---
phase: 08-public-frontend
plan: "08-03"
subsystem: cms
tags: [isr, cache, next-cache, revalidate-tag, payload-hooks, cms, revalidation]

# Dependency graph
requires:
  - phase: 05-cms-collections
    provides: "pagesCollection, postsCollection with hooks.afterChange arrays"
  - phase: 08-public-frontend
    plan: 08-01
    provides: "web-main canonical template; agency app pattern established"
provides:
  - "isrPurgeHook — Payload afterChange hook for pages, calls revalidateTag for agency:<id>:page:<slug> and agency:<id>:collection:pages"
  - "isrPurgePostHook — Payload afterChange hook for posts, calls revalidateTag for agency:<id>:post:<slug> and agency:<id>:collection:posts"
  - "Both hooks exported from @mjagency/cms barrel"
  - "5 unit tests verifying tag format, guards, and idempotency"
affects:
  - 08-07-PLAN (dynamic [slug] page route exports revalidate = 60 to complete the 60s SLA)
  - All 12 agency app instances that embed Payload CMS via @mjagency/cms

# Tech tracking
tech-stack:
  added:
    - "next@15.5.15 devDependency in @mjagency/cms — provides next/cache types for tsc"
    - "next@>=15.0.0 peerDependency in @mjagency/cms — documents runtime requirement"
  patterns:
    - "afterChange hook pattern: reads doc.agency_id and doc.slug, guards on absence, calls revalidateTag twice per content type"
    - "Tag convention: agency:<agencyId>:<type>:<slug> for item-level + agency:<agencyId>:collection:<type> for list-level"
    - "Guard pattern: if (!agencyId || !slug) return — prevents stale/invalid cache purges"

key-files:
  created:
    - "packages/cms/src/hooks/isr-purge.ts — isrPurgeHook + isrPurgePostHook with revalidateTag calls"
    - "packages/cms/src/__tests__/isr-purge.test.ts — 5 unit tests (mocked next/cache)"
  modified:
    - "packages/cms/src/collections/pages.ts — appended isrPurgeHook to afterChange array"
    - "packages/cms/src/collections/posts.ts — appended isrPurgePostHook to afterChange array"
    - "packages/cms/src/index.ts — exported isrPurgeHook and isrPurgePostHook from barrel"
    - "packages/cms/package.json — added next@15.5.15 devDependency + peerDependency"

key-decisions:
  - "isrPurgeHook and isrPurgePostHook are separate functions (not one parameterized hook) — each function has precise tag format for its collection type and eliminates conditional branching at runtime"
  - "next added as devDependency (15.5.15) in @mjagency/cms to satisfy TypeScript's resolution of next/cache types; also declared as peerDependency to document the runtime requirement"
  - "Test helpers pageArg() and postArg() use typed factory pattern with Parameters<typeof hook>[0] return type — avoids as any casts while keeping test args minimal and readable"
  - "afterChange array uses append pattern: [schedulePublishHook, isrPurgeHook] — preserves existing schedulePublishHook order"

requirements-completed:
  - REQ-091

# Metrics
duration: 10min
completed: "2026-04-27"
---

# Phase 08 Plan 03: ISR + tag-based cache purge — Payload afterChange hook → revalidateTag Summary

**isrPurgeHook and isrPurgePostHook call revalidateTag from next/cache on every Payload page/post save, using agency:<id>:<type>:<slug> tag convention — 5 unit tests pass, hooks registered in both collections, both exported from @mjagency/cms**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-27T05:29:01Z
- **Completed:** 2026-04-27T05:39:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `packages/cms/src/hooks/isr-purge.ts` with `isrPurgeHook` (pages) and `isrPurgePostHook` (posts), each calling `revalidateTag` twice: item-level (`agency:<id>:page:<slug>`) and collection-level (`agency:<id>:collection:pages`) (REQ-091)
- Guards prevent `revalidateTag` calls when `agency_id` or `slug` are absent — avoids invalid cache purges on incomplete documents
- Registered `isrPurgeHook` in `pagesCollection.hooks.afterChange` and `isrPurgePostHook` in `postsCollection.hooks.afterChange`, appended after the existing `schedulePublishHook`
- Exported both hooks from `@mjagency/cms` barrel (`src/index.ts`)
- 5 unit tests all pass: valid doc triggers 2 revalidateTag calls each, missing agency_id/slug skips calls, idempotency verified

## Task Commits

Each task was committed atomically:

1. **Task 1: Create isr-purge.ts hook and unit tests** - `df8b508` (feat)
2. **Task 2: Register hooks in collections + export from index** - `cadf488` (feat)

## Files Created/Modified

- `packages/cms/src/hooks/isr-purge.ts` (new) — isrPurgeHook + isrPurgePostHook
- `packages/cms/src/__tests__/isr-purge.test.ts` (new) — 5 unit tests with mocked next/cache
- `packages/cms/src/collections/pages.ts` (modified) — afterChange: [schedulePublishHook, isrPurgeHook]
- `packages/cms/src/collections/posts.ts` (modified) — afterChange: [schedulePublishHook, isrPurgePostHook]
- `packages/cms/src/index.ts` (modified) — added export { isrPurgeHook, isrPurgePostHook } from './hooks/isr-purge.js'
- `packages/cms/package.json` (modified) — next@15.5.15 devDependency + peerDependency

## Decisions Made

- Separate hook functions (isrPurgeHook vs isrPurgePostHook) rather than one parameterized function — cleaner and no runtime conditional needed
- `next` added as devDependency in CMS package so TypeScript can resolve `next/cache` types during typecheck
- Test factory helpers `pageArg()` / `postArg()` return `Parameters<typeof hook>[0]` for strict typing without casting the entire argument
- Append-to-afterChange pattern preserves existing `schedulePublishHook` execution order

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing `next` dependency in CMS package.json for next/cache types**
- **Found during:** Task 2 TypeScript check
- **Issue:** `src/hooks/isr-purge.ts` imports from `next/cache` but `packages/cms` had no `next` dependency declared; tsc reported `TS2307: Cannot find module 'next/cache'`
- **Fix:** Added `next@15.5.15` as devDependency and `next@>=15.0.0` as peerDependency in `packages/cms/package.json`
- **Files modified:** `packages/cms/package.json`, `pnpm-lock.yaml`
- **Commit:** `cadf488`

**2. [Rule 1 - Bug] Fixed test argument type errors for Payload CollectionAfterChangeHook signature**
- **Found during:** Task 2 TypeScript check
- **Issue:** Test file passed args missing `context` and `data` fields required by Payload 3.82.1's `CollectionAfterChangeHook` type (TS2345 errors); the plan's original test template used `as never` casts for collection/req but did not include the required `context` and `data` properties
- **Fix:** Refactored test to use typed factory helpers `pageArg()` and `postArg()` with `Parameters<typeof isrPurgeHook>[0]` return type — includes `context: {}` and `data: {}` stubs
- **Files modified:** `packages/cms/src/__tests__/isr-purge.test.ts`
- **Commit:** `cadf488`

## Pre-existing TypeScript Errors (Out of Scope)

The following TypeScript errors exist in the CMS package but pre-date this plan and are not caused by this plan's changes. They are deferred per deviation Rule scope:

- `src/collections/media-assets.ts(52)` — AfterOperationHook parameter type mismatch
- `src/config/build-payload-config.ts(77)` — `afterDocControls` not in admin type
- `src/dam/search.ts(103)` — `Where` type index signature incompatibility
- `src/hooks/svg-sanitize.ts(46)` — DOMPurify `WindowLike` vs `Window` type mismatch
- `packages/db/src/schema/*.ts` — `SQL<unknown>` not assignable to `PgPolicyToOption`
- `packages/media/src/color-extraction.ts` — missing `@types/color-thief-node`

## Issues Encountered

None beyond the two auto-fixed TypeScript issues documented above.

## User Setup Required

None. The hooks fire automatically when Payload saves a page or post document. The `revalidate = 60` export on dynamic page routes (REQ-091 SLA) is handled in plan 08-07.

## Next Phase Readiness

- Both ISR purge hooks are registered and exported — ready for Wave 4 dynamic route plans (08-07) to add `export const revalidate = 60` to complete the full 60s SLA
- `revalidateTag` tag format (`agency:<id>:<type>:<slug>`) is established — Wave 4 fetches must use `unstable_cache` or `fetch` with matching tags
- All 5 unit tests pass; hooks are testable in isolation via vitest with mocked next/cache

## Self-Check: PASSED

- `packages/cms/src/hooks/isr-purge.ts` — FOUND
- `packages/cms/src/__tests__/isr-purge.test.ts` — FOUND
- commit `df8b508` — FOUND
- commit `cadf488` — FOUND

---
*Phase: 08-public-frontend*
*Completed: 2026-04-27*
