---
phase: "09"
plan: "01"
subsystem: backend/db
tags: [schema, pg-boss, drizzle, trend-cache, content-ideas, tdd, wave-0]
dependency_graph:
  requires: []
  provides:
    - trend_cache table with UNIQUE(source,niche) for ON CONFLICT upsert
    - content_ideas table with pgPolicy RLS matching posts pattern
    - registerResearchRefreshJob pg-boss daily job (5am UTC)
    - research-cache.ts stub (satisfies tsc for lazy import resolution)
    - RED test stubs: research-cache.test.ts, research-ai.test.ts, research.test.ts
  affects:
    - backend/src/db/schema.ts
    - backend/src/lib/boss.ts
    - backend/src/index.ts
    - backend/.env.example
tech_stack:
  added:
    - google-trends-api@4.9.2 (CJS/ESM interop: default import returns 'object')
  patterns:
    - pg-boss createQueue() before schedule() FK constraint guard
    - drizzle unique() (not index()) for ON CONFLICT UNIQUE constraint
    - lazy dynamic import in pg-boss worker to avoid circular dep
    - Wave 0 Nyquist test stubs (RED until implementation plans)
key_files:
  created:
    - backend/src/lib/research-cache.ts (stub — full impl in Plan 09-03)
    - backend/drizzle/0001_nasty_morlun.sql (migration)
    - backend/tests/research-cache.test.ts (RED stubs)
    - backend/tests/research-ai.test.ts (RED stubs)
    - backend/tests/research.test.ts (passing placeholder stubs)
  modified:
    - backend/src/db/schema.ts (added trend_cache + content_ideas + types)
    - backend/src/lib/boss.ts (added registerResearchRefreshJob)
    - backend/src/index.ts (wired registerResearchRefreshJob in main())
    - backend/.env.example (added optional YOUTUBE_API_KEY comment)
    - backend/package.json (google-trends-api@4.9.2)
decisions:
  - "unique() NOT index() on trend_cache(source, niche) — required for ON CONFLICT DO UPDATE upsert (Pitfall 6 from RESEARCH.md)"
  - "YOUTUBE_API_KEY is optional (not in REQUIRED_ENV) — fetchYouTubeTrends returns [] if absent; other 3 sources still work"
  - "google-trends-api default import returns 'object' — no createRequire wrapper needed in Plan 09-02"
  - "research-cache.ts stub created to satisfy tsc dynamic import resolution in boss.ts worker"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-05-04"
  tasks_completed: 3
  tasks_total: 3
  files_created: 7
  files_modified: 5
---

# Phase 9 Plan 01: DB Foundation + Wave 0 Test Stubs Summary

**One-liner:** Drizzle schema extended with trend_cache (global, UNIQUE upsert constraint) + content_ideas (per-user RLS), pg-boss daily refresh job registered, google-trends-api@4.9.2 installed, and RED Wave 0 test stubs created for all Phase 9 implementation plans.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend schema.ts with trend_cache and content_ideas | bccaf18 | schema.ts, 0001_nasty_morlun.sql |
| 2 | Register refresh-trends pg-boss job + wire + install google-trends-api | 598a2a9 | boss.ts, index.ts, .env.example, research-cache.ts, package.json |
| 3 | Create RED test stubs for Wave 0 | 0328a17 | research-cache.test.ts, research-ai.test.ts, research.test.ts |

## Decisions Made

1. **unique() NOT index() on trend_cache(source, niche)** — `ON CONFLICT (source, niche) DO UPDATE` requires a UNIQUE constraint, not a regular index. Confirmed in migration SQL: `CONSTRAINT "trend_cache_source_niche_unique" UNIQUE("source","niche")`.

2. **YOUTUBE_API_KEY optional** — Added as a commented-out env var in `.env.example`, NOT in `REQUIRED_ENV`. The `fetchYouTubeTrends` function (Plan 09-02) will guard on `process.env.YOUTUBE_API_KEY` and return `[]` if absent. Other 3 sources still operate.

3. **google-trends-api CJS/ESM interop** — Tested with `node --input-type=module` spike. `import googleTrends from 'google-trends-api'` returns `typeof === 'object'`. No `createRequire` wrapper needed. Plan 09-02 can use the default import directly.

4. **research-cache.ts stub** — Created minimal stub to satisfy TypeScript `NodeNext` module resolution for the lazy dynamic import in boss.ts worker. The stub exports `getTrendCache`, `setTrendCache`, `isCacheFresh`, `refreshAllNiches` — all throw `Error('not yet implemented')`. Plan 09-03 replaces with real implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created research-cache.ts stub for tsc dynamic import resolution**
- **Found during:** Task 2 — tsc failed with `Cannot find module './research-cache.js'`
- **Issue:** TypeScript `NodeNext` module resolution checks dynamic imports statically; `research-cache.ts` didn't exist yet
- **Fix:** Created `backend/src/lib/research-cache.ts` with throwing stubs for all 4 exports
- **Files modified:** `backend/src/lib/research-cache.ts` (new file)
- **Commit:** 598a2a9

## Verification Results

```
npx tsc --noEmit  → CLEAN (zero errors)
drizzle-kit generate → migration contains UNIQUE("source","niche") on trend_cache
drizzle-kit migrate → migrations applied successfully
grep unique backend/src/db/schema.ts → unique('trend_cache_source_niche_unique')
grep registerResearchRefreshJob backend/src/index.ts → import (line 4) + await call (line 44)
grep YOUTUBE_API_KEY backend/src/index.ts → empty (not in REQUIRED_ENV)
grep YOUTUBE_API_KEY backend/.env.example → commented-out optional
```

## Test State

| File | State | Reason |
|------|-------|--------|
| research-cache.test.ts | RED (11 failures) | Modules `trends/youtube.js`, `trends/google-trends.js`, `trends/reddit.js`, `trends/exploding.js`, `research-cache.js` not yet implemented |
| research-ai.test.ts | RED (3 failures) | Module `research-ai.js` not yet implemented |
| research.test.ts | GREEN (4 passing) | Placeholder stubs — replaced in Plan 09-04 |

RED state is correct and expected. Nyquist rule satisfied.

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| backend/src/lib/research-cache.ts | All exports throw `Error('not yet implemented')` | Plan 09-01 stub only; full implementation in Plan 09-03 |

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what the plan's threat model covers. The `content_ideas` RLS policy follows the exact same `pgPolicy` pattern as all other per-user tables. The `trend_cache` table is intentionally global (no user_id, no RLS) — consistent with the threat model disposition for T-09-02.

## Self-Check: PASSED
