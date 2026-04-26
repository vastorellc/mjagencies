---
phase: 02-multi-tenant-db
plan: "05"
subsystem: backup-dr
tags: [pgbackrest, r2, wal, aes-256-cbc, zstd, pitr, dr-drill, runbooks]
dependency_graph:
  requires: [01-04-media-r2-client, 01-01-foundation-infra, 02-01-db-migrations]
  provides: [pgbackrest-config, wal-archiving, 3-tier-cron-backup, pitr-restore, r2-smoke-test, dr-drill-script, backup-restore-runbook, dr-drill-runbook]
  affects: [phase-12-launch-checklist, 02-06-permissions-vault-retention]
tech_stack:
  added: [pgbackrest-config-templates, envsubst-generator-pattern]
  patterns: [deploy-time-config-generation, dynamic-import-env-guard, wal-archive-push, 3-tier-retention]
key_files:
  created:
    - infra/pgbackrest/pgbackrest.conf.tmpl
    - infra/pgbackrest/pgbackrest.conf
    - infra/pgbackrest/postgresql.archive.conf
    - infra/pgbackrest/cron/pgbackrest-daily.sh
    - infra/pgbackrest/cron/pgbackrest-weekly.sh
    - infra/pgbackrest/cron/pgbackrest-monthly.sh
    - infra/pgbackrest/cron/crontab
    - scripts/gen-pgbackrest-config.sh
    - scripts/pgbackrest-restore.sh
    - scripts/pgbackrest-verify-r2.ts
    - scripts/pgbackrest-dr-drill.sh
    - docs/runbooks/backup-restore.md
    - docs/runbooks/dr-drill.md
  modified:
    - .env.example
decisions:
  - "Open Q3 resolved: single R2 bucket mjagency-backups with /postgres-main path prefix (simpler IAM, cheaper, per-agency separation exists at DB layer)"
  - "Cipher: AES-256-CBC via pgBackRest repo1-cipher-type (pgBackRest does not support AES-GCM at repo level; Plan 02-06 uses AES-GCM at application layer for permissions_vault independently)"
  - "Retention: WAL 1095d (3yr), daily-incr 30d, weekly-diff 90d, monthly-full 84mo (7yr aligns REQ-018)"
  - "pgbackrest-verify-r2.ts uses dynamic imports after env guard so process.exit(2) fires before module resolution in CI without R2 creds"
  - "DR drill crontab uses direct pgbackrest invocations per locked RESEARCH interface; shell wrappers provide logger piping for ops flexibility"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-26T05:17:51Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 13
  files_modified: 1
---

# Phase 02 Plan 05: pgBackRest R2 Backups + DR Drill Summary

pgBackRest config, WAL archiving, 3-tier snapshot cron, AES-256-CBC encryption, PITR restore tool, R2 smoke test via `@mjagency/media`, quarterly DR drill script, and two operator runbooks — all deploy-time-ready for the shared Postgres 17 instance.

---

## What Was Built

### pgBackRest Configuration

**`infra/pgbackrest/pgbackrest.conf.tmpl`** — Source-of-truth config template (locked from RESEARCH §4.2 with Open Q3 resolution):
- `repo1-type=s3`, `repo1-s3-region=auto`, endpoint `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
- Single bucket `mjagency-backups`, path prefix `/postgres-main`
- `repo1-cipher-type=aes-256-cbc`, `repo1-cipher-pass=${PGBACKREST_CIPHER_PASS}` (Doppler)
- `compress-type=zstd`, `compress-level=3`, `process-max=4`
- Retention: `repo1-retention-full=84` (7yr), `repo1-retention-diff=12`, `repo1-retention-archive=1095` (3yr WAL)
- Stanza `[postgres-main]`: `pg1-path=/var/lib/postgresql/17/main`, `pg1-port=5432`

**`infra/pgbackrest/pgbackrest.conf`** — Generated runtime config (committed with `__SET_VIA_DOPPLER__` placeholders, proving the generator ran; proves structure without exposing creds).

**`infra/pgbackrest/postgresql.archive.conf`** — WAL archive fragment for provisioning:
```ini
archive_mode = on
archive_command = 'pgbackrest --stanza=postgres-main --config=/etc/pgbackrest/pgbackrest.conf archive-push %p'
archive_timeout = 60
max_wal_senders = 3
wal_level = replica
```
Append to `/etc/postgresql/17/main/postgresql.conf` at VPS provisioning time.

### 3-Tier Cron Backup Schedule

| Script | Type | Schedule | Retention |
|--------|------|----------|-----------|
| `pgbackrest-daily.sh` | `--type=incr` | 02:00 UTC daily | 30 days |
| `pgbackrest-weekly.sh` | `--type=diff` | 03:00 UTC Sunday | 90 days |
| `pgbackrest-monthly.sh` | `--type=full` | 04:00 UTC 1st of month | 7 years |

All three scripts pipe via `logger -t pgbackrest-<tier>` (Loki-visible via Plan 01-04 promtail).

**`infra/pgbackrest/cron/crontab`** — Direct pgbackrest invocations with `--type=incr/diff/full`. Install with `crontab -u postgres infra/pgbackrest/cron/crontab`.

### Operator Scripts

**`scripts/gen-pgbackrest-config.sh`** — Idempotent envsubst generator:
- Sources `.env` if present, applies `__SET_VIA_DOPPLER__` fallback for unset vars.
- Renders `pgbackrest.conf.tmpl` → `pgbackrest.conf` via `envsubst` (scoped to 4 vars only).
- Sets `+x` on the three cron shell scripts as a side effect.
- Idempotent: re-running with identical env produces zero diff (verified).

**`scripts/pgbackrest-restore.sh`** — PITR + delta restore operator tool:
- Flags: `--target=<TIMESTAMP>` (PITR), `--stanza=<NAME>` (default `postgres-main`), `--delta`, `--help`.
- `--help` exits 0 before any system calls.
- PITR path: `pgbackrest restore --target=<ts> --target-action=promote`.

**`scripts/pgbackrest-dr-drill.sh`** — Quarterly DR drill (see below).

### R2 Smoke Test

**`scripts/pgbackrest-verify-r2.ts`** — Uses `createR2Client` from `@mjagency/media` (Phase 1):
- **Dynamic import pattern:** `process.exit(2)` guard fires before `@mjagency/media` import resolution, so CI without R2 creds exits cleanly with code 2 (skip) rather than crashing on module not found.
- Writes probe object `probes/pgbackrest-verify-<ts>.txt`, reads it back, asserts body `ok`.
- Lists `archive/postgres-main/` prefix using a direct `S3Client` (`ListObjectsV2Command`) — deliberately bypasses `createR2Client` for the list call because the Phase-1 R2 client interface exposes only put/get/signedUrl (not list). This Phase-1 API gap is tracked for M005.
- Exits 0 success, 1 failure, 2 skip (no creds).

### DR Drill Script

**`scripts/pgbackrest-dr-drill.sh`** — Quarterly DR validation (REQ-017):
1. Stops staging Postgres + clears data dir.
2. Restores latest R2 backup via `pgbackrest-restore.sh --stanza=postgres-staging --delta`.
3. Starts Postgres (WAL replay recovery).
4. Verifies 13 agency DBs via `psql`.
5. Runs `migrate-runner --dry-run --all`.
6. Measures total elapsed time vs RTO target (14400s / 4h).
7. Writes `PASS` (exit 0) or `FAIL` (exit 1) to `.dr-drill/<timestamp>/SUMMARY.md`.
- `--help` short-circuits before any sudo/systemctl calls (exits 0).

### Runbooks

**`docs/runbooks/backup-restore.md`** — Daily operations runbook covering:
- Overview (pgBackRest features, SLA targets)
- Schedule table (WAL + 3 tiers)
- Retention bands table
- Restore procedure (latest + PITR)
- PITR limitations (60s granularity, 3yr window, cross-agency constraint)
- Cipher pass rotation procedure (new full backup → expiry of old)
- R2 access keys rotation procedure
- Smoke testing instructions
- Bandwidth estimates (R2 egress-free)
- Failure diagnostics (5 scenarios with fixes)

**`docs/runbooks/dr-drill.md`** — Quarterly DR drill procedure covering:
- Overview + SLA reference (RPO 1h, RTO 4h)
- Cadence table (Q1–Q4 dates for 2026/2027)
- Prerequisites (staging host, stanza, Doppler, disk)
- Procedure (automated script + expected output files)
- Manual verification steps (4 numbered steps: `\l`, RLS test, PgBouncer RLS, schema diff)
- What "PASS" means (5 criteria)
- Failure scenarios (WAL gap, missing DBs, schema drift, RTO exceeded — each with fix)
- Phase 12 gate criteria (90-day validity window)

### Environment Variables Added

`.env.example` additions (4 new vars):
```
R2_ACCOUNT_ID=replace-via-doppler
R2_ACCESS_KEY=replace-via-doppler
R2_SECRET_KEY=replace-via-doppler
PGBACKREST_CIPHER_PASS=replace-via-doppler
```

---

## Plan-Time Decisions

| Decision | Detail |
|----------|--------|
| Open Q3 resolved | Single bucket `mjagency-backups` with `/postgres-main` path prefix. Per-agency separation exists at the DB layer; backup-layer separation adds IAM complexity without benefit at this scale. |
| Cipher at repo level | AES-256-CBC via pgBackRest `repo1-cipher-type` — pgBackRest does not support AES-GCM at repo level. Plan 02-06 uses AES-GCM independently at the application layer for the permissions_vault. These are orthogonal encryption layers. |
| 7-year monthly full | Retention `repo1-retention-full=84` (84 months = 7 years) aligns with REQ-018 vault retention. If Plan 02-06 vault retention changes, update `pgbackrest.conf.tmpl`. |
| Cron host | Same VPS as Postgres 17. Cron entries in `infra/pgbackrest/cron/crontab` committed; operator installs at deploy time. |
| No binary installation | This plan ships configs and scripts. pgBackRest binary installation is a deploy-time/infra task gated by Phase 12 launch readiness. |

---

## Limits / Known Constraints

- **pgBackRest binary not in dev sandbox** — Configs and scripts ship as deploy-time artifacts. Verify steps test config syntax, generator idempotency, and script `--help` exit codes; not actual backup execution.
- **pgbackrest-verify-r2.ts R2 list API gap** — The `createR2Client` from `@mjagency/media` does not expose `listObjects`. The smoke test uses a direct `S3Client` for the list call. Tracked for M005 if a generic list method is needed more broadly.
- **Cross-agency PITR** — All 13 agency DBs share one Postgres instance and one backup stream. PITR restores all simultaneously; per-agency PITR is not supported at this architecture level.

---

## Files Phase 12 Launch Will Consume

| File | Purpose at Phase 12 |
|------|-------------------|
| `scripts/pgbackrest-dr-drill.sh` | Mandatory quarterly DR drill — must produce PASS within 90 days before launch |
| `docs/runbooks/dr-drill.md` | Phase 12 launch checklist DR gate criteria and procedure |
| `docs/runbooks/backup-restore.md` | Ops reference for ongoing daily backup management post-launch |
| `infra/pgbackrest/pgbackrest.conf.tmpl` | Rendered to `/etc/pgbackrest/pgbackrest.conf` during VPS provisioning |
| `infra/pgbackrest/postgresql.archive.conf` | Appended to `postgresql.conf` during VPS provisioning |
| `infra/pgbackrest/cron/crontab` | Installed with `crontab -u postgres` during VPS provisioning |

---

## Deviations from Plan

None — plan executed exactly as written.

One implementation note (not a deviation): `scripts/pgbackrest-verify-r2.ts` uses dynamic imports (`await import('@mjagency/media')`) inside `main()` rather than top-level static imports. This is required because ESM static imports are resolved before code execution, making a `process.exit(2)` guard at the top of the file ineffective. The dynamic import pattern is functionally equivalent and is the correct approach for env-guarded module loading in Node.js/tsx.

---

## Threat Model Compliance

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-02-012 (I — backup files readable) | `repo1-cipher-type=aes-256-cbc` + Doppler-managed cipher pass; R2 keys scoped to single bucket | Implemented in `pgbackrest.conf.tmpl` |
| T-02-013 (T — backup tampering) | pgBackRest SHA-256 manifest verification on restore; runbook documents R2 versioning (manual bucket config) | Documented in `backup-restore.md` |
| T-02-014 (D — VPS resource exhaustion) | `compress-type=zstd compress-level=3`; `process-max=4`; full backups at 04:00 UTC (lowest traffic) | Implemented in `pgbackrest.conf.tmpl` + crontab |

---

## Self-Check

**Created files exist:**
- `infra/pgbackrest/pgbackrest.conf.tmpl` — FOUND
- `infra/pgbackrest/pgbackrest.conf` — FOUND
- `infra/pgbackrest/postgresql.archive.conf` — FOUND
- `infra/pgbackrest/cron/pgbackrest-daily.sh` — FOUND
- `infra/pgbackrest/cron/pgbackrest-weekly.sh` — FOUND
- `infra/pgbackrest/cron/pgbackrest-monthly.sh` — FOUND
- `infra/pgbackrest/cron/crontab` — FOUND
- `scripts/gen-pgbackrest-config.sh` — FOUND
- `scripts/pgbackrest-restore.sh` — FOUND
- `scripts/pgbackrest-verify-r2.ts` — FOUND
- `scripts/pgbackrest-dr-drill.sh` — FOUND
- `docs/runbooks/backup-restore.md` — FOUND
- `docs/runbooks/dr-drill.md` — FOUND

**Commits exist:**
- `9ee7940` feat(02-05): pgbackrest config + cron + restore + R2 smoke test (Task 5.1)
- `7a0d24c` docs(02-05): pgbackrest dr-drill script + backup + dr runbooks (Task 5.2)

## Self-Check: PASSED
