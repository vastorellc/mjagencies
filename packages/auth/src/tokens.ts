/**
 * packages/auth/src/tokens.ts
 *
 * jose-only JWT sign/verify primitives for access + refresh tokens.
 *
 * Requirements satisfied:
 *   REQ-020: JWT auth using jose exclusively (CLAUDE.md §2, REQ-502 CI gate)
 *   REQ-021: Access token 15min TTL, aud='mjagency-api', iss='mjagency', alg=HS256
 *   REQ-022: Refresh token 7d TTL, aud='mjagency-refresh', iss='mjagency', alg=HS256
 *   REQ-300: jose is the ONLY allowed JWT library
 *   REQ-310 / SEC-N8: Every jwtVerify call passes explicit algorithms, issuer, audience
 *
 * Key format: TextEncoder().encode(process.env.JWT_*_SECRET)
 *   Pitfall 5 from RESEARCH §1.4: jose requires Uint8Array keys for HMAC, not raw strings.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

const JWT_ACCESS_SECRET  = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!)
const JWT_REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET!)

export interface AccessTokenClaims {
  sub: string        // user UUID
  agencyId: string   // agency UUID
  role: 'super_admin' | 'admin' | 'editor'
  jti: string        // UUID v4
  familyId: string   // shared across token pair lineage
  mfaVerifiedAt?: string  // ISO timestamp; absent until MFA passes
}

/**
 * Signs an access JWT (15 min, HS256, aud='mjagency-api').
 * REQ-021, SEC-N8: alg, iss, aud are explicit on every sign call.
 */
export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({
    sub:      claims.sub,
    agencyId: claims.agencyId,
    role:     claims.role,
    familyId: claims.familyId,
    jti:      claims.jti,
    ...(claims.mfaVerifiedAt ? { mfaVerifiedAt: claims.mfaVerifiedAt } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('mjagency')
    .setAudience('mjagency-api')
    .setExpirationTime('15m')
    .sign(JWT_ACCESS_SECRET)
}

export interface VerifiedAccessPayload extends JWTPayload {
  sub:      string
  agencyId: string
  role:     'super_admin' | 'admin' | 'editor'
  jti:      string
  familyId: string
  mfaVerifiedAt?: string
}

/**
 * Verifies an access JWT. Throws JWTExpired, JWTClaimValidationFailed, or
 * JWTSignatureVerificationFailed on any invalid condition.
 * REQ-310 / SEC-N8: algorithms, issuer, audience all explicitly provided.
 */
export async function verifyAccessToken(token: string): Promise<VerifiedAccessPayload> {
  const { payload } = await jwtVerify<VerifiedAccessPayload>(token, JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer:     'mjagency',
    audience:   'mjagency-api',
  })
  return payload
}

export interface RefreshTokenClaims {
  sub:      string
  agencyId: string
  jti:      string
  familyId: string
}

/**
 * Signs a refresh JWT (7 days, HS256, aud='mjagency-refresh').
 * REQ-022: one-time-use enforced via Redis GETDEL in rotateRefreshToken (refresh.ts).
 */
export async function signRefreshToken(claims: RefreshTokenClaims): Promise<string> {
  return new SignJWT({
    sub: claims.sub, agencyId: claims.agencyId, jti: claims.jti, familyId: claims.familyId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('mjagency')
    .setAudience('mjagency-refresh')
    .setExpirationTime('7d')
    .sign(JWT_REFRESH_SECRET)
}

/**
 * Verifies a refresh JWT. Throws on expired, wrong audience, wrong issuer, or tampered signature.
 * REQ-310 / SEC-N8: algorithms, issuer, audience all explicitly provided.
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenClaims & JWTPayload> {
  const { payload } = await jwtVerify<RefreshTokenClaims & JWTPayload>(token, JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
    issuer:     'mjagency',
    audience:   'mjagency-refresh',
  })
  return payload
}
