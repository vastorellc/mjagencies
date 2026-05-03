---
phase: 06-auto-upload-scheduling
plan: "03"
status: complete
subsystem: backend-scheduling
tags: [scheduling, pkt, peak-times, tdd, upload]
dependency_graph:
  requires: [06-01]
  provides: [getPeakTimes, PKT_PEAK_TIMES, GET /api/upload/peak-times]
  affects: [06-04-schedule-modal]
tech_stack:
  added: []
  patterns: [tdd-red-green, allowlist-validation]
key_files:
  created:
    - backend/src/lib/scheduling.ts
    - backend/src/test/scheduling.test.ts
  modified:
    - backend/src/routes/upload.ts
    - backend/vitest.config.ts
decisions:
  - "setUTCDate before setUTCHours in candidate construction to avoid month-overflow bugs when advancing days"
  - "Allowlist array PEAK_VALID_PLATFORMS separate from VALID_PLATFORMS (upload schedule) to include 'x' for peak-times endpoint"
  - "Updated vitest.config.ts include pattern to cover src/test/**/*.test.ts alongside existing tests/ pattern"
metrics:
  duration: "8 minutes"
  completed: "2026-05-03T11:17:00Z"
  tasks_completed: 1
  files_changed: 4
---

# Phase 06 Plan 03: PKT Peak-Time Scheduling Utility Summary

PKT peak-time scheduler with `getPeakTimes()` function and `GET /api/upload/peak-times` endpoint, fully unit-tested via TDD.

## What Was Built

### backend/src/lib/scheduling.ts
- `PKT_PEAK_TIMES` constant — maps all 5 platforms to their UTC day+hour specs (PKT-5h)
- `getPeakTimes(platform, fromDate?)` — scans forward up to 14 days, returns first 2 slots >5min in future as UTC ISO-8601 strings
- `x` platform returns `[]` (always immediate, no scheduling)
- Type-exported: `SchedulablePlatform`

### backend/src/test/scheduling.test.ts
8 unit tests covering:
- YouTube: both slots on Friday
- YouTube: past-slot skip (14:00Z start skips 13:00Z)
- Instagram: Monday slots
- Facebook: Wednesday slots
- TikTok: Tuesday slots
- X: empty array
- Max 2 slots cap
- All slots are valid parseable ISO-8601 UTC strings

### backend/src/routes/upload.ts
- Added `GET /api/upload/peak-times?platform=` endpoint
- Allowlist guard: `PEAK_VALID_PLATFORMS` includes all 5 platforms (youtube/instagram/tiktok/facebook/x)
- Returns `{ slots: string[] }` — 0-2 ISO strings

### backend/vitest.config.ts
- Extended `include` to `['tests/**/*.test.ts', 'src/test/**/*.test.ts']` so scheduling tests are found

## TDD Gate Compliance

- RED commit: `450c16e` — `test(06-03): add failing tests for PKT peak-time scheduling utility`
- GREEN commit: `189ef90` — `feat(06-03): PKT peak-time scheduling utility + GET /api/upload/peak-times`

Both gates present in correct order.

## Verification Results

- `vitest run src/test/scheduling.test.ts` — 8/8 tests pass
- `tsc --noEmit` — exits 0
- `grep 'peak-times' backend/src/routes/upload.ts` — shows GET endpoint at line 211
- `grep 'PKT_PEAK_TIMES' backend/src/lib/scheduling.ts` — shows constant at line 15

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts include pattern missed src/test/ directory**
- **Found during:** RED phase (no test files found error)
- **Issue:** vitest.config.ts had `include: ['tests/**/*.test.ts']` — plan specified `backend/src/test/` location which was not covered
- **Fix:** Extended include to `['tests/**/*.test.ts', 'src/test/**/*.test.ts']`
- **Files modified:** `backend/vitest.config.ts`
- **Commit:** `189ef90`

**2. [Rule 3 - Blocking] setUTCDate ordering fix**
- **Found during:** GREEN implementation review
- **Issue:** Plan's pseudocode called `setUTCHours` then `setUTCDate` — this order can cause month-overflow (e.g., setting hours on Jan 31 then adding days computes wrong month). Reordered to `setUTCDate` first, `setUTCHours` second.
- **Fix:** Swapped operation order in candidate construction
- **Files modified:** `backend/src/lib/scheduling.ts`
- **Impact:** All 8 tests pass with correct order

## Known Stubs

None. All data is computed from real date arithmetic. No placeholder values.

## Threat Flags

No new security surface beyond what was planned in the threat model (T-06-11 platform allowlist — implemented).

## Self-Check: PASSED

- [x] `backend/src/lib/scheduling.ts` exists
- [x] `backend/src/test/scheduling.test.ts` exists
- [x] `backend/src/routes/upload.ts` contains GET peak-times endpoint
- [x] `backend/vitest.config.ts` updated
- [x] Commit `450c16e` exists (RED gate)
- [x] Commit `189ef90` exists (GREEN gate)
- [x] 8/8 tests pass
- [x] tsc exits 0
