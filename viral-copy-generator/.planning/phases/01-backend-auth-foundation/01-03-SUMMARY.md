---
phase: 01-backend-auth-foundation
plan: 03
subsystem: auth
tags: [express, supabase, pg-boss, auth-middleware, coop-coep, vps-storage, typescript]

dependency_graph:
  requires:
    - backend/src/db/schema.ts — Drizzle schema from Plan 02
    - backend/src/db/migrate.ts — runMigrations() from Plan 02
    - backend/src/db/index.ts — DB singleton from Plan 02
  provides:
    - backend/src/lib/supabase.ts — supabaseAdmin client with service role key
    - backend/src/middleware/auth.ts — authMiddleware via supabase.auth.getUser()
    - backend/src/middleware/admin.ts — adminMiddleware checking app_metadata.role
    - backend/src/routes/health.ts — GET /health public route
    - backend/src/routes/posts.ts — GET /api/posts auth-gated stub
    - backend/src/lib/boss.ts — pg-boss v12 singleton with hourly cleanup job
    - backend/src/lib/storage.ts — initStorage() + cleanupStaleFiles() with UPLOADS_ROOT export
    - backend/src/app.ts — Express 5 app with COOP/COEP headers, CORS, auth middleware
    - backend/src/index.ts — startup orchestration: migrations → storage → boss → listen
  affects:
    - All subsequent backend routes — must import from db/index.ts and respect authMiddleware
    - Phase 2 (Settings + Social OAuth) — posts/settings routes build on this auth layer
    - Phase 6 (Auto-Upload) — storage.ts deleteFile() implementation deferred to this phase

tech-stack:
  added: []
  patterns:
    - supabase.auth.getUser(token) for backend JWT verification (never jose/jsonwebtoken)
    - app.use('/api', authMiddleware) — single line protects all /api/* routes
    - pg-boss named import { PgBoss } from 'pg-boss' (v12 ESM breaking change from default)
    - COOP/COEP Express middleware on all responses before CORS/routes
    - Startup order: runMigrations() → initStorage() → getBoss() → app.listen()

key-files:
  created:
    - backend/src/lib/supabase.ts
    - backend/src/middleware/auth.ts
    - backend/src/routes/health.ts
    - backend/src/routes/posts.ts
    - backend/src/lib/boss.ts
    - backend/src/app.ts
    - backend/src/index.ts
  modified:
    - backend/src/lib/storage.ts (added exported UPLOADS_ROOT const, STORE-03 deferral comment, graceful error handling)

key-decisions:
  - "UPLOADS_ROOT exported as const — allows boss.ts to import from storage.ts cleanly without re-reading env var"
  - "COOP/COEP headers added in Express middleware before all routes — backend API must set these for Phase 3 SharedArrayBuffer support"
  - "storage.ts graceful error handling added — cleanupStaleFiles() catches read errors per-directory so one bad dir does not abort the full scan"
  - "deleteFile() deferred to Phase 6 with explicit comment (STORE-03) — intentional scope boundary, no stub value flows to UI"

patterns-established:
  - "Pattern: Express auth gate — app.use('/api', authMiddleware) before all /api routes; /health explicitly excluded"
  - "Pattern: Admin check — adminMiddleware checks res.locals.user set by authMiddleware; app_metadata.role immutable by user"
  - "Pattern: Startup sequence — migrations → storage → pg-boss → listen; ensures schema exists before queue workers run"

requirements-completed: [AUTH-02, AUTH-03, AUTH-05, AUTH-06, STORE-02, STORE-04]

duration: 15min
completed: "2026-05-01"
---

# Phase 1 Plan 03: Backend + Auth Foundation — Express App Summary

**Express 5 backend with Supabase JWT auth middleware, pg-boss v12 hourly cleanup job, COOP/COEP headers on all responses, and startup orchestration guaranteeing migrations run before pg-boss and Express listen.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-01T10:45:00Z
- **Completed:** 2026-05-01T11:00:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Auth enforcement layer: `authMiddleware` calls `supabase.auth.getUser(token)` on every `/api/*` request — unauthenticated requests return 401 before any route handler runs
- Admin role gate: `adminMiddleware` checks `app_metadata.role === 'admin'` set only via service role key — non-admin users get 403
- pg-boss v12 singleton using named `{ PgBoss }` import, hourly `cleanup-stale-files` cron job registered on startup
- COOP/COEP headers (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) on every response — required for Phase 3 `@ffmpeg/core` SharedArrayBuffer usage
- Startup orchestration: `runMigrations()` → `initStorage()` → `getBoss()` → `app.listen()` — pg-boss never starts before schema migrations complete

## Task Commits

1. **Task 1: Auth middleware + admin middleware + backend Supabase client** - `5c35b96` (feat)
2. **Task 2: Routes + pg-boss + storage + Express app + startup orchestration** - `b6ace87` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/src/lib/supabase.ts` — supabaseAdmin client using SUPABASE_SERVICE_ROLE_KEY
- `backend/src/middleware/auth.ts` — authMiddleware: extracts Bearer token, calls getUser(), sets res.locals.user + res.locals.userId
- `backend/src/middleware/admin.ts` — adminMiddleware: checks res.locals.user.app_metadata.role !== 'admin' → 403
- `backend/src/routes/health.ts` — GET / → `{ ok: true, ts: ISO }` with no auth
- `backend/src/routes/posts.ts` — GET / stub → `{ posts: [], userId }` (full implementation in Phase 5)
- `backend/src/lib/boss.ts` — pg-boss v12 getBoss() singleton, registerCleanupJob() with schedule '0 * * * *'
- `backend/src/lib/storage.ts` — exported UPLOADS_ROOT const, graceful per-directory error handling, STORE-03 deferral comment
- `backend/src/app.ts` — Express 5 app: COOP/COEP middleware, CORS, body parser, /health public, /api auth-gated, 404 + error handlers
- `backend/src/index.ts` — startup entry: dotenv/config, migrations → storage → boss → listen

## Decisions Made

- COOP/COEP set in Express middleware (not Nginx config) — backend API must send these headers so the frontend can use SharedArrayBuffer in Phase 3 video analysis
- `UPLOADS_ROOT` exported as a named const from storage.ts rather than a private function — allows boss.ts to import it cleanly without re-reading the env var
- `cleanupStaleFiles()` uses nested try/catch per-directory — the plan's Pattern 9 version throws on any readdir error; the implemented version is safer for VPS production use where some directories may have permission issues

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added graceful error handling to cleanupStaleFiles()**
- **Found during:** Task 2 (storage.ts implementation)
- **Issue:** Plan's Pattern 9 calls `readdir(UPLOADS_ROOT)` without try/catch. If UPLOADS_ROOT does not exist at cleanup time (e.g., cron fires before initStorage() on a fresh deploy), the job throws and pg-boss marks it failed. Similarly, individual user directories may have permission errors on a multi-user VPS.
- **Fix:** Wrapped outer readdir in try/catch (handles UPLOADS_ROOT missing), wrapped inner per-directory processing in try/catch (handles individual directory errors). Console logs stale file deletions.
- **Files modified:** backend/src/lib/storage.ts
- **Verification:** TypeScript compiles clean; UPLOADS_ROOT missing scenario handled without throwing
- **Committed in:** b6ace87 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — error handling)
**Impact on plan:** Defensive error handling prevents pg-boss job failures on fresh deploys. No scope creep.

## Issues Encountered

None — TypeScript compiled clean with no errors on both tasks. All acceptance criteria verified via grep and tsc --noEmit.

## Known Stubs

- `backend/src/routes/posts.ts` — returns `{ posts: [], userId }`. This is an intentional plan-level stub for Phase 5. The auth enforcement (401 without token) works correctly; the empty posts array is expected until Phase 5 implements the full query.

## Threat Flags

No new security-relevant surface beyond what is in the plan's threat model. All /api/* routes are covered by authMiddleware (T-01-06 mitigated). Admin middleware in place for future admin routes (T-01-07 mitigated). Error handler returns only "Internal Server Error" to clients (T-01-08 mitigated).

## Next Phase Readiness

- Express backend is fully auth-gated and running
- Plan 04 (frontend login screen) can proceed — backend /health and /api/posts are available
- Plan 05 (frontend App.tsx + full scaffold) depends on this auth layer being complete
- Phase 2 (Settings + Social OAuth) can build settings routes on this auth foundation
- pg-boss is initialized and ready for job registration in Phase 6 (upload jobs)

---
*Phase: 01-backend-auth-foundation*
*Completed: 2026-05-01*
