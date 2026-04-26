---
phase: 02-multi-tenant-db
plan: 03
subsystem: migration-runner
tags: [drizzle-orm, postgres, migrations, parallel, canary, dry-run, snapshot, rollback, pgbouncer-bypass]
dependency_graph:
  requires:
    - 02-01 (packages/db schema modules, 0000_initial.sql, custom SQL files, migrations_runner role)
    - 02-02 (no-session-set lint rule — parallel context)
    - 01-02 (connection.ts agencyConnection helpers — extended here)
    - packages/config (AGENCIES const)
  provides:
    - packages/db/src/connection.ts:buildDirectUrl (port 5432 bypass)
    - packages/db/src/migrate/* (runner, apply-custom, dry-run, snapshot, index)
    - "@mjagency/db/migrate" subpath export
    - scripts/migrate-runner.ts (CLI — all 6 flags + help)
    - scripts/migrate-rollback.ts (manual rollback CLI)
    - docs/runbooks/migrations.md (operator runbook)
  affects:
    - 02-04 (seed framework calls runMigration to ensure schema is deployed)
    - 02-05 (backup scripts operate against migrated DBs)
    - 02-06 (vault + audit triggers — will extend CUSTOM_FILES array)
tech_stack:
  added:
    - drizzle-orm/postgres-js/migrator (programmatic migrate() API)
    - node:child_process.spawn (pg_dump + psql)
    - node:readline (canary confirmation prompt)
  patterns:
    - Promise.allSettled for parallel fan-out (reports per-agency status even on failure)
    - buildDirectUrl — port 5432 bypass ringfenced to migration runner only
    - CUSTOM_FILES const array — explicitly typed for 02-06 append extension
    - it.skipIf(!INTEGRATION_DATABASE_URL) for integration test gating
key_files:
  created:
    - packages/db/src/migrate/runner.ts
    - packages/db/src/migrate/apply-custom.ts
    - packages/db/src/migrate/dry-run.ts
    - packages/db/src/migrate/snapshot.ts
    - packages/db/src/migrate/index.ts
    - packages/db/src/__tests__/migrate-dry-run.test.ts
    - packages/db/src/__tests__/migrate-runner.integration.test.ts
    - packages/db/vitest.config.ts
    - scripts/migrate-runner.ts
    - scripts/migrate-rollback.ts
    - docs/runbooks/migrations.md
  modified:
    - packages/db/src/connection.ts (added buildDirectUrl)
    - packages/db/src/index.ts (added migrate namespace re-export)
    - packages/db/package.json (added ./migrate exports entry + db:migrate scripts)
    - packages/db/tsconfig.json (added vitest.config.ts to includes)
    - package.json (added root workspace deps for script execution)
decisions:
  - "Open Q1 resolved: buildDirectUrl(slug, password) added to connection.ts — port 5432, migrations_runner role, ringfenced by JSDoc warning"
  - "Open Q2 resolved: single MIGRATIONS_DB_PASSWORD env var (shared Doppler secret) — fail-fast if unset"
  - "Promise.allSettled (not Promise.all) — all 13 agencies attempt migration even if one fails; per-agency status reported"
  - "CUSTOM_FILES exported as readonly const array — 02-06 appends 003_audit_triggers.sql and 004_partition_audit_log.sql cleanly"
  - "Root package.json gains workspace deps for tsx script execution — @mjagency/config, @mjagency/db, tsx devDep"
metrics:
  duration: "estimated 90 minutes"
  completed_date: "2026-04-25"
  tasks_completed: 2
  files_created: 11
  files_modified: 5
---

# Phase 02 Plan 03: Migration Runner — Parallel × 13, Dry-Run, Canary, Snapshot, Rollback Summary

Parallel-by-default migration runner that applies the Drizzle schema across all 13 agency databases using `Promise.allSettled`. Includes `buildDirectUrl` (port 5432 PgBouncer bypass), a custom DDL applier with `:'app_role'` substitution, dry-run inspection, pg_dump snapshot support, and a manual rollback CLI.

## New Exports from `@mjagency/db`

### `buildDirectUrl(slug, password)` — connection.ts

```ts
buildDirectUrl('ecommerce', process.env.MIGRATIONS_DB_PASSWORD!)
// 'postgresql://migrations_runner:***@127.0.0.1:5432/ecommerce_db'
```

- Port 5432 only (bypasses PgBouncer transaction mode — pitfall 8.2)
- Authenticates as `migrations_runner` (BYPASSRLS role)
- JSDoc warning: "DO NOT use for application queries — bypasses PgBouncer pool and runs as BYPASSRLS role"
- Ringfenced: all application code continues to use `buildDatabaseUrl` (PgBouncer ports 6432-6443)

### `@mjagency/db/migrate` subpath

```ts
import { runMigration, runAllMigrations, applyCustomDdl, dryRun, snapshotAgency } from '@mjagency/db/migrate'
```

| Export | Purpose |
|--------|---------|
| `runMigration(slug, password)` | Single-agency apply (drizzle-kit + custom DDL) |
| `runAllMigrations(opts)` | Orchestrator — parallel, canary, sequential, dry-run modes |
| `applyCustomDdl(client, slug)` | Reads CUSTOM_FILES, substitutes app_role, applies via client.unsafe() |
| `dryRun(slug, password)` | Inspects `__drizzle_migrations`, returns pending list |
| `snapshotAgency(slug, password, outDir)` | pg_dump --schema-only per agency |
| `CUSTOM_FILES` | Readonly const array — 02-06 appends entries here |

## CLI Scripts

### `scripts/migrate-runner.ts`

```
pnpm tsx scripts/migrate-runner.ts [flags]
  --agency=<slug>       Single agency (default: all)
  --all                 All 13 agencies (default)
  --dry-run             List pending, no apply; exits 0/1
  --canary              brand first -> confirm -> remaining 12 in parallel
  --sequential          One at a time (diagnostics)
  --snapshot-before     pg_dump per agency before migrating
  --help                Print help and exit 0
```

### `scripts/migrate-rollback.ts`

```
pnpm tsx scripts/migrate-rollback.ts <snapshot-dir> [--agency=<slug>]
```

Re-applies snapshot via `psql -f <slug>.sql --single-transaction`. Uses `PGPASSWORD` from `MIGRATIONS_DB_PASSWORD`.

## Custom DDL Apply Order

Per agency DB, the runner applies in this exact sequence:

1. **Drizzle-kit generated files** via `migrate(db, { migrationsFolder })` — `0000_initial.sql` (tables, RLS policies)
2. **`custom/001_agency_id_immutable.sql`** — `prevent_agency_id_change()` function + BEFORE UPDATE OF agency_id triggers on users, sessions, permissions_vault
3. **`custom/002_force_rls_and_app_role.sql`** — FORCE ROW LEVEL SECURITY on agency tables + REVOKE UPDATE/DELETE on audit_log + DML grants (with `:'app_role'` -> `<slug>_user` substitution)

**02-06 extension point:** `CUSTOM_FILES` in `apply-custom.ts` is a clearly-marked TypeScript const array. Plan 02-06 appends:
- `'003_audit_triggers.sql'`
- `'004_partition_audit_log.sql'`

## Snapshot + Rollback Procedure

```bash
# Snapshot before apply (stage/prod):
pnpm tsx scripts/migrate-runner.ts --canary --snapshot-before
# Writes: .snapshots/<ISO-ts>/{brand,ecommerce,...}.sql

# Rollback if needed:
pnpm tsx scripts/migrate-rollback.ts .snapshots/<ISO-ts>
# Or single agency: --agency=ecommerce
```

**Limitation:** Schema-only snapshots. Data is preserved unless the migration dropped columns/tables. Destructive migrations require a full pgBackRest backup first (Plan 02-05 runbook).

## Plan-Time Decisions Resolved

| Decision | Resolution |
|----------|-----------|
| Open Q1 — buildDirectUrl | Added to connection.ts; port 5432, migrations_runner role, ringfenced by JSDoc warning and separate from buildDatabaseUrl |
| Open Q2 — password approach | Single `MIGRATIONS_DB_PASSWORD` shared Doppler secret; runner throws clearly if unset |

## Test Coverage

### Unit tests (5 assertions in 7 test cases, all mock-only, no DB)

`packages/db/src/__tests__/migrate-dry-run.test.ts` — 7 tests pass:
1. `buildDirectUrl` returns port-5432 URL for known slug
2. `buildDirectUrl` encodes special characters in password
3. `buildDirectUrl` throws for unknown slug
4. `applyCustomDdl` substitutes `:'app_role'` with `<slug>_user`
5. `applyCustomDdl` strips psql meta-commands (`\connect`)
6. `dryRun` returns slug, appliedCount, pending array
7. `runAllMigrations({ dryRun: true })` calls `migrate()` zero times

### Integration tests (3 tests, skip without INTEGRATION_DATABASE_URL)

`packages/db/src/__tests__/migrate-runner.integration.test.ts` — 3 tests (all gated on `INTEGRATION_DATABASE_URL`):
1. Apply schema to fresh DB — tables, RLS, triggers verified
2. Re-running is idempotent — same `__drizzle_migrations` row count
3. dryRun reports zero pending after apply

**Skip behavior:** Without `INTEGRATION_DATABASE_URL`, all 3 tests show `3 skipped` — exits 0.

## Files Plans 02-04, 02-05, 02-06 Will Consume

| File | Consumer | What they need |
|------|----------|---------------|
| `runMigration(slug, password)` from `@mjagency/db/migrate` | 02-04 seed runner | Ensure schema is deployed before seeding |
| `CUSTOM_FILES` const in `apply-custom.ts` | 02-06 | Append `003_audit_triggers.sql`, `004_partition_audit_log.sql` |
| `.snapshots/<ts>/` directory | 02-05 | Backup runbook integrates snapshot + WAL backup |
| `buildDirectUrl` in `connection.ts` | 02-05, 02-06 | Direct Postgres connection for admin operations |
| Populated agency DBs (after migrate runs) | 02-04, 02-06 | seed data and vault/trigger installation |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] printAllSettledSummary indexing with noUncheckedIndexedAccess**
- **Found during:** Task 3.1 typecheck
- **Issue:** `results[i]` and `slugs[i]` produce `T | undefined` under `noUncheckedIndexedAccess`, breaking the `.status` and `.reason` access pattern.
- **Fix:** Added explicit type assertion `results[i] as PromiseSettledResult<void>` and null-coalescing fallback `slugs[i] ?? 'agency-N'`. Used `(result as PromiseRejectedResult).reason` for rejected case.
- **Files modified:** `packages/db/src/migrate/runner.ts`

**2. [Rule 1 - Bug] Integration test Row type mismatch**
- **Found during:** Task 3.2 typecheck
- **Issue:** postgres-js `Row` type (`Record<string, unknown>`) not directly assignable to `{ tablename: string }` in strict mode.
- **Fix:** Changed `.map((r: { tablename: string }) => ...)` to `.map((r) => (r as { tablename: string }).tablename)`.
- **Files modified:** `packages/db/src/__tests__/migrate-runner.integration.test.ts`

**3. [Rule 2 - Missing] Root package.json lacks workspace package dependencies for script execution**
- **Found during:** Task 3.2 verification (`pnpm tsx scripts/migrate-runner.ts --help` failed with MODULE_NOT_FOUND)
- **Issue:** tsx running from monorepo root couldn't resolve `@mjagency/config` or `@mjagency/db` — these workspace packages were not linked at the root level.
- **Fix:** Added `"@mjagency/config": "workspace:*"`, `"@mjagency/db": "workspace:*"` to root `package.json` dependencies, and `"tsx": "4.19.2"` as a dev dependency.
- **Files modified:** `package.json`

### Pre-existing TypeScript Errors (Out of Scope)

The following TypeScript errors exist in files NOT created or modified by this plan. They are pre-existing from Plans 02-01 and 02-02 and are deferred items:

| File | Error | Source Plan |
|------|-------|-------------|
| `../config/src/otel-node.ts` | `ATTR_SERVICE_NAMESPACE` renamed in @opentelemetry/semantic-conventions | 02-01/config |
| `src/__tests__/pgbouncer-set-local.integration.test.ts` | Type assertion pattern for postgres-js `RowList` | 02-02 |
| `src/schema/users.ts`, `sessions.ts`, `permissions-vault.ts` | `SQL<unknown>` not assignable to `PgPolicyToOption` in pgPolicy `to:` | 02-01 |

These errors are not caused by Plan 02-03 changes and have not been modified.

## Threat Surface Scan

No new network endpoints introduced. Trust boundary analysis:

| Threat | Status |
|--------|--------|
| T-02-003 (migration runner credentials reused by app code) | Mitigated — buildDirectUrl JSDoc warns; distinct from buildDatabaseUrl; application code cannot call migrations_runner role via PgBouncer |
| T-02-007 (partial DDL apply — inconsistent state) | Mitigated — Promise.allSettled reports per-agency; --snapshot-before provides pre-image; migrate-rollback.ts enables manual restore |
| T-02-008 (slug injected into app_role substitution) | Mitigated — AGENCIES const is compile-time fixed; CLI validates --agency= against AGENCIES before any substitution |

## Known Stubs

None — all code paths are fully implemented. The dry-run's "naive ordering" (slice by count) is intentional and documented in JSDoc; it is sufficient for operator confidence and a full hash-aware implementation is noted as a future improvement.

## Self-Check: PASSED

| File | Status |
|------|--------|
| packages/db/src/connection.ts | FOUND — contains buildDirectUrl, 127.0.0.1:5432, migrations_runner |
| packages/db/src/migrate/runner.ts | FOUND — contains Promise.allSettled, drizzle-orm/postgres-js/migrator |
| packages/db/src/migrate/apply-custom.ts | FOUND — contains CUSTOM_FILES, 001_agency_id_immutable, 002_force_rls_and_app_role, app_role |
| packages/db/src/migrate/dry-run.ts | FOUND — contains __drizzle_migrations |
| packages/db/src/migrate/snapshot.ts | FOUND — contains pg_dump |
| packages/db/src/migrate/index.ts | FOUND — exports all 5 public symbols |
| packages/db/src/__tests__/migrate-dry-run.test.ts | FOUND — 7 tests pass |
| packages/db/src/__tests__/migrate-runner.integration.test.ts | FOUND — 3 tests skip without INTEGRATION_DATABASE_URL |
| scripts/migrate-runner.ts | FOUND — --help exits 0 (verified) |
| scripts/migrate-rollback.ts | FOUND — contains psql |
| docs/runbooks/migrations.md | FOUND — contains canary, snapshot, PgBouncer, MIGRATIONS_DB_PASSWORD |

| Commit | Hash | Status |
|--------|------|--------|
| feat(02-03): migration runner core + buildDirectUrl + custom DDL applier (Task 3.1) | 1d661b3 | FOUND |
| feat(02-03): migrate-runner CLI + snapshot + rollback + runbook (Task 3.2) | 0a66ba9 | FOUND |
