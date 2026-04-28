/**
 * packages/compliance/src/erasure/token.ts
 * Plan 11-05 / REQ-144 D-04:
 *
 * Email-verification JWT for the public CCPA erasure flow.
 *
 * CLAUDE.md rule 2 — `jose` ONLY. `jsonwebtoken` is BANNED for Edge runtime
 * compatibility (we use Node here, but the rule is repo-wide for consistency).
 *
 * Properties:
 *   alg=HS256, iss='mjagency', aud='mjagency-api', kind='erasure', 24h expiry.
 *   payload includes { email, agencyId, requestId, kind: 'erasure' }.
 *   Signed with process.env.JWT_ACCESS_SECRET (Phase 3 reuse).
 *
 * Replay protection lives at the consumer (Pitfall 6.4): callers SETNX a Redis
 * key `agency:<id>:erasure:requestid:<requestId>` EX 86400 before processing —
 * this token module verifies signature/issuer/audience/expiry only.
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

const ISSUER = 'mjagency'
const AUDIENCE = 'mjagency-api'
const KIND = 'erasure'

function getSecret(): Uint8Array {
  const secret = process.env['JWT_ACCESS_SECRET']
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is required to sign/verify erasure tokens')
  }
  return new TextEncoder().encode(secret)
}

export interface ErasureTokenPayload extends JWTPayload {
  email: string
  agencyId: string
  requestId: string
  kind: 'erasure'
}

/**
 * Signs a 24h-TTL JWT carrying the erasure-request claims.
 * Returns the encoded token string for inclusion in the verification email URL.
 */
export async function createErasureToken(
  email: string,
  agencyId: string,
  requestId: string,
): Promise<string> {
  return new SignJWT({ email, agencyId, requestId, kind: KIND })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime('24h')
    .sign(getSecret())
}

/**
 * Verifies an erasure token. Throws on:
 *   - bad signature / wrong algorithm
 *   - wrong issuer ('mjagency')
 *   - wrong audience ('mjagency-api')
 *   - expired (>24h)
 *   - missing 'kind' claim or kind !== 'erasure'
 *
 * Returns the verified payload claims (email, agencyId, requestId).
 */
export async function verifyErasureToken(
  token: string,
): Promise<{ email: string; agencyId: string; requestId: string }> {
  const { payload } = await jwtVerify<ErasureTokenPayload>(token, getSecret(), {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  })
  if (payload.kind !== KIND) {
    throw new Error('Invalid token kind — expected erasure')
  }
  return {
    email: payload.email,
    agencyId: payload.agencyId,
    requestId: payload.requestId,
  }
}
