# Database Failover Runbook

**Audience:** Database administrators, platform ops
**Last updated:** 2026-04-28 (Plan 12-05)
**Related:** `docs/runbooks/backup-restore.md`, `docs/runbooks/dr-drill.md`, `scripts/pgbackrest-restore.sh`, `docs/runbooks/pgbouncer-rls.md`

---

## Overview

This runbook covers per-agency Postgres failover using pgBackRest + PgBouncer for the MJAgency platform. All 13 agency databases (brand, ecommerce, growth, webdev, ai, branding, strategy, finance, engineering, product, video, graphic, and shared platform DB) reside on the shared Postgres 17 instance.

**SLA targets (PROJECT.md):** RPO 1h, RTO 4h.

**Key infrastructure:**
- Backup tool: pgBackRest (`infra/pgbackrest/pgbackrest.conf`)
- Backup storage: Cloudflare R2 bucket `mjagency-backups`
- Connection pooler: PgBouncer (credentials managed in Doppler)
- Restore script: `scripts/pgbackrest-restore.sh`
- Config generator: `scripts/gen-pgbackrest-config.sh`

**Agency database names:**

| Agency slug | Database name |
|-------------|---------------|
| web-ecommerce | `ecommerce_db` |
| web-realestate | `realestate_db` |
| web-healthcare | `healthcare_db` |
| web-legal | `legal_db` |
| web-homeservices | `homeservices_db` |
| web-fitness | `fitness_db` |
| web-dental | `dental_db` |
| web-automotive | `automotive_db` |
| web-restaurant | `restaurant_db` |
| web-education | `education_db` |
| web-financial | `financial_db` |
| web-petcare | `petcare_db` |
| web-main (brand) | `brand_db` |

---

## Prerequisites

### Required access
- SSH access to production VPS
- pgBackRest installed at `/usr/local/bin/pgbackrest`
- Doppler super_admin (`doppler login` completed)
- R2 credentials (`R2_ACCESS_KEY`, `R2_SECRET_KEY` in Doppler)
- `PGBACKREST_CIPHER_PASS` in Doppler (shared project → prd config)

### Verify pgBackRest connectivity before failover

```bash
# Confirm R2 connectivity and backup is reachable
doppler run --project mjagency-shared --config prd -- \
  pgbackrest --stanza=postgres-main \
  --config=/etc/pgbackrest/pgbackrest.conf \
  info
```

Expected: backup info listing with a recent backup timestamp (within last 24 hours for daily incrementals).

### Check current backup status

```bash
# List available backups (latest first)
doppler run --project mjagency-shared --config prd -- \
  pgbackrest --stanza=postgres-main \
  --config=/etc/pgbackrest/pgbackrest.conf \
  info --output=json | jq '.[0].backup | sort_by(.timestamp.stop) | reverse | .[0:3]'
```

---

## Procedure

### Step 1 — Confirm primary is down

```bash
# Attempt connection to Postgres via direct URL
psql "$DATABASE_URL_DIRECT" -c "SELECT NOW(), pg_is_in_recovery();"
```

If this command hangs or returns `connection refused`, the primary is down. Proceed to Step 2.

If it returns `pg_is_in_recovery = true`, the primary is a standby — check the actual primary host.

```bash
# Check PostgreSQL service status on VPS
sudo systemctl status postgresql
sudo journalctl -u postgresql --since "30 minutes ago" | tail -50
```

### Step 2 — Promote replica if hot standby is configured

If a hot standby replica was provisioned and is running:

```bash
# Check if standby is in recovery mode
psql "host=<STANDBY_HOST> dbname=postgres user=postgres" -c "SELECT pg_is_in_recovery();"
# Should return: t

# Promote replica to primary
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/17/main
# Or via Postgres 12+ function:
psql "host=<STANDBY_HOST> dbname=postgres user=postgres" -c "SELECT pg_promote();"
```

Confirm promotion:
```bash
psql "host=<STANDBY_HOST> dbname=postgres user=postgres" -c "SELECT pg_is_in_recovery();"
# Must return: f  (false = primary mode)
```

If no hot standby is available, proceed directly to Step 3 (restore from pgBackRest).

### Step 3 — Restore from pgBackRest

```bash
# 1. Stop PostgreSQL on the recovery host (or production host if doing in-place restore)
sudo systemctl stop postgresql

# 2. Restore the latest backup for a specific agency (all DBs on same instance)
#    Use --delta for speed if data directory exists; omit for clean restore
bash scripts/pgbackrest-restore.sh --latest

# 3. For Point-in-Time Recovery to a specific timestamp:
bash scripts/pgbackrest-restore.sh --target='2026-04-28 14:30:00'

# 4. Start PostgreSQL — enters WAL replay recovery
sudo systemctl start postgresql

# 5. Monitor recovery progress
tail -f /var/log/postgresql/postgresql-17-main.log | grep -E "recovery|started|ready"
```

Recovery completes when you see: `database system is ready to accept connections`

To check all agency databases accessible after restore:
```bash
psql -h 127.0.0.1 -p 5432 -U postgres -c "\l" | grep -E "_db"
```

All 13 `_db` databases must be listed.

### Step 4 — Update PgBouncer connection string in Doppler

After failover, update PgBouncer to point to the new primary host:

```bash
# Update the primary host in Doppler (shared config)
doppler secrets set PGBOUNCER_PRIMARY_HOST=<new-primary-host> \
  --project mjagency-shared --config prd

# Update per-agency DATABASE_URL if direct connection URL changed
doppler secrets set DATABASE_URL="postgresql://app_user:<pass>@<new-host>:5432/<agency_db>?pgbouncer=true" \
  --project mjagency-{slug} --config prd
```

Regenerate pgBackRest config to point to new primary for WAL archiving:
```bash
doppler run --project mjagency-shared --config prd -- \
  bash scripts/gen-pgbackrest-config.sh
# Copy updated config to /etc/pgbackrest/pgbackrest.conf
sudo cp infra/pgbackrest/pgbackrest.conf /etc/pgbackrest/pgbackrest.conf
```

### Step 5 — Restart agency apps via PM2

```bash
# Restart a single agency app after updating DATABASE_URL
pm2 restart web-{slug}

# Restart all agency apps after platform-wide failover
pm2 restart all

# Verify app is running
pm2 status | grep web-
```

Watch app logs for DB connection errors:
```bash
pm2 logs web-{slug} --lines 30
```

---

## Verification

1. **Database direct connection:**
   ```bash
   psql "$DATABASE_URL_DIRECT" -c "SELECT NOW(), current_database(), pg_is_in_recovery();"
   ```
   Expected: current timestamp, database name, and `f` (not in recovery = primary).

2. **Agency app health check:**
   ```bash
   curl -s "https://{agency-slug}.mjagency.com/api/health"
   # Expected: {"status":"ok","db":"connected","redis":"connected"}
   ```

3. **All 13 DBs accessible:**
   ```bash
   psql -h 127.0.0.1 -U postgres -c "\l" | grep _db | wc -l
   # Expected: 13
   ```

4. **RLS isolation still enforced (run on restored instance):**
   ```bash
   pnpm --filter=@mjagency/db vitest run src/__tests__/rls.integration.test.ts
   ```

5. **Audit chain integrity after restore:**
   ```bash
   pnpm tsx scripts/verify-audit-chain.ts --all
   ```
   Expected: exit code 0 (all chains intact).

---

## Failure Diagnostics

**Symptom:** `pgbackrest info` shows no recent backups (last backup > 24h ago).
**Check:** Check WAL archiving status: `psql "$DATABASE_URL_DIRECT" -c "SELECT * FROM pg_stat_archiver;"`. Look at `failed_count` and `last_failed_msg`.
**Fix:** If archive is failing, R2 credentials may have expired. Re-run `scripts/gen-pgbackrest-config.sh` and copy to `/etc/pgbackrest/pgbackrest.conf`. Then trigger a manual backup: `sudo -u postgres pgbackrest --stanza=postgres-main --type=incr backup`.

**Symptom:** Restore exits with "cipher pass mismatch".
**Check:** `PGBACKREST_CIPHER_PASS` in Doppler may have been rotated. The restore requires the passphrase that was active when the backup was created.
**Fix:** Restore the previous passphrase from Doppler (`PGBACKREST_CIPHER_PASS_PREV` if set) and re-run the restore. See `docs/runbooks/backup-restore.md` Cipher Pass section.

**Symptom:** PostgreSQL starts but immediately enters crash recovery loop.
**Check:** `/var/log/postgresql/postgresql-17-main.log` — look for "invalid page" or "could not read block" errors indicating file corruption.
**Fix:** Re-run restore without `--delta` flag to force a full file replace: `bash scripts/pgbackrest-restore.sh --latest --no-delta`. Ensure the data directory is owned by `postgres:postgres`: `chown -R postgres:postgres /var/lib/postgresql/17/main`.

**Symptom:** PgBouncer connection refused after updating primary host.
**Check:** `sudo systemctl status pgbouncer` and `cat /var/log/pgbouncer/pgbouncer.log | tail -30`.
**Fix:** Restart PgBouncer after updating its config: `sudo systemctl restart pgbouncer`. Verify `PGBOUNCER_PRIMARY_HOST` in Doppler matches the new primary VPS IP/hostname.

**Symptom:** `pm2 restart web-{slug}` fails, app crashes on startup.
**Check:** `pm2 logs web-{slug} --lines 50` — look for `DATABASE_URL_DIRECT` connection errors or `ECONNREFUSED`.
**Fix:** Confirm the new DATABASE_URL in Doppler: `doppler secrets get DATABASE_URL --project mjagency-{slug} --config prd`. Ensure PgBouncer is listening and the agency DB exists on the restored instance.
