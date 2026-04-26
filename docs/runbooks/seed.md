# Seed Runbook

## Overview

The MJAgency seed framework provides a **resumable, per-agency seed executor** built on the
`_seed_state` tracking table. Each seed step is tracked by name; on re-run, steps already
marked `completed` are skipped, and steps marked `failed` are retried from the top. This
design allows operators to safely re-run seeds after a partial failure without duplicating
data or restarting from scratch.

The framework ships in `@mjagency/db/seed` (Plan 02-04) and is consumed by the
`scripts/seed-runner.ts` CLI.

---

## Prerequisites

Before running seeds, the schema must be applied to each target agency database.
Run the migration runner first:

```bash
# Apply migrations to all 12 agencies
pnpm tsx scripts/migrate-runner.ts --all

# Or to a single agency
pnpm tsx scripts/migrate-runner.ts --agency=ecommerce
```

The seed runner requires the `_seed_state` table (created by Plan 02-04's schema), the
`agencies` table, and the `users` table — all of which are provisioned by the migrations.

---

## Running Seeds

### All 12 agencies in parallel

```bash
pnpm db:seed
# Equivalent to:
pnpm tsx scripts/seed-runner.ts --all
```

Runs all `allSteps` across all 12 agency databases in parallel via `Promise.allSettled`.
Prints a per-agency summary. Exits 1 if any agency fails.

### Single agency

```bash
pnpm tsx scripts/seed-runner.ts --agency=ecommerce
```

### Subset of steps

```bash
pnpm tsx scripts/seed-runner.ts --agency=brand --steps=agencies,admin-users
```

Step names must match the `name` field of the `SeedStep` objects in `allSteps`.

### Reset and re-run (DEV ONLY)

```bash
# WARNING: irreversible — truncates _seed_state and re-runs all steps
pnpm tsx scripts/seed-runner.ts --agency=ecommerce --reset
```

The `--reset` flag truncates `_seed_state` before running, causing all steps to be treated
as pending. This is destructive and intended for local development only. Never use `--reset`
in a production environment.

---

## Adding a New Seed Step

1. Create a new file in `packages/db/src/seed/steps/<step-name>.ts`.
2. Import the `SeedStep` type:

   ```ts
   import type { SeedStep } from '../types.js'
   ```

3. Implement the step:

   ```ts
   import { agencyUuid } from '../uuid.js'
   import type { SeedStep } from '../types.js'

   export const myNewStep: SeedStep = {
     name: 'my-new-step', // must be globally unique in allSteps
     async run(tx, slug) {
       // tx is a Drizzle transaction with set_config('app.agency_id', id, true) already set.
       // All queries use tx — never call the outer db directly from within a step.
       // Your insert/update must be idempotent (ON CONFLICT DO NOTHING or SELECT-then-INSERT).
       const agencyId = agencyUuid(slug)
       await tx.insert(myTable).values({ ... }).onConflictDoNothing()
     },
   }
   ```

4. Add the step to `allSteps` in `packages/db/src/seed/index.ts`:

   ```ts
   import { myNewStep } from './steps/my-new-step.js'

   export const allSteps = [agenciesStep, adminUsersStep, myNewStep]
   ```

   **Order matters**: steps run sequentially per agency. New steps always append to the end.
   Never reorder or rename existing steps — this would break resumability for partially-seeded
   databases (the `_seed_state` row's `step_name` is the step's identity).

5. Add unit tests for the new step in `packages/db/src/__tests__/seed-runner.test.ts`.

---

## Resumability Semantics

| `_seed_state.status` | Behavior on next `runSeed` call         |
|---------------------|-----------------------------------------|
| `completed`         | Step is **skipped** — not re-run        |
| `failed`            | Step is **retried** from the beginning  |
| `running`           | Step is **retried** (crash during step) |
| (no row)            | Step is treated as **pending** — runs   |

The `_seed_state` table is per-agency-DB (not shared). Because each agency has its own
isolated Postgres database, `_seed_state` stores only the steps for that agency's seed run.

If a step produces partial results before crashing (e.g. inserts 5 of 10 rows), the retry
must handle the partial state gracefully. Design steps with idempotent inserts:

- **Prefer**: `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE`.
- **Alternative**: SELECT-then-INSERT (used by the `admin-users` step to avoid needing a
  single-column UNIQUE constraint on `users.email`).

---

## Pitfall 8.5 — RLS Context Inside Seeds

Every seed step's `run` body executes inside a Postgres transaction where
`set_config('app.agency_id', agencyId, true)` has already been called. This ensures RLS
policies on agency-scoped tables (e.g. `users`) are active.

**Never bypass this contract.** If you call database functions outside the `tx` argument
(e.g. the outer `db` client), RLS will not be active and queries will either fail visibility
checks or silently operate on wrong-tenant data.

The unit test for this (Test 5 in `seed-runner.test.ts`) verifies that `set_config` is
the FIRST `execute` call inside every step's transaction.

---

## Inter-Plan Handoff

### Phase 3 (auth) — admin-users step replacement

The `admin-users` step currently seeds a placeholder bcrypt hash for the `super_admin`
password. This is a **dev-only placeholder**. Phase 3 (auth) must replace this step with
a real onboarding token flow before any production seed run.

Search for `TODO_PHASE3` in the codebase to find all replacement points:

```bash
grep -r "TODO_PHASE3" packages/ scripts/
```

Until Phase 3 ships, **production seed runs are blocked** by the Phase 12 launch checklist
which requires Phase 3 auth to be fully deployed.

### Phase 5 (content sprint) — content seed steps

Phase 5 adds content seed steps (REQ-505) for seeding Payload CMS content per agency.
These steps will be added to a phase-local array passed to `runSeed`, or to `allSteps`
after Phase 12 launch sequencing is confirmed. The `SeedStep` interface requires no changes.

### Phase 9 (CRM pre-seeds) — CRM data steps

Phase 9 adds CRM pre-seed steps (REQ-103, REQ-104) for seeding contact lists, pipeline
stages, and deal templates per agency. Same integration path as Phase 5.

### Plan 12 (launch) — full fan-out

Plan 12 (launch) will run all seed steps across all 12 agencies via:

```bash
pnpm db:seed
```

This invokes `runSeedAllAgencies` with `allSteps`. Any failures are logged per-agency
and the runner exits 1 — the launch checklist gates on exit 0.
