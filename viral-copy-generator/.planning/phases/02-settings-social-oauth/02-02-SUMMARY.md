---
phase: 02-settings-social-oauth
plan: 02
subsystem: api
tags: [settings, aes-256-gcm, jsonb-merge, oauth-stubs, masked-response, pg-mem, supertest, integration-tests]

requires:
  - phase: 02-01
    provides: AES-256-GCM encrypt/decrypt/maskKey primitives, oauth-state.ts CSRF map
  - phase: 01-backend-auth-foundation
    provides: authMiddleware (res.locals.userId), app.ts Express skeleton, settings table schema

provides:
  - GET /api/settings — returns defaults (no row created) or masked ai key + connected status
  - PATCH /api/settings — upserts ai_provider / api_key_encrypted / default_niche / enabled_platforms
  - DELETE /api/settings/connections/:platform — JSONB merge sets platform key to null, preserving others
  - authGoogleRouter stub (returns 501) — route registered in app.ts for 02-03 to fill
  - authMetaRouter stub (returns 501) — route registered in app.ts for 02-04 to fill
  - pg-mem test fixture (_helpers.ts) with PatchedPool — reusable by 02-03, 02-04, 02-05

affects: [02-03, 02-04, 02-05]

tech-stack:
  added:
    - supertest@7.0.0 (HTTP assertions in Vitest)
    - "@types/supertest@6.0.2"
    - pg-mem@3.0.5 (in-process Postgres for integration tests)
  patterns:
    - PatchedPool: pg-mem Pool subclass intercepting drizzle rowMode/types + JSONB || merge (JS-side merge)
    - UPSERT keyed on user_id UNIQUE: INSERT ... ON CONFLICT DO UPDATE with per-field update map
    - JSONB partial update: COALESCE(col, '{}')::jsonb || patch::jsonb inside db.transaction + SELECT FOR UPDATE
    - Plaintext never in response: maskKey(decrypt(col)) always — never raw api_key_encrypted

key-files:
  created:
    - backend/src/routes/settings.ts
    - backend/src/routes/auth-google.ts
    - backend/src/routes/auth-meta.ts
    - backend/tests/_helpers.ts
    - backend/tests/settings.test.ts
  modified:
    - backend/src/app.ts
    - backend/package.json
    - backend/package-lock.json

key-decisions:
  - "pg-mem v3.0.5 PatchedPool: pg-mem does not support drizzle's rowMode='array' or types.getTypeParser; also lacks JSONB || merge operator. Pool and transacted clients are patched to strip these options and rewrite COALESCE||merge in JS, preserving test fidelity without mocking drizzle."
  - "UPSERT uses INSERT...onConflictDoUpdate with an explicit update Record<string, unknown> rather than sql`excluded.col` for each field — allows partial-field updates (only include keys the caller sent) without overwriting fields not in the PATCH body."
  - "TRUNCATE replaced by DELETE in resetTestDb — pg-mem does not support TRUNCATE ... RESTART IDENTITY CASCADE syntax; DELETE achieves the same isolation between tests."

requirements-completed:
  - SETTINGS-01
  - SETTINGS-02
  - SETTINGS-03
  - SETTINGS-08
  - SETTINGS-09
  - SETTINGS-10

duration: 44min
completed: 2026-05-01
---

# Phase 2 Plan 02: Settings HTTP Surface + OAuth Stubs Summary

**Encrypted settings API (GET/PATCH/disconnect) with AES-256-GCM masking, JSONB-merge concurrency safety, and pg-mem integration tests — 10/10 passing; OAuth route stubs unblock parallel 02-03 / 02-04 work**

## Performance

- **Duration:** ~44 min
- **Started:** 2026-05-01T20:41:30Z
- **Completed:** 2026-05-01T21:25:33Z
- **Tasks:** 2/2 complete
- **Files modified:** 8

## Accomplishments

- `settings.ts` — GET/PATCH/DELETE-connection endpoints; AES-256-GCM encryption via 02-01 primitives; `****last4` masking enforced; JSONB merge with SELECT FOR UPDATE lock; SETTINGS-10 timezone
- `_helpers.ts` — pg-mem PatchedPool that makes all drizzle ORM operations work in-process, including JSONB merge interception
- `settings.test.ts` — 10 integration tests: masking, encryption fidelity, partial PATCH, platform enable, JSONB disconnect, plaintext-never-in-response, cross-user RLS, auth gate, validation
- `auth-google.ts` / `auth-meta.ts` — 501 stub routers enabling app.ts to wire all Phase 2 routes atomically
- `app.ts` — extended once with all three Phase 2 routers under `/api` (after `authMiddleware`)

## Task Commits

1. **Task 1: settings.ts (GET/PATCH/disconnect) + pg-mem integration tests** — `1685dae` (feat)
2. **Task 2: OAuth route stubs + app.ts router wiring** — `e63af44` (feat)

## Files Created/Modified

- `backend/src/routes/settings.ts` — GET, PATCH, DELETE /connections/:platform; encrypt/maskKey/decrypt from 02-01; JSONB merge; Asia/Karachi timezone
- `backend/src/routes/auth-google.ts` — stub router (authGoogleRouter); GET /connect, /callback → 501
- `backend/src/routes/auth-meta.ts` — stub router (authMetaRouter); GET /instagram/{connect,callback}, /facebook/{connect,callback} → 501
- `backend/src/app.ts` — extended with settingsRouter, authGoogleRouter, authMetaRouter under /api
- `backend/tests/_helpers.ts` — pg-mem PatchedPool factory; createTestDb + resetTestDb exports
- `backend/tests/settings.test.ts` — 10 integration tests via supertest + pg-mem
- `backend/package.json` — added supertest@7.0.0, @types/supertest@6.0.2, pg-mem@3.0.5
- `backend/package-lock.json` — updated lockfile

## Decisions Made

- **pg-mem PatchedPool:** pg-mem v3.0.5 does not support: (a) `query.types` / `getTypeParser` used by drizzle for prepared statements, (b) `rowMode: 'array'` used for ORM SELECT queries, (c) the JSONB `||` merge operator. The PatchedPool subclass intercepts `query()` on both the pool and transacted clients to strip unsupported options and rewrite JSONB merges as a JavaScript read-merge-write, making all drizzle ORM operations work without mocking drizzle itself. This approach is test-only and invisible to production.
- **TRUNCATE → DELETE in resetTestDb:** `TRUNCATE settings RESTART IDENTITY CASCADE` is not supported by pg-mem; `DELETE FROM settings` achieves per-test isolation. Tests do not depend on sequence resets so this is transparent.
- **`_helpers.ts` UPSERT pattern:** The production route uses `INSERT ... onConflictDoUpdate` with a dynamically-built update set (only fields present in PATCH body). This preserves partial-update semantics — a PATCH that only sends `default_niche` does not overwrite `api_key_encrypted`.

## Test Results

All 10 integration tests pass:

| Test | Behavior | Status |
|------|----------|--------|
| Test 9 | GET without auth returns 401 | PASS |
| Test 1 | GET first-time returns defaults; DB row count = 0 | PASS |
| Test 2 | PATCH stores ciphertext, returns ****ABCD | PASS |
| Test 3 | GET after save returns ****1234; plaintext absent | PASS |
| Test 4 | PATCH default_niche preserves api_key_encrypted | PASS |
| Test 5 | PATCH enabled_platforms accepts tiktok | PASS |
| Test 6 | DELETE /connections/youtube nulls youtube, instagram untouched (JSONB merge) | PASS |
| Test 7 | Response never contains api_key_encrypted or access_token | PASS |
| Test 8 | Cross-user isolation: User B sees User A's defaults only | PASS |
| Test 10 | PATCH ai_provider='banana' returns 400 | PASS |

**DB row count after first GET (Test 1):** 0 — GET is read-only; no DB row created for first-time users.

**app.ts router registration count:**
- `app.use('/api/auth/google', authGoogleRouter)` — exactly 1
- `app.use('/api/auth', authMetaRouter)` — exactly 1

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pg-mem v3.0.5 incompatibility with drizzle-orm ORM queries**
- **Found during:** Task 1 (first test run in GREEN phase)
- **Issue:** pg-mem v3.0.5 does not support `rowMode: 'array'` (drizzle SELECT queries), `query.types.getTypeParser` (drizzle INSERT/UPDATE), or the JSONB `||` operator — all required by the drizzle-orm node-postgres session. The plan specified `newDb() + createPg() + drizzle(pool)` verbatim, which failed with `NotSupported: getTypeParser` and `NotSupported: pg rowMode`.
- **Fix:** Subclassed MemPool as `PatchedPool` in `_helpers.ts`. Intercepts all `query()` calls on the pool (for non-transaction queries) and on checked-out clients (for `db.transaction()` — drizzle calls `pool.connect()` internally). The interceptor: (a) strips `rowMode` and `types` from query config; (b) converts `rowMode='array'` results by mapping rows to `Object.values(row)`; (c) detects COALESCE||jsonb patterns and rewrites them as JS-level merge operations before passing simplified SQL to pg-mem.
- **Files modified:** `backend/tests/_helpers.ts`
- **Verification:** All 10 integration tests pass including Test 6 (JSONB merge disconnect) and Test 2 (UPSERT with conflict update)
- **Committed in:** `1685dae` (Task 1 commit)

**2. [Rule 1 - Bug] `TRUNCATE ... RESTART IDENTITY CASCADE` unsupported in pg-mem**
- **Found during:** Task 1 (test fixture testing)
- **Issue:** The plan's `resetTestDb` body used `TRUNCATE settings RESTART IDENTITY CASCADE` which pg-mem does not implement
- **Fix:** Replaced with `DELETE FROM settings` — achieves row-level reset; test isolation preserved
- **Files modified:** `backend/tests/_helpers.ts`
- **Committed in:** `1685dae`

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs — pg-mem version compatibility)
**Impact on plan:** Both fixes necessary for test infrastructure to work. Production code is unchanged. No scope creep. The JSONB merge in the route handler uses the exact Pattern 5 SQL from the plan — the rewrite is test-only.

## Known Stubs

- `backend/src/routes/auth-google.ts` — GET /connect, /callback return 501 intentionally; stubs will be replaced by Plan 02-03
- `backend/src/routes/auth-meta.ts` — 4 routes return 501 intentionally; stubs will be replaced by Plan 02-04

These stubs are **intentional by design** — their purpose is to register the routes in app.ts now to prevent ownership conflicts in parallel plans 02-03 and 02-04.

## Threat Flags

No new network endpoints, auth paths, or schema changes beyond what is in the plan's threat model. All three T-02-* mitigations implemented as specified:
- T-02-01 (plaintext leak): maskKey(decrypt()) on every GET; never raw column in response
- T-02-09 (JSONB concurrency): SELECT FOR UPDATE inside db.transaction()
- T-02-10 (userId spoofing): all handlers read res.locals.userId; request body never trusted for userId
- T-02-11 (input validation): VALID_PROVIDERS / VALID_NICHES / VALID_PLATFORMS whitelist arrays; 400 on mismatch

## Next Phase Readiness

- `settingsRouter` ready for frontend consumption (Phase 8 Settings screen)
- `_helpers.ts` ready for import by 02-03 (Google OAuth), 02-04 (Meta OAuth), 02-05 (Meta token refresh) — all import `createTestDb` / `resetTestDb` directly
- `authGoogleRouter` stub in app.ts at `/api/auth/google` — 02-03 fills route bodies only, no app.ts changes needed
- `authMetaRouter` stub in app.ts at `/api/auth` — 02-04 fills route bodies only, no app.ts changes needed

---
*Phase: 02-settings-social-oauth*
*Completed: 2026-05-01*
