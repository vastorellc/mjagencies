# Phase 3: Auth + SSO + Edge Routing — Research

**Researched:** 2026-04-25
**Domain:** JWT, MFA/TOTP, SSO, Next.js 15 Edge middleware, Redis session management, Cloudflare routing
**Confidence:** HIGH (locked stack; primary goal is verifying current API patterns, version pins, and integration pitfalls)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**From Phase 1+2 (carried forward)**
- JWT library: `jose` ONLY (REQ-502, REQ-300 — `jsonwebtoken` BANNED by CI security-grep)
- Audit log infrastructure: hash-chained, monthly-partitioned, SHA-256 chain (Phase 2 02-06)
- `withAgencyContext()` wrapper required for any agency-scoped DB query (Phase 2 02-01/02-02)
- Agency-isolation Redis keys via `REDIS_KEY` from `@mjagency/config` (`session: (a, u) => agency:${a}:session:${u}`)
- BullMQ encrypted queue available via `@mjagency/queue` if any auth flows need queues
- 12 PgBouncer ports 6432–6443 + transaction mode (auth code MUST use `withAgencyContext`)
- Cookie names follow `__Host-` prefix convention for max security

**From CONTEXT.md locked policy (mjagency/ specs)**
- Access token TTL: 15 minutes (REQ-021)
- Refresh token TTL: 7 days, one-time-use with token family revocation on replay (REQ-022)
- TOTP MFA: `otpauth` library (REQ-025)
- Recovery codes: 8 codes, bcrypt-stored at cost factor 12, single-use (REQ-025, REQ-309)
- Cloudflare middleware: rate limits, security headers, agency subdomain extraction; `matcher` MUST exclude `/(payload)/admin` and `/api/*` (REQ-030)
- SSO host: `accounts.brand.com` (the brand agency = web-main) (REQ-026)
- Open-redirect prevention: `next` query param strict-allowlist, never raw redirect (REQ-308, REQ-424)
- Agency owner cannot self-delete (REQ-028, REQ-400)
- JWT claims: `iss=mjagency`, `aud=mjagency-api` on access tokens, `aud=mjagency-refresh` on refresh tokens (REQ-310, SEC-N8)
- `httpOnly + SameSite=Strict + Secure` cookies, `__Host-` prefix (REQ-023)
- MFA mandatory for `super_admin` + `admin` roles (REQ-024)

### Claude's Discretion
- JWT key rotation cadence (deferred to security-rotation runbook)
- MFA bypass for emergency access (super-admin only, audited)
- SSO state CSRF mechanism implementation details
- Middleware ordering

### Deferred Ideas (OUT OF SCOPE)
- WebAuthn/passkeys — defer to security-hardening (M011)
- SAML SSO for enterprise — defer to post-launch
- Password-less email-link auth — out of scope at M003
- IP allowlisting for super_admin — defer to M011
- Rate-limit-by-account (vs rate-limit-by-IP) — M011

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-020 | JWT using `jose` library ONLY (never `jsonwebtoken`) | §1 jose API patterns; CI gate pattern in §10 |
| REQ-021 | Access token — 15min TTL, iss=mjagency, aud=mjagency-api | §1.1 SignJWT pattern with exact claims |
| REQ-022 | Refresh token — 7d TTL, one-time use, family revocation | §2 Access + refresh strategy; family revocation schema |
| REQ-023 | Tokens in httpOnly + SameSite=Strict + Secure cookies | §3 Cookie patterns with `__Host-` prefix |
| REQ-024 | MFA mandatory for super_admin + admin roles | §4.4 enforcement gate pattern |
| REQ-025 | TOTP + 8 one-time recovery codes | §4 TOTP MFA + recovery codes |
| REQ-026 | SSO at accounts.brand.com | §5 SSO cross-subdomain pattern |
| REQ-027 | Session regeneration on privilege escalation | §2.4 rotation flow; audit log emit |
| REQ-028 | Agency owner cannot self-delete account | §9 self-delete block patterns |
| REQ-029 | Next.js version >= 15.2.3 (CVE-2025-29927 patch) | §10 CVE details + CI gate |
| REQ-030 | Cloudflare middleware excludes `/admin` and `/api` routes | §6 middleware matcher pattern |
| REQ-031 | Every server action — auth check as first line | §7 requireSession() helper |
| REQ-300 | `jose` library ONLY for JWT | §1 jose patterns; no alternatives |
| REQ-308 | Open redirect — validate `returnTo` is same-origin | §8 open-redirect prevention |
| REQ-309 | MFA recovery — 8 one-time codes, bcrypt stored | §4.3 recovery codes pattern |
| REQ-310 | JWT claims — iss=mjagency, aud verified on every check | §1.2 jwtVerify options |
| REQ-400 | Agency owner cannot self-delete account | §9 DB constraint + server-action guard |
| REQ-408 | Subdomain rename — Cal.com redirect configured | §6.3 Host header extraction notes |
| REQ-424 | Open redirect prevention — `returnTo` must be same-origin | §8 same-origin validation |

</phase_requirements>

---

## Project Constraints (from mjagency/CLAUDE.md)

These directives apply with the same authority as locked decisions:

1. **`jose` ONLY for JWT** — `import { jwtVerify, SignJWT } from 'jose'`. Never `jsonwebtoken`. CI gate: `grep jsonwebtoken` must return 0. [VERIFIED: CLAUDE.md §2, security.md]
2. **Server actions: session check as FIRST LINE** — `const session = await requireSession()` before any logic. Middleware alone is insufficient. [VERIFIED: CLAUDE.md §3, security.md SEC-02]
3. **Next.js middleware matcher MUST exclude `/(payload)/admin/*`, `/api/*`, `/_next/*`** — Payload routes need Node runtime; middleware runs on Edge. [VERIFIED: CLAUDE.md §4]
4. **No secrets in `NEXT_PUBLIC_` env vars.** JWT secrets via Doppler only, never in browser. [VERIFIED: CLAUDE.md §7]
5. **TypeScript strict mode always; no `any`; explicit return types; `import type` for types.** [VERIFIED: CLAUDE.md §9]
6. **Pino logger (`createLogger` from `packages/config`) for all auth event logging** — auth flows MUST log via `createLogger` so JWTs are scrubbed via redact config. [VERIFIED: Phase 1 RESEARCH; packages/config/logger.ts]
7. **OTel spans in auth flows must respect Edge runtime guard** — Pino (`createLogger`) and OTel work in Node; only `jose` + Edge-compatible APIs in middleware.ts. [VERIFIED: Phase 1 canonical refs]
8. **All auth events MUST emit audit log rows** via the Phase 2 audit trigger / `capture_audit_row()` pattern. [VERIFIED: Phase 2 02-06 SUMMARY]
9. **`withAgencyContext(db, agencyId, ...)` is the ONLY approved DB query path** — never raw SQL without this wrapper. [VERIFIED: packages/db/src/client.ts]

---

## Summary

Phase 3 implements the security boundary that all subsequent phases stand on. It wires JWT-based stateless auth into the Phase 2 DB schema (`sessions` + `users` tables with RLS), adds TOTP MFA with bcrypt-stored recovery codes, establishes an SSO subdomain at `accounts.brand.com`, and locks Cloudflare middleware subdomain routing with security headers. The server-action auth pattern (`requireSession()`) is enforced via a custom ESLint rule so the contract is machine-checked across all 6 plans.

The most critical integration requirements are: (1) `jose` **only** — no `jsonwebtoken` anywhere (CI gate); (2) refresh token family revocation — a replay of any token in a family must immediately revoke every session in that family and force logout; (3) the Cloudflare middleware matcher must **not** cover `/(payload)/admin` or `/api/*` routes (these need Node runtime for Payload CMS); (4) every server action must call `requireSession()` as its FIRST statement — middleware is not sufficient because CVE-2025-29927 demonstrated that middleware can be bypassed.

**Primary recommendation:** Model `packages/auth` as the single source of truth for all token operations, cookie management, and session retrieval. Application code never touches JWT directly — it calls `packages/auth` helpers.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JWT signing + verification | API / Node runtime (packages/auth) | Edge (middleware — verify only) | Signing requires secret key; verification must work at Edge for fast redirects |
| Cookie management | API / Server Action | — | `cookies()` from `next/headers` only writable in server actions + route handlers |
| Redis revocation store | API / Node runtime | — | `ioredis` is Node-only; Edge cannot reach Redis directly |
| MFA TOTP validation | API / Node runtime | — | `otpauth` is universal but bcrypt (recovery codes) is Node-only |
| Cloudflare subdomain routing | Edge (middleware.ts) | — | Host header available at Edge; must run before request hits app |
| Security headers (CSP, HSTS) | Edge (middleware.ts) | — | Set on every response before body is sent; Edge is earliest intercept point |
| Audit log emission | API / Node runtime | — | `capture_audit_row()` trigger + `withAgencyContext()` — both require Postgres |
| Agency owner self-delete block | API / Node runtime + DB constraint | — | Business rule enforced at two layers: DB trigger + server-action guard |
| SSO token exchange | API / Node runtime (accounts.brand.com route handler) | — | Opaque state token stored in Redis; exchange happens server-side |

---

## §1 jose JWT Signing + Verification

### §1.1 Library Overview

- **Package:** `jose` [VERIFIED: npm registry — version 6.2.2, published 2026-04-25]
- **Why:** Edge-runtime compatible (no Node-only `crypto` module dependency at import time), full TypeScript types, supports HS256, RS256, ES256 and all RFC-compliant algorithms.
- **BANNED alternative:** `jsonwebtoken` — incompatible with Next.js Edge runtime. CI gate REQ-502 enforces.

### §1.2 HS256 Access Token — Signing Pattern

```typescript
// Source: github.com/panva/jose docs/jwt/sign/classes/SignJWT.md [VERIFIED]
// packages/auth/src/tokens.ts
import { SignJWT } from 'jose'

const JWT_ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!)
// process.env.JWT_ACCESS_SECRET = 64-byte hex from Doppler, e.g. openssl rand -hex 64

export interface AccessTokenClaims {
  sub: string       // user UUID
  agencyId: string  // agency UUID
  role: 'super_admin' | 'admin' | 'editor'
  jti: string       // UUID v4, used for revocation
  familyId: string  // token family UUID, same for all refresh tokens in a session
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({
    sub:      claims.sub,
    agencyId: claims.agencyId,
    role:     claims.role,
    familyId: claims.familyId,
    jti:      claims.jti,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('mjagency')
    .setAudience('mjagency-api')
    .setExpirationTime('15m')
    .sign(JWT_ACCESS_SECRET)
}
```

### §1.3 HS256 Refresh Token — Signing Pattern

```typescript
// packages/auth/src/tokens.ts (continued)
const JWT_REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET!)

export interface RefreshTokenClaims {
  sub:        string  // user UUID
  agencyId:   string  // agency UUID
  jti:        string  // UUID v4 — uniquely identifies THIS refresh token
  familyId:   string  // family UUID — shared across all rotations in one login session
}

export async function signRefreshToken(claims: RefreshTokenClaims): Promise<string> {
  return new SignJWT({
    sub:      claims.sub,
    agencyId: claims.agencyId,
    jti:      claims.jti,
    familyId: claims.familyId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('mjagency')
    .setAudience('mjagency-refresh')
    .setExpirationTime('7d')
    .sign(JWT_REFRESH_SECRET)
}
```

### §1.4 jwtVerify — Access Token (Edge-compatible)

```typescript
// Source: github.com/panva/jose docs/jwt/verify/functions/jwtVerify.md [VERIFIED]
// packages/auth/src/tokens.ts

import { jwtVerify, type JWTPayload } from 'jose'

export interface VerifiedAccessPayload extends JWTPayload {
  sub:      string
  agencyId: string
  role:     'super_admin' | 'admin' | 'editor'
  jti:      string
  familyId: string
}

export async function verifyAccessToken(
  token: string
): Promise<VerifiedAccessPayload> {
  const { payload } = await jwtVerify<VerifiedAccessPayload>(
    token,
    JWT_ACCESS_SECRET,
    {
      algorithms: ['HS256'],
      issuer:     'mjagency',
      audience:   'mjagency-api',
    }
  )
  return payload
}

// Refresh token verification (NODE runtime only — in route handlers, not middleware)
export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenClaims & JWTPayload> {
  const { payload } = await jwtVerify<RefreshTokenClaims & JWTPayload>(
    token,
    JWT_REFRESH_SECRET,
    {
      algorithms: ['HS256'],
      issuer:     'mjagency',
      audience:   'mjagency-refresh',
    }
  )
  return payload
}
```

### §1.5 RS256 — Key Import Pattern (for future rotation)

RS256 is not required at v1 but the key import API is documented here for the quarterly rotation runbook:

```typescript
// Source: jose docs [VERIFIED: npm view jose 6.2.2; github.com/panva/jose]
import { importPKCS8, importSPKI } from 'jose'

// Signing (private key, PKCS#8 PEM from Doppler)
const privateKey = await importPKCS8(process.env.JWT_PRIVATE_KEY!, 'RS256')

// Verification (public key, SPKI PEM)
const publicKey = await importSPKI(process.env.JWT_PUBLIC_KEY!, 'RS256')

// Sign
const token = await new SignJWT({ sub: 'user-uuid' })
  .setProtectedHeader({ alg: 'RS256', kid: 'v1' })  // kid enables key rotation
  .setIssuer('mjagency')
  .setAudience('mjagency-api')
  .setExpirationTime('15m')
  .sign(privateKey)

// Verify
const { payload } = await jwtVerify(token, publicKey, {
  algorithms: ['RS256'],
  issuer:     'mjagency',
  audience:   'mjagency-api',
})
```

**Key rotation strategy (Claude's Discretion):** v1 uses HS256 with a single shared secret. Key rotation is a Doppler + quarterly runbook concern (security.md SEC-10). When v2 migrates to RS256, use `kid` in the header and a JWKS endpoint — `jose`'s `createRemoteJWKSet` handles this without code changes to the verify path. [ASSUMED — rotation tooling details not confirmed in this session]

---

## §2 Access + Refresh Token Strategy + Redis Revocation

### §2.1 Token Strategy Overview

| Property | Access Token | Refresh Token |
|----------|-------------|---------------|
| TTL | 15 minutes | 7 days |
| Algorithm | HS256 | HS256 |
| `aud` | `mjagency-api` | `mjagency-refresh` |
| `iss` | `mjagency` | `mjagency` |
| `jti` | UUID v4 (revocable) | UUID v4 (one-time-use marker) |
| `familyId` | Carried from refresh | New UUID per login, inherited on rotation |
| Stored in | httpOnly cookie `__Host-access` | httpOnly cookie `__Host-refresh` |
| Revocation check | On every request (Redis TTL) | On each rotation (Redis atomic check) |

### §2.2 Redis Revocation Store Schema

```
# Namespace: agency:<agencyId>:session:*
# (uses REDIS_KEY helper from @mjagency/config)

# Per-JTI revocation (access token)
agency:<agencyId>:session:revoked:<jti>
  value: "1"
  TTL: remaining token lifetime in seconds (15m max)

# Refresh token one-time-use marker
agency:<agencyId>:session:rt:<jti>
  value: JSON.stringify({ familyId, userId, usedAt: null })
  TTL: 7 days

# Family revocation set (all JTIs in a family)
agency:<agencyId>:session:family:<familyId>
  type: Redis SET (SADD)
  value: [jti1, jti2, ...] (all refresh token JTIs in this family)
  TTL: 7 days
```

**Note:** `REDIS_KEY` helper from `packages/config` generates these key strings. Do not hardcode key patterns — always use the helper. [VERIFIED: 03-CONTEXT.md canonical refs; packages/config/src/agency-constants.ts]

### §2.3 Token Rotation Flow

```typescript
// packages/auth/src/refresh.ts
// Called from: app/api/auth/refresh/route.ts (Node runtime only — NOT middleware)

import { eq, and, isNull } from 'drizzle-orm'
import { sessions } from '@mjagency/db'
import { withAgencyContext } from '@mjagency/db'
import { REDIS_KEY } from '@mjagency/config'
import { createClient } from 'ioredis'

export async function rotateRefreshToken(
  incomingRefreshToken: string,
  redis: ReturnType<typeof createClient>,
  db: AgencyDb,
  agencyId: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  // 1. Verify refresh token cryptographic signature
  const claims = await verifyRefreshToken(incomingRefreshToken)
  // jwtVerify throws on expired or invalid signature

  // 2. Atomic one-time-use check: GET + DEL in a single Redis transaction
  const rtKey = REDIS_KEY.session.rt(agencyId, claims.jti)
  const stored = await redis.getdel(rtKey)  // atomic: returns value and deletes

  if (!stored) {
    // Token already used OR never existed — REPLAY DETECTED
    // Revoke entire family
    await revokeFamilyTokens(redis, agencyId, claims.familyId)
    return null  // caller must force logout
  }

  // 3. Verify session exists in DB and is not revoked
  const session = await withAgencyContext(db, agencyId, async (tx) => {
    return tx
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenFamilyId, claims.familyId),
          isNull(sessions.revokedAt)
        )
      )
      .limit(1)
  })

  if (!session.length) return null

  // 4. Issue new token pair
  const newJti       = crypto.randomUUID()
  const newRefreshJti = crypto.randomUUID()

  const [newAccess, newRefresh] = await Promise.all([
    signAccessToken({
      sub:      claims.sub,
      agencyId: claims.agencyId,
      role:     session[0].role as AccessTokenClaims['role'],
      jti:      newJti,
      familyId: claims.familyId,
    }),
    signRefreshToken({
      sub:      claims.sub,
      agencyId: claims.agencyId,
      jti:      newRefreshJti,
      familyId: claims.familyId,
    }),
  ])

  // 5. Store new refresh token one-time-use marker
  const rtTtl = 7 * 24 * 3600
  await redis.set(
    REDIS_KEY.session.rt(agencyId, newRefreshJti),
    JSON.stringify({ familyId: claims.familyId, userId: claims.sub, usedAt: null }),
    'EX',
    rtTtl
  )

  // 6. Add new JTI to family set
  await redis.sadd(
    REDIS_KEY.session.family(agencyId, claims.familyId),
    newRefreshJti
  )
  await redis.expire(REDIS_KEY.session.family(agencyId, claims.familyId), rtTtl)

  return { accessToken: newAccess, refreshToken: newRefresh }
}

async function revokeFamilyTokens(
  redis: ReturnType<typeof createClient>,
  agencyId: string,
  familyId: string
): Promise<void> {
  const familyKey = REDIS_KEY.session.family(agencyId, familyId)
  const members   = await redis.smembers(familyKey)

  // Delete all refresh token one-time-use markers in this family
  if (members.length > 0) {
    await redis.del(
      ...members.map((jti) => REDIS_KEY.session.rt(agencyId, jti))
    )
  }
  await redis.del(familyKey)
}
```

### §2.4 Session Regeneration on Privilege Escalation (REQ-027)

On MFA completion or role elevation, issue a brand new token pair with a **new** `familyId`. The old family is revoked:

```typescript
// packages/auth/src/session.ts
export async function regenerateSession(
  oldFamilyId: string,
  userId: string,
  agencyId: string,
  role: AccessTokenClaims['role'],
  redis: ReturnType<typeof createClient>
): Promise<{ accessToken: string; refreshToken: string }> {
  // Revoke old family
  await revokeFamilyTokens(redis, agencyId, oldFamilyId)

  // Issue completely new family
  const newFamilyId   = crypto.randomUUID()
  const newAccessJti  = crypto.randomUUID()
  const newRefreshJti = crypto.randomUUID()

  const [access, refresh] = await Promise.all([
    signAccessToken({ sub: userId, agencyId, role, jti: newAccessJti, familyId: newFamilyId }),
    signRefreshToken({ sub: userId, agencyId, jti: newRefreshJti, familyId: newFamilyId }),
  ])

  await redis.set(
    REDIS_KEY.session.rt(agencyId, newRefreshJti),
    JSON.stringify({ familyId: newFamilyId, userId }),
    'EX',
    7 * 24 * 3600
  )

  return { accessToken: access, refreshToken: refresh }
}
```

**Audit log:** emit a `privilege_escalation` row via the audit trigger for every call to `regenerateSession`. [VERIFIED: Phase 2 02-06 SUMMARY — capture_audit_row() pattern]

---

## §3 Cookies (`__Host-`, httpOnly, SameSite=Strict, Secure)

### §3.1 `__Host-` Prefix Requirements

The `__Host-` cookie prefix mandates: [VERIFIED: MDN Set-Cookie docs; github.com/vercel/next.js issue #56632]

1. `Secure` attribute must be set (HTTPS origin)
2. **No `Domain` attribute** (host-only — prevents subdomain overrides)
3. `Path=/` (cannot be scoped to a sub-path)
4. Must be set from a secure (HTTPS) origin

**Implication:** `__Host-` cookies are bound to the exact origin. They **cannot** be read by sibling subdomains — this is precisely why they are the right choice for auth tokens.

**Critical Next.js bug:** [VERIFIED: github.com/vercel/next.js/issues/56632] `ResponseCookies#delete` does not correctly honor `__Secure-`/`__Host-` prefix cookies in some Next.js versions. Always verify `delete()` behavior in integration tests and prefer `set(..., { maxAge: 0 })` as the deletion path.

### §3.2 Cookie Names for MJAgency

```
__Host-access   — access token (15min)
__Host-refresh  — refresh token (7d)
__Host-mfa      — ephemeral MFA-in-progress state (5min TTL, cleared after TOTP verify)
```

### §3.3 Setting Cookies — Server Action / Route Handler Pattern

```typescript
// Source: nextjs.org/docs/app/api-reference/functions/cookies [VERIFIED — Next.js 16.2.4 docs]
// NOTE: npm view next version = 16.2.4; production constraint is >= 15.2.3
// packages/auth/src/cookie.ts
import 'server-only'
import { cookies } from 'next/headers'

const IS_PROD = process.env.NODE_ENV === 'production'

export async function setAuthCookies(
  accessToken:  string,
  refreshToken: string
): Promise<void> {
  const jar = await cookies()  // async in Next.js 15+ (v15.0.0-RC change)

  // Access token — 15min
  jar.set('__Host-access', accessToken, {
    httpOnly: true,
    secure:   true,          // __Host- requires Secure
    sameSite: 'strict',
    path:     '/',           // __Host- requires Path=/
    maxAge:   15 * 60,       // 15 minutes in seconds
    // NO domain attribute — __Host- prohibition
  })

  // Refresh token — 7d
  jar.set('__Host-refresh', refreshToken, {
    httpOnly: true,
    secure:   true,
    sameSite: 'strict',
    path:     '/',
    maxAge:   7 * 24 * 60 * 60,  // 7 days in seconds
  })
}

export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies()
  // Use maxAge:0 to clear — delete() has known issues with __Host- prefixed cookies
  jar.set('__Host-access',  '', { maxAge: 0, path: '/', secure: true, httpOnly: true, sameSite: 'strict' })
  jar.set('__Host-refresh', '', { maxAge: 0, path: '/', secure: true, httpOnly: true, sameSite: 'strict' })
}
```

**Edge runtime note:** `cookies()` from `next/headers` is **not** available in middleware.ts (Edge runtime). In middleware, read cookies via `req.cookies.get('__Host-access')?.value`. Only write/delete cookies from server actions or route handlers.

### §3.4 Reading Cookie in Middleware (Edge)

```typescript
// apps/web-*/middleware.ts — Edge compatible
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'  // Edge-compatible

const JWT_ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET)

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('__Host-access')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  try {
    await jwtVerify(token, JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer:     'mjagency',
      audience:   'mjagency-api',
    })
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}
```

---

## §4 TOTP MFA + Recovery Codes

### §4.1 Library Selection

- **`otpauth`** — version `9.5.1` [VERIFIED: npm view otpauth version = 9.5.1]
- Supports TOTP (RFC 6238), full TypeScript types, works in Node.js, Bun, Deno, and browsers
- Provides `TOTP.validate()` with configurable window, `URI.stringify()` for QR code URI
- Last published: 2026-04-25 [VERIFIED: npm registry]
- **`qrcode`** — version `1.5.4` for QR code image generation [VERIFIED: npm view qrcode version = 1.5.4]
- **`bcrypt`** — version `6.0.0` for recovery code hashing [VERIFIED: npm view bcrypt version = 6.0.0]

### §4.2 TOTP Setup Flow

```typescript
// Source: github.com/hectorm/otpauth README [VERIFIED — v9.5.1, fetched 2026-04-25]
// packages/auth/src/mfa.ts
import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'

export function generateTotpSecret(): string {
  // Generates a 160-bit (20-byte) cryptographically secure random secret
  // OTPAuth.Secret generates via crypto.getRandomValues (works in Edge + Node)
  const secret = new OTPAuth.Secret({ size: 20 })
  return secret.base32  // Store this in DB (encrypted via vault helper)
}

export function createTotpUri(
  secret: string,
  userEmail: string,
  issuer: string = 'MJAgency'
): string {
  const totp = new OTPAuth.TOTP({
    issuer,
    label:     userEmail,
    algorithm: 'SHA1',   // RFC 6238 standard; most authenticator apps only support SHA1
    digits:    6,
    period:    30,
    secret:    OTPAuth.Secret.fromBase32(secret),
  })
  return totp.toString()  // otpauth://totp/... URI
}

export async function generateQrCodeDataUrl(totpUri: string): Promise<string> {
  return QRCode.toDataURL(totpUri, { errorCorrectionLevel: 'M' })
}

export function verifyTotp(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits:    6,
    period:    30,
    secret:    OTPAuth.Secret.fromBase32(secret),
  })
  const delta = totp.validate({ token, window: 1 })
  // window: 1 = accept 1 step before/after (accounts for clock skew)
  // Returns null if invalid, 0/±1 if valid
  return delta !== null
}
```

### §4.3 Recovery Codes — Generation + Storage

```typescript
// packages/auth/src/recovery-codes.ts
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'

const BCRYPT_COST = 12  // SEC-12 specifies cost factor 12
const CODE_COUNT  = 8   // REQ-025, REQ-309

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: CODE_COUNT }, () =>
    randomBytes(16).toString('hex')  // 128-bit random hex string
  )
}

export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code, BCRYPT_COST)))
}

// Verify a recovery code against stored hashes
// Returns index of matching hash (for invalidation) or -1
export async function verifyRecoveryCode(
  plainCode: string,
  storedHashes: string[]
): Promise<number> {
  for (let i = 0; i < storedHashes.length; i++) {
    const hash = storedHashes[i]
    if (hash && await bcrypt.compare(plainCode, hash)) {
      return i
    }
  }
  return -1
}
```

**Storage:** Recovery code hashes stored in a new `mfa_config` table (not in `permissions_vault`) with:
- `user_id`, `agency_id`, `totp_secret_encrypted` (via vault helper), `recovery_hashes` (text[], 8 entries), `backup_used_at` (timestamp[] — one per slot, set when used)
- Recovery code hash slot set to empty string `''` on use (prevents double-use without shrinking array)

**Audit log:** emit `mfa_recovery_code_used` + `mfa_recovery_code_invalidated` rows on every recovery code consumption.

### §4.4 MFA Enforcement Gate

```typescript
// packages/auth/src/session.ts
// Called in requireSession() helper (§7) after JWT verification
export function checkMfaEnforcement(
  role: 'super_admin' | 'admin' | 'editor',
  mfaVerifiedAt: Date | null,
  mfaEnabled: boolean
): void {
  const MFA_REQUIRED_ROLES = new Set(['super_admin', 'admin'])
  if (!MFA_REQUIRED_ROLES.has(role)) return

  if (!mfaEnabled) {
    // REQ-024: MFA mandatory for super_admin + admin
    // 30-day grace period: tracked in users.mfa_grace_period_expires_at
    // After grace expires, throw here and redirect to MFA setup
    throw new MfaRequiredError('MFA must be configured before this role grants access')
  }

  if (!mfaVerifiedAt) {
    throw new MfaRequiredError('MFA verification required for this session')
  }
}
```

**Lockout policy (SEC-12):** 3 consecutive TOTP failures → 15-minute temporary lockout stored as `agency:<id>:session:mfa-lockout:<userId>` in Redis with 15-minute TTL. Each failed attempt increments an `INCR` counter with `EXPIRE` reset. [ASSUMED — exact lockout duration; policy derives from SEC-12 principles]

---

## §5 SSO at accounts.brand.com

### §5.1 Architecture Pattern

SSO in this system is an **intra-platform cross-subdomain auth flow**, not an OAuth provider integration. `accounts.brand.com` is a centralized login page hosted by the `web-main` Next.js app that issues tokens valid across all agency subdomains.

The cross-subdomain challenge: `__Host-` cookies are host-bound — a cookie set on `accounts.brand.com` cannot be read by `ecommerce.brand.com`. The solution is an **opaque state token + server-side redirect** pattern:

```
1. User visits ecommerce.brand.com/protected-page
2. Middleware detects no __Host-access cookie → redirect to accounts.brand.com/sso?
      returnTo=<signed-redirect-token>
      &agency=ecommerce
3. accounts.brand.com presents login form
4. On successful auth: accounts.brand.com generates an opaque SSO code (16-byte random hex)
      → stores in Redis: accounts:sso:<code> = { userId, agencyId, familyId, createdAt }  TTL=60s
      → redirects to ecommerce.brand.com/auth/callback?code=<code>&state=<signed-state>
5. ecommerce.brand.com /auth/callback route handler:
      a. Verifies state param (signed HMAC — §5.2)
      b. POSTs code to accounts.brand.com/api/sso/exchange (server-to-server, not client-side)
      c. accounts.brand.com atomically GETDELs the code from Redis (one-time-use)
      d. Returns { accessToken, refreshToken } JWT pair
      e. ecommerce.brand.com sets __Host-access + __Host-refresh cookies via setAuthCookies()
      f. Redirects user to intended page
```

**Why not shared-domain cookies (e.g., `.brand.com`):** Shared-domain cookies defeat `__Host-` guarantees. Any compromised subdomain could read auth cookies. The opaque-code exchange is more secure. [ASSUMED — the specific SSO mechanism; the locked constraint is `__Host-` cookies which makes shared-domain cookies incompatible. This architecture is the natural consequence.]

### §5.2 State CSRF Mechanism

```typescript
// packages/auth/src/sso-state.ts
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const SSO_STATE_SECRET = process.env.SSO_STATE_SECRET!  // 32-byte from Doppler

export function generateSsoState(agencyId: string, returnTo: string): string {
  const nonce     = randomBytes(16).toString('hex')
  const payload   = `${agencyId}:${encodeURIComponent(returnTo)}:${nonce}`
  const signature = createHmac('sha256', SSO_STATE_SECRET)
    .update(payload)
    .digest('hex')
  return Buffer.from(`${payload}:${signature}`).toString('base64url')
}

export function verifySsoState(
  state: string,
  expectedAgencyId: string
): { valid: boolean; returnTo: string } {
  const decoded = Buffer.from(state, 'base64url').toString('utf8')
  const parts   = decoded.split(':')
  if (parts.length < 4) return { valid: false, returnTo: '/dashboard' }

  const [agencyId, encodedReturnTo, nonce, signature] = parts as [string, string, string, string]
  const payload   = `${agencyId}:${encodedReturnTo}:${nonce}`
  const expected  = createHmac('sha256', SSO_STATE_SECRET)
    .update(payload)
    .digest('hex')

  const valid = (
    agencyId === expectedAgencyId &&
    timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  )

  return {
    valid,
    returnTo: valid ? decodeURIComponent(encodedReturnTo) : '/dashboard',
  }
}
```

### §5.3 Redis SSO Code Schema

```
# On accounts.brand.com's Redis namespace
accounts:sso:<code>       TTL=60s
  value: { userId, agencyId, familyId, issuedAt }
  One-time-use: GETDEL atomically consumed by the exchanging agency app
```

---

## §6 Cloudflare Middleware — Subdomain Routing + Headers + Rate Limits

### §6.1 Matcher — CRITICAL Exclusions

```typescript
// apps/web-*/middleware.ts
// Source: CLAUDE.md §4 [VERIFIED]; ROADMAP REQ-030 [VERIFIED]

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - /(payload)/admin* : Payload CMS admin — Node runtime required
     * - /api/*            : API routes — Node runtime required (Payload + custom)
     * - /_next/*          : Next.js internals
     * - /favicon.ico, sitemap.xml, robots.txt, manifest.json
     *
     * This EXACT pattern is mandated. See REQ-030 + CLAUDE.md §4.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|api/|\\(payload\\)/admin).*)',
  ],
}
```

### §6.2 Agency Subdomain Extraction

```typescript
// apps/web-*/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { AGENCIES } from '@mjagency/config'

const JWT_ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET)

// Type-safe set of known agency slugs
const KNOWN_AGENCIES = new Set<string>(AGENCIES)

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const hostname = req.headers.get('host') ?? ''

  // Strip port for local dev (e.g. ecommerce.localhost:3001)
  const host = hostname.split(':')[0] ?? ''

  // Extract subdomain: ecommerce.brand.com → ecommerce
  // Also handles: ecommerce.localhost (dev)
  const parts       = host.split('.')
  const subdomain   = parts.length >= 2 ? parts[0] : null
  const agencySlug  = subdomain && KNOWN_AGENCIES.has(subdomain) ? subdomain : null

  if (!agencySlug) {
    // Unknown subdomain → 404 (prevents subdomain takeover probing)
    return new NextResponse(null, { status: 404 })
  }

  // Auth check — see §3.4 for full jwtVerify call
  const token = req.cookies.get('__Host-access')?.value
  const url   = req.nextUrl.clone()

  if (!token) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  try {
    const { payload } = await jwtVerify(token, JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer:     'mjagency',
      audience:   'mjagency-api',
    })

    // Verify token's agencyId matches the subdomain
    if ((payload as { agencyId?: string }).agencyId !== agencySlug) {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Inject agency context into request headers for server components
    const response = NextResponse.next()
    response.headers.set('x-agency-id',   agencySlug)
    response.headers.set('x-user-id',     payload.sub ?? '')
    response.headers.set('x-user-role',   (payload as { role?: string }).role ?? '')

    // Apply security headers
    applySecurityHeaders(response)
    return response

  } catch {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
}
```

### §6.3 Security Headers

```typescript
// packages/auth/src/security-headers.ts
export function applySecurityHeaders(response: NextResponse): void {
  const headers = response.headers

  // HSTS: max-age 2 years, include subdomains
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

  // Clickjacking protection (redundant with CSP frame-ancestors but belt-and-suspenders)
  headers.set('X-Frame-Options', 'DENY')

  // XSS filter (legacy browsers)
  headers.set('X-XSS-Protection', '1; mode=block')

  // MIME sniffing prevention
  headers.set('X-Content-Type-Options', 'nosniff')

  // Referrer policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions policy
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)'
  )

  // NOTE: CSP with per-request nonce lives in Phase 11 (SEC-N3).
  // Middleware-level CSP is a static header here; nonce injection lands in M011.
  headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",  // tightened to nonce in Phase 11
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://imagedelivery.net",  // Cloudflare Images
      "connect-src 'self' https://api.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  )
}
```

**CSP nonce (SEC-N3):** The full nonce-per-request CSP implementation is deferred to Phase 11. Phase 3 ships a functional static CSP that does not break Pino + OTel + Lexical. [VERIFIED: security.md SEC-N3 — "Per-request nonce: crypto.randomBytes(16).toString('base64') ... Injected via Cloudflare Worker before HTML response"]

### §6.4 Cloudflare WAF Rate Limiting

Phase 3 uses **Cloudflare WAF rate-limiting rules** (dashboard-configured), not application-level rate limiting (Phase 11 concern). The middleware.ts should NOT implement IP-rate-limiting at the Next.js layer:

- Cloudflare WAF rule: `>50 req/min from same IP to /login` → 429 with 5-minute block
- Cloudflare WAF rule: `>10 req/min to /api/auth/refresh` → 429
- Cloudflare WAF rule: strip `x-middleware-subrequest` header (CVE-2025-29927 mitigation at edge) [VERIFIED: developers.cloudflare.com/changelog/post/2025-03-22-next-js-vulnerability-waf/]

Application-level rate limit option (Claude's Discretion): use a lightweight Redis counter in the `/api/auth/refresh` route handler with `INCR` + `EXPIRE` pattern if Cloudflare WAF is not available in local dev. [ASSUMED — specific rate limit thresholds; adjust based on observed traffic]

---

## §7 Server-Action Auth Pattern + ESLint Rule

### §7.1 `requireSession()` Helper

```typescript
// packages/auth/src/require-session.ts
import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken, type VerifiedAccessPayload } from './tokens.js'

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') { super(message); this.name = 'UnauthorizedError' }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') { super(message); this.name = 'ForbiddenError' }
}

/**
 * requireSession — MUST be called as FIRST statement in every server action.
 *
 * Usage:
 *   'use server'
 *   export async function updatePage(data: PageData) {
 *     const session = await requireSession()   // ← FIRST LINE
 *     if (session.agencyId !== data.agencyId) throw new ForbiddenError()
 *     // ... rest of action
 *   }
 *
 * Throws UnauthorizedError (caught by Next.js error boundaries) if:
 * - No access token cookie present
 * - JWT signature invalid
 * - JWT expired
 * - JWT issuer/audience mismatch
 *
 * For MFA-required roles, the MFA check happens inside this function.
 */
export async function requireSession(
  opts: { requireMfa?: boolean } = {}
): Promise<VerifiedAccessPayload> {
  const jar   = await cookies()
  const token = jar.get('__Host-access')?.value

  if (!token) {
    redirect('/login')  // redirect() throws internally in Next.js
  }

  let payload: VerifiedAccessPayload
  try {
    payload = await verifyAccessToken(token)
  } catch {
    // Clear stale cookies and redirect
    jar.set('__Host-access',  '', { maxAge: 0, path: '/', secure: true, httpOnly: true, sameSite: 'strict' })
    jar.set('__Host-refresh', '', { maxAge: 0, path: '/', secure: true, httpOnly: true, sameSite: 'strict' })
    redirect('/login')
  }

  // MFA enforcement for super_admin + admin
  if (opts.requireMfa || new Set(['super_admin', 'admin']).has(payload.role)) {
    // mfaVerifiedAt is embedded in token claims when MFA is complete
    const mfaVerifiedAt = (payload as { mfaVerifiedAt?: string }).mfaVerifiedAt
    if (!mfaVerifiedAt) {
      redirect('/mfa/verify')
    }
  }

  return payload
}
```

### §7.2 Server Action Pattern (Required Form)

```typescript
// CORRECT — matches CLAUDE.md §3 mandated pattern
'use server'
import { requireSession } from '@mjagency/auth'

export async function updatePageContent(data: { agencyId: string; pageId: string; content: string }) {
  const session = await requireSession()  // FIRST LINE — non-negotiable
  if (session.agencyId !== data.agencyId) throw new ForbiddenError()
  // ... rest of action
}
```

### §7.3 ESLint Rule — Enforce `requireSession()` First Statement

A custom ESLint rule (similar to the Phase 2 `no-session-set` rule) checks that every `async` function in a `'use server'` file starts with `requireSession()`. Location: `packages/config/eslint/rules/require-session-first.js`.

```javascript
// packages/config/eslint/rules/require-session-first.js
/**
 * ESLint rule: require-session-first
 *
 * In any file marked with 'use server' directive, every exported async function
 * MUST have requireSession() or requireSession({ ... }) as its first statement.
 *
 * Exempt functions: those named startsWith('_') (internal helpers).
 *
 * This is a lint-level enforcement of the security pattern from CLAUDE.md §3.
 */
module.exports = {
  meta: {
    type:     'problem',
    docs:     { description: 'Require requireSession() as first statement in server actions' },
    schema:   [],
    messages: {
      missingRequireSession:
        'Server action "{{name}}" must call requireSession() as its first statement (CLAUDE.md §3, REQ-031)',
    },
  },
  create(context) {
    let isUseServerFile = false

    return {
      // Detect 'use server' directive
      ExpressionStatement(node) {
        if (
          node.expression.type === 'Literal' &&
          node.expression.value === 'use server' &&
          node.parent.type === 'Program'
        ) {
          isUseServerFile = true
        }
      },

      // Check exported async functions
      'ExportNamedDeclaration > FunctionDeclaration'(node) {
        if (!isUseServerFile) return
        if (!node.async) return
        if (node.id?.name?.startsWith('_')) return  // exempt private helpers

        const body = node.body?.body ?? []
        const firstStatement = body[0]

        const isRequireSession =
          firstStatement?.type === 'VariableDeclaration' &&
          firstStatement.declarations?.[0]?.init?.type === 'AwaitExpression' &&
          firstStatement.declarations?.[0]?.init?.argument?.type === 'CallExpression' &&
          (
            firstStatement.declarations?.[0]?.init?.argument?.callee?.name === 'requireSession' ||
            (
              firstStatement.declarations?.[0]?.init?.argument?.callee?.type === 'MemberExpression' &&
              firstStatement.declarations?.[0]?.init?.argument?.callee?.property?.name === 'requireSession'
            )
          )

        if (!isRequireSession) {
          context.report({
            node,
            messageId: 'missingRequireSession',
            data:      { name: node.id?.name ?? '(anonymous)' },
          })
        }
      },
    }
  },
}
```

Register in `packages/config/eslint.config.mjs` under `rules:` with severity `'error'`.

---

## §8 Open-Redirect Prevention

### §8.1 Pattern (REQ-308, REQ-424, SEC-N5)

```typescript
// Source: mjagency/specs/security.md SEC-N5 [VERIFIED]
// packages/auth/src/redirect.ts

/**
 * validateReturnTo — verify that a redirect target is same-origin.
 *
 * Accepts: /dashboard, /agency/ecommerce/posts
 * Rejects: https://evil.com, //evil.com, javascript:alert(1), data:text/html,...
 *
 * The URL constructor resolves relative to `origin`. If the resolved origin
 * matches the expected origin, the path is safe. Otherwise, fall back to /dashboard.
 */
export function validateReturnTo(
  returnTo: string | null | undefined,
  origin: string
): string {
  if (!returnTo) return '/dashboard'

  try {
    // Resolve relative to the origin — catches protocol-relative URLs, etc.
    const resolved = new URL(returnTo, origin)
    if (resolved.origin !== origin) {
      return '/dashboard'
    }
    // Additional safety: reject paths starting with //
    if (returnTo.startsWith('//')) return '/dashboard'
    return resolved.pathname + resolved.search + resolved.hash
  } catch {
    return '/dashboard'
  }
}
```

**Usage in login route handler:**

```typescript
// app/api/auth/login/route.ts
const returnTo = validateReturnTo(
  new URL(req.url).searchParams.get('returnTo'),
  new URL(req.url).origin
)
// use returnTo for post-login redirect — never use raw query param
```

### §8.2 Signed Redirect Tokens (for SSO state)

For SSO flows (§5), the `returnTo` value is embedded in the signed state token, not passed as a raw query parameter. The HMAC signature (§5.2) ensures the return URL cannot be tampered with after generation.

---

## §9 Agency Owner Self-Delete Block

### §9.1 Dual-Layer Enforcement (REQ-028, REQ-400)

**Layer 1 — Server Action guard:**

```typescript
// packages/auth/src/guards.ts
import { and, eq } from 'drizzle-orm'
import { users } from '@mjagency/db'
import { withAgencyContext } from '@mjagency/db'

export async function assertNotAgencyOwner(
  db: AgencyDb,
  agencyId: string,
  targetUserId: string,
  requestingUserId: string
): Promise<void> {
  // Only block self-delete; an admin can delete other users
  if (targetUserId !== requestingUserId) return

  // Check if the user is the owner (role=admin AND is the only admin)
  const ownerCount = await withAgencyContext(db, agencyId, async (tx) => {
    return tx
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.agencyId, agencyId), eq(users.role, 'admin')))
  })

  if ((ownerCount[0]?.count ?? 0) <= 1) {
    throw new ForbiddenError(
      'Agency owner cannot delete their own account (REQ-028). Transfer ownership first.'
    )
  }
}
```

**Layer 2 — Database constraint (custom migration in Plan 03-06):**

```sql
-- 005_agency_owner_self_delete_block.sql
-- Postgres function + trigger that prevents deletion of the last admin user
CREATE OR REPLACE FUNCTION prevent_last_admin_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role = 'admin' THEN
    IF (
      SELECT COUNT(*) FROM users
      WHERE agency_id = OLD.agency_id AND role = 'admin'
    ) = 1 THEN
      RAISE EXCEPTION 'Cannot delete the last admin user for agency %', OLD.agency_id
        USING ERRCODE = '23000';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_last_admin_delete_trigger
  BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION prevent_last_admin_delete();
```

The DB constraint is the backstop — even if the server-action guard is bypassed, the DELETE will fail at the DB layer. Both layers emit an audit log row.

---

## §10 Next.js 15.2.3 CVE-2025-29927 Gate

### §10.1 CVE Details

- **CVE ID:** CVE-2025-29927
- **CVSS:** Critical
- **Affected:** Next.js 11.1.4 through 13.5.6, 14.x < 14.2.25, 15.x < 15.2.3
- **Patched:** Next.js >= 15.2.3 (for 15.x) [VERIFIED: nvd.nist.gov/vuln/detail/CVE-2025-29927; vercel.com/blog/postmortem-on-next-js-middleware-bypass]

**Mechanism:** The `x-middleware-subrequest` header (used internally to prevent infinite middleware loops) was trusted without validation when set by external clients. An attacker could send `x-middleware-subrequest: middleware` to bypass all middleware logic entirely, skipping authentication checks.

**Impact:** Any Next.js app relying on middleware as the SOLE auth guard was fully bypassable with a single HTTP header. This is why **REQ-031** mandates session checks in server actions — middleware alone is never sufficient.

**Cloudflare mitigation:** Cloudflare WAF deployed a managed rule on 2026-03-22 to strip `x-middleware-subrequest` headers from external requests. Self-hosted apps without Cloudflare in front must rely on upgrading to >= 15.2.3. [VERIFIED: developers.cloudflare.com/changelog/post/2025-03-22-next-js-vulnerability-waf/]

**Current `next` version:** 16.2.4 (npm). Any version from 15.2.3 onward is compliant. [VERIFIED: npm view next version = 16.2.4]

### §10.2 CI Gate Pattern (REQ-029)

```yaml
# .github/workflows/pr.yml — add to existing security-check job
- name: Check Next.js version >= 15.2.3 (CVE-2025-29927)
  run: |
    NEXT_VERSION=$(node -e "
      const pkg = require('./package.json');
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      console.log(deps.next || '0.0.0');
    ")
    node -e "
      const [maj, min, patch] = '${NEXT_VERSION}'.replace(/[\^~>=]/g, '').split('.').map(Number);
      const ok = (maj > 15) || (maj === 15 && min > 2) || (maj === 15 && min === 2 && patch >= 3);
      if (!ok) { console.error('FAIL: next@' + '${NEXT_VERSION}' + ' < 15.2.3 (CVE-2025-29927)'); process.exit(1); }
      console.log('OK: next@' + '${NEXT_VERSION}' + ' >= 15.2.3');
    "
```

This check must run on **every PR** and **every branch merge**. [VERIFIED: mjagency/specs/security.md SEC-N2]

---

## §11 Pitfalls

### Pitfall 1: Pino Logger in Edge Runtime (CRITICAL)

**What goes wrong:** Middleware.ts imports from `packages/config/logger.ts` (Pino). Pino uses `node:process.stdout` and `sonic-boom`, which are Node-only. The Edge runtime throws `ReferenceError: process is not defined` at startup.

**Why it happens:** Phase 1 shipped a `createLogger` helper in `packages/config`. Auth code is tempted to `import { createLogger } from '@mjagency/config'` everywhere. This import fails silently in Edge or crashes the middleware.

**How to avoid:**
- Middleware.ts must have ZERO imports from `@mjagency/config` (logger) or any other Node-only package.
- Middleware.ts is allowed to import: `jose`, `next/server` (`NextRequest`, `NextResponse`, `NextURL`), `@mjagency/config` ONLY for constants (not logger).
- Log auth events from **route handlers** (Node runtime), not middleware.
- Pattern check: add `importFrom('apps/*/middleware.ts').mustNotImport('@mjagency/config/logger')` to the `require-session-first` ESLint rule companion.

**Warning signs:** `Error: require is not defined`, `ReferenceError: process is not defined`, middleware returns 500 for all requests.

[VERIFIED: Phase 1 RESEARCH canonical refs — "Edge guard pattern (auth code that runs in middleware is Edge — no Node-only imports)"; Phase 1 02-CONTEXT canonical refs]

### Pitfall 2: Refresh Token Route Must Not Be in Middleware Matcher

**What goes wrong:** `/api/auth/refresh` is an API route. If the middleware matcher accidentally includes it, the middleware tries to verify the access token (expired — that is WHY the client is calling refresh) and redirects to `/login` before the refresh can succeed. Client is locked out permanently.

**How to avoid:** Verify the matcher pattern explicitly excludes `api/`. The pattern in §6.1 does this. Test with an expired access token + valid refresh token.

### Pitfall 3: `__Host-` Cookie Domain Attribute

**What goes wrong:** Setting `domain: '.brand.com'` on a `__Host-` prefixed cookie. Browsers silently reject the cookie (the `domain` attribute is prohibited for `__Host-` cookies). No error is thrown; the cookie is simply never set.

**How to avoid:** Never pass `domain` in the options object when setting `__Host-` cookies. The §3.3 pattern omits `domain` deliberately. [VERIFIED: MDN Set-Cookie docs; github.com/vercel/next.js/issues/56632]

### Pitfall 4: `cookies()` Must Be Awaited in Next.js 15

**What goes wrong:** `const jar = cookies()` (synchronous) instead of `const jar = await cookies()`. The synchronous form still works in Next.js 15 for backwards compatibility but will be deprecated and removed.

**How to avoid:** Always `await cookies()` in server actions and route handlers. TypeScript strict mode will help once Next.js fully types the async return. [VERIFIED: nextjs.org/docs/app/api-reference/functions/cookies — "v15.0.0-RC: cookies is now an async function"]

### Pitfall 5: JWT Verification in Middleware vs Server Action — Different Key Formats

**What goes wrong:** `new TextEncoder().encode(process.env.JWT_ACCESS_SECRET)` creates a `Uint8Array` for HS256. In Edge, `process.env` is available. However, importing `jose` in middleware is fine — but importing `importPKCS8` for RS256 is NOT Edge-compatible if the key requires ASN.1 parsing from a PEM string in certain environments.

**How to avoid:** v1 uses HS256 throughout (HS256 key = raw bytes, no PEM parsing required). HS256 works in Edge. Never store the raw secret in `next.config.ts` or client-side bundles. [ASSUMED — RS256 Edge compatibility in all environments; HS256 Edge compatibility is HIGH confidence]

### Pitfall 6: `withAgencyContext()` Required for All Auth DB Queries

**What goes wrong:** Auth code calls `db.select().from(sessions).where(...)` without `withAgencyContext()`. PgBouncer transaction mode means the prior physical connection's `SET app.agency_id` is still active. A lookup for agency A sees rows from agency B if the prior transaction happened to set agency B's ID.

**How to avoid:** Every DB query in auth code MUST be wrapped: `withAgencyContext(db, agencyId, async (tx) => { ... })`. This is the `packages/db` contract. The ESLint `no-raw-drizzle-query` rule from Phase 2 covers this. [VERIFIED: packages/db/src/client.ts comments; Phase 2 02-01 SUMMARY]

### Pitfall 7: Middleware Precedence vs Route Handler vs Server Action

**Auth check precedence (from weakest to strongest):**

```
Middleware (Edge, optimistic)
  ↓ can be bypassed by CVE-2025-29927 or future middleware bugs
Route Handler (Node, strong)
  ↓ good for API routes; not called for server-rendered pages
Server Action (Node, strongest)
  ↓ MUST be first line, non-skippable by client
```

**Rule:** Middleware is a UX optimization (fast redirects), NOT a security gate. Every security decision must be made at the server-action or route-handler level. [VERIFIED: nextjs.org/docs/app/guides/authentication — "Proxy can be useful for initial checks, it should not be your only line of defense"]

### Pitfall 8: bcrypt Cost Factor 12 Is Slow — Do Not Call in Hot Path

**What goes wrong:** Calling `bcrypt.hash(code, 12)` synchronously or in a tight loop during a login request. bcrypt at cost 12 takes ~300ms on a 2-core VPS. 8 recovery codes × 300ms = 2.4 seconds blocking the event loop.

**How to avoid:** Hash recovery codes **at setup time** (one-time), not at verification time. At verification time, call `bcrypt.compare(attempt, hash)` for AT MOST ONE hash (fail-fast on first match). [ASSUMED — exact timing; the principle is verified bcrypt cost 12 behavior]

---

## §12 Version Matrix

All versions verified against npm registry on 2026-04-25:

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `jose` | `6.2.2` | JWT sign + verify | Edge-compatible; `jsonwebtoken` BANNED |
| `otpauth` | `9.5.1` | TOTP MFA | RFC 6238, Node/Edge/Browser |
| `qrcode` | `1.5.4` | QR code image generation | Server-side only |
| `bcrypt` | `6.0.0` | Recovery code hashing | Node-only; cost factor 12 |
| `ioredis` | `5.10.1` | Redis client (revocation store) | Shared with `@mjagency/queue` |
| `next` | `>= 15.2.3` | App framework (CVE gate) | Current npm latest: 16.2.4 |
| `zod` | `4.3.6` | Input validation | Used in login form + server actions |
| `drizzle-orm` | `0.45.2` | ORM (from Phase 2) | `withAgencyContext()` wrapper required |
| `bcryptjs` | — | **NOT recommended** | Use `bcrypt` (native) for perf |
| `jsonwebtoken` | — | **BANNED** | CI gate REQ-502 enforces |

**Installation (new packages for Phase 3):**

```bash
pnpm add jose@6.2.2 otpauth@9.5.1 qrcode@1.5.4 bcrypt@6.0.0 --filter=@mjagency/auth
pnpm add -D @types/bcrypt @types/qrcode --filter=@mjagency/auth
# ioredis already installed via @mjagency/queue (Phase 2)
```

---

## §A1 Open Questions for Planner

| # | Question | Context | Risk if Unresolved |
|---|---------|---------|-------------------|
| Q1 | Where does `mfa_config` table live — in `packages/db/src/schema/` as a new schema file, or as a new column on `users`? | TOTP secret + recovery code hashes require a home. Separate table is cleaner (1:1 with users, avoids fat users table), but adds a migration. | MFA setup + verify plans need a consistent DB contract |
| Q2 | What is the Redis connection for `accounts.brand.com` (SSO code store)? Is it a shared Redis or the `brand` agency's namespaced Redis? | The SSO code is cross-agency by nature. If using agency-specific Redis, the exchange endpoint on ecommerce.brand.com can't reach it. | SSO code exchange fails if Redis namespaces are siloed |
| Q3 | Does the `sessions` DB table get a row for every token pair, or just refresh tokens? | Session table currently has `tokenFamilyId` and `revokedAt`. If it tracks access tokens too, revocation is DB-driven (slow). Redis revocation is the right path, but the DB table's role needs to be explicit in the plan. | Family revocation logic may double-write or omit the DB layer |
| Q4 | TOTP secret encryption: use `putVaultValue()` from `@mjagency/db/vault`? Or a dedicated column with `encryptVaultValue()` directly? | Vault helpers require `withAgencyContext()` and a `permission_key` string. For TOTP secrets this is straightforward, but adds per-lookup latency. | Inconsistent encryption approach across Phase 2 vault vs Phase 3 MFA |
| Q5 | `__Host-` cookies on `localhost` (dev): browsers reject `Secure` cookies from `http://localhost`. | Development needs a workaround (e.g., mkcert for local HTTPS, or a dev-only cookie name without `__Host-`). | Cookie-based auth completely broken in local dev without this resolved |
| Q6 | How many `packages/auth` sub-modules should Phase 3 plan for? | Research identifies: `tokens.ts`, `cookie.ts`, `require-session.ts`, `mfa.ts`, `recovery-codes.ts`, `guards.ts`, `sso-state.ts`, `redirect.ts`. That is 8 files — spread across 6 plans. | Plan-to-file mapping may be ambiguous |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT sign + verify | Custom HMAC + base64url encoder | `jose` 6.2.2 | Edge runtime compat; RFC compliance; constant-time compare |
| TOTP generation + validate | RFC 6238 implementation | `otpauth` 9.5.1 | Clock drift window, HMAC variants, URI format |
| QR code image from URI | PNG encoder | `qrcode` 1.5.4 | Error correction levels, data URL output, no DOM required |
| Password/code hashing | SHA-256 (wrong for passwords) | `bcrypt` 6.0.0 | Work factor, salting, timing-safe compare via `bcrypt.compare()` |
| Open-redirect check | Regex on returnTo string | `new URL(returnTo, origin).origin !== origin` | Regex misses protocol-relative, unicode tricks; URL constructor is authoritative |
| Token family tracking | Array in JWT payload | Redis SET per family + SADD | JWTs are stateless — list of revoked JTIs must be server-side |
| CSRF state for SSO | Session-cookie only | HMAC-signed state token (§5.2) | `timingSafeEqual` prevents timing oracle; state is stateless |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JWT key rotation cadence is quarterly per security.md SEC-10; exact runbook details not researched | §1.5 | Rotation plan in Phase 3 may need adjustment |
| A2 | MFA lockout policy: 3 failures → 15-minute lockout (derived from SEC-12 principles) | §4.4 | Too lenient (attacker gets 3 attempts) or too strict (legitimate users locked out) |
| A3 | SSO uses opaque-code exchange (not shared-domain cookies or PKCE) — natural consequence of `__Host-` constraint | §5.1 | If business requires single-subdomain SSO cookie, architecture changes significantly |
| A4 | RS256 PEM parsing via `importPKCS8` works in Edge runtime for future rotation | §1.5, §11 Pitfall 5 | If Edge blocks ASN.1 PEM parsing, v2 rotation must use HS256 or JWK format |
| A5 | `__Host-` cookies do not work on plain `http://localhost` in dev | §A1 Q5 | Dev workflow broken; mkcert or cookie name tweak needed |
| A6 | Redis for SSO code store is a separate `accounts` namespace (not agency-scoped) | §5.3 | Cross-agency SSO exchange fails if Redis is siloed per-agency |
| A7 | `mfa_config` table is a separate Phase 3 migration (not column additions on existing `users`) | §4.3, §A1 Q1 | Schema conflict with Phase 2 `0000_initial.sql` |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22 LTS | bcrypt, ioredis, qrcode (Node-only) | ✓ (per PROJECT.md) | 22.x (pinned) | — |
| Redis | Revocation store, SSO code store | ✓ (Docker Compose from Phase 1) | ioredis 5.10.1 | None — blocking |
| PostgreSQL 17 | sessions + users tables | ✓ (Phase 2) | 17 | — |
| Cloudflare WAF | CVE-2025-29927 header-strip rule | ✓ (PROJECT.md §Stack) | Managed rule 2025-03-22 | Strip header in Nginx if no CF |
| HTTPS / TLS | `__Host-` cookies require Secure | ✓ prod (Cloudflare) / mkcert dev | N/A | Dev: disable `__Host-` prefix in NODE_ENV=development |

**Missing dependencies with no fallback:**
- Redis is required — no fallback for revocation store or SSO code store. Phase 1 Docker Compose provides it; ensure `REDIS_URL` Doppler secret is populated.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit); Playwright (e2e) |
| Config file | `packages/auth/vitest.config.ts` (Wave 0 gap) |
| Quick run command | `pnpm vitest run --filter=@mjagency/auth` |
| Full suite command | `pnpm vitest run && pnpm playwright test auth/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REQ-020 | `jsonwebtoken` import absent | CI grep gate | `grep -r jsonwebtoken . --include='*.ts' \| wc -l \| xargs test 0 -eq` | ✅ (Phase 1 CI gate) |
| REQ-021 | Access token TTL = 15min | Unit | `vitest run tokens.test.ts` | ❌ Wave 0 |
| REQ-022 | Refresh token replay → family revocation | Integration | `vitest run refresh.integration.test.ts` | ❌ Wave 0 |
| REQ-023 | Cookies set with httpOnly+SameSite+Secure | Unit (mock cookies) | `vitest run cookie.test.ts` | ❌ Wave 0 |
| REQ-024/025 | MFA enforced for admin roles | Unit | `vitest run mfa.test.ts` | ❌ Wave 0 |
| REQ-029 | Next.js >= 15.2.3 | CI version check | `.github/workflows/pr.yml` step | ❌ Wave 0 |
| REQ-030 | Middleware excludes `/api` and `/(payload)/admin` | Unit (middleware matcher) | `vitest run middleware.test.ts` | ❌ Wave 0 |
| REQ-031 | Server actions fail without requireSession | ESLint rule + unit | `eslint --rule require-session-first` | ❌ Wave 0 |
| REQ-308/424 | Open redirect to evil.com → /dashboard | Unit | `vitest run redirect.test.ts` | ❌ Wave 0 |
| REQ-400/028 | Agency owner self-delete blocked | Integration | `vitest run guards.integration.test.ts` | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `packages/auth/vitest.config.ts` — test config
- [ ] `packages/auth/src/__tests__/tokens.test.ts` — covers REQ-020, REQ-021, REQ-022
- [ ] `packages/auth/src/__tests__/cookie.test.ts` — covers REQ-023
- [ ] `packages/auth/src/__tests__/mfa.test.ts` — covers REQ-024, REQ-025, REQ-309
- [ ] `packages/auth/src/__tests__/refresh.integration.test.ts` — covers REQ-022 (needs Redis)
- [ ] `packages/auth/src/__tests__/redirect.test.ts` — covers REQ-308, REQ-424
- [ ] `packages/auth/src/__tests__/guards.integration.test.ts` — covers REQ-028, REQ-400
- [ ] `packages/auth/src/__tests__/middleware.test.ts` — covers REQ-030
- [ ] `packages/config/eslint/rules/require-session-first.js` — covers REQ-031

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | `jose` + `otpauth` + `bcrypt` recovery codes |
| V3 Session Management | YES | Redis revocation + token family revocation on replay |
| V4 Access Control | YES | `requireSession()` + RLS via `withAgencyContext()` |
| V5 Input Validation | YES | `zod` schema for login form + JWT claim validation |
| V6 Cryptography | YES | `jose` HS256; `bcrypt` cost 12; `node:crypto` HMAC for SSO state |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JWT replay (stale access token) | Spoofing | Redis JTI revocation list with token-remaining-TTL expiry |
| Refresh token replay | Spoofing | Atomic `GETDEL` + family revocation on replay detection |
| Middleware bypass (CVE-2025-29927) | Elevation | `requireSession()` in every server action (REQ-031); Next.js >= 15.2.3 |
| Open redirect | Tampering | `new URL(returnTo, origin).origin !== origin` check (SEC-N5) |
| CSRF on auth endpoints | Spoofing | `SameSite=Strict` cookies + HMAC-signed SSO state token |
| Session fixation | Spoofing | `regenerateSession()` on login + MFA completion (SEC-17) |
| Cross-subdomain cookie theft | Info Disclosure | `__Host-` prefix (no Domain attribute, host-only) |
| Admin panel enumeration | Info Disclosure | Middleware excludes `/(payload)/admin`; `X-Robots-Tag: noindex` (SEC-13) |
| MFA brute force | Spoofing | Redis INCR lockout: 3 failures → 15-min lockout |
| TOTP secret disclosure | Info Disclosure | Stored encrypted via vault helper (`encryptVaultValue`) |

---

## Sources

### Primary (HIGH confidence)
- [jose npm registry](https://www.npmjs.com/package/jose) — version 6.2.2 confirmed
- [panva/jose SignJWT docs](https://github.com/panva/jose/blob/main/docs/jwt/sign/classes/SignJWT.md) — method signatures verified
- [panva/jose jwtVerify docs](https://github.com/panva/jose/blob/main/docs/jwt/verify/functions/jwtVerify.md) — options verified
- [Next.js cookies() API docs](https://nextjs.org/docs/app/api-reference/functions/cookies) — v15 async change confirmed
- [Next.js Authentication guide](https://nextjs.org/docs/app/guides/authentication) — jose integration pattern
- [NVD CVE-2025-29927](https://nvd.nist.gov/vuln/detail/CVE-2025-29927) — vulnerability details
- [Vercel postmortem CVE-2025-29927](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass) — exact bypass mechanism
- [Cloudflare WAF CVE-2025-29927 rule](https://developers.cloudflare.com/changelog/post/2025-03-22-next-js-vulnerability-waf/) — managed rule deployed 2025-03-22
- [otpauth npm registry + GitHub](https://github.com/hectorm/otpauth) — v9.5.1 confirmed, API verified
- [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) — `__Host-` prefix requirements
- `mjagency/CLAUDE.md` — canonical security mandates
- `mjagency/specs/security.md` — SEC-01 through SEC-N11 rules
- `packages/db/src/client.ts` — `withAgencyContext()` pattern
- `packages/db/src/schema/sessions.ts` — `tokenFamilyId`, `revokedAt` columns
- Phase 2 02-06 SUMMARY — audit log emit patterns

### Secondary (MEDIUM confidence)
- [NextJS `__Host-` cookie bug #56632](https://github.com/vercel/next.js/issues/56632) — delete() issue with `__Secure-`/`__Host-` prefixes
- [MDN Cookie security guide](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies) — `__Host-` attribute rules
- [ProjectDiscovery CVE-2025-29927 analysis](https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass) — x-middleware-subrequest mechanism
- [Token refresh rotation best practices](https://www.serverion.com/uncategorized/refresh-token-rotation-best-practices-for-developers/) — family revocation pattern

### Tertiary (LOW confidence — flagged for validation)
- SSO opaque-code exchange architecture (§5) — derived from `__Host-` constraints, not a single authoritative source
- MFA lockout: 3 failures → 15-minute policy — derived from SEC-12, exact numbers ASSUMED
- RS256 Edge runtime compatibility in §11 Pitfall 5 — partial confidence; HS256 confirmed safe

---

## Metadata

**Confidence breakdown:**
- Standard stack (jose, otpauth, bcrypt, ioredis): HIGH — all versions npm-verified
- Architecture (token strategy, family revocation, SSO): MEDIUM–HIGH — patterns verified, edge cases noted
- Cookie `__Host-` constraints: HIGH — MDN + Next.js docs verified
- CVE-2025-29927 details: HIGH — NVD + Vercel postmortem + Cloudflare WAF release note
- Pitfalls (Edge/Pino, PgBouncer): HIGH — confirmed in Phase 1+2 research and docs

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days — stable stack)
