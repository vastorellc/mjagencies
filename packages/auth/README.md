# @mjagency/auth

JWT-based authentication layer for all MJAgency apps. Implements `jose`-only JWTs,
httpOnly+SameSite=Strict+Secure cookies, atomic Redis-backed one-time-use refresh
rotation with family revocation on replay, and a privilege-escalation session helper.

Plans 03-02 (MFA), 03-03 (SSO), 03-04 (Cloudflare middleware), 03-05 (requireSession),
and 03-06 (audit) all consume the primitives exported from this package.

---

## Token Strategy

| Token      | TTL    | Algorithm | Audience         | Issuer      | Key Secret           |
|------------|--------|-----------|------------------|-------------|----------------------|
| Access JWT | 15 min | HS256     | `mjagency-api`   | `mjagency`  | `JWT_ACCESS_SECRET`  |
| Refresh JWT| 7 days | HS256     | `mjagency-refresh`| `mjagency` | `JWT_REFRESH_SECRET` |

Access token claims: `sub`, `agencyId`, `role`, `jti`, `familyId`, `mfaVerifiedAt?`
Refresh token claims: `sub`, `agencyId`, `jti`, `familyId`

Both secrets are Doppler-managed. Rotation deferred to M011 security-rotation runbook.

---

## Cookie Names

| Environment                    | Access Cookie      | Refresh Cookie      | `secure` flag |
|--------------------------------|--------------------|---------------------|---------------|
| Production (`NODE_ENV=production`) | `__Host-access`  | `__Host-refresh`    | `true`        |
| Development (all other values) | `mj-access`        | `mj-refresh`        | `false`       |

All cookies are set with: `httpOnly: true`, `sameSite: 'strict'`, `path: '/'`, NO `domain`.

**Plan-Time Decision Open Q5 (cookie fallback):**
The `__Host-` prefix requires `Secure=true` and no `Domain` attribute, which does not work on
`http://localhost`. Dev mode falls back to bare names with `secure: false` so localhost HTTP
auth works without a self-signed certificate. `clearAuthCookies()` always clears all four names
(`__Host-access`, `__Host-refresh`, `mj-access`, `mj-refresh`) so a `NODE_ENV` toggle never
leaves a stale cookie in the browser.

---

## Family Revocation (REQ-022)

```
Login ──► issue(access, refresh, familyId) ──► store rt:<jti> in Redis (EX 7d)
                                                ──► add jti to family:<familyId> set

Refresh ──► verifyRefreshToken(token)
         ──► redis.getdel(rt:<jti>)
               ├─ found   ──► issue new pair (same familyId, new JTIs) ──► store new rt:<newJti>
               └─ not found ──► REPLAY DETECTED
                               ──► smembers(family:<familyId>)
                               ──► del(rt:<jti>) for each member
                               ──► del(family:<familyId>)
                               ──► return null  ──► force logout
```

`rotateRefreshToken` returns `null` on replay (does NOT throw). The route handler is expected
to clear cookies and redirect to login. The old `rt:<jti>` Redis marker is gone after the first
redemption (atomic GETDEL), making replay physically impossible for the first caller.

---

## Privilege-Escalation Session Swap (REQ-027)

`regenerateSession(oldFamilyId, userId, agencyId, role, redis, opts)`:
1. Revokes the old token family (calls `revokeFamilyTokens`)
2. Issues a brand-new family with fresh JTIs
3. Returns `{ accessToken, refreshToken, familyId }`

Plan 03-02 (MFA) calls `regenerateSession` after TOTP verify to stamp `mfaVerifiedAt` into
the new access token. Plan 03-05 server actions call `regenerateSession` on role change.

---

## REDIS_KEY Namespace (CLAUDE.md §8 — agency isolation)

All session Redis keys flow through `REDIS_KEY.session.*` helpers from `@mjagency/config`:

| Helper                                   | Key pattern                                   |
|------------------------------------------|-----------------------------------------------|
| `REDIS_KEY.session.rt(agencyId, jti)`    | `agency:<id>:session:rt:<jti>`                |
| `REDIS_KEY.session.family(agencyId, f)`  | `agency:<id>:session:family:<familyId>`       |
| `REDIS_KEY.session.revoked(agencyId, j)` | `agency:<id>:session:revoked:<jti>`           |
| `REDIS_KEY.session.mfaLockout(a, u)`     | `agency:<id>:session:mfa-lockout:<userId>`    |
| `REDIS_KEY.session.user(agencyId, u)`    | `agency:<id>:session:<userId>` (back-compat)  |

SSO codes (cross-agency, brokered through accounts.brand.com) use the `accounts:sso:*`
namespace — Plan 03-03 adds that helper.

---

## REQ Coverage

| Requirement | Description                                           | File           |
|-------------|-------------------------------------------------------|----------------|
| REQ-020     | JWT auth implemented                                  | tokens.ts      |
| REQ-021     | Access token 15min, HS256, aud=mjagency-api           | tokens.ts      |
| REQ-022     | Refresh one-time-use, 7d, family revocation on replay | refresh.ts     |
| REQ-023     | httpOnly + SameSite=Strict + Secure + __Host- cookies | cookie.ts      |
| REQ-027     | regenerateSession on privilege escalation             | session.ts     |
| REQ-300     | jose exclusively (no jsonwebtoken)                    | tokens.ts      |
| REQ-310     | Explicit algorithms/issuer/audience on every verify   | tokens.ts      |

---

## Env Vars Required

```bash
JWT_ACCESS_SECRET=<64-byte hex>   # openssl rand -hex 64 (Doppler-managed)
JWT_REFRESH_SECRET=<64-byte hex>  # distinct secret (Doppler-managed)
REDIS_URL=redis://localhost:6379
```

---

## Test Coverage

- **Unit tests (16):** `src/__tests__/tokens.test.ts` (10 tests) + `src/__tests__/cookie.test.ts` (6 tests)
  - No external deps; `vi.stubEnv` for secrets; `vi.mock('next/headers')` for cookie jar
- **Integration tests (5):** `src/__tests__/refresh.integration.test.ts`
  - Gated on `INTEGRATION_REDIS_URL` — skip cleanly without Redis; run full suite with Redis
  - Covers: rotation, replay+family-revoke, double-revoke safety, regenerateSession, tampered token throw

Run all unit tests: `pnpm --filter=@mjagency/auth vitest run`
