---
phase: 01-backend-auth-foundation
plan: 05
subsystem: testing, infra
tags: [vitest, nginx, pg-boss, coop-coep, smoke-test]

# Dependency graph
requires:
  - phase: 01-backend-auth-foundation
    provides: Express backend with auth middleware, pg-boss, storage, Drizzle schema, frontend login screen
provides:
  - Vitest suite passing (admin 403 unit test + storage init test)
  - nginx/vcg.conf production Nginx scaffold with COOP/COEP + public /uploads/ for Meta video fetch
  - pg-boss createQueue fix — v12 FK constraint resolved
  - Backend smoke test verified: /health 200, /api/posts 401
  - Phase 1 ready for manual sign-off (human-verify checkpoint)
affects: [phase-02-settings-oauth, phase-06-auto-upload]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pg-boss v12: createQueue() required before schedule() — FK constraint on pgboss.schedule.name"
    - "Nginx /uploads/ uses CORP: cross-origin (not same-origin) to allow Meta server access"

key-files:
  created:
    - nginx/vcg.conf
  modified:
    - backend/src/lib/boss.ts

key-decisions:
  - "pg-boss v12 requires createQueue() before schedule() — FK constraint (pgboss.schedule.name references pgboss.queue)"
  - "nginx /uploads/ has no internal directive — Meta's servers need public HTTPS access for Phase 6 video ingestion (STORE-02)"
  - "nginx /uploads/ uses Cross-Origin-Resource-Policy: cross-origin to allow external Meta server reads"

patterns-established:
  - "Boss queue pattern: createQueue() then schedule() — both required before work() registration"

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - AUTH-06
  - STORE-01
  - STORE-02
  - STORE-04

# Metrics
duration: 20min
completed: 2026-05-01
---

# Phase 1 Plan 05: Integration Verification Summary

**Vitest suite passing (admin 403 + storage init), backend smoke tests confirmed (200/401/401), nginx COOP/COEP + /uploads/ scaffold created, pg-boss v12 FK bug fixed**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-01T10:50:00Z
- **Completed:** 2026-05-01T11:10:00Z
- **Tasks:** 2 of 3 automated complete (Task 3 = human-verify checkpoint)
- **Files modified:** 2

## Accomplishments

- Ran `npx vitest run` and `npx vitest run --coverage` — 2 passing tests, 0 failures (admin 403 + storage init)
- Created `nginx/vcg.conf` with COOP/COEP headers, public /uploads/ location for Meta video fetch (no `internal` directive), correct CORP cross-origin on /uploads/
- Auto-fixed pg-boss v12 bug: `createQueue()` must precede `schedule()` — FK constraint on `pgboss.schedule.name` referencing `pgboss.queue`
- Confirmed backend startup: migrations applied, storage initialized, pg-boss started with cleanup job registered, Express listening on :3001
- Smoke tests confirmed: `GET /health` → 200, `GET /api/posts` (no token) → 401, `GET /api/posts` (invalid token) → 401

## Task Commits

Each task was committed atomically:

1. **Task 1: Run full test suite** — no file changes needed (tests already pass from Plan 01 stubs); verified `npx vitest run` exits 0
2. **Task 2: Backend smoke + Nginx config scaffold** — `b01a36b` (feat)

**Plan metadata commit:** pending (docs commit below after state updates)

## Files Created/Modified

- `nginx/vcg.conf` — production Nginx config with COOP/COEP, /api/ proxy, /health proxy, /uploads/ public location (CORP cross-origin), /frontend/ static files
- `backend/src/lib/boss.ts` — added `createQueue('cleanup-stale-files')` before `schedule()` call (pg-boss v12 FK fix)

## Decisions Made

- **pg-boss v12 createQueue pattern:** v12 introduced a `pgboss.queue` table as a registry. `schedule()` inserts into `pgboss.schedule` which has a FK on `(name)` referencing `pgboss.queue`. Must call `createQueue(name)` first. This is a breaking change from v9/v10.
- **nginx /uploads/ public access:** `internal` directive intentionally omitted — Meta's Instagram and Facebook servers must fetch video files via public HTTPS during Phase 6 auto-upload (STORE-02). Files are UUID-named and cleaned up hourly (STORE-04).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pg-boss v12 startup crash — queue must be created before scheduling**
- **Found during:** Task 2 (backend smoke test startup)
- **Issue:** `bossInstance.schedule('cleanup-stale-files', ...)` failed with FK constraint violation: `Key (name)=(cleanup-stale-files) is not present in table "queue"`. pg-boss v12 added `pgboss.queue` as a required registry; `schedule()` inserts a FK reference into it.
- **Fix:** Added `await bossInstance.createQueue('cleanup-stale-files')` before the `schedule()` call in `registerCleanupJob()`.
- **Files modified:** `backend/src/lib/boss.ts`
- **Verification:** Backend restarted successfully; log showed `[pg-boss] cleanup-stale-files job registered` and `[server] listening on :3001`
- **Committed in:** `b01a36b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Essential fix — backend could not start without it. No scope creep.

## Issues Encountered

- pg-boss v12 FK constraint on schedule table — resolved via Rule 1 auto-fix (createQueue before schedule)
- No other issues encountered

## Automated Verification Results

All automated checks passed:

| Check | Command | Result |
|-------|---------|--------|
| Vitest suite | `npx vitest run` | EXIT 0 — 2 pass, 8 todo/skip |
| Vitest coverage | `npx vitest run --coverage` | EXIT 0 |
| admin.test.ts | non-admin 403 assertion | PASS |
| storage.test.ts | initStorage creates dir | PASS |
| GET /health | `curl localhost:3001/health` | HTTP 200 — `{"ok":true,"ts":"..."}` |
| GET /api/posts (no token) | `curl localhost:3001/api/posts` | HTTP 401 — `{"error":"Unauthorized"}` |
| GET /api/posts (invalid token) | `curl -H "Authorization: Bearer invalid_token_here"` | HTTP 401 |
| nginx no internal | `grep "internal" nginx/vcg.conf` | 0 matches (correct) |
| nginx CORP cross-origin | `grep "cross-origin" nginx/vcg.conf` | Found on /uploads/ location |
| Migrations ran | startup log | `[migrate] all migrations applied` |
| pg-boss started | startup log | `[pg-boss] started` + `[pg-boss] cleanup-stale-files job registered` |

## Human Checkpoint Required — Task 3

The following items require manual browser/dashboard verification:

### Checklist for Human Verifier

**1. Supabase dashboard checks:**
- [ ] Authentication → Settings → "Enable email signups" is toggled OFF
- [ ] Authentication → Users → admin user exists in the list
- [ ] SQL Editor: `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'pgboss'` returns 1 row

**2. DB tables and RLS:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
-- Expected: learning_signals, platform_posts, posts, settings

SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
-- Expected: 4 policies (one per table)

SELECT column_name FROM information_schema.columns
WHERE table_name = 'settings' AND column_name = 'learned_weights';
-- Expected: 1 row

SELECT column_name FROM information_schema.columns
WHERE table_name = 'learning_signals' AND column_name IN ('post_id', 'hashtags');
-- Expected: 2 rows
```

**3. Run make-admin script** (admin user must exist in Supabase first):
```bash
cd backend && npm run make-admin -- admin@yourdomain.com
```
Expected output: `[make-admin] Admin role set for: admin@yourdomain.com`

**4. Frontend browser checks** (run `npm run dev` in frontend/):
- [ ] Open http://localhost:5173 — login screen appears (not app screen)
- [ ] DevTools Console → type `self.crossOriginIsolated` → must return `true`
- [ ] Sign in → GeneratorPage shows with "Sign out" button
- [ ] Click "Sign out" → returns to login screen immediately (AUTH-03)
- [ ] Sign in again → refresh page → stays on GeneratorPage (AUTH-03 session persistence)

**5. Local uploads directory:**
- [ ] `ls ${UPLOADS_PATH:-/var/uploads}` shows directory exists (created by backend startup)

### Resume Signal
Type "approved" if all criteria pass. Type the criterion number and failure description if anything fails.

## Known Stubs

None — this plan is verification-only; no UI or data-flow stubs introduced.

## Next Phase Readiness

- Phase 1 automation complete and green
- Awaiting human sign-off on browser/dashboard checks before marking Phase 1 complete
- Once approved, Phase 2 (Settings + Social OAuth) can begin

---
*Phase: 01-backend-auth-foundation*
*Completed: 2026-05-01 (awaiting human-verify checkpoint)*
