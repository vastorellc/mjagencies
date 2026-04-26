---
phase: 03-auth-sso-edge
plan: "03"
subsystem: auth/sso
tags:
  - sso
  - hmac
  - redis
  - opaque-code
  - auth-routes
dependency_graph:
  requires:
    - "03-01 (tokens, cookies, session, refresh, createAuthRedis)"
    - "03-02 (MFA primitives — no direct dependency but same package)"
    - "03-04 (sso-state stub replaced; auth/callback route coordinates)"
    - "03-05 (requireSession consumed by app routes in later phase)"
  provides:
    - "generateSsoState / verifySsoState — HMAC-SHA256 signed CSRF state (packages/auth)"
    - "createSsoCode / redeemSsoCode — single-use opaque code via Redis GETDEL (packages/auth)"
    - "REDIS_KEY.accounts.sso.code — cross-agency platform namespace helper (packages/config)"
    - "/sso page — login form for accounts.brand.com (apps/web-main)"
    - "/api/sso/exchange — server-to-server code exchange with internal-header gate"
    - "/api/auth/login — direct login + SSO entry path (501 in production)"
    - "/api/auth/logout — family revocation + cookie clearing"
    - "/api/auth/refresh — rotateRefreshToken + 401 on replay"
  affects:
    - "apps/web-main (5 new routes + SSO page)"
    - "packages/auth (2 new modules, extended index)"
    - "packages/config (REDIS_KEY extended with accounts.sso)"
    - ".env.example (7 new env vars)"
tech_stack:
  added:
    - "zod@3.25.28 (web-main dependency — body validation in exchange + login routes)"
    - "ioredis@5.10.1 (web-main devDependency — integration test Redis client)"
  patterns:
    - "HMAC-SHA256 + timingSafeEqual + buffer-length guard (RESEARCH §5.2)"
    - "Atomic GETDEL for single-use code redemption (T-03-011)"
    - "Internal-header gate before body parse (T-03-012)"
    - "Production 501 gate before credential check (T-03-013)"
    - "TDD: RED (failing tests) -> GREEN (implementations) -> no refactor needed"
key_files:
  created:
    - packages/auth/src/sso-state.ts
    - packages/auth/src/sso-code.ts
    - packages/auth/src/__tests__/sso-state.test.ts
    - packages/auth/src/__tests__/sso-code.integration.test.ts
    - apps/web-main/src/app/sso/page.tsx
    - apps/web-main/src/app/api/sso/exchange/route.ts
    - apps/web-main/src/app/api/auth/login/route.ts
    - apps/web-main/src/app/api/auth/logout/route.ts
    - apps/web-main/src/app/api/auth/refresh/route.ts
    - apps/web-main/src/app/api/auth/__tests__/login.integration.test.ts
    - apps/web-main/src/app/api/auth/__tests__/sso-exchange.integration.test.ts
    - apps/web-main/README.md
  modified:
    - packages/auth/src/sso-state.ts (replaced 03-04 stub with real HMAC implementation)
    - packages/auth/src/index.ts (added sso-state, sso-code exports)
    - packages/config/src/agency-constants.ts (added accounts.sso.code namespace)
    - apps/web-main/package.json (added zod dep + ioredis devDep)
    - .env.example (added 7 new env vars: SSO_STATE_SECRET, SSO_INTERNAL_TOKEN, ACCOUNTS_HOST, LOGIN_DEV_*, DB_APP_PASSWORD)
decisions:
  - "Q2 resolved: accounts:sso:code:* platform-shared namespace (NOT per-agency) — exchange is cross-agency by design"
  - "A3: Opaque-code + signed-state (NOT shared-domain cookies) — __Host- prefix requires host-bound cookies"
  - "Production-501 gap: login returns 501 until users.password_hash ships (Phase 5+) — T-03-013 mitigation"
  - "Open-redirect inline check: same-origin guard in login route; Plan 03-06 replaces with validateReturnTo()"
  - "zod added as web-main dependency (not workspace-wide) — only needed in exchange + login routes"
metrics:
  duration_minutes: 7
  completed_date: "2026-04-26"
  tasks_completed: 2
  files_created: 12
  files_modified: 5
---

# Phase 03 Plan 03: SSO at accounts.brand.com — HMAC State + Opaque Code via Shared Redis + Auth Routes

One-liner: HMAC-SHA256 signed SSO state + GETDEL opaque codes in `accounts:sso:code:*` Redis namespace + login/logout/refresh routes wired against Plan 03-01 primitives.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 3-3.1 | SSO state HMAC + opaque code Redis store | 7415d3c | sso-state.ts, sso-code.ts, sso-state.test.ts, sso-code.integration.test.ts |
| 3-3.2 | SSO + login/logout/refresh routes in web-main | fd9ae2a | sso/page.tsx, exchange/route.ts, login/route.ts, logout/route.ts, refresh/route.ts |

## What Was Built

### SSO State HMAC Primitive (packages/auth/src/sso-state.ts)

Replaces the 03-04 stub (which always returned `valid:false`). Full implementation per RESEARCH §5.2:

- `generateSsoState(agencyId, returnTo)` encodes `agencyId:encodedReturnTo:nonce:hmacSig` as base64url. Nonce = 16 random bytes for replay prevention.
- `verifySsoState(state, expectedAgencyId)` uses HMAC-SHA256 constant-time compare. Length-mismatch guard applied BEFORE `timingSafeEqual` (prevents throw on short buffers). Returns `{ valid, returnTo, agencyId }`.
- T-03-010 mitigation: signature checked AND agency embedded in payload AND verified against `expectedAgencyId`.

### SSO Opaque Code Redis Store (packages/auth/src/sso-code.ts)

Q2 resolution — platform-shared `accounts:sso:code:*` namespace (NOT per-agency):

- `createSsoCode(redis, payload)` stores 32-hex codeId with 60-second TTL under `accounts:sso:code:<codeId>`.
- `redeemSsoCode(redis, codeId)` uses atomic `redis.getdel` (single-use, no race window). Returns null on miss, expiry, or malformed JSON.
- T-03-011 mitigation: GETDEL is atomic; 60-second TTL caps exposure window.

### REDIS_KEY Extension (packages/config/src/agency-constants.ts)

Added `accounts.sso.code(codeId)` helper returning `accounts:sso:code:<codeId>`. Existing `session.*` per-agency helpers preserved intact.

### SSO Page (apps/web-main/src/app/sso/page.tsx)

Server component at `accounts.brand.com/sso`. Validates agency against `AGENCIES` (notFound on unknown slug). Renders HTML form posting to `/api/auth/login` with hidden fields for `agency`, `state`, `returnTo`.

### /api/sso/exchange Route

Server-to-server only. Checks `x-mjagency-internal` header before body parse (T-03-012). Validates code via zod. Calls `redeemSsoCode` then signs access + refresh tokens and registers refresh marker + family in per-agency Redis namespace.

### /api/auth/login Route

- Production (NODE_ENV=production): Returns 501 immediately, NO credential check (T-03-013). Gap: full credential validation requires `users.password_hash` column (Phase 5+).
- Dev path: Validates against `LOGIN_DEV_USER_*` env vars.
  - SSO entry path (state present): regenerateSession -> createSsoCode -> 302 to `https://<agency>.<ACCOUNTS_HOST_PARENT>/auth/callback?code=<codeId>&state=<state>`.
  - Direct login path (no state): regenerateSession -> setAuthCookies -> 200.
- Inline same-origin returnTo guard (Plan 03-06 replaces with `validateReturnTo()`).

### /api/auth/logout Route

Reads access cookie -> verifyAccessToken -> revokeFamilyTokens(redis, agencyId, familyId) -> clearAuthCookies. Order: revoke BEFORE clear. Gracefully handles missing/invalid cookie.

### /api/auth/refresh Route

Reads refresh cookie -> verifyRefreshToken (for agencyId routing) -> rotateRefreshToken. On null: clearAuthCookies + 401. On success: setAuthCookies + 200.

## Test Coverage

| Test File | Count | Type | Status |
|-----------|-------|------|--------|
| packages/auth/src/__tests__/sso-state.test.ts | 6 | Unit | All pass |
| packages/auth/src/__tests__/sso-code.integration.test.ts | 5 | Integration | Skip without INTEGRATION_REDIS_URL |
| apps/web-main/src/app/api/auth/__tests__/login.integration.test.ts | 4 | Integration | Skip without INTEGRATION_REDIS_URL |
| apps/web-main/src/app/api/auth/__tests__/sso-exchange.integration.test.ts | 5 | Integration | Skip without INTEGRATION_REDIS_URL |

Total: 6 unit (passing) + 14 integration (gated on INTEGRATION_REDIS_URL)

sso-state.test.ts coverage:
- Test 1: Roundtrip — generate + verify correct agency -> valid:true
- Test 2: Wrong agency rejected -> valid:false (T-03-010)
- Test 3: Tampered signature rejected -> valid:false (T-03-010)
- Test 4: Complex returnTo URL-encoding preserved
- Test 5: Malformed garbage state -> valid:false (no throw)
- Test 6: Length-mismatched signature buffer -> valid:false (no timingSafeEqual throw)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical dep] zod not in web-main package.json**

- Found during: Task 3-3.2 typecheck failure
- Issue: Exchange route and login route both import zod; zod was not installed in web-main.
- Fix: Added `"zod": "3.25.28"` to dependencies + `"ioredis": "5.10.1"` as devDependency for test Redis client. Plan specified zod@4.3.6 but used 3.x as v4 was not in the workspace; same API surface used.
- Files modified: apps/web-main/package.json

## New Env Vars

| Variable | Purpose |
|----------|---------|
| SSO_STATE_SECRET | HMAC-SHA256 key for signing SSO state tokens — openssl rand -hex 64 |
| SSO_INTERNAL_TOKEN | Internal-header gate secret for /api/sso/exchange |
| ACCOUNTS_HOST | Hostname for accounts.brand.com |
| ACCOUNTS_HOST_PARENT | Parent domain for agency subdomains (default: brand.com) |
| LOGIN_DEV_USER_EMAIL | Dev-only login email (non-production only) |
| LOGIN_DEV_USER_PASSWORD | Dev-only login password (non-production only) |
| LOGIN_DEV_USER_ID | Dev-only user UUID (non-production only) |
| DB_APP_PASSWORD | Per-agency DB app connection password |

## Plan-Time Decisions Resolved

- Q2 (Redis SSO namespace): accounts:sso:code:* platform-shared. Per-agency agency:<id>:session:* continues for sessions.
- A3 (SSO architecture): Opaque-code + signed-state (NOT shared-domain cookies). __Host- cookies are host-bound.
- Production-501 gap: Login returns 501 until users.password_hash ships (Phase 5+).
- Open-redirect: Inline same-origin check. Plan 03-06 ships validateReturnTo() to replace it.

## Files Plans 03-04..03-06 Consume

- Plan 03-04: Middleware relies on verifySsoState from @mjagency/auth (real HMAC now, not stub). /auth/callback in web-main already uses it.
- Plan 03-05: requireSession reads cookies set by /api/auth/login (setAuthCookies) and /api/sso/exchange (via agency-app /auth/callback -> setAuthCookies).
- Plan 03-06: validateReturnTo() helper replaces inline same-origin check in /api/auth/login. Audit emit fires on every regenerateSession call.

## Self-Check: PASSED

- packages/auth/src/sso-state.ts: createHmac('sha256') + timingSafeEqual: FOUND
- packages/auth/src/sso-code.ts: accounts:sso:code + getdel: FOUND
- packages/config/src/agency-constants.ts: accounts.sso.code: FOUND
- apps/web-main/src/app/sso/page.tsx: FOUND
- apps/web-main/src/app/api/sso/exchange/route.ts: redeemSsoCode + x-mjagency-internal: FOUND
- apps/web-main/src/app/api/auth/login/route.ts: 501 + NODE_ENV production guard: FOUND
- apps/web-main/src/app/api/auth/logout/route.ts: revokeFamilyTokens + clearAuthCookies: FOUND
- apps/web-main/src/app/api/auth/refresh/route.ts: rotateRefreshToken: FOUND
- pnpm --filter=@mjagency/auth run test: 6 sso-state tests pass, 5 sso-code skip: CONFIRMED
- git commits 7415d3c + fd9ae2a: CONFIRMED
- No jsonwebtoken in packages/auth, packages/config, apps/web-main/src: CONFIRMED
