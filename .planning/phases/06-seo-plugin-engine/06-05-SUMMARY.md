---
phase: 06-seo-plugin-engine
plan: "05"
subsystem: seo
tags: [seo, self-learning, gsc, ga4, bullmq, payload-collection, service-account, cron-job, req-073]

# Dependency graph
requires:
  - phase: 06-01
    provides: plugin engine infrastructure, barrel index, redis config cache, @mjagency/seo package
  - phase: 06-03
    provides: faqs collection pattern (global super_admin-only collections), generateContent() from @mjagency/ai

provides:
  - seoSuggestionsCollection — global Payload collection, superAdminOnly all 4 operations, status=pending_review
  - runSelfLearningForAgency — GSC+GA4 signal pull (28d per-agency via env keys), AI tuner call, seo_suggestions write
  - SelfLearningJobData — empty interface for BullMQ job typed with no input data
  - registerSelfLearning — BullMQ repeatable daily cron job (0 2 * * *) with Pitfall 7 dedup check
  - @googleapis/searchconsole 6.0.1 + @google-analytics/data 5.2.1 dependencies in @mjagency/seo

affects:
  - 06-06 (algo-alerts follows same superAdminOnly global collection pattern as seo_suggestions)
  - Phase 12 UAT (self-learning requires GSC/GA4 service account setup per user_setup in PLAN.md)

# Tech tracking
tech-stack:
  added:
    - "@googleapis/searchconsole 6.0.1 (GSC API v3 via AuthPlus.GoogleAuth service account auth)"
    - "@google-analytics/data 5.2.1 (GA4 Data API v1beta via BetaAnalyticsDataClient)"
    - "@mjagency/ai workspace:* (generateContent() for AI weight tuner step)"
    - "payload 3.82.1 as peerDep+devDep in @mjagency/seo (Payload type access in worker.ts)"
  patterns:
    - "Per-agency GSC/GA4 credentials via env: GSC_SERVICE_ACCOUNT_KEY_<AGENCY_ID>.toUpperCase()"
    - "Skip-silently pattern: missing credentials return [] and 0-metric check exits early"
    - "AI tuner uses generateContent().text — GenerateContentResult.text field (not raw string)"
    - "BullMQ Pitfall 7 dedup: getRepeatableJobs() check before queue.add on every server restart"
    - "@googleapis/searchconsole auth via auth.GoogleAuth constructor (AuthPlus property pattern)"
    - "payload.config imported via '@payload-config' alias from within src/ files"

key-files:
  created:
    - packages/cms/src/collections/seo-suggestions.ts
    - packages/seo/src/self-learning/worker.ts
    - apps/web-main/src/jobs/self-learning.ts
  modified:
    - packages/cms/src/collections/index.ts (seoSuggestionsCollection added to CORE_COLLECTIONS + named export)
    - packages/seo/src/index.ts (runSelfLearningForAgency + SelfLearningJobData re-exports appended)
    - packages/seo/package.json (@google-analytics/data, @googleapis/searchconsole, @mjagency/ai, payload peer/dev)
    - apps/web-main/instrumentation.node.ts (registerSelfLearning() call appended after cms-scheduled-publish)
    - pnpm-lock.yaml (new dependency lock entries)

key-decisions:
  - "Used auth.GoogleAuth (AuthPlus property) from @googleapis/searchconsole instead of importing googleapis — only the scoped package is installed, not the full googleapis bundle"
  - "generateContent() returns GenerateContentResult not string — used result.text to extract the raw AI output string"
  - "payload imported as peerDep+devDep in @mjagency/seo — worker.ts needs Payload type; cms package already has it as direct dep; seo adds it as peer to maintain correct dep graph"
  - "Used @payload-config alias (not relative path) in self-learning.ts — this is the codebase-standard pattern for payload config access from within src/ files"
  - "queue.add cast to unknown for SelfLearningJobData — createEncryptedQueue returns Queue<EncryptedPayload> but proxy add() handler accepts T; non-sensitive data passes through unencrypted"
  - "getRepeatableJobs() dedup checks both cron and pattern fields — BullMQ v4 uses 'cron' field; v5+ may use 'pattern'; both covered for forward compat"

requirements-completed:
  - REQ-073

# Metrics
duration: 15min
completed: 2026-04-27
---

# Phase 06 Plan 05: Self-Learning Loop (GSC + GA4 signals → AI tuner → seo_suggestions) Summary

**Daily BullMQ cron job pulling GSC impressions/CTR/position and GA4 bounce rate/session signals per agency, calling generateContent() as AI weight tuner, writing suggestions to seo_suggestions collection (super_admin-only) for human review before applying**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-27T02:00:00Z
- **Completed:** 2026-04-27T02:15:55Z
- **Tasks:** 2
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- seoSuggestionsCollection created: global Payload collection (no agency_id), superAdminOnly on all 4 access operations (read/create/update/delete), status defaults to 'pending_review', fields: agency_slug, suggestion_type, status, signal_summary (json), suggested_config (json), ai_rationale (textarea), data_window (text)
- Self-learning worker: per-agency GSC and GA4 signal fetch (last 28 days), early-exit when both return empty, AI tuner via generateContent() with JSON parse of suggested_config + rationale, Payload.create with overrideAccess:true
- BullMQ registerSelfLearning(): daily cron '0 2 * * *', Pitfall 7 idempotency check via getRepeatableJobs() before add, loads all agencies from settings collection, per-agency try/catch continues on error

## Task Commits

Each task was committed atomically:

1. **Task 1: seo_suggestions collection + self-learning worker logic** - `1a08cd8` (feat)
2. **Task 2: BullMQ repeatable job for self-learning cron** - `badf297` (feat)

## Files Created/Modified

- `packages/cms/src/collections/seo-suggestions.ts` — CollectionConfig with slug 'seo_suggestions', group 'SEO', superAdminOnly x4, status defaultValue 'pending_review'
- `packages/seo/src/self-learning/worker.ts` — runSelfLearningForAgency + fetchGscMetrics + fetchGa4Metrics + SelfLearningJobData interface
- `apps/web-main/src/jobs/self-learning.ts` — registerSelfLearning() with BullMQ queue + worker + dedup check
- `packages/cms/src/collections/index.ts` — seoSuggestionsCollection added (now 13 collections)
- `packages/seo/src/index.ts` — runSelfLearningForAgency + SelfLearningJobData exports appended
- `packages/seo/package.json` — @google-analytics/data 5.2.1, @googleapis/searchconsole 6.0.1, @mjagency/ai, payload 3.82.1 peer/dev
- `apps/web-main/instrumentation.node.ts` — registerSelfLearning() appended after cms-scheduled-publish

## Decisions Made

- `auth.GoogleAuth` (from `@googleapis/searchconsole`'s `AuthPlus` instance) used for GSC service account authentication — the full `googleapis` package is not installed; only the scoped `@googleapis/searchconsole` is available, which re-exports `GoogleAuth` as a property on the exported `auth` instance
- `generateContent()` returns `GenerateContentResult` not a string — `result.text` extracted for JSON parsing of AI tuner response
- `payload` added as peer+devDep to `@mjagency/seo` for the `Payload` type in worker.ts
- `@payload-config` alias used in `src/jobs/self-learning.ts` — consistent with all other src/ files in web-main; relative path `../../payload.config.js` would also work but breaks if file moves
- `getRepeatableJobs()` dedup checks both `cron` and `pattern` fields for forward compatibility with BullMQ v5+

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect googleapis import — package not installed**
- **Found during:** Task 1 (typecheck)
- **Issue:** Plan code used `import { google } from 'googleapis'` but only `@googleapis/searchconsole` is installed (not the full `googleapis` bundle). TypeScript reported "Cannot find module 'googleapis'".
- **Fix:** Changed to `import { searchconsole, auth as gscAuth } from '@googleapis/searchconsole'` and used `gscAuth.GoogleAuth` constructor (AuthPlus stores GoogleAuth as a static property per its type definition).
- **Files modified:** `packages/seo/src/self-learning/worker.ts`
- **Verification:** `pnpm --filter @mjagency/seo typecheck` passes cleanly after fix

**2. [Rule 2 - Missing] Added payload as peer/dev dependency to @mjagency/seo**
- **Found during:** Task 1 (typecheck)
- **Issue:** `worker.ts` imports `import type { Payload } from 'payload'` but `payload` was not in `@mjagency/seo`'s dependency list. TypeScript reported "Cannot find module 'payload'".
- **Fix:** Added `payload: 3.82.1` as both peerDependency and devDependency in `packages/seo/package.json`.
- **Files modified:** `packages/seo/package.json`
- **Verification:** `pnpm --filter @mjagency/seo typecheck` passes cleanly after fix

**3. [Rule 2 - Missing] Added @mjagency/ai as dependency to @mjagency/seo**
- **Found during:** Task 1 (typecheck)
- **Issue:** `worker.ts` uses `await import('@mjagency/ai')` for the AI tuner step but `@mjagency/ai` was not listed as a dependency. TypeScript reported "Cannot find module '@mjagency/ai'".
- **Fix:** Added `@mjagency/ai: workspace:*` to `packages/seo/package.json` dependencies.
- **Files modified:** `packages/seo/package.json`
- **Verification:** `pnpm --filter @mjagency/seo typecheck` passes cleanly after fix

**4. [Rule 1 - Bug] Fixed generateContent() return type — returns GenerateContentResult not string**
- **Found during:** Task 1 (implementation analysis)
- **Issue:** Plan code used `const raw = await generateContent(...)` and then called `raw.match(...)` as if it were a string. But `generateContent()` returns `GenerateContentResult` with a `.text` field. The plan's code assumed a plain string return.
- **Fix:** Changed to `const result = await generateContent(...)` then `const raw = result.text` before calling `.match()`.
- **Files modified:** `packages/seo/src/self-learning/worker.ts`
- **Verification:** TypeScript now resolves `.text` as `string` correctly

**5. [Rule 1 - Bug] Fixed @payload-config import path for payload.config in BullMQ worker**
- **Found during:** Task 2 (typecheck)
- **Issue:** Plan's worker code used `import('../payload.config.js')` (root-relative) but from `src/jobs/self-learning.ts` this would need `../../payload.config.js`. TypeScript reported "Cannot find module '../payload.config.js'".
- **Fix:** Used `@payload-config` alias which is the codebase-standard approach for all `src/` files and maps to `./payload.config.ts` via tsconfig paths.
- **Files modified:** `apps/web-main/src/jobs/self-learning.ts`
- **Verification:** No TypeScript errors on new files after fix

**6. [Rule 1 - Bug] Fixed SelfLearningJobData type incompatibility with queue.add**
- **Found during:** Task 2 (typecheck)
- **Issue:** `createEncryptedQueue<T>()` returns `Queue<EncryptedPayload>` for type safety, so `queue.add()` expects `EncryptedPayload` not `SelfLearningJobData`. TypeScript error: "Argument of type 'SelfLearningJobData' is not assignable to parameter of type 'EncryptedPayload'".
- **Fix:** Cast the queue to a typed wrapper for the dedup add call: `(queue as unknown as { add(...) }).add(...)`. The proxy's actual runtime add() handler accepts T and passes non-sensitive data through.
- **Files modified:** `apps/web-main/src/jobs/self-learning.ts`
- **Verification:** No TypeScript errors on new files after fix

---

**Total deviations:** 6 auto-fixed (3 Rule 1 bugs, 2 Rule 2 missing deps/functionality, 1 Rule 2 missing dep)
**Impact on plan:** All auto-fixes necessary for type correctness and correct API usage. No scope creep.

## Known Stubs

None. The self-learning worker is fully implemented:
- GSC and GA4 signal fetching is real (credentials skip handled gracefully)
- AI tuner calls real `generateContent()` (falls back to stub text when LITELLM_API_URL absent per plan design)
- seo_suggestions.create writes real Payload records with overrideAccess:true
- BullMQ job registers with real cron and dedup logic

The self-learning loop will produce no suggestions until agencies have GSC/GA4 service account credentials configured in Doppler. This is intentional and documented in the plan's `user_setup` section.

## Threat Surface Scan

Threat model already covers all new surface in this plan:
- T-06-05-01: GSC/GA4 keys in logs — mitigated (only `.message` logged in catch, not credential string)
- T-06-05-02: overrideAccess:true in worker — accepted (BullMQ worker is system-level, not request-scoped)
- T-06-05-03: seo_suggestions visible to agency editors — mitigated (superAdminOnly on all 4 operations)
- T-06-05-04: Duplicate BullMQ jobs — mitigated (getRepeatableJobs() dedup check before queue.add)
- T-06-05-05: LiteLLM call with large signal data — mitigated (prompt uses averages not raw rows, maxTokens=500)

## User Setup Required

Service account credentials must be configured in Doppler for each agency before the self-learning loop can produce suggestions:
- `GSC_SERVICE_ACCOUNT_KEY_<AGENCY_ID>` — JSON string from Google Cloud Console service account key. Add service account email as Restricted user in Search Console property settings.
- `GA4_SERVICE_ACCOUNT_KEY_<AGENCY_ID>` — Same service account JSON (or separate). Add service account email as Viewer in GA4 property access management.
- `GA4_PROPERTY_ID_<AGENCY_ID>` — GA4 Admin → Property → Property ID (numeric string, e.g. "123456789")

Agencies without credentials are silently skipped. The loop runs daily at 2am regardless; agencies with no credentials produce no records.

## Next Phase Readiness

- Plan 06-06 (algo-alerts collection + RSS watcher) can now be executed — it follows the same superAdminOnly global collection pattern as seo_suggestions
- seoSuggestionsCollection is live in CORE_COLLECTIONS — Payload admin will show the SEO > Suggestions view for super_admin users
- Self-learning loop active — will start producing suggestions once GSC/GA4 credentials are provisioned

---
*Phase: 06-seo-plugin-engine*
*Completed: 2026-04-27*

## Self-Check: PASSED

Files verified:
- packages/cms/src/collections/seo-suggestions.ts: EXISTS
- packages/seo/src/self-learning/worker.ts: EXISTS
- apps/web-main/src/jobs/self-learning.ts: EXISTS

Commits verified:
- 1a08cd8: EXISTS (Task 1 — seo_suggestions collection + self-learning worker)
- badf297: EXISTS (Task 2 — BullMQ repeatable job)

Typechecks:
- @mjagency/seo typecheck: PASSED (0 errors in new files)
- @mjagency/cms typecheck: pre-existing errors only (lexical-features, svg-sanitize, otel-node, db schema, color-thief-node — none from plan 06-05 changes)
- @mjagency/web-main typecheck: pre-existing errors only (same cms/config/db/media package errors — no errors in src/jobs/self-learning.ts or instrumentation.node.ts)
