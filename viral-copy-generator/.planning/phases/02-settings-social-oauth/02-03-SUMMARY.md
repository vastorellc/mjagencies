---
phase: 02-settings-social-oauth
plan: 03
subsystem: auth
tags: [oauth, google, youtube, googleapis, redirect-flow, aes-256-gcm, jsonb-merge, csrf]

requires:
  - phase: 02-01
    provides: AES-256-GCM encrypt/decrypt, oauth-state createOAuthState/consumeOAuthState
  - phase: 02-02
    provides: settings table, pg-mem _helpers.ts fixture, authGoogleRouter stub in app.ts

provides:
  - getGoogleOAuthClient() factory for googleapis OAuth2Client (reused by Phase 6 auto-upload)
  - refreshYouTubeToken() helper for Phase 6 upload workers
  - GET /api/auth/google/connect — returns 200 JSON { auth_url } for window.location.assign
  - GET /api/auth/google/callback — validates state, exchanges code, encrypts tokens, JSONB-merges
  - GOOGLE_YOUTUBE_SCOPES constant (upload + readonly)
  - 5 Vitest integration tests covering the full OAuth round-trip

affects: [02-04, 02-06, 02-07, 06-autoupload]

tech-stack:
  added:
    - googleapis@171.4.0 (pinned exact, no ^ or ~)
  patterns:
    - OAuth callback mounted BEFORE global authMiddleware; /connect uses per-route authMiddleware
    - All failure paths redirect with error= param (no 500 leakage to client)
    - CSRF via single-use state map (consumeOAuthState deletes before validate)
    - Tokens encrypted at route layer before JSONB merge (T-02-06)
    - SELECT FOR UPDATE inside db.transaction() for JSONB concurrency safety (Pitfall 3)

key-files:
  created:
    - backend/src/lib/oauth-google.ts
    - backend/tests/oauth-google.test.ts
  modified:
    - backend/src/routes/auth-google.ts
    - backend/src/app.ts
    - backend/package.json
    - backend/package-lock.json

key-decisions:
  - "authGoogleRouter mounted before app.use('/api', authMiddleware): Google's callback redirect carries no Bearer token; per-route authMiddleware on /connect preserves auth on initiation while allowing /callback to be unauthed"
  - "JSON response on /connect (NOT 302): CORS hides Location header on cross-origin opaqueredirect responses from XHR/fetch; frontend uses window.location.assign(auth_url) for full-page redirect"
  - "googleapis OAuth2Client over raw fetch: handles token refresh, scope validation, type-safety for Phase 6 reuse"
  - "prompt=consent on every /connect call: guarantees refresh_token on each reconnect (Pitfall 2)"

requirements-completed:
  - SETTINGS-04

duration: 58min
completed: 2026-05-01
---

# Phase 2 Plan 03: Google OAuth + YouTube Token Storage Summary

**googleapis@171.4.0 OAuth2 flow with CSRF-protected state, AES-256-GCM token encryption before JSONB-merge, and 5/5 Vitest integration tests — full YouTube connect round-trip implemented**

## Performance

- **Duration:** ~58 min
- **Started:** 2026-05-01T21:40:50Z
- **Completed:** 2026-05-01T22:37:00Z
- **Tasks:** 2/2 complete (TDD: RED + GREEN phases)
- **Files modified:** 6

## Accomplishments

- `oauth-google.ts` — `getGoogleOAuthClient()` factory + `GOOGLE_YOUTUBE_SCOPES` (upload + readonly) + `refreshYouTubeToken()` Phase 6 helper
- `auth-google.ts` — Full `/connect` (JSON auth_url with offline+consent+state) and `/callback` (state validate, code exchange via googleapis, encrypt, JSONB-merge, 302 redirect). No 500 paths.
- `app.ts` — authGoogleRouter mounted before global authMiddleware; /connect gated per-route; /callback accessible to Google's redirect
- `oauth-google.test.ts` — 5 tests: JSON contract, unique state, invalid-state redirect, valid-state encrypt+merge+redirect, single-use replay prevention
- googleapis@171.4.0 installed and pinned exact in package.json

## Task Commits

1. **Task 1: googleapis install + oauth-google.ts factory** — `a81a0d4` (feat)
2. **Task 2 RED: failing oauth-google tests** — `2b8ca71` (test)
3. **Task 2 GREEN: full /connect + /callback implementation** — `8099a74` (feat)

## Files Created/Modified

- `backend/src/lib/oauth-google.ts` — getGoogleOAuthClient(), GOOGLE_YOUTUBE_SCOPES, refreshYouTubeToken()
- `backend/src/routes/auth-google.ts` — Full OAuth handlers (replaced 501 stubs)
- `backend/src/app.ts` — Router mounting order fix; authGoogleRouter before authMiddleware
- `backend/tests/oauth-google.test.ts` — 5 integration tests with googleapis + supabase mocks
- `backend/package.json` — googleapis@171.4.0 (exact, no ^)
- `backend/package-lock.json` — updated lockfile

## Decisions Made

- **Callback route before global authMiddleware:** Google's OAuth redirect callback arrives without a Bearer token. The router is mounted before `app.use('/api', authMiddleware)` so `/callback` is reachable. `/connect` still requires auth via a per-route `authMiddleware` argument. This is the standard OAuth architecture pattern — state param provides CSRF + userId binding without requiring a session.
- **JSON on /connect, not 302:** CORS spec requires browsers to hide the `Location` header on cross-origin opaque redirects (status 0 or 302 from XHR). Since the frontend sends an authenticated XHR to `/connect`, returning JSON with `auth_url` lets it call `window.location.assign(auth_url)` for the full-page redirect — confirmed CORS-safe.
- **googleapis OAuth2Client:** Chosen over raw fetch for consistent handling of token refresh, type safety, and Phase 6 reuse in auto-upload workers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] OAuth callback blocked by global authMiddleware**
- **Found during:** Task 2 (RED phase test run)
- **Issue:** Test 3 showed `/callback` returning 401 because `app.use('/api', authMiddleware)` blocked Google's redirect (which carries no Bearer token). The plan's route structure didn't account for this.
- **Fix:** Moved `authGoogleRouter` registration to BEFORE `app.use('/api', authMiddleware)` in app.ts. Added per-route `authMiddleware` to the `/connect` handler to preserve auth on initiation. `/callback` remains unauthed by design — state param provides CSRF + userId.
- **Files modified:** `backend/src/app.ts`, `backend/src/routes/auth-google.ts`
- **Verification:** All 5 tests pass; settings tests still pass (no regression)
- **Committed in:** `8099a74` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking)
**Impact on plan:** Fix is architecturally correct for OAuth patterns. No scope creep. Plan goal fully achieved.

## Test Results

| Test | Behavior | Status |
|------|----------|--------|
| Test 1 | GET /connect returns 200 JSON { auth_url } with accounts.google.com + offline + consent + 64-hex state + both scopes | PASS |
| Test 2 | Two /connect calls produce unique state values | PASS |
| Test 3 | /callback with invalid state redirects to error=oauth_failed (not 500) | PASS |
| Test 4 | /callback with valid state: ciphertext != plaintext; decrypt(stored) == plaintext; redirects to connected=youtube | PASS |
| Test 5 | Same state reused on second /callback fails (single-use enforcement) | PASS |

**googleapis version verification:**
```
node -e "console.log(require('./node_modules/googleapis/package.json').version)"
171.4.0
```

**No 500 paths in auth-google.ts:**
```
grep "res.status(500)" src/routes/auth-google.ts
(no output — confirmed)
```

**Ciphertext != plaintext (Test 4 assertion):**
- `stored.access_token !== 'ya29.fake-access'` — PASS
- `decrypt(stored.access_token) === 'ya29.fake-access'` — PASS
- `stored.refresh_token !== '1//fake-refresh'` — PASS
- `decrypt(stored.refresh_token) === '1//fake-refresh'` — PASS

## Known Stubs

None — plan fully implemented. All 501 stubs replaced.

## Threat Flags

No new network endpoints, auth paths, or schema changes beyond what is in the plan's threat model.
All T-02-* mitigations implemented:
- T-02-02 (CSRF): consumeOAuthState deletes before validate — single-use replay-proof
- T-02-05 (cross-user hijack): userId bound into state map at /connect; /callback retrieves from state, never from query params
- T-02-06 (plaintext tokens): encrypt(access_token) + encrypt(refresh_token) called before JSONB write
- T-02-13 (code reuse): googleapis returns invalid_grant on replay → caught in catch → oauth_failed redirect
- T-02-14 (error leak): all catch blocks log internally, redirect with error=oauth_failed only

## Next Phase Readiness

- `getGoogleOAuthClient()` and `refreshYouTubeToken()` ready for Phase 6 auto-upload workers
- `authGoogleRouter` fully implemented — no further changes needed for backend
- Phase 02-04 (Meta OAuth) can run independently — same app.ts pattern will apply
- Credentials required before Wave 5 E2E verification: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL` (registered in .env.example from 02-01)

---
*Phase: 02-settings-social-oauth*
*Completed: 2026-05-01*
