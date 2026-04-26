# DR Drill Runbook — Quarterly Disaster Recovery Drill

**Audience:** Lead engineer responsible for executing the quarterly DR drill.  
**Last updated:** 2026-04-25 (Plan 02-05)  
**Related:** `scripts/pgbackrest-dr-drill.sh`, `docs/runbooks/backup-restore.md`, Phase 12 launch checklist

---

## Overview

The quarterly DR drill validates that the platform can be fully restored from R2 backups within the SLA RTO of 4 hours and RPO of 1 hour (PROJECT.md). This drill is mandatory per REQ-017 and is a hard gate in the Phase 12 launch checklist — the platform cannot go live unless the most recent drill produced a PASS result within the prior 90 days.

The drill exercises the full recovery pipeline:
1. Restore from R2 to a staging Postgres host.
2. Verify all 13 agency databases are accessible.
3. Run dry-run migrations to confirm schema parity.
4. Measure total RTO.

A PASS means the entire procedure completed within the 4-hour SLA window with all databases accessible and zero unexpected pending migrations.

---

## Cadence

Run on the **first Monday of January, April, July, and October** (quarterly).

| Quarter | Target date (2026) | Target date (2027) |
|---------|-------------------|-------------------|
| Q1 | 2026-01-05 | 2027-01-04 |
| Q2 | 2026-04-06 | 2027-04-05 |
| Q3 | 2026-07-06 | 2027-07-05 |
| Q4 | 2026-10-05 | 2027-10-04 |

After completing each drill, post the `.dr-drill/<timestamp>/SUMMARY.md` result to the team runbook channel and archive it in the project's shared drive (or internal wiki).

---

## Prerequisites

Before running the drill:

1. **Staging Postgres host** — a separate VPS or VM from the production host. The staging data directory (`/var/lib/postgresql/17/staging`) must be empty or willing to be wiped. **Do not run this against the production Postgres data dir.**

2. **pgBackRest installed** on the staging host at `/usr/local/bin/pgbackrest`.

3. **Staging stanza configured** — the staging Postgres host needs `/etc/pgbackrest/pgbackrest.conf` with a `[postgres-staging]` stanza pointing to the same R2 bucket (`mjagency-backups`) and the same cipher pass. Generate it with:
   ```bash
   doppler run -- bash scripts/gen-pgbackrest-config.sh
   ```
   Then copy to the staging host's `/etc/pgbackrest/pgbackrest.conf`.

4. **Doppler credentials injected** on the staging host:
   - `PGBACKREST_CIPHER_PASS`
   - `R2_ACCESS_KEY`
   - `R2_SECRET_KEY`

5. **pnpm available** on the staging host for the migration dry-run step.

6. **Sufficient disk space** — the restore requires at least the size of the most recent full backup plus accumulated WAL (estimate: 2–10 GB).

---

## Procedure

Run the automated drill script. It handles all steps and writes output to `.dr-drill/<timestamp>/`.

```bash
bash scripts/pgbackrest-dr-drill.sh
```

The script will:
1. Stop staging Postgres + clear the data directory.
2. Restore the latest backup from R2 (with `--delta` for speed on repeat drills).
3. Start Postgres (enters WAL replay recovery).
4. Verify the 13 agency databases are accessible via `psql`.
5. Run `migrate-runner --dry-run --all` to confirm schema parity.
6. Measure total elapsed time, compare to RTO target (14400s / 4h), and write the PASS/FAIL verdict to `.dr-drill/<timestamp>/SUMMARY.md`.

**Expected output files:**

| File | Description |
|------|-------------|
| `.dr-drill/<ts>/restore.log` | pgBackRest restore output |
| `.dr-drill/<ts>/migrate-dry-run.log` | Migration dry-run output |
| `.dr-drill/<ts>/SUMMARY.md` | RTO measurement + PASS/FAIL |

---

## Manual Verification Steps

After the script completes (even if it exits 0), perform these manual checks to confirm full recovery quality:

1. **Verify all 13 agency databases are present:**
   ```bash
   psql -h 127.0.0.1 -p 5432 -U postgres -c "\l"
   ```
   Assert: `brand_db`, `ecommerce_db`, `growth_db`, `webdev_db`, `ai_db`, `branding_db`, `strategy_db`, `finance_db`, `engineering_db`, `product_db`, `video_db`, `graphic_db` all appear.

2. **Run RLS isolation test against staging:**
   ```bash
   pnpm --filter=@mjagency/db vitest run src/__tests__/rls.integration.test.ts
   ```
   Assert: all RLS isolation tests pass. No cross-tenant data leaks.

3. **Verify PgBouncer RLS on staging:**
   ```bash
   pnpm tsx scripts/verify-pgbouncer-rls.ts
   ```
   Assert: no cross-tenant leaks reported. (Configure `PGBOUNCER_HOST`/`PGBOUNCER_PORT` env vars to point at staging PgBouncer instances.)

4. **Schema equivalence check (staging vs prod):**
   ```bash
   # Dump schema from staging
   pg_dump -h 127.0.0.1 -U postgres --schema-only brand_db > /tmp/staging-schema.sql
   # Dump schema from production (read-only replica or direct if safe)
   pg_dump -h <PROD_HOST> -U postgres --schema-only brand_db > /tmp/prod-schema.sql
   # Compare
   diff /tmp/staging-schema.sql /tmp/prod-schema.sql
   ```
   Assert: zero structural differences. Any diff indicates a pending migration that was not applied to prod.

---

## What "PASS" Means

A drill result is PASS when ALL of the following are true:

- Restore completed without error (pgbackrest exit 0).
- All 13 agency databases are accessible via `psql`.
- `migrate-runner --dry-run --all` exits 0 with 0 unexpected pending migrations.
- RLS integration test passes (no cross-tenant leaks).
- Total drill time is under 14400 seconds (4 hours).

A PASS result is valid for 90 days from the drill date. The Phase 12 launch checklist requires a valid PASS before the platform goes live.

---

## Failure Scenarios

### Partial Restore (WAL Gap)

**Symptom:** pgBackRest restore exits with "unable to find WAL segment" or similar.  
**Cause:** WAL archive has a gap — likely caused by a temporary R2 connectivity failure during WAL archiving.  
**Fix:**
1. Re-run without `--delta` to force a clean full restore:
   ```bash
   bash scripts/pgbackrest-restore.sh --stanza=postgres-staging
   ```
2. Check `pg_stat_archiver.failed_count` and `last_failed_msg` on the production host to understand the root cause of the WAL gap.

### Missing Agency Databases

**Symptom:** `\l` shows fewer than 13 agency databases after restore.  
**Cause 1:** R2 keys are wrong (backed up with different credentials) — cipher pass mismatch.  
**Fix 1:** Verify `PGBACKREST_CIPHER_PASS` in Doppler matches what was used for the backup. Check pgBackRest logs for cipher errors.  
**Cause 2:** The most recent full backup predates the creation of some agency databases.  
**Fix 2:** Check `pgbackrest info --stanza=postgres-main` for backup timestamps. If the DBs were created after the last full, restore from a more recent backup or restore prod WAL to the agency DB creation time.

### Schema Drift (Unexpected Pending Migrations)

**Symptom:** `migrate-runner --dry-run` reports pending migrations that are not expected.  
**Cause:** A migration was applied to prod but not committed to the migrations source directory in the repo.  
**Fix:**
1. Identify the pending migration from the dry-run log.
2. Compare `schema_migrations` table in staging vs prod:
   ```bash
   psql -h 127.0.0.1 -U postgres brand_db -c "SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;"
   ```
3. Locate the missing migration file and commit it to the repo. This is a process gap — migrations must always be committed before being applied to prod.

### RTO Exceeded (Total > 4h)

**Symptom:** Drill reports FAIL with `TOTAL_DURATION_S >= 14400`.  
**Cause:** Restore is slow — typically due to large accumulated WAL or a very large data directory.  
**Recommendations:**
1. Enable `--delta` restore (already used in the script) — ensures only changed blocks are transferred.
2. Increase `process-max` in `pgbackrest.conf` if the VPS has spare CPU (current: 4).
3. Review the monthly full backup size. If it exceeds 10 GB, consider pgBackRest's `--bundle` option or splitting the restore across tablespaces.
4. Run the drill at off-peak hours to maximize available I/O bandwidth.

---

## Phase 12 Gate

The Phase 12 launch checklist will not pass unless:

1. The most recent DR drill is a **PASS** result.
2. The drill was run **within the prior 90 days** of the launch date.
3. The `.dr-drill/<timestamp>/SUMMARY.md` file is accessible and shows `Status: PASS`.
4. All 13 agency DBs were confirmed accessible in the drill.
5. The RLS integration test passed against the restored staging instance.

If the most recent drill result is FAIL, or more than 90 days old, run a new drill and resolve any failures before proceeding with Phase 12 go-live.
