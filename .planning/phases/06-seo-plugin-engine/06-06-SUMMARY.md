---
phase: 06-seo-plugin-engine
plan: "06"
subsystem: seo
tags: [seo, algo-watcher, rss-parser, bullmq, payload-collection, redis, guid-dedup, cron-job, req-074]

# Dependency graph
requires:
  - phase: 06-01
    provides: rss-parser 3.13.0 dependency in @mjagency/seo, plugin engine infrastructure
  - phase: 06-05
    provides: seoSuggestionsCollection superAdminOnly pattern, registerSelfLearning BullMQ pattern, instrumentation.node.ts structure

provides:
  - algoAlertsCollection — global Payload collection, superAdminOnly all 4 operations, no agency_id, status=new
  - processRssFeed — rss-parser wrapper with Pitfall 4 GUID fallback, keyword matching, Redis SADD/SISMEMBER dedup, 90-day TTL
  - AlgoAlert — TypeScript interface exported from @mjagency/seo
  - registerAlgoWatcher — BullMQ repeatable job every 6h with Pitfall 7 idempotency check, SSRF URL validation, overrideAccess:true Payload writes
  - algo-watcher.test.ts — 3 unit tests covering known-GUID skip, keyword match, no-match seen-set behavior

affects:
  - Phase 9 (email engine: algo alerts email notifications deferred to Phase 9)
  - Phase 12 UAT (algo-watcher requires Redis + Payload running to trigger test runs)

# Tech tracking
tech-stack:
  added:
    - "rss-parser 3.13.0 (already added in plan 06-01, verified present)"
  patterns:
    - "Pitfall 4 GUID fallback: item.guid ?? item.link ?? isoDate:title for stable dedup key"
    - "No-match items marked seen (Redis pipeline SADD+EXPIRE) to prevent reprocessing on every 6h run"
    - "BullMQ Pitfall 7 dedup: getRepeatableJobs() check before queue.add on every server restart"
    - "SSRF prevention: /^https?:\\/\\//.test(feedUrl) before fetch on configurable feeds"
    - "Global collection with overrideAccess:true in worker — system-level writes bypass superAdminOnly"
    - "JSDoc comments with cron expressions avoid */ sequence that TypeScript misparses as comment close"

key-files:
  created:
    - packages/cms/src/collections/algo-alerts.ts
    - packages/seo/src/algo-watcher/rss.ts
    - apps/web-main/src/jobs/algo-watcher.ts
    - packages/seo/src/__tests__/algo-watcher.test.ts
  modified:
    - packages/cms/src/collections/index.ts (algoAlertsCollection added to CORE_COLLECTIONS + named export, 14 collections)
    - packages/seo/src/index.ts (processRssFeed + AlgoAlert exports appended)
    - apps/web-main/instrumentation.node.ts (registerAlgoWatcher() call appended after registerSelfLearning)

key-decisions:
  - "algoAlertsCollection is global (no agency_id) — matches D-12; superAdminOnly on all 4 operations prevents algo intelligence leaking to agency editors"
  - "No-match RSS items also marked as seen via Redis pipeline — prevents reprocessing same items on every 6h poll cycle; only keyword-matching items become AlgoAlert objects"
  - "Used @payload-config alias in algo-watcher.ts for Payload config import — consistent with self-learning.ts codebase pattern"
  - "Payload migrate blocked by pre-existing AlignmentFeature export error in lexical-features.ts — not caused by plan 06-06 changes; code correctness unaffected"
  - "JSDoc cron expression written as plain English to avoid */ sequence that TypeScript misparses as JSDoc comment close (parse error at line 6)"

requirements-completed:
  - REQ-074

# Metrics
duration: 6min
completed: 2026-04-27
---

# Phase 06 Plan 06: Algorithm Watcher (RSS monitoring → algo_alerts Payload collection + BullMQ 6h cron) Summary

**RSS monitoring of Google Search Central blog + configurable secondary feeds, keyword-matched items create algo_alerts records (super_admin-only) via BullMQ repeatable job every 6h, with Redis GUID deduplication using 90-day TTL and Pitfall 4 fallback chain**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-27T02:20:02Z
- **Completed:** 2026-04-27T02:26:08Z
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- algoAlertsCollection created: global Payload collection (no agency_id), superAdminOnly on all 4 access operations (read/create/update/delete), status defaults to 'new', fields: title/source/link/matched_keywords(json)/snippet/pub_date/status/guid(readOnly)
- RSS parsing utility (processRssFeed): rss-parser 3.13.0 wrapper with Pitfall 4 GUID fallback chain (guid ?? link ?? isoDate:title), Redis SISMEMBER check for already-seen GUIDs, no-match items marked seen to prevent reprocessing, keyword-matching items returned as AlgoAlert[], graceful error handling (log + return [] on fetch failure)
- BullMQ registerAlgoWatcher(): 6h cron ('0 */6 * * *'), Pitfall 7 getRepeatableJobs() idempotency check, hardcoded GSC feed + configurable secondary feeds, SSRF URL validation (/^https?:\/\//), overrideAccess:true on payload.create for all algo_alerts writes, redis.quit() in finally block
- 3 unit tests covering: known GUID skipped (no alert), new GUID + keyword match produces AlgoAlert, new GUID + no keyword match → pipeline.exec called (marked seen), all 67 seo tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: algo_alerts collection + RSS parsing utility + algo-watcher tests** - `5b05eef` (feat)
2. **Task 2: algorithm watcher BullMQ job + Payload migrate** - `8ed9a92` (feat)

## Files Created/Modified

- `packages/cms/src/collections/algo-alerts.ts` — CollectionConfig with slug 'algo_alerts', group 'SEO', superAdminOnly x4, no agency_id, status defaultValue 'new', guid field readOnly
- `packages/seo/src/algo-watcher/rss.ts` — processRssFeed() + AlgoAlert interface, SEEN_KEY='seo:algo-watcher:seen-guids', SEEN_TTL_SECONDS=90*24*60*60
- `apps/web-main/src/jobs/algo-watcher.ts` — registerAlgoWatcher() with BullMQ queue 'seo-algo-watcher', cron 0 */6 * * *, Pitfall 7 dedup, GSC_BLOG_FEED hardcoded, SSRF validation, overrideAccess:true
- `packages/seo/src/__tests__/algo-watcher.test.ts` — 3 describe blocks with in-memory Redis mock and rss-parser vi.mock
- `packages/cms/src/collections/index.ts` — algoAlertsCollection added (now 14 collections)
- `packages/seo/src/index.ts` — processRssFeed + AlgoAlert exports appended
- `apps/web-main/instrumentation.node.ts` — registerAlgoWatcher() call appended (all 3 workers: cms-scheduled-publish, registerSelfLearning, registerAlgoWatcher)

## Decisions Made

- Used `@payload-config` alias for Payload config import in algo-watcher.ts (consistent with self-learning.ts — codebase-standard for src/ files in web-main)
- No-match RSS items are marked as seen via pipeline SADD+EXPIRE to avoid reprocessing on every 6h poll — this is a deliberate design choice to reduce Redis write volume over time while preventing item re-evaluation
- JSDoc comment for cron expression written without `*/6` to avoid TypeScript parse error (TypeScript misreads `*/6` in JSDoc as closing the comment block)
- Payload migrate blocked by pre-existing AlignmentFeature error — noted in SUMMARY, code correctness unaffected per plan directive

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed JSDoc cron expression causing TypeScript parse error**
- **Found during:** Task 2 (typecheck)
- **Issue:** JSDoc comment line `* Cron: every 6 hours ('0 */6 * * *') per D-13.` caused TypeScript parse errors at lines 6-17. TypeScript interpreted `*/6` as closing the JSDoc block, producing "Expression expected", "Unterminated string literal", and 20+ cascade errors.
- **Fix:** Replaced `'0 */6 * * *'` in the JSDoc comment with `cron expression: 0 every-6h every-hour every-day every-weekday`. The ALGO_WATCHER_CRON constant in code correctly uses the string `'0 */6 * * *'`.
- **Files modified:** `apps/web-main/src/jobs/algo-watcher.ts`
- **Verification:** `pnpm --filter @mjagency/web-main typecheck` shows only pre-existing errors (lexical-features, svg-sanitize, otel-node, db schema, color-thief-node) — no errors from algo-watcher.ts
- **Committed in:** 8ed9a92 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug)
**Impact on plan:** Auto-fix required for type correctness. No scope creep. The actual cron string value is correct in code.

## Issues Encountered

**Payload migrate blocked:** `CI=true PAYLOAD_MIGRATING=true npx payload migrate` exits non-zero with:
```
SyntaxError: The requested module '@payloadcms/richtext-lexical' does not provide an export named 'AlignmentFeature'
```
This is a pre-existing error in `packages/cms/src/editor/lexical-features.ts` that predates plan 06-06. The Payload configuration cannot fully load because lexical-features.ts fails at runtime. This is the same error visible in all typechecks since Phase 5. The algo_alerts collection code is correct — the table cannot be created until the AlignmentFeature issue is resolved separately. Per plan directive: "If it exits non-zero, note the error in SUMMARY but do NOT block."

## Known Stubs

None. The algo-watcher is fully implemented:
- processRssFeed() uses real rss-parser (graceful degradation on fetch failure)
- Redis SADD/SISMEMBER uses real ioredis pipeline
- registerAlgoWatcher() uses real BullMQ queue + worker with real cron
- payload.create() writes real algo_alerts records with overrideAccess:true

The watcher will produce no alerts until Redis is running and feeds are reachable. This is expected behavior, not a stub.

## Threat Surface Scan

All new surface is covered by the plan's threat model:
- T-06-06-01: SSRF via configurable feed URL — mitigated via /^https?:\/\// test before fetch
- T-06-06-02: algo_alerts visible to agency editors — mitigated via superAdminOnly x4
- T-06-06-03: duplicate algo_alerts for same RSS item — mitigated via Redis SADD/SISMEMBER + Pitfall 4 GUID fallback
- T-06-06-04: malicious RSS XML injection — accepted (rss-parser handles; text-only storage)
- T-06-06-05: duplicate BullMQ repeatable jobs — mitigated via getRepeatableJobs() idempotency check

## Next Phase Readiness

- Plan 06-06 is the final execution plan for Phase 6 (seo-plugin-engine)
- algo_alerts collection is registered in CORE_COLLECTIONS — will be live in Payload admin once AlignmentFeature issue is resolved and migrate runs
- Algorithm watcher will start processing RSS feeds on first server startup after Redis is available
- Phase 9 (email engine) can wire algo_alerts notifications when email infrastructure is ready

---
*Phase: 06-seo-plugin-engine*
*Completed: 2026-04-27*

## Self-Check: PASSED

Files verified:
- packages/cms/src/collections/algo-alerts.ts: EXISTS
- packages/seo/src/algo-watcher/rss.ts: EXISTS
- apps/web-main/src/jobs/algo-watcher.ts: EXISTS
- packages/seo/src/__tests__/algo-watcher.test.ts: EXISTS
- .planning/phases/06-seo-plugin-engine/06-06-SUMMARY.md: EXISTS

Commits verified:
- 5b05eef: EXISTS (Task 1 — algo_alerts collection + RSS parsing utility + algo-watcher tests)
- 8ed9a92: EXISTS (Task 2 — algorithm watcher BullMQ job + Payload migrate attempt)

Typechecks:
- @mjagency/seo typecheck: PASSED (0 errors)
- @mjagency/cms typecheck: pre-existing errors only (lexical-features, svg-sanitize, otel-node, db schema, color-thief-node — none from plan 06-06 changes)
- @mjagency/web-main typecheck: pre-existing errors only (same cms/config/db/media package errors — no errors in src/jobs/algo-watcher.ts or instrumentation.node.ts)

Tests:
- pnpm --filter @mjagency/seo test: 67/67 PASSED (6 test files, including 3 new algo-watcher tests)
