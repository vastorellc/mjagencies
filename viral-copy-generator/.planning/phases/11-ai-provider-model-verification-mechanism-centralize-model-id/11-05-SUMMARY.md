---
phase: 11
plan: 05
subsystem: backend/provider-health
tags: [pg-boss, health-check, admin-route, service-keys, fail-partial, vitest]
requires: [11-01, 11-03, 11-04]
provides: [runProviderHealthCheck, registerProviderHealthCheckJob, GET /api/admin/provider-health]
affects: [backend/src/lib/boss.ts, backend/src/index.ts, backend/src/routes/admin.ts]
tech-stack:
  added: []
  patterns: [fail-partial-isolation, pg-boss-createQueue-before-schedule, lazy-dynamic-import, ROW_NUMBER-cleanup]
key-files:
  created:
    - backend/src/lib/provider-health-check.ts
  modified:
    - backend/src/lib/boss.ts
    - backend/src/index.ts
    - backend/src/routes/admin.ts
    - backend/.env.example
    - backend/src/test/lib/provider-health-check.test.ts
decisions:
  - "Used `as unknown as { rows: T[] }` cast pattern (consistent with existing admin routes) for db.execute() return type narrowing — avoids any-type violation while matching Drizzle/node-postgres QueryResult shape"
  - "vi.resetModules() in afterEach ensures env var changes per test are isolated when module is re-imported — critical for process.env mutation tests"
  - "Added 'classifies SDK 5xx as service_unavailable' test as deviation (Wave 0 stub had it but plan Task 2 omitted it; added for completeness — 9 tests total vs 8 minimum)"
metrics:
  duration: "614 seconds (~10 min)"
  completed: "2026-05-16T04:44:35Z"
  tasks_completed: 3
  files_created: 1
  files_modified: 5
  tests_added: 9
  tests_passing: 9
---

# Phase 11 Plan 05: Provider Health Check Worker + Admin Route Summary

Weekly pg-boss health check that pings every (provider, model) in MODELS with a 2-stage probe, persists results to `admin_provider_health`, and exposes a merged admin endpoint including p95 latency.

## What Was Built

**Provider Health Check Worker** (`backend/src/lib/provider-health-check.ts`, 220 lines):
- `runProviderHealthCheck()` iterates all 8 `MODELS` entries
- Per-model fail-partial isolation: each (provider, model) wrapped in independent try/catch
- Missing `HEALTHCHECK_*_KEY` → `status='not_configured'`, `latency_ms=0`, informative error message (does NOT throw)
- Two-stage probe: `models.retrieve()` then 1-token generation per SDK
- `classifyError()` maps SDK error shapes to 7 canonical statuses across 3 SDK shapes (OpenAI-compatible, Anthropic, Google GenAI)
- Bulk Drizzle insert (1 round-trip for all 8 rows)
- ROW_NUMBER() OVER (PARTITION BY provider, model_id ORDER BY checked_at DESC) cleanup — keeps last 30 rows per pair
- Error messages truncated at 500 chars (T-11-05: prevents API key fragment leakage)
- Zero `NEXT_PUBLIC_` env vars (Pitfall 8 enforced)

**pg-boss Job Registration** (`backend/src/lib/boss.ts`):
- `registerProviderHealthCheckJob()` mirrors `registerResearchRefreshJob` pattern exactly
- `createQueue('provider-health-check')` BEFORE `schedule()` (Pitfall 1 guard — FK constraint)
- Cron: `'0 7 * * 1'` (Mondays 7am UTC = noon PKT)
- Duplicate-schedule error swallowed idempotently (restart-safe)
- Worker lazy-imports `./provider-health-check.js` to avoid circular dependency

**Startup Registration** (`backend/src/index.ts`):
- `registerProviderHealthCheckJob(boss)` added as 5th job registration call

**Environment Documentation** (`backend/.env.example`):
- 4 optional `HEALTHCHECK_*_KEY` vars documented with comments
- `HEALTHCHECK_OPENAI_KEY`, `HEALTHCHECK_ANTHROPIC_KEY`, `HEALTHCHECK_GOOGLE_KEY`, `HEALTHCHECK_DEEPSEEK_KEY`
- Explicit warning: "NEVER prefix with NEXT_PUBLIC_"
- Cost note: ~$0.08/year per provider

**Admin Endpoint** (`GET /api/admin/provider-health`):
- `DISTINCT ON (provider, model_id)` picks latest health row per model
- `percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)` for p95 over last 7 days (ok-only rows)
- Merged with MODELS metadata: displayName, tier, capabilities, pricing, retiresAt
- Models with no health rows: `latestStatus='unknown'`, `latencyP95Last7dMs=null`
- `adminMiddleware` applied at router level — no per-route auth check needed

**Tests** (`backend/src/test/lib/provider-health-check.test.ts`):
- 9 tests replacing Wave 0 `it.todo` stubs — all GREEN
- Tests cover: 8-row success, not_configured on missing key, fail-partial isolation, 404/401/429/5xx classification, cleanup query verification, latency_ms >=0

## Commits

| Task | Hash | Description |
|------|------|-------------|
| Task 1 | ddd5e2a | feat(11-05): implement runProviderHealthCheck worker (VERIFY-05) |
| Task 2 | 84ef90a | feat(11-05): register pg-boss provider-health-check job + env docs + 9 GREEN tests (VERIFY-05) |
| Task 3 | 87ab0b1 | feat(11-05): add GET /api/admin/provider-health route (VERIFY-06) |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as specified, with one additive deviation:

**1. [Rule 2 - Added] Extra test case: `classifies SDK 5xx as service_unavailable`**
- **Found during:** Task 2 test implementation
- **Issue:** Wave 0 stub had `it.todo('classifies SDK 5xx as status="service_unavailable"')` — the plan's Task 2 test list only specified 8 tests ending with `latency_ms > 0`
- **Fix:** Added the 5xx classification test for completeness (result: 9 tests vs plan's minimum of 8)
- **Files modified:** `backend/src/test/lib/provider-health-check.test.ts`
- **Commit:** 84ef90a

**2. [Rule 1 - TypeScript fix] Type narrowing for db.execute() return in admin route**
- **Found during:** Task 3 tsc check
- **Issue:** First attempt used `(result as unknown as { rows?: typeof latestRows }).rows ?? latestRows` — tsc rejected because `typeof latestRows` (QueryResult) does not match array index signature
- **Fix:** Used explicit named types (`LatestRow`, `P95Row`) and `as unknown as { rows: T[] }` cast matching existing admin route patterns (`.rows` pattern confirmed in `/jobs`, `/users` routes)
- **Files modified:** `backend/src/routes/admin.ts`
- **Commit:** 87ab0b1 (included in task commit)

## Known Stubs

None. All HEALTHCHECK_*_KEY env vars produce real results when configured. When absent they produce `status='not_configured'` rows which are complete and visible data (not missing/empty data).

## Threat Flags

No new security surface beyond what was declared in the plan's threat model. All T-11-05 mitigations implemented:
- `HEALTHCHECK_*_KEY` values never logged
- Error messages truncated at 500 chars
- No `NEXT_PUBLIC_` prefix on any health check var
- Route is read-only (no admin write path)

## Cost Estimate

- Weekly cron: 8 models × 2 SDK calls × 52 weeks = 832 calls/year
- At minimal token count (1 token in, 1 token out), cost is negligible (~$0.08/year across all 4 providers)

## Self-Check: PASSED

All created/modified files exist on disk. All task commits verified in git log:
- ddd5e2a — backend/src/lib/provider-health-check.ts (Task 1)
- 84ef90a — boss.ts + index.ts + .env.example + test file (Task 2)
- 87ab0b1 — backend/src/routes/admin.ts (Task 3)
