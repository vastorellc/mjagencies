---
phase: 07-ai-assistant
plan: "01"
subsystem: ai
tags: [ai, cost-cap, model-routing, bullmq, redis, tdd, litellm]
dependency_graph:
  requires: []
  provides:
    - packages/ai cost-cap enforcement (checkAgencyCostCap, recordAgencySpend, resetMonthlySpend)
    - packages/ai model routing by tier (getModelForTier, MODEL_ROUTING, ModelTier)
    - packages/ai per-agency LiteLLM key resolution (getAgencyLiteLLMKey)
    - packages/ai extended generateContent with agencyId/tier/systemPrompt/metadata
    - apps/web-main monthly cost-reset cron (BullMQ, REQ-080)
  affects:
    - packages/ai (extended, all callers)
    - apps/web-main (new job registration)
tech_stack:
  added:
    - ioredis@5.4.1 (runtime dependency)
    - ioredis-mock@8.9.0 (test dependency)
    - "@types/ioredis-mock@8.2.7" (dev dependency)
  patterns:
    - TDD red/green cycle (RED commit precedes GREEN commit)
    - Redis try/finally quit pattern (from packages/seo/src/config-cache.ts)
    - BullMQ Pitfall 7 dedup pattern (from apps/web-main/src/jobs/self-learning.ts)
    - LITELLM_API_KEY_<AGENCY_UPPER> per-agency key with global fallback
    - agency:<id>:ai:monthly-spend Redis key for spend counter
key_files:
  created:
    - packages/ai/src/cost-cap.ts
    - packages/ai/src/model-routing.ts
    - packages/ai/src/__tests__/cost-cap.test.ts
    - packages/ai/src/__tests__/model-routing.test.ts
    - packages/ai/src/__tests__/generate-content.test.ts
    - apps/web-main/src/jobs/cost-reset.ts
  modified:
    - packages/ai/src/generate-content.ts
    - packages/ai/src/index.ts
    - packages/ai/package.json
    - apps/web-main/instrumentation.node.ts
decisions:
  - Per-agency LiteLLM key resolved as LITELLM_API_KEY_${agencyId.toUpperCase()} with fallback to LITELLM_API_KEY
  - Monthly spend Redis key is agency:<id>:ai:monthly-spend (lowercase agencyId in key, uppercase for env var)
  - BullMQ cron '0 0 1 * *' resets monthly spend counters on the 1st of each month
  - Cost tracking errors swallowed — recordAgencySpend must never break user requests
  - TTL on spend keys set to 35 days (slightly longer than a calendar month)
  - Cost estimate heuristic: Math.ceil(total_tokens * 0.0002) cents per response
  - AiBudgetExceededError thrown when spent >= cap (not strictly > cap)
  - "@types/ioredis-mock@8.2.7" added to satisfy verbatimModuleSyntax strict typecheck
metrics:
  duration: "~25 minutes"
  completed_date: "2026-04-27"
  tasks_completed: 3
  files_created: 6
  files_modified: 4
  tests_added: 40
  commits: 3
---

# Phase 07 Plan 01: AI Cost Cap + Model Routing + Cron Reset Summary

**One-liner:** Per-agency LiteLLM budget enforcement via Redis spend counter, tier-based model routing (4 tiers), and BullMQ monthly cron reset — prerequisite for all Phase 7 AI editor features.

## What Was Built

### packages/ai/src/cost-cap.ts

New module providing per-agency LiteLLM cost cap enforcement (REQ-080):

- `getAgencyLiteLLMKey(agencyId)` — resolves `LITELLM_API_KEY_<AGENCY_UPPER>` with fallback to global `LITELLM_API_KEY`
- `checkAgencyCostCap(agencyId)` — reads Redis key `agency:<id>:ai:monthly-spend`, throws `AiBudgetExceededError` if `spent >= cap` (where cap is `LITELLM_BUDGET_<AGENCY_UPPER>` in cents)
- `recordAgencySpend(agencyId, cents)` — INCRBY on spend counter, sets 35-day TTL on new keys, swallows errors
- `resetMonthlySpend()` — SCAN + pipeline DEL of all `agency:*:ai:monthly-spend` keys, returns count deleted
- `AiBudgetExceededError` — extends Error with `name = 'AiBudgetExceededError'`

Redis client pattern copied verbatim from `packages/seo/src/config-cache.ts` (try/finally redis.quit()).

### packages/ai/src/model-routing.ts

New module providing tiered model routing:

- `ModelTier` type: `'tier1-bulk' | 'tier2-writing' | 'tier2-research' | 'tier3-max'`
- `MODEL_ROUTING` const map:
  - `tier1-bulk` → `['gemini-2.5-flash-lite', 'gpt-4.1-nano']`
  - `tier2-writing` → `['claude-sonnet-4-6']`
  - `tier2-research` → `['gemini-2.5-pro']`
  - `tier3-max` → `['claude-opus-4-6']`
- `getModelForTier(tier?)` — returns primary model, defaults to `tier1-bulk`

### packages/ai/src/generate-content.ts (extended)

Phase 7 extensions (all optional — Phase 5/6 callers unchanged):

- Added `agencyId?`, `tier?`, `systemPrompt?` to `GenerateContentParams`
- Pipeline order: `checkAgencyCostCap` → `fetch` → `recordAgencySpend`
- Per-agency key resolution via `getAgencyLiteLLMKey`
- Model selected via `getModelForTier(params.tier)` (legacy callers get `tier1-bulk` = `gemini-2.5-flash-lite`)
- LiteLLM metadata tagging: `metadata: { tags: ['agency:<id>'] }` when agencyId provided
- Cost estimate: `Math.ceil(total_tokens * 0.0002)` cents per response

Stub fallback path (no `LITELLM_API_URL`) preserved unchanged for CI/local dev.

### apps/web-main/src/jobs/cost-reset.ts

BullMQ repeatable worker registered at server startup:
- Queue: `ai-cost-reset`
- Cron: `'0 0 1 * *'` (midnight on the 1st of each month UTC)
- Worker body: calls `resetMonthlySpend()` from `@mjagency/ai`, logs count cleared
- Pitfall 7 dedup: checks `getRepeatableJobs()` before adding (prevents duplicate cron runs on restart)

### apps/web-main/instrumentation.node.ts (modified)

Added `registerCostReset()` call after Phase 6 `registerAlgoWatcher()`.

## Test Counts

| File | Tests |
|------|-------|
| cost-cap.test.ts | 19 |
| model-routing.test.ts | 7 |
| generate-content.test.ts | 14 |
| **Total** | **40** |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `c40200c` | test | RED — failing tests for cost-cap (TDD gate) |
| `3f333cb` | feat | GREEN — cost cap + model routing + agencyId-aware generateContent |
| `9cdb6cd` | feat | Monthly cost-reset cron job |

## TDD Gate Compliance

- RED commit (`c40200c`) precedes GREEN commit (`3f333cb`) — TDD gate satisfied.
- RED test confirmed failure: `Failed to load url ../cost-cap.js — Does the file exist?`
- GREEN tests: all 40 tests pass after implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ioredis-mock cross-test state pollution in cost-cap.test.ts**
- **Found during:** Task 2 GREEN verification
- **Issue:** Test `recordAgencySpend > increments agency:<id>:ai:monthly-spend by the given cents` was using the `'ecommerce'` agencyId which already had spend accumulated from earlier tests in the same ioredis-mock instance.
- **Fix:** Changed the test to use unique agency ID `'increments-test-agency'` with a 200-cent cap (above the 25-cent increment) to avoid cross-test state pollution.
- **Files modified:** `packages/ai/src/__tests__/cost-cap.test.ts`
- **Commit:** `3f333cb`

**2. [Rule 2 - Missing] Added @types/ioredis-mock to devDependencies**
- **Found during:** Task 2 typecheck run
- **Issue:** `verbatimModuleSyntax` + `strict` mode required type declarations for `ioredis-mock`; error TS7016: "Could not find a declaration file for module 'ioredis-mock'".
- **Fix:** Added `"@types/ioredis-mock": "8.2.7"` to devDependencies in `packages/ai/package.json`.
- **Files modified:** `packages/ai/package.json`, `pnpm-lock.yaml`
- **Commit:** `3f333cb`

## Known Stubs

None — all exports provide real implementation. The stub fallback in `generate-content.ts` is intentional (preserved from Phase 5 for CI/local dev when `LITELLM_API_URL` is absent).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: env-secret-access | packages/ai/src/cost-cap.ts | Reads `LITELLM_API_KEY_<AGENCY>` per-agency secrets; these must be injected via Doppler (never hardcoded). Existing pattern — same as Phase 5 global key. |

## Pre-existing web-main Typecheck Status

`pnpm --filter @mjagency/web-main typecheck` has 30 pre-existing errors from earlier phases (packages/cms, packages/db, packages/config, packages/media) that are out of scope for this plan. Zero new errors introduced by this plan's files (`cost-reset.ts`, `instrumentation.node.ts`).

## Self-Check: PASSED

Files exist:
- packages/ai/src/cost-cap.ts: FOUND
- packages/ai/src/model-routing.ts: FOUND
- packages/ai/src/__tests__/cost-cap.test.ts: FOUND
- packages/ai/src/__tests__/model-routing.test.ts: FOUND
- packages/ai/src/__tests__/generate-content.test.ts: FOUND
- apps/web-main/src/jobs/cost-reset.ts: FOUND

Commits exist:
- c40200c (RED test): FOUND
- 3f333cb (GREEN implementation): FOUND
- 9cdb6cd (cron job): FOUND

Tests: 40/40 passing. Typecheck (AI package): exit 0.
