---
phase: 08-admin-panel
plan: 06
subsystem: frontend-types-api
tags: [typescript, types, api-client, admin, strict-mode]

# Dependency graph
requires:
  - phase: 08-admin-panel
    plan: 05
    provides: GET /api/admin/health and GET /api/admin/logs routes (ADMIN-07, ADMIN-08)
provides:
  - Screen type extended with 'admin' variant (ADMIN-01)
  - AdminJob, AdminUser, AdminHealthResponse, AdminLogsResponse, AdminPlatformStat, AdminPlatformStatsResponse types in types.ts
  - 10 admin API client functions in api.ts: fetchAdminJobs, retryAdminJob, cancelAdminJob, fetchAdminUsers, disableAdminUser, enableAdminUser, resetAdminLearning, fetchAdminHealth, fetchAdminLogs, fetchAdminPlatformStats
affects: [08-07, 08-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase block pattern: admin types appended as a labeled block after Phase 7 types — mirrors Phase 5, 6, 7 precedents for easy grepping"
    - "apiFetch() wrapping pattern: all 10 admin functions delegate to apiFetch() which auto-attaches Bearer token — no manual Authorization header in admin functions"
    - "Fail-partial union in AdminHealthResponse: disk | { error: string } and database | { error: string } — mirrors backend fail-partial pattern from 08-05 at the type level"
    - "encodeURIComponent() on all user-supplied path segments — consistent with Phase 7 api.ts pattern, prevents path injection"
    - "res.json().catch(() => ({})) in disableAdminUser — only for the error-path body read (admin self-lockout error message); other success paths use typed cast directly"

key-files:
  created: []
  modified:
    - frontend/src/lib/types.ts
    - frontend/src/lib/api.ts

key-decisions:
  - "AdminDiskInfo exported as a named interface (not inlined) — enables 08-07 AdminPage to import and do 'disk' in health checks in type-narrowed branches"
  - "fetchAdminLogs options object (not positional params) — all three filters are optional; object param avoids callers passing undefined multiple times"
  - "fetchAdminJobs includeAll=false default — default behaviour omits cancelled jobs so the admin queue view is not cluttered; opt-in for full history"
  - "resetAdminLearning returns { deleted: number } not void — confirmation display in AdminPage shows 'Deleted N signals' without a second fetch"
  - "disableAdminUser reads error body on failure — backend returns { error: 'Cannot disable your own account' } for self-lockout; surfacing this in the thrown Error enables AdminPage to show specific message"

patterns-established:
  - "Admin API functions all follow: apiFetch() → res.ok guard → typed res.json() cast — no inline fetch, no raw URLs, no missing error handling"

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07, ADMIN-08, ADMIN-09]

# Metrics
duration: 2min
completed: 2026-05-03
---

# Phase 8 Plan 06: Admin Types + API Client Summary

**TypeScript type contracts for all 9 admin API endpoints (AdminJob, AdminUser, AdminHealthResponse, AdminLogsResponse, AdminPlatformStatsResponse) and 10 typed API client functions — Screen union extended with 'admin'**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-03T20:34:55Z
- **Completed:** 2026-05-03T20:36:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Screen type in types.ts extended from 4 variants to 5: `'generator' | 'settings' | 'history' | 'learning' | 'admin'` — enables App.tsx navigation to AdminPage without casting (ADMIN-01)
- 9 exported admin interfaces added to types.ts: AdminJobData, AdminJob (state union of 6 pg-boss states), AdminUser (banned boolean + connected_platforms string[]), AdminDiskInfo, AdminHealthResponse (fail-partial union for disk and database fields), AdminLogsMeta, AdminLogsResponse, AdminPlatformStat, AdminPlatformStatsResponse
- 10 admin API client functions added to api.ts — all use apiFetch() (Bearer token auto-attached), all return typed responses, no `any` types
- Import block in api.ts updated to include 5 new admin types from types.ts
- TypeScript: tsc --noEmit exits 0 with no errors or warnings

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Phase 8 admin types to types.ts and extend Screen type** - `f1018f2` (feat)
2. **Task 2: Add admin API client functions to api.ts** - `10cbf20` (feat)

## Files Created/Modified

- `frontend/src/lib/types.ts` — Screen type extended; 87 lines added (Phase 8 admin block: 9 interfaces, 0 `any` types)
- `frontend/src/lib/api.ts` — import updated; 116 lines added (Phase 8 admin block: 10 exported functions)

## Decisions Made

- AdminDiskInfo exported as a named interface so 08-07 AdminPage can import and use type narrowing on the disk field (`'size' in health.disk`)
- fetchAdminLogs takes an options object rather than positional parameters — all three filters (lines, userId, from) are optional; object param avoids undefined-chaining at call sites
- fetchAdminJobs defaults includeAll=false — default view omits cancelled jobs; pass true for full pg-boss history
- resetAdminLearning returns `{ deleted: number }` not void — AdminPage can display "Deleted N signals" confirmation without an extra fetch
- disableAdminUser reads error body on failure path — backend sends `{ error: 'Cannot disable your own account' }` for self-lockout; error message propagates to AdminPage UI

## Deviations from Plan

None — plan executed exactly as written. Both tasks match the plan action blocks verbatim. TypeScript passed cleanly on first attempt.

## Known Stubs

None — types.ts and api.ts contain no placeholder values; all interfaces directly model the backend response shapes documented in the plan's `<interfaces>` block.

## Threat Flags

None — no new network endpoints or auth paths added in this plan. Types are compile-time contracts; api.ts admin functions delegate to apiFetch() which already enforces Bearer token on all requests (T-08-21 confirmed: frontend admin gating is UX-only; backend double-gate is enforcement layer).

## Self-Check: PASSED

- `frontend/src/lib/types.ts` exists and contains Screen='admin', AdminJob, AdminUser, AdminHealthResponse
- `frontend/src/lib/api.ts` exists and contains all 10 admin functions
- Commit `f1018f2` exists in git log (Task 1)
- Commit `10cbf20` exists in git log (Task 2)
- tsc --noEmit exits 0 (no output)
- grep ": any|as any" returns 0 matches in both files

---
*Phase: 08-admin-panel*
*Completed: 2026-05-03*
