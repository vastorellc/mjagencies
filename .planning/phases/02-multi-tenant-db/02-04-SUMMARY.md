---
phase: 02-multi-tenant-db
plan: "04"
subsystem: seed-framework
tags:
  - seed
  - resumability
  - rls
  - multi-tenant
  - cli
dependency_graph:
  requires:
    - "02-01 (seed-state schema + agencies/users tables + withAgencyContext)"
    - "02-03 (migration runner — integration test uses runMigration for DB setup)"
  provides:
    - "runSeed — per-agency resumable executor"
    - "runSeedAllAgencies — parallel fan-out helper"
    - "agencyUuid — deterministic UUID from slug"
    - "SeedStep interface — extension contract for Phase 5 and Phase 9"
    - "allSteps — ordered canonical step list"
    - "scripts/seed-runner.ts — CLI entry point"
  affects:
    - "Phase 3 (auth) — admin-users step provides seeded super_admin user"
    - "Phase 5 (content sprint) — SeedStep interface for content steps"
    - "Phase 9 (CRM pre-seeds) — SeedStep interface for CRM data"
    - "Plan 12 (launch) — runSeedAllAgencies + allSteps for full fan-out"
tech_stack:
  added:
    - "drizzle-seed@0.3.1 (devDep — available for future bulk-data steps)"
  patterns:
    - "Resumable step executor using _seed_state table PK tracking"
    - "Transaction-scoped set_config for RLS context (pitfall 8.5)"
    - "SELECT-then-INSERT idempotency pattern (avoids schema constraint requirement)"
    - "Promise.allSettled fan-out for parallel multi-agency execution"
key_files:
  created:
    - packages/db/src/seed/runner.ts
    - packages/db/src/seed/types.ts
    - packages/db/src/seed/uuid.ts
    - packages/db/src/seed/index.ts
    - packages/db/src/seed/steps/agencies.ts
    - packages/db/src/seed/steps/admin-users.ts
    - packages/db/src/__tests__/seed-runner.test.ts
    - packages/db/src/__tests__/seed-resumable.integration.test.ts
    - scripts/seed-runner.ts
    - docs/runbooks/seed.md
  modified:
    - packages/db/src/index.ts
    - packages/db/package.json
decisions:
  - "SELECT-then-INSERT for admin-users avoids adding a single-column UNIQUE constraint on users.email — Plan 02-01 schema unchanged"
  - "agencyUuid uses SHA-256 (not real UUIDv5 SHA-1) — deterministic, fits PG uuid type, predictable without DB lookup"
  - "drizzle-seed added as devDep now but not used by the two real steps — reserves the dep for Phase 9 CRM bulk-data steps"
  - "TODO_PHASE3 marker pattern adopted for admin-users placeholder password — tracked by grep gate in Plan 01-05"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-26T05:59:48Z"
  tasks_completed: 2
  files_created: 10
  files_modified: 2
  tests_added: 12
---

# Phase 02 Plan 04: Resumable Per-Agency Seed Framework Summary

**One-liner:** Resumable per-agency seed executor with `_seed_state` tracking, pitfall-8.5 RLS context, SELECT-then-INSERT idempotency, parallel fan-out CLI, and 9 unit + 3 integration tests.

---

## What Was Built

### Seed Framework Architecture

The core seed framework lives at `packages/db/src/seed/` and exports:

- **`runSeed(db, slug, agencyId, steps[])`** — iterates `SeedStep` objects in declared order.
  Each step is checked against `_seed_state`: `completed` → skipped, `failed`/missing → run.
  On success: marks `completed`. On failure: marks `failed` with `error_text` and rethrows.
  The runner is the only code in the repo that calls `set_config('app.agency_id', id, true)`
  as the first statement inside every step's transaction (pitfall 8.5 mitigation).

- **`runSeedAllAgencies(targets[], steps[])`** — `Promise.allSettled` fan-out, returns
  `SeedAgencyResult[]` with per-agency `ok | failed` status.

- **`agencyUuid(slug)`** — deterministic SHA-256-based UUID-shaped string. Same slug always
  produces the same UUID. Used by both seed steps and the verify-pgbouncer-rls script.

- **`SeedStep` interface** — `{ name: string; run(tx, slug): Promise<void> }`. The extension
  contract for Phase 5 and Phase 9.

### Two Real Seed Steps

| Step | File | Idempotency Strategy |
|------|------|---------------------|
| `agencies` | `steps/agencies.ts` | `ON CONFLICT (slug) DO NOTHING` |
| `admin-users` | `steps/admin-users.ts` | SELECT-then-INSERT (no unique constraint needed) |

The `agencies` step inserts the top-level agency record with the deterministic `agencyUuid`.
The `admin-users` step creates one `super_admin` user per agency with a placeholder bcrypt
hash (`TODO_PHASE3` marker). Phase 3 replaces this with a real onboarding token flow.

### CLI Script (`scripts/seed-runner.ts`)

Full flag support:

| Flag | Behavior |
|------|----------|
| `--agency=<slug>` | Single agency run |
| `--all` | All 12 agencies in parallel via `Promise.allSettled` |
| `--steps=a,b,c` | Subset filter by step name |
| `--reset` | TRUNCATE `_seed_state` first (DEV ONLY) |
| `--help` | Print usage, exit 0 |

Password resolution: `SEED_<SLUG>_DB_PASSWORD` → `INTEGRATION_<SLUG>_DB_PASSWORD` → `SEED_DB_PASSWORD`.

### Tests

**Unit tests** (`seed-runner.test.ts`) — 9 tests, no DB required:
1. `agencyUuid` determinism (same slug, same result)
2. `agencyUuid` regex match (v5 UUID format)
3. `agencyUuid` returns different UUIDs for different slugs
4. Skip completed step — `run` not called
5. Pending step — `insert(running)`, `run`, `update(completed)` in order
6. Failed step — `update(failed)` with `errorText` + rethrow
7. `set_config` as FIRST execute inside transaction (pitfall 8.5)
8. Resume — completed step skipped, failed step retried on second run
9. Empty steps array — no-op, no error

**Integration tests** (`seed-resumable.integration.test.ts`) — 3 tests, all gated by
`INTEGRATION_DATABASE_URL`. Skipped without DB. Tests cover: happy path, resume after failure,
and idempotency (double-run produces no duplicate rows).

---

## Resumability Semantics

| `_seed_state.status` | Next `runSeed` behavior |
|---------------------|------------------------|
| `completed` | Skipped |
| `failed` | Retried |
| `running` | Retried (crash-safe) |
| (absent) | Run as pending |

The `--reset` flag truncates `_seed_state` and treats all steps as pending — DEV ONLY.

---

## Inter-Plan Handoffs

| Phase / Plan | Integration Point | Trigger |
|-------------|------------------|---------|
| Phase 3 (auth) | Replace `admin-users` step with real onboarding token flow | Search `TODO_PHASE3` in codebase |
| Phase 5 (content) | Add content seed steps via `SeedStep` interface | REQ-505 |
| Phase 9 (CRM pre-seeds) | Add CRM data steps via `SeedStep` interface | REQ-103, REQ-104 |
| Plan 12 (launch) | Run `runSeedAllAgencies(targets, allSteps)` across all 12 DBs | Launch checklist gate |

---

## Plan-Time Decisions

**Decision 1: SELECT-then-INSERT for admin-users**
The `users` table has a composite unique index on `(agency_id, email)` but no single-column
unique index on `email`. An `ON CONFLICT (email)` clause requires a single-column unique
index — adding it would be an out-of-scope modification to Plan 02-01's schema. The
SELECT-then-INSERT pattern achieves the same idempotency guarantee without any schema changes.
No files from Plan 02-01 or Plan 02-03 were modified.

**Decision 2: agencyUuid uses SHA-256 (not real UUIDv5)**
Real UUIDv5 uses SHA-1. For this application, SHA-256 is preferred (no SHA-1 collision
concerns) and the result still fits PostgreSQL's `uuid` type. The determinism guarantee is
equivalent. The function is clearly documented as "v5-style" to avoid confusion.

**Decision 3: drizzle-seed@0.3.1 added as devDep now**
Not used by either of the two real steps (which insert real data, not generated fakes).
Added now so Phase 9 (CRM pre-seeds) and Phase 5 (dev content stubs) can use it without
re-evaluating the choice or causing a dependency PR at that phase.

---

## Files for Plan 12 (launch)

Plan 12 will import:
- `runSeedAllAgencies` from `@mjagency/db/seed`
- `allSteps` from `@mjagency/db/seed`
- Or invoke via: `pnpm db:seed` (runs `scripts/seed-runner.ts --all`)

---

## Deviations from Plan

None — plan executed exactly as written.

The `TODO_PHASE3` comments in `admin-users.ts` and `seed-runner.ts` are explicitly permitted
by the plan's `<action>` step 2 which instructs using the `TODO_PHASE3` prefix pattern.

---

## Known Stubs

One intentional stub exists:

| File | Line | Description |
|------|------|-------------|
| `packages/db/src/seed/steps/admin-users.ts` | ~47 | Placeholder bcrypt hash for `'changeme'` (cost 4). Phase 3 replaces with real onboarding token flow. Marked `TODO_PHASE3`. |

This stub does NOT prevent the plan's goal (proving the seed framework works). The
`admin-users` step runs correctly and inserts a `super_admin` user — Phase 3 will replace
the password handling, not the step structure.

---

## Threat Surface

No new trust boundaries beyond those documented in the plan's `<threat_model>`:

- **T-02-009 (I) mitigated**: `set_config` is called as the FIRST execute in every step's
  transaction. Unit test 7 verifies this invariant.
- **T-02-010 (T) mitigated**: `agenciesStep` uses `onConflictDoNothing`; `adminUsersStep`
  uses SELECT-then-INSERT. Integration test 3 verifies no duplicates.
- **T-02-011 (E) accepted with gate**: Placeholder password `TODO_PHASE3` marker + runbook
  note. Production seeding blocked by Phase 12 launch checklist until Phase 3 ships.

---

## Self-Check

### Created files exist

- FOUND: packages/db/src/seed/runner.ts
- FOUND: packages/db/src/seed/types.ts
- FOUND: packages/db/src/seed/uuid.ts
- FOUND: packages/db/src/seed/index.ts
- FOUND: packages/db/src/seed/steps/agencies.ts
- FOUND: packages/db/src/seed/steps/admin-users.ts
- FOUND: packages/db/src/__tests__/seed-runner.test.ts
- FOUND: packages/db/src/__tests__/seed-resumable.integration.test.ts
- FOUND: scripts/seed-runner.ts
- FOUND: docs/runbooks/seed.md

### Commits exist

- `3dfc511` feat(02-04): seed runner core + SeedStep types + agencyUuid (Task 4.1)
- `0f94789` feat(02-04): real seed steps + CLI + resumability integration test (Task 4.2)

## Self-Check: PASSED
