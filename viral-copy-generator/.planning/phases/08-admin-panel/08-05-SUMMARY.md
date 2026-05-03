---
phase: 08-admin-panel
plan: 05
subsystem: api
tags: [express, admin, node-os, child_process, fs-promises, sql-aggregates, security, typescript]

# Dependency graph
requires:
  - phase: 08-admin-panel
    plan: 04
    provides: adminRouter with learning reset and platform stats routes (DELETE /users/:userId/learning, GET /stats/platforms)
provides:
  - GET /api/admin/health — VPS CPU count, memory MB, disk usage (df -h /var), Supabase DB size (pg_size_pretty), pg-boss queue depth (ADMIN-07)
  - GET /api/admin/logs — pino log tail with userId/from filters, 1-500 line cap, graceful missing-file handling (ADMIN-08)
affects: [08-06, 08-07, 08-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "os module (cpus/totalmem/freemem) + promisify(exec) for df -h — all Node.js built-ins, no external dependencies"
    - "Fail-partial pattern: disk and DB queries each have independent try/catch; response always returns what is available + error field for what failed"
    - "Fixed-string exec() — 'df -h /var' is a literal constant; no user input concatenated (T-08-17 mitigation)"
    - "LOG_FILE env var for log path — operator-controlled, never req.query/req.params (T-08-19 mitigation)"
    - "Pino log parsing: split on newline, filter Boolean, JSON.parse each line independently, fail-open for non-JSON lines"
    - "Hard cap Math.min(Math.max(1, rawLines), 500) — 500-line ceiling prevents large reads in a single request (T-08-20 mitigation)"

key-files:
  created: []
  modified:
    - backend/src/routes/admin.ts

key-decisions:
  - "readFile import added together with os/exec/promisify imports in Task 1 commit — import-section consolidation avoids a two-commit touch to the import block"
  - "Fail-partial for health endpoint: disk and DB queries are independent try/catch blocks so a df failure does not suppress the DB size result and vice versa — admin gets maximum available diagnostic info even in partial-failure scenarios"
  - "Pino log lines parsed independently: invalid JSON lines are kept (fail-open) rather than dropped — startup messages and stack traces that span multiple lines are not silently lost"
  - "filterUserId checks both 'userId' and 'user_id' keys — pino camelCase vs snake_case variance across log sites; both are covered without requiring a format migration"

patterns-established:
  - "Fixed-command exec() pattern: command string is a compile-time literal with no user input; prevents shell injection while enabling VPS introspection"
  - "Env-var-only file path pattern: readFile receives process.env.LOG_FILE — operator sets path at deploy time, no request-time path construction possible"

requirements-completed: [ADMIN-07, ADMIN-08]

# Metrics
duration: 6min
completed: 2026-05-03
---

# Phase 8 Plan 05: System Health + Log Viewer Summary

**VPS health dashboard (os module + df + pg_size_pretty + pg-boss queue count) and pino log tail with userId/from filters — ADMIN-07, ADMIN-08**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-03T20:30:00Z
- **Completed:** 2026-05-03T20:36:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- GET /api/admin/health returns: cpu.count (os.cpus().length), memory {total_mb, free_mb, used_mb, use_pct} (os.totalmem/freemem), disk {size, used, avail, usePct} (parsed from df -h /var stdout), database {size} (pg_size_pretty SQL), queue {pending_jobs} (COUNT from pgboss.job)
- Fail-partial design: disk (exec) and database (db.execute) each have independent try/catch; whichever succeeds returns its data, the other returns its error message — admin sees maximum diagnostic info in degraded scenarios
- GET /api/admin/logs reads LOG_FILE env var (defaults to /var/log/app.log); returns last N lines (1-500, default 100); supports ?userId= and ?from= (ISO-8601) filters applied per parsed JSON line; fails gracefully with `{ lines: [], meta: { error } }` if file is missing
- All exec() and readFile() paths are free of user-input influence: df command is a fixed string literal (T-08-17), logPath is from process.env only (T-08-19)
- TypeScript compiles cleanly — tsc --noEmit exits 0, no `any` types

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GET /api/admin/health** - `1d0b05f` (feat)
2. **Task 2: Add GET /api/admin/logs** - `f2e231a` (feat)

## Files Created/Modified

- `backend/src/routes/admin.ts` — os, child_process.exec, promisify, fs/promises.readFile imports added; execAsync constant added; GET /health and GET /logs appended after GET /stats/platforms; no existing routes modified

## Decisions Made

- readFile import added in Task 1 commit alongside the other Node.js built-in imports — consolidates the import block in a single commit rather than touching it twice
- Fail-partial for /health: each of disk and DB has its own try/catch so a single-component failure does not suppress the rest of the health payload
- Pino log parsing is fail-open: non-JSON lines (startup logs, stack traces) pass through all filters and are included in the tail result

## Deviations from Plan

None — plan executed exactly as written. Both routes match the plan's action blocks verbatim. The only variation was including `readFile` import in the Task 1 commit (rather than Task 2) to consolidate the import section — this has no functional impact.

## Known Stubs

None — both routes perform real OS calls and database queries against live resources.

## Threat Flags

None — both new endpoints are within the plan's threat model (T-08-17 through T-08-20). No new network surfaces beyond what the plan covers.

## Self-Check: PASSED

- `backend/src/routes/admin.ts` exists and contains both new routes
- Commits `1d0b05f` and `f2e231a` exist in git log
- tsc --noEmit exits 0
- `os.freemem` present (1 match)
- `pg_size_pretty` present (1 match)
- `df -h` present (1 match — fixed string literal)
- `LOG_FILE` present (1 match — env var)
- `Math.min.*500` present (1 match — line cap)

---
*Phase: 08-admin-panel*
*Completed: 2026-05-03*
