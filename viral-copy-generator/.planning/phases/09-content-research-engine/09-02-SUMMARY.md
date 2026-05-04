---
phase: "09"
plan: "02"
subsystem: backend/lib/trends
tags: [trend-fetchers, youtube, google-trends, reddit, exploding-topics, fail-open, tdd, wave-1]
dependency_graph:
  requires:
    - 09-01 (TrendItem type in schema.ts, research-cache.ts stub, google-trends-api@4.9.2 installed)
  provides:
    - fetchYouTubeTrends(niche): Promise<TrendItem[]> — googleapis client, regionCode=PK, category map, env guard
    - fetchGoogleTrends(niche): Promise<TrendItem[]> — google-trends-api relatedQueries, JSON.parse, rankedList[1]
    - fetchRedditTrends(niche): Promise<TrendItem[]> — subreddit map, mandatory User-Agent, per-sub try/catch
    - fetchExplodingTopics(niche): Promise<TrendItem[]> — best-effort HTML scrape, regex JSON extract
    - google-trends-api.d.ts — hand-rolled type declarations (no @types package available)
  affects:
    - backend/src/lib/trends/ (new directory)
    - backend/src/types/ (new directory)
    - backend/tests/research-cache.test.ts (4/6 tests now GREEN — fetcher shape tests)
tech_stack:
  added:
    - google-trends-api.d.ts type declaration (hand-rolled — no @types/google-trends-api on npm)
  patterns:
    - fail-open async fetcher pattern (every fetcher returns [] on any error, never throws)
    - env guard pattern (YOUTUBE_API_KEY absence returns [] immediately)
    - per-subreddit try/catch with continue + outer fail-open catch
    - AbortSignal.timeout() for per-fetcher network timeouts
    - JSON.parse on google-trends-api raw string response (Pitfall 7)
    - rankedList[1] for rising queries (index 0 = top/established)
key_files:
  created:
    - backend/src/lib/trends/youtube.ts
    - backend/src/lib/trends/google-trends.ts
    - backend/src/lib/trends/reddit.ts
    - backend/src/lib/trends/exploding.ts
    - backend/src/types/google-trends-api.d.ts
  modified: []
decisions:
  - "google-trends-api default import used directly — CJS/ESM interop confirmed in Plan 09-01 spike (typeof === 'object', no createRequire wrapper needed)"
  - "Hand-rolled google-trends-api.d.ts — @types/google-trends-api does not exist on npm; minimal interface covers relatedQueries + interestOverTime"
  - "Reddit outer try/catch added — plan showed per-subreddit catch only; outer catch ensures return [] is always reachable for grep verification and robustness"
  - "ExplodingTopics _niche param prefixed with underscore — function is global fetch (not niche-filtered); underscore suppresses unused-param TypeScript warning"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-05-04"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 0
---

# Phase 9 Plan 02: Trend Fetchers (YouTube, Google Trends, Reddit, ExplodingTopics) Summary

**One-liner:** Four fail-open async trend fetchers implemented — YouTube (googleapis, regionCode=PK, category map, API key env guard), Google Trends (google-trends-api default import, JSON.parse on raw string, rising queries at rankedList[1]), Reddit (custom User-Agent required, per-subreddit try/catch, AbortSignal.timeout), and ExplodingTopics (best-effort HTML scrape, regex JSON extraction, silently returns []).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | YouTube and Google Trends fetchers | 706092e | youtube.ts, google-trends.ts, google-trends-api.d.ts |
| 2 | Reddit and ExplodingTopics fetchers | 0bece9b | reddit.ts, exploding.ts |

## Decisions Made

1. **google-trends-api default import** — CJS/ESM interop was confirmed in Plan 09-01 Task 2 spike: `import googleTrends from 'google-trends-api'` returns `typeof === 'object'`. No `createRequire` wrapper needed. Used Option A from the plan directly.

2. **Hand-rolled google-trends-api.d.ts** — `@types/google-trends-api` does not exist on npm (404). Created minimal type declaration at `backend/src/types/google-trends-api.d.ts` covering the `relatedQueries`, `interestOverTime`, and other methods used in this codebase. Placed in `src/types/` to keep it within tsconfig's `include: ["src/**/*"]` scope.

3. **Reddit outer try/catch** — The plan's code sample showed only per-subreddit inner catch. Added an outer try/catch returning `[]` to ensure the function is fully fail-open and satisfies the `grep -rn "return \[\]"` verification check from the plan's success criteria.

4. **ExplodingTopics `_niche` prefix** — The function scrapes a global trending page (not niche-specific). The niche parameter is accepted to match the `TrendItem[]` interface contract but unused. Prefixed with `_` to suppress TypeScript unused-variable warning (strict mode).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created google-trends-api.d.ts type declaration**
- **Found during:** Task 1 — `tsc --noEmit` failed with `TS7016: Could not find a declaration file for module 'google-trends-api'`
- **Issue:** No `@types/google-trends-api` package exists on npm; the CJS library has no bundled TypeScript types
- **Fix:** Created `backend/src/types/google-trends-api.d.ts` with minimal interface covering `relatedQueries`, `interestOverTime`, and other library methods
- **Files modified:** `backend/src/types/google-trends-api.d.ts` (new file)
- **Commit:** 706092e

## Verification Results

```
npx tsc --noEmit          → CLEAN (zero errors)
ls backend/src/lib/trends/ → youtube.ts  google-trends.ts  reddit.ts  exploding.ts
grep -rn "return \[\]" backend/src/lib/trends/ → return [] in all 4 files confirmed
grep YOUTUBE_API_KEY youtube.ts → env guard on line 18
grep JSON.parse google-trends.ts → JSON.parse call on line 29
grep rankedList google-trends.ts → rankedList[1] on line 31
grep viral-copy-generator reddit.ts → User-Agent on line 6
grep AbortSignal.timeout reddit.ts → 8000ms timeout
grep AbortSignal.timeout exploding.ts → 10000ms timeout
```

## Test State

| File | State | Notes |
|------|-------|-------|
| research-cache.test.ts fetchYouTubeTrends | GREEN (pass) | Returns [] without YOUTUBE_API_KEY — correct behavior |
| research-cache.test.ts fetchGoogleTrends | GREEN (pass) | Fail-open returns [] without API |
| research-cache.test.ts fetchRedditTrends | GREEN (pass) | Returns [] due to AbortSignal timeout in test env |
| research-cache.test.ts fetchExplodingTopics | GREEN (pass) | Returns [] on fetch failure — correct |
| research-cache.test.ts getTrendCache | RED (expected) | research-cache.ts stub — implemented in Plan 09-03 |
| research-cache.test.ts setTrendCache | RED (expected) | research-cache.ts stub — implemented in Plan 09-03 |

4/6 tests GREEN. 2 RED tests are expected stubs from Plan 09-01, to be implemented in Plan 09-03.

## Known Stubs

None. All four fetcher files are fully implemented. The `research-cache.ts` stub from Plan 09-01 is out of scope for this plan.

## Threat Surface Scan

No new network endpoints created. The four fetcher modules make outbound HTTP requests to external services (YouTube API, Google Trends, Reddit, ExplodingTopics) — all from server-side only. Per the plan's threat model:

- T-09-05 (YOUTUBE_API_KEY exposure): Key is server-side only, never returned in responses, never logged. Pino redact config already active.
- T-09-06 (DoS from timeouts): AbortSignal.timeout(8000) on Reddit, AbortSignal.timeout(10000) on ExplodingTopics. YouTube uses googleapis timeout defaults. All fail-open.
- T-09-04 (trend data tampering/prompt injection): Trend titles from these fetchers pass through research-ai.ts sanitization (Plan 09-03) before entering any AI prompt.

No new trust boundary surfaces beyond what the plan's threat model covers.

## Self-Check: PASSED
