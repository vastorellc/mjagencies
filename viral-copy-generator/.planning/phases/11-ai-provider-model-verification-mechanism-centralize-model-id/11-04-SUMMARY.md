---
phase: 11
plan: 04
subsystem: backend-db
tags: [drizzle, schema, migration, admin_provider_health, pg-mem, VERIFY-05, BLOCKING]
dependency_graph:
  requires: [11-01]
  provides: [admin_provider_health table, pg-mem integration tests]
  affects: [11-05-PLAN (provider-health-check worker), backend/drizzle/0005_abnormal_mentallo.sql]
tech_stack:
  added: []
  patterns: [pg-mem PatchedPool test helper, Drizzle generate+migrate, inline DDL bootstrap in beforeEach]
key_files:
  created:
    - backend/drizzle/0005_abnormal_mentallo.sql
  modified:
    - backend/src/db/schema.ts
    - backend/src/test/db/admin-provider-health.test.ts
decisions:
  - "drizzle-kit generate used (NEVER push) — migration inspected as additive-only before applying"
  - "No RLS on admin_provider_health — admin-scoped at route layer (matches trend_cache pattern)"
  - "No user_id column — system-level pings, not user-scoped"
  - "pg-mem PatchedPool reused from backend/tests/_helpers.ts — table bootstrapped via inline CREATE TABLE in beforeEach"
  - "DISTINCT ON test verifies latest-per-pair query correctness without mocking"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-16"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 11 Plan 04: admin_provider_health Schema + Migration + Tests Summary

**One-liner:** Drizzle `admin_provider_health` table (6 columns, 2 indexes, no RLS) migrated via additive-only `0005_abnormal_mentallo.sql`; Wave 0 it.todo stub converted to 7 GREEN pg-mem integration tests.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Append admin_provider_health pgTable to schema.ts | b25e1eb | backend/src/db/schema.ts |
| 2 | Generate + inspect + apply Drizzle migration [human-approved] | 424f837 | backend/drizzle/0005_abnormal_mentallo.sql |
| 3 | Convert Wave 0 stub to 7 GREEN pg-mem integration tests | ae368de | backend/src/test/db/admin-provider-health.test.ts |

## What Was Built

### admin_provider_health Table (schema.ts)

Appended after `video_ai_insights` in `backend/src/db/schema.ts`:

```
Column        Type        Constraints
id            UUID        PK, DEFAULT gen_random_uuid()
provider      TEXT        NOT NULL
model_id      TEXT        NOT NULL
status        TEXT        NOT NULL
latency_ms    INTEGER     NOT NULL
error_message TEXT        NULL (nullable when status='ok')
checked_at    TIMESTAMP   NOT NULL, DEFAULT NOW()
```

Two indexes:
- `admin_provider_health_provider_model_idx` — composite (provider, model_id, checked_at) for DISTINCT ON admin query
- `admin_provider_health_checked_at_idx` — standalone (checked_at) for cleanup ROW_NUMBER partition query

No RLS policies, no user_id — matches trend_cache / platform_viral_patterns admin-scoped pattern.

### Migration File: `0005_abnormal_mentallo.sql`

- Generated via `drizzle-kit generate` (never push — Pitfall 2 averted)
- Inspected pre-apply: contains only `CREATE TABLE "admin_provider_health"` and `CREATE INDEX` statements
- The migration file also includes `ALTER TABLE "settings" ADD COLUMN "available_niches"` (carried from a prior schema drift — additive only)
- No `DROP POLICY`, `DROP RLS`, `DISABLE ROW LEVEL SECURITY`, or destructive changes to existing tables
- Applied via `drizzle-kit migrate` against Supabase; `drizzle-kit check` reported no drift

RLS-drop scan result: `grep "DROP POLICY\|DISABLE ROW LEVEL" backend/drizzle/0005_abnormal_mentallo.sql` → 0 matches.

### Integration Tests: 7 GREEN (pg-mem, no real DB)

File: `backend/src/test/db/admin-provider-health.test.ts`

| # | Test | Verifies |
|---|------|---------|
| 1 | insert with all columns succeeds and row is retrievable | Basic insert + SELECT |
| 2 | id auto-generates as UUID (matches UUID v4 format) | gen_random_uuid() default |
| 3 | checked_at defaults to NOW() (within ±5 s of insert time) | Timestamp default |
| 4 | error_message is null when status=ok | Nullable column |
| 5 | error_message stores string when status=model_not_found | Non-null error path |
| 6 | bulk insert of 8 models in one call succeeds (all 4 providers) | Multi-row insert |
| 7 | SELECT DISTINCT ON (provider, model_id) returns latest row per pair | Admin query pattern |

Run: `cd backend && npm test -- --run src/test/db/admin-provider-health.test.ts` → 7/7 PASS.

## Deviations from Plan

None — plan executed exactly as written.

Task 2 was a `checkpoint:human-action` (human-approved drizzle migration). Human confirmed additive-only and applied. Resuming as Task 3 continuation is the intended flow.

Note: Pre-existing failures in `backend/tests/settings.test.ts` (cross-user isolation test asserting `api_key_masked` returns null vs undefined) are out of scope — not introduced by this plan. Logged to deferred-items.

## Known Stubs

None. The table definition is complete and all insert/query patterns are exercised in tests.

## Threat Flags

None. The `admin_provider_health` table was already modeled in the plan's `<threat_model>` (T-11-04, T-11-06, T-11-07, T-11-15). No new trust boundaries introduced.

## Self-Check: PASSED

- [x] `backend/src/db/schema.ts` exports `admin_provider_health` — confirmed line 402
- [x] `backend/drizzle/0005_abnormal_mentallo.sql` exists — confirmed
- [x] `backend/src/test/db/admin-provider-health.test.ts` exists — confirmed
- [x] Commits b25e1eb, 424f837, ae368de — all present in git log
- [x] 7/7 tests GREEN — confirmed via `npm test --run`
- [x] No DROP POLICY in migration — confirmed via grep
