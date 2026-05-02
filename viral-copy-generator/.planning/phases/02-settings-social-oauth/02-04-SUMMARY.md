---
phase: 02-settings-social-oauth
plan: 04
subsystem: auth
tags: [oauth, instagram, facebook, meta, page-token, account-type-preflight, aes-256-gcm, jsonb-merge, csrf]

requires:
  - phase: 02-01
    provides: AES-256-GCM encrypt/decrypt primitives (encryption.ts)
  - phase: 02-02
    provides: settings table, pg-mem _helpers.ts fixture, PlatformConfig type in schema.ts
  - phase: 02-03
    provides: app.ts routing pattern (OAuth router before authMiddleware), authMiddleware per-route pattern, oauth-state.ts createOAuthState/consumeOAuthState

provides:
  - oauth-meta.ts: buildInstagramAuthUrl, buildFacebookAuthUrl, exchangeInstagramCode, exchangeFacebookCode, refreshInstagramToken (for 02-05)
  - GET /api/auth/instagram/connect — returns 200 JSON { auth_url } for window.location.assign
  - GET /api/auth/instagram/callback — validates CSRF state, strips #_ from code, short->long-lived exchange, PERSONAL account preflight reject, encrypts + JSONB-merges
  - GET /api/auth/facebook/connect — returns 200 JSON { auth_url } for window.location.assign
  - GET /api/auth/facebook/callback — validates CSRF state, fetches /me/accounts, picks CREATE_CONTENT page, encrypts page_access_token + JSONB-merges; no-page case stores setup_required: true
  - PlatformConfig.facebook union widened to include { setup_required: true } variant (no cast)
  - 9 Vitest integration tests covering all behaviors including PERSONAL reject, no-page, replay attacks

affects: [02-05, 02-06, 02-07, 06-autoupload]

tech-stack:
  added: []
  patterns:
    - Two distinct OAuth flows on the same Meta app — Instagram Login (graph.instagram.com) and Facebook Login for Business (graph.facebook.com) — must NOT be combined (research Pitfall 9)
    - OAuth callback mounted BEFORE global authMiddleware; /connect uses per-route authMiddleware
    - #_ suffix stripped from Instagram code param before token exchange (Pitfall 1)
    - Short-lived (1h) Instagram token always exchanged for long-lived (60d) before storage
    - Account-type preflight (PERSONAL -> reject, no DB write) enforced at callback layer (Pitfall 4)
    - No qualifying Facebook Page -> store { setup_required: true }, redirect with warning param (Open Question 1)
    - All tokens encrypted at route layer before JSONB merge (T-02-06)
    - SELECT FOR UPDATE inside db.transaction() for JSONB concurrency safety (Pitfall 3)
    - All failure paths redirect with error= param — no 500 paths in OAuth route handlers (Pitfall 8)

key-files:
  created:
    - backend/src/lib/oauth-meta.ts
    - backend/tests/oauth-meta.test.ts
  modified:
    - backend/src/routes/auth-meta.ts
    - backend/src/db/schema.ts
    - backend/src/app.ts

key-decisions:
  - "Two physically separate Meta OAuth flows: Instagram Login (api.instagram.com, instagram_business_basic + instagram_business_content_publish) and Facebook Login for Business (graph.facebook.com, pages_show_list + pages_manage_posts + pages_read_engagement) — same Meta app credentials, different authorization servers"
  - "authMetaRouter mounted before app.use('/api', authMiddleware): Meta callbacks arrive without Bearer token; /connect handlers use per-route authMiddleware; state param provides CSRF + userId binding for callbacks"
  - "Facebook no-page case stores { setup_required: true } rather than failing: allows UI to surface a 'Create Facebook Page' CTA; PlatformConfig.facebook union widened in schema.ts to avoid as-unknown cast (CLAUDE.md rule 9)"
  - "refreshInstagramToken() exported from oauth-meta.ts for Plan 02-05 weekly pg-boss job — not called here"

requirements-completed:
  - SETTINGS-05
  - SETTINGS-06

duration: 6min
completed: 2026-05-02
---

# Phase 2 Plan 04: Meta OAuth (Instagram + Facebook) Summary

**Two separate Meta OAuth flows (Instagram Login + Facebook Login for Business) with #_ code trimming, PERSONAL account rejection, page selection, AES-256-GCM token encryption, and 9/9 Vitest tests passing**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-02T01:05:21Z
- **Completed:** 2026-05-02T01:11:07Z
- **Tasks:** 2/2 complete (Task 1: oauth-meta.ts helper; Task 2 TDD: RED + GREEN)
- **Files modified:** 5

## Accomplishments

- `oauth-meta.ts` — URL builders for both flows, Instagram 3-step code exchange (short->long-lived + account_type preflight), Facebook code exchange + /me/accounts page selection, `refreshInstagramToken` for Phase 5 weekly job, `INSTAGRAM_SCOPES` / `FACEBOOK_SCOPES` constants
- `auth-meta.ts` — Full handlers for `/instagram/connect` + `/instagram/callback` + `/facebook/connect` + `/facebook/callback`. Per-route authMiddleware on /connect; callbacks accept Meta redirects without Bearer token. All failure paths redirect with `error=` (no 500 leakage)
- `schema.ts` — `PlatformConfig.facebook` widened to union `| { setup_required: true } | null` — no `as unknown` cast required (CLAUDE.md rule 9)
- `app.ts` — `authMetaRouter` moved BEFORE global `app.use('/api', authMiddleware)` so callbacks are reachable from Meta's browser redirect
- `oauth-meta.test.ts` — 9 integration tests (see table below)

## Task Commits

1. **Task 1: oauth-meta.ts helper module** — `28a4465` (feat)
2. **Task 2 RED: failing oauth-meta tests** — `a15a461` (test)
3. **Task 2 GREEN: full auth-meta.ts + app.ts fix** — `af9d4e2` (feat)

## Files Created/Modified

- `backend/src/lib/oauth-meta.ts` — Meta OAuth helper module (URL builders, token exchanges, refresh helper)
- `backend/src/routes/auth-meta.ts` — Full route handlers replacing 501 stubs (Instagram + Facebook)
- `backend/src/db/schema.ts` — PlatformConfig.facebook union type widened (no cast needed)
- `backend/src/app.ts` — authMetaRouter mounted before global authMiddleware
- `backend/tests/oauth-meta.test.ts` — 9 integration tests

## Test Results

| Test | Behavior | Status |
|------|----------|--------|
| Test 1 | GET /instagram/connect returns 200 JSON { auth_url } at api.instagram.com with scope=instagram_business_basic,instagram_business_content_publish + 64-hex state | PASS |
| Test 2 | /instagram/callback: code with #_ trimmed, short->long exchange (mocked), BUSINESS account stored as ciphertext, redirects connected=instagram | PASS |
| Test 3 | /instagram/callback: PERSONAL account_type rejected before DB write, redirects error=instagram_personal_account | PASS |
| Test 4 | /instagram/callback: invalid state redirects error=oauth_failed, no DB write | PASS |
| Test 5 | GET /facebook/connect returns 200 JSON { auth_url } at www.facebook.com/v22.0/dialog/oauth with scope=pages_show_list,pages_manage_posts,pages_read_engagement | PASS |
| Test 6 | /facebook/callback success: page with CREATE_CONTENT task, page_access_token encrypted (decrypt roundtrip verified), page_id stored, redirects connected=facebook | PASS |
| Test 7 | /facebook/callback no-page: /me/accounts returns empty list, stores { setup_required: true }, redirects connected=facebook&warning=no_facebook_page | PASS |
| Test 8 | /facebook/callback: invalid state redirects error=oauth_failed, no DB write | PASS |
| Test 9 | Single-use state enforcement for both flows: replay attempt on Instagram callback fails; replay on Facebook callback fails | PASS |

**Regression: oauth-google 5/5 + settings 10/10 still passing**

## Decisions Made

- **Two physically separate Meta OAuth paths:** Instagram Login uses `api.instagram.com` authorization server with `instagram_business_basic,instagram_business_content_publish` scopes. Facebook Login for Business uses `graph.facebook.com` with `pages_show_list,pages_manage_posts,pages_read_engagement`. They share META_APP_ID/META_APP_SECRET credentials but must NOT be combined (research Pitfall 9).
- **app.ts routing fix:** authMetaRouter moved before global authMiddleware (same pattern as authGoogleRouter in 02-03). The /connect endpoints apply per-route authMiddleware to preserve auth gating on initiation while allowing /callback to accept Meta's redirect (no Bearer token). State param provides CSRF + userId binding.
- **Facebook no-page resolution (Open Question 1):** When /me/accounts returns no page with CREATE_CONTENT task, the callback stores `{ setup_required: true }` in platform_config.facebook and redirects with `warning=no_facebook_page`. This allows the UI to surface a "Create Facebook Page" CTA rather than blocking the connection. The PlatformConfig.facebook type was widened in schema.ts to include this union variant without any TypeScript cast.
- **refreshInstagramToken exported from oauth-meta.ts:** The 60-day long-lived Instagram token needs weekly refresh. This helper is exported from oauth-meta.ts for use in Plan 02-05's pg-boss scheduled job — it is not called in Plan 02-04 itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] authMetaRouter was mounted after global authMiddleware (same 02-03 pattern)**
- **Found during:** Task 2 RED phase — Tests 4 and 8 (invalid state) returned 401 instead of 302 because /callback routes were blocked by `app.use('/api', authMiddleware)`.
- **Issue:** The original `app.ts` mounted `authMetaRouter` at `app.use('/api/auth', authMetaRouter)` which is AFTER `app.use('/api', authMiddleware)`. Meta's browser redirect carries no Bearer token, so all callback requests got a 401.
- **Fix:** Moved `app.use('/api/auth', authMetaRouter)` to BEFORE `app.use('/api', authMiddleware)`. Added per-route `authMiddleware` argument to both /connect handlers (same as the existing pattern in authGoogleRouter from 02-03).
- **Files modified:** `backend/src/app.ts`, `backend/src/routes/auth-meta.ts`
- **Verification:** All 9 tests pass after fix; oauth-google + settings regressions pass.
- **Committed in:** `af9d4e2` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking, same pattern already established in 02-03)
**Impact on plan:** Fix is architecturally correct for OAuth patterns. The plan's task description did mention the routing fix was needed but it required updating app.ts explicitly. No scope creep.

## Issues Encountered

None beyond the auto-fixed routing deviation above.

## Known Stubs

None — all 501 stubs replaced. Both Meta flows fully implemented with tests.

## Threat Surface Scan

All T-02-* mitigations implemented as planned:
- T-02-02 (CSRF): `consumeOAuthState` deletes before validate — single-use, replay-proof for both flows (Test 9 confirms)
- T-02-05 (cross-user hijack): userId bound into state map at /connect; /callback retrieves userId from state, never from query params
- T-02-06 (plaintext tokens): `encrypt(conn.longLivedToken)` before JSONB write (Instagram); `encrypt(conn.page.access_token)` before JSONB write (Facebook)
- T-02-15 (PERSONAL account elevation): `account_type === 'PERSONAL'` check before DB write; reject → `instagram_personal_account` redirect (Test 3 confirms)
- T-02-17 (code #_ tampering): `code.replace(/#_$/, '')` in `exchangeInstagramCode` (Test 2 confirms)
- T-02-18 (error detail leak): all catch blocks `console.error` and redirect with `error=oauth_failed` only — no 500 paths in route handlers

No new network endpoints or trust boundaries beyond what is in the plan's threat model.

## Next Phase Readiness

- `refreshInstagramToken()` exported from oauth-meta.ts — ready for Plan 02-05 weekly pg-boss job
- Both Meta flows fully implemented; no further backend changes needed for auth-meta.ts
- Plan 02-05 (weekly Meta token refresh) can run independently
- Credentials required before Wave 5 E2E verification: `META_APP_ID`, `META_APP_SECRET` (Instagram app), `APP_URL`

---
*Phase: 02-settings-social-oauth*
*Completed: 2026-05-02*
