---
phase: 08-admin-panel
plan: 03
subsystem: admin
tags: [express, admin, supabase-auth, user-management, security, typescript]

# Dependency graph
requires:
  - phase: 08-admin-panel
    plan: 02
    provides: adminRouter with pg-boss queue routes, supabaseAdmin import pattern
provides:
  - GET /api/admin/users — list all users with safe fields only (ADMIN-04, ADMIN-10)
  - PATCH /api/admin/users/:userId/disable — ban user for 10 years (ADMIN-05)
  - PATCH /api/admin/users/:userId/enable — clear user ban (ADMIN-05)
affects: [08-04, 08-05, 08-06, 08-07, 08-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "supabaseAdmin.auth.admin.listUsers(perPage: 1000) — single call fetches all users up to v1 scale limit"
    - "ADMIN-10 allowlist via explicit object literal — safe fields enumerated, never spread or pass-through"
    - "Object.keys(cfg).filter(k => cfg[k] != null) — connected platform names extracted from JSONB keys, token values never touched"
    - "ban_duration '87600h' for disable, 'none' for enable — Supabase Admin API pattern for account suspension"
    - "Admin self-lockout guard via res.locals.userId comparison — prevents accidental admin account disable"

key-files:
  created: []
  modified:
    - backend/src/routes/admin.ts

key-decisions:
  - "res.locals.userId typed as string | undefined — adminMiddleware populates this from the verified JWT; TypeScript strict mode requires the undefined guard"
  - "platform_config JSONB extracted via raw SQL SELECT user_id, platform_config FROM settings — Drizzle type inference available but raw sql used for consistency with existing pg-boss pattern in the file"
  - "banned field computed as boolean from banned_until timestamp — UI receives a simple true/false; no timestamp leakage of the actual ban expiry"

# Metrics
duration: 4min
completed: 2026-05-03
---

# Phase 8 Plan 03: User Management Endpoints Summary

**GET /users with Supabase Admin API listUsers + ADMIN-10 safe-field allowlist; PATCH /users/:userId/disable (ban 87600h) and /enable (ban none) with admin self-lockout guard — no api_key_encrypted or OAuth token values returned**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-03T20:18:19Z
- **Completed:** 2026-05-03T20:22:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- GET /api/admin/users calls `supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })` and joins two aggregate queries: upload count from `posts` (COUNT GROUP BY user_id) and connected platforms from `settings.platform_config` (Object.keys only — no token values)
- ADMIN-10 enforced: response shape is an explicit allowlist (id, email, created_at, last_sign_in_at, banned bool, upload_count, connected_platforms); api_key_encrypted and OAuth tokens structurally excluded
- `banned` field is a boolean derived from `banned_until` timestamp — no raw timestamp in response
- PATCH /api/admin/users/:userId/disable calls `updateUserById(targetUserId, { ban_duration: '87600h' })` — 10 years, effectively permanent; reversible
- PATCH /api/admin/users/:userId/enable calls `updateUserById(targetUserId, { ban_duration: 'none' })` — restores login immediately
- Admin self-lockout guard: `targetUserId === adminUserId` (from `res.locals.userId`) returns 400 before any Supabase call
- 502 returned if Supabase Admin API errors; 400 for malformed input
- TypeScript compiles cleanly — tsc --noEmit exits 0, no `any` types

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GET /api/admin/users** - `7db700a` (feat)
2. **Task 2: Add PATCH /users/:userId/disable and /enable** - `9a06a6a` (feat)

## Files Created/Modified

- `backend/src/routes/admin.ts` — supabaseAdmin import added; three new routes appended after DELETE /jobs/:id (GET /users, PATCH /users/:userId/disable, PATCH /users/:userId/enable); no existing routes modified

## Decisions Made

- `res.locals.userId` typed as `string | undefined` — adminMiddleware populates this from the verified JWT; TypeScript strict mode requires the guard before the self-lockout comparison
- Raw SQL used for settings query (`sql\`SELECT user_id, platform_config FROM settings\``) — consistent with the pg-boss raw SQL pattern already in the file; no RLS bypass risk since this is a service-role backend route
- `banned` is a computed boolean from `banned_until > new Date()` — UI gets a simple flag; avoids exposing the actual ban expiry timestamp in the admin response

## Deviations from Plan

None — plan executed exactly as written. The `res.locals.userId` type annotation (`as string | undefined`) is an inline TypeScript guard required by strict mode but does not change the runtime behavior described in the plan.

## Known Stubs

None — all routes perform real Supabase Admin API calls and real database queries.

## Threat Flags

None — no new network endpoints beyond what the plan's threat model covers. T-08-09 (information disclosure on GET /users) is mitigated by the explicit allowlist. T-08-10 (IDOR on disable) is mitigated by the admin self-lockout guard. No new surfaces introduced.

## Self-Check: PASSED

- `backend/src/routes/admin.ts` exists and contains all three routes
- Commits `7db700a` and `9a06a6a` exist in git log
- tsc --noEmit exits 0
- `listUsers` present (1 match), `api_key_encrypted` appears only in comments (0 in response logic), `ban_duration` present twice ('87600h' and 'none'), self-lockout guard present

---
*Phase: 08-admin-panel*
*Completed: 2026-05-03*
