---
phase: 08-admin-panel
plan: 04
subsystem: admin
tags: [express, admin, drizzle, transactions, sql-aggregates, security, typescript]

# Dependency graph
requires:
  - phase: 08-admin-panel
    plan: 03
    provides: adminRouter with user management routes (GET /users, PATCH /users/:userId/disable, PATCH /users/:userId/enable)
provides:
  - DELETE /api/admin/users/:userId/learning — atomic learning data reset (ADMIN-06)
  - GET /api/admin/stats/platforms — aggregate platform upload + virality stats (ADMIN-09, ADMIN-10)
affects: [08-05, 08-06, 08-07, 08-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "db.transaction() wraps COUNT + DELETE learning_signals + UPDATE settings.learned_weights atomically — no partial commit possible"
    - "COUNT(*)::text inside transaction before DELETE — count returned in response for admin confirmation feedback"
    - "COUNT(*) FILTER (WHERE upload_status = 'posted') — conditional aggregate avoids subquery for success/failure split"
    - "AVG(virality_score) via JOIN platform_posts pp ON posts p — cross-table aggregate without selecting any content fields"
    - "scoreMap merge pattern — two separate GROUP BY queries merged in JS to avoid complex OUTER JOIN"

key-files:
  created: []
  modified:
    - backend/src/routes/admin.ts

key-decisions:
  - "COUNT inside transaction before DELETE — count is atomic with the delete; avoids a separate pre-flight query that could race"
  - "Two separate aggregate queries for platform stats rather than a single OUTER JOIN — cleaner Drizzle sql`` template and avoids NULL/0 ambiguity in conditional aggregate across joined tables"
  - "scoreMap[row.platform] falsy guard uses ternary returning null — explicitly returns null (not 0) when no virality data exists for a platform, preserving semantic difference between 'no data' and 'score of 0'"

# Metrics
duration: 4min
completed: 2026-05-03
---

# Phase 8 Plan 04: Learning Reset + Platform Stats Summary

**Atomic learning data reset via db.transaction() (DELETE learning_signals + NULL learned_weights); aggregate-only platform stats (COUNT FILTER + AVG JOIN) with no individual post content returned — ADMIN-06, ADMIN-09, ADMIN-10**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-03T20:24:08Z
- **Completed:** 2026-05-03T20:28:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- DELETE /api/admin/users/:userId/learning wraps three operations in a single `db.transaction()`: COUNT(*) for response feedback, DELETE FROM learning_signals WHERE user_id = $userId, UPDATE settings SET learned_weights = NULL WHERE user_id = $userId
- Atomic guarantee: if either write fails, both roll back — partial state (signals deleted but weights not nulled, or vice versa) is impossible
- Returns `{ ok: true, userId, deleted: N }` where N is the count of rows deleted from learning_signals
- GET /api/admin/stats/platforms runs two aggregate SQL queries: one GROUP BY platform for upload totals (COUNT, COUNT FILTER posted, COUNT FILTER failed) and one GROUP BY pp.platform for AVG(virality_score) via JOIN posts
- Merges both into per-platform objects: `{ platform, total_uploads, succeeded, failed, success_rate, avg_virality_score }`
- Returns overall totals: `{ uploads, succeeded, overall_success_rate }` across all platforms
- ADMIN-10 enforced: no ai_output, hook_text, caption, title, or any individual post content selected in either route
- eq import added from drizzle-orm; learning_signals, settings, platform_posts, posts added to schema import line
- TypeScript compiles cleanly — tsc --noEmit exits 0, no `any` types

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DELETE /users/:userId/learning** - `d0220a1` (feat)
2. **Task 2: Add GET /stats/platforms** - `b9e7bab` (feat)

## Files Created/Modified

- `backend/src/routes/admin.ts` — eq + schema imports added; DELETE /users/:userId/learning and GET /stats/platforms appended after PATCH /users/:userId/enable; no existing routes modified

## Decisions Made

- COUNT inside transaction before DELETE — ensures the count is atomic with the delete rather than a separate pre-flight query that could race with concurrent deletions
- Two separate aggregate queries for platform stats rather than a single OUTER JOIN — cleaner sql template, avoids NULL/0 ambiguity in conditional aggregates across joined tables, simpler to extend
- `scoreMap[row.platform]` falsy guard returns `null` (not 0) when no virality data exists — preserves semantic distinction between "no uploads with scores" and "average score of 0"

## Deviations from Plan

None — plan executed exactly as written. Both routes match the plan's action blocks verbatim.

## Known Stubs

None — both routes perform real database queries against live tables.

## Threat Flags

None — both new endpoints are within the plan's threat model (T-08-13 through T-08-16). No new network surfaces beyond what the plan covers.

## Self-Check: PASSED

- `backend/src/routes/admin.ts` exists and contains both new routes
- Commits `d0220a1` and `b9e7bab` exist in git log
- tsc --noEmit exits 0
- `db.transaction` present (2 matches — 1 comment + 1 call)
- `GROUP BY platform` present (2 matches — both in GET /stats/platforms)
- `ai_output|hook_text|copy|caption` — 0 matches in response logic (1 match in comment only)
- `learning_signals|learned_weights` — 7 matches covering import, comment, SQL count query, delete call, update call

---
*Phase: 08-admin-panel*
*Completed: 2026-05-03*
