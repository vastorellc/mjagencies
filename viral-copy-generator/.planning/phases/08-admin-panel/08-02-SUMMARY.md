---
phase: 08-admin-panel
plan: 02
subsystem: admin
tags: [express, admin, pg-boss, job-management, security, typescript]

# Dependency graph
requires:
  - phase: 08-admin-panel
    plan: 01
    provides: adminRouter with double-gate auth, getBoss import pattern
provides:
  - GET /api/admin/jobs — list all pg-boss jobs with state filter, ADMIN-10 data allowlist
  - POST /api/admin/jobs/:id/retry — resume a failed job via boss.resume(name, id)
  - DELETE /api/admin/jobs/:id — cancel a pending/active job via boss.cancel(name, id)
affects: [08-03, 08-04, 08-05, 08-06, 08-07, 08-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw SQL on pgboss.job via Drizzle db.execute(sql`...`) — Drizzle has no schema for pg-boss internal tables"
    - "Job data allowlist pattern: safeData extracts only userId/platform/fileId/scheduledAt/postId; any other field silently dropped"
    - "pg-boss v12 (name, id) API: queue name looked up from pgboss.job before boss.resume/cancel call; jobId-only public API"
    - "404 on unknown jobId for retry/cancel — prevents silent no-op on stale admin UI references"

key-files:
  created: []
  modified:
    - backend/src/routes/admin.ts

key-decisions:
  - "pg-boss v12 boss.resume/cancel requires (name, id) not just (id) — plan interface was outdated; look up name from pgboss.job before calling (Rule 1 auto-fix)"
  - "ADMIN-10 allowlist uses bracket notation (data['userId']) to satisfy TypeScript strict indexing on Record<string,unknown>"
  - "?state=all query param includes completed+cancelled in the listing — default omits them to keep the view actionable"
  - "404 returned when retry/cancel targets a non-existent jobId — more informative than silent boss no-op"

# Metrics
duration: 3min
completed: 2026-05-03
---

# Phase 8 Plan 02: pg-boss Queue Management Endpoints Summary

**Three admin endpoints for pg-boss job visibility: list all jobs with ADMIN-10 field allowlist, retry a failed job (boss.resume), cancel a pending job (boss.cancel) — pg-boss v12 (name, id) API handled transparently**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-03T20:13:02Z
- **Completed:** 2026-05-03T20:16:46Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- GET /api/admin/jobs queries pgboss.job via Drizzle raw SQL, returns last 200 jobs newest-first; accepts ?state=all to include completed/cancelled
- ADMIN-10 compliant: job data filtered through safeData allowlist before response — only userId, platform, fileId, scheduledAt, postId included; api_key_encrypted and OAuth tokens structurally excluded
- POST /api/admin/jobs/:id/retry looks up queue name from pgboss.job, calls boss.resume(name, id); returns 404 if job not found
- DELETE /api/admin/jobs/:id looks up queue name, calls boss.cancel(name, id); returns 404 if job not found
- TypeScript compiles cleanly — tsc --noEmit exits 0, no `any` types

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GET /api/admin/jobs** - `4b06fd3` (feat)
2. **Task 2: Add POST /jobs/:id/retry and DELETE /jobs/:id** - `5b2280f` (feat)

## Files Created/Modified
- `backend/src/routes/admin.ts` — three new routes added (GET /jobs, POST /jobs/:id/retry, DELETE /jobs/:id); three new imports added (db, getBoss, sql); no existing routes modified

## Decisions Made
- pg-boss v12 resume/cancel take `(name: string, id: string)` not `(id: string)` — plan interface comment was outdated; queue name looked up from pgboss.job before each call; public API remains jobId-only
- ADMIN-10 allowlist: bracket notation (`data['userId']`) required for TypeScript strict mode with `Record<string,unknown>` — dot notation causes implicit index errors
- Default state filter omits completed/cancelled; ?state=all opt-in — keeps the admin UI focused on actionable jobs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pg-boss v12 boss.resume/cancel signature mismatch**
- **Found during:** Task 2 TypeScript compile
- **Issue:** Plan interface showed `boss.resume(jobId)` and `boss.cancel(jobId)` (1 argument). pg-boss v12 type definition requires `(name: string, id: string | string[])` — 2 required arguments. TypeScript error TS2554 on both calls.
- **Fix:** Added a `SELECT name FROM pgboss.job WHERE id = $1 LIMIT 1` lookup before each boss.resume/boss.cancel call. Returns 404 if job not found (bonus: more informative than pg-boss silent no-op). Queue name passed as first argument.
- **Files modified:** backend/src/routes/admin.ts
- **Commits:** 5b2280f

## Known Stubs
None — all routes perform real database operations against pgboss.job.

## Threat Flags
None — no new network endpoints beyond what the threat model covers. SQL is parameterized via Drizzle sql template (T-08-07). State filter uses sql fragments, not string concatenation. LIMIT 200 hard cap enforced (T-08-08). Job data allowlist enforced (T-08-05).

## Self-Check: PASSED

- `backend/src/routes/admin.ts` exists and contains all three routes
- Commits `4b06fd3` and `5b2280f` exist in git log
- tsc --noEmit exits 0

---
*Phase: 08-admin-panel*
*Completed: 2026-05-03*
