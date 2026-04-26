# Migrations Runbook

## Overview

Single source of truth for applying the MJAgency Phase 2 schema across all 13 agency databases.
The migration runner connects **directly to Postgres on port 5432** (bypassing PgBouncer) using the
`migrations_runner` role (BYPASSRLS, provisioned in `infra/postgres/init.sql`).

This runbook covers:
- Prerequisites (roles, secrets, pg_dump)
- Daily dev → stage → prod flow
- Canary procedure (brand first, then fan-out)
- Snapshot and rollback procedure
- Rollback strategy limitation
- Custom DDL apply order
- Diagnosing failures from `Promise.allSettled` output
- Why direct port 5432 (and not PgBouncer)
- CI gate configuration

---

## Prerequisites

### Postgres role

The `migrations_runner` role must exist with BYPASSRLS privilege. It is provisioned by
`infra/postgres/init.sql` (the Docker Compose or VPS Postgres init script from Plan 02-01).

```sql
-- Verify role exists:
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'migrations_runner';
-- Expected: one row with rolbypassrls = true
```

### MIGRATIONS_DB_PASSWORD secret

The runner reads `MIGRATIONS_DB_PASSWORD` from the environment. This is a shared-project
Doppler secret (project: `mjagency-shared`, config: `dev` / `stg` / `prd`).

- **CI/prod:** inject via `doppler run --project=mjagency-shared -- pnpm tsx scripts/migrate-runner.ts`
- **Local dev:** `export MIGRATIONS_DB_PASSWORD=<value>` (get value from Doppler UI or a team member)

The runner fails fast with a clear error message if this variable is not set.

### pg_dump and psql

Required for `--snapshot-before` and `scripts/migrate-rollback.ts`.

```bash
# Verify available:
pg_dump --version
psql --version
```

On Ubuntu/Debian: `sudo apt install postgresql-client`
On macOS: `brew install libpq && brew link libpq --force`

### PgBouncer not required

Migrations do NOT go through PgBouncer. The runner connects directly to Postgres on port 5432.
PgBouncer must be running for application traffic, but does not affect migration execution.

---

## Daily Flow

### Development

```bash
# 1. Preview pending migrations (safe — does not apply)
pnpm db:migrate:dry

# 2. Review output. If all agencies show "0 pending", nothing to do.

# 3. Apply schema
pnpm db:migrate

# Output:
# [migrate-runner] brand: OK
# [migrate-runner] ecommerce: OK
# ... (13 lines)
# [migrate-runner] 13/13 OK
```

### Stage / Production

Always use canary + snapshot in non-dev environments:

```bash
# Snapshot current schema + canary deploy
pnpm tsx scripts/migrate-runner.ts --canary --snapshot-before

# Flow:
# 1. pg_dump --schema-only for all 13 DBs → .snapshots/<timestamp>/
# 2. Apply to brand_db
# 3. Prompt: "Proceed with remaining 12 agencies? [Y/n]"
# 4. On ENTER/y: fan out to remaining 12 in parallel
```

---

## Canary Procedure

The canary mode applies migrations to `brand` first, prints the result, and waits for
operator confirmation before fanning out to the remaining 12 agencies in parallel.

```
[migrate-runner] canary: applying migrations to brand_db first...
[migrate-runner] canary: brand OK

[migrate-runner] canary: Brand migration succeeded. Proceed with remaining 12 agencies? [Y/n]
> [ENTER]

[migrate-runner] ecommerce: OK
[migrate-runner] growth: OK
... (12 more)
[migrate-runner] 12/12 OK
```

If you type `n` at the prompt, the runner exits with code 1. The remaining 12 agencies retain
their pre-migration schema. Re-run with `--all` after fixing the issue.

**Best practice:** Always use `--canary --snapshot-before` together in stage/prod so you have a
rollback artifact if the brand migration reveals problems.

---

## Snapshot + Rollback Procedure

### Taking a snapshot

```bash
# Snapshot is taken automatically with --snapshot-before:
pnpm tsx scripts/migrate-runner.ts --snapshot-before --all

# Or during canary:
pnpm tsx scripts/migrate-runner.ts --canary --snapshot-before

# Snapshot directory:
ls .snapshots/
# 2026-04-25T10-30-00-000Z/
#   brand.sql
#   ecommerce.sql
#   ... (13 files)
```

### Rolling back

```bash
# Roll back all agencies from a snapshot:
pnpm tsx scripts/migrate-rollback.ts .snapshots/2026-04-25T10-30-00-000Z

# Roll back a single agency:
pnpm tsx scripts/migrate-rollback.ts .snapshots/2026-04-25T10-30-00-000Z --agency=ecommerce

# Output:
# [migrate-rollback] Rolling back 13 DB(s) from snapshot: ...
# [migrate-rollback] WARNING: This operation re-applies the snapshot schema. Ensure data backup.
# [migrate-rollback] brand: applying snapshot...
# [migrate-rollback] brand: OK
# ...
```

The rollback applies the snapshot schema via `psql -f <slug>.sql --single-transaction`.

---

## Rollback Strategy Limitation

**Drizzle ORM does not generate down migrations.**

The `--snapshot-before` flag captures the schema state BEFORE a migration runs.
`scripts/migrate-rollback.ts` re-applies that snapshot. This restores table definitions.

**Data preservation:** The `--schema-only` snapshot does NOT include row data.
- If the migration only adds columns/tables (non-destructive), data is preserved during rollback
  because the schema snapshot DROP + CREATE cycle recreates the table structure but leaves
  existing rows intact (assuming psql `-f` runs `ALTER TABLE` not `DROP TABLE`).
- **If the migration dropped a column or table:** data in those structures is lost. In this
  case, restore from a full backup (see Plan 02-05 backup runbook: `pgbackrest restore`).

**Practical rule:** For any migration that includes `DROP TABLE`, `ALTER TABLE ... DROP COLUMN`,
or other destructive operations, take a full backup BEFORE running the migration:
```bash
# Full backup before destructive migration
pgbackrest --stanza=brand backup --type=full
# Then apply migration
pnpm tsx scripts/migrate-runner.ts --canary --snapshot-before
```

---

## Custom DDL Apply Order

The runner applies migrations in this exact sequence per agency DB:

1. **Drizzle-kit generated files** via `migrate(db, { migrationsFolder })` from `drizzle-orm/postgres-js/migrator`
   - Currently: `packages/db/src/migrations/0000_initial.sql`
   - All future drizzle-kit generated files are applied in sorted order by drizzle-kit's journal.
   - Creates: all 6 tables, `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY` for users/sessions/permissions_vault.

2. **`custom/001_agency_id_immutable.sql`** — immutability triggers
   - `CREATE OR REPLACE FUNCTION prevent_agency_id_change()`
   - `BEFORE UPDATE OF agency_id` triggers on users, sessions, permissions_vault
   - Idempotent: `DROP TRIGGER IF EXISTS` before each CREATE.

3. **`custom/002_force_rls_and_app_role.sql`** — FORCE RLS + per-agency grants
   - `ALTER TABLE ... FORCE ROW LEVEL SECURITY` on users, sessions, permissions_vault
   - `REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC` (append-only enforcement)
   - DML grants: `GRANT ... TO <slug>_user` (runner substitutes `:'app_role'` → `<slug>_user`)

**Template substitution:** The runner replaces `:'app_role'` with `<slug>_user` before applying
`002_force_rls_and_app_role.sql`. For example, for the `ecommerce` agency: `ecommerce_user`.

**Plan 02-06 extensions:** The `CUSTOM_FILES` array in `packages/db/src/migrate/apply-custom.ts`
will be extended to add `003_audit_triggers.sql` and `004_partition_audit_log.sql`.

---

## Diagnosing Failures

The runner uses `Promise.allSettled` so ALL agencies attempt migration even if one fails.
After all settle, a summary table is printed:

```
[migrate-runner] brand: OK
[migrate-runner] ecommerce: FAILED — Error: connect ECONNREFUSED 127.0.0.1:5432
[migrate-runner] growth: OK
...
[migrate-runner] 12/13 OK
```

Per-agency transactions mean: the failed agency stays at its pre-migration state; the other
12 have the new schema. Re-run after fixing the issue (Drizzle migrations are idempotent for
already-applied files).

**Common failure causes:**
- `connect ECONNREFUSED 127.0.0.1:5432` — Postgres is down or not listening on port 5432.
  Check: `pg_isready -h 127.0.0.1 -p 5432`
- `password authentication failed` — MIGRATIONS_DB_PASSWORD is wrong or migrations_runner
  password was rotated. Check Doppler or re-provision via `infra/postgres/migration-role.sql`.
- `role "ecommerce_user" does not exist` — `002_force_rls_and_app_role.sql` ran before
  the per-agency role was provisioned. Run `infra/postgres/init.sql` first.
- `table "__drizzle_migrations" does not exist` in dry-run — expected on a fresh DB that has
  never had `migrate()` called. Not an error; dry-run reports all files as pending.

**Single-agency retry:**
```bash
pnpm tsx scripts/migrate-runner.ts --agency=ecommerce
```

**Sequential mode for verbose output:**
```bash
pnpm tsx scripts/migrate-runner.ts --sequential
```

---

## Why Direct Port 5432 (and Not PgBouncer)

PgBouncer runs in **transaction mode** (`pool_mode = transaction`). Transaction mode reuses
physical connections across multiple client sessions.

**Pitfall 8.2 — Multi-statement DDL across connections:**
When a DDL script contains multiple statements (e.g., `BEGIN; CREATE TABLE ...; CREATE INDEX ...; COMMIT;`),
PgBouncer may route individual statements to different backend connections, causing the
`CREATE INDEX` to see a different transaction scope than the `CREATE TABLE`. This breaks DDL
migrations that rely on a consistent transaction context.

The fix is to bypass PgBouncer and connect directly to Postgres on port 5432 for migrations.
The `buildDirectUrl(slug, password)` helper in `packages/db/src/connection.ts` provides this URL.

**Application code MUST NOT use `buildDirectUrl`** — it bypasses connection pooling and uses
the BYPASSRLS `migrations_runner` role. Application code uses `buildDatabaseUrl` (PgBouncer,
ports 6432–6443) via `createAgencyDb`.

---

## CI Gate

Add this step to your CI pipeline to fail the build if pending migrations are detected:

```yaml
# .github/workflows/ci.yml (or equivalent)
- name: Check pending migrations
  env:
    MIGRATIONS_DB_PASSWORD: ${{ secrets.MIGRATIONS_DB_PASSWORD }}
    INTEGRATION_DATABASE_URL: ${{ secrets.INTEGRATION_DATABASE_URL }}
  run: |
    pnpm tsx scripts/migrate-runner.ts --dry-run --all
    # Exits 0 if all 13 DBs have 0 pending; exits 1 on connection error
```

For CI environments without a running DB: the `--dry-run` flag will exit 1 on connection error,
which is the correct behavior (prevents deploying code against an unverified schema state).
If you want CI to skip when no DB is available, run the integration test suite with
`it.skipIf(!process.env.INTEGRATION_DATABASE_URL)` instead.
