/**
 * packages/auth/src/refresh.ts
 *
 * Atomic refresh token rotation with family revocation on replay.
 *
 * Requirements satisfied:
 *   REQ-022: Refresh token one-time-use enforced via Redis GETDEL (atomic, no race window)
 *   REQ-022: Family revocation — replay of any token in a family deletes the entire family
 *
 * Pitfall 6 (RESEARCH §1.2, Phase 2 02-01 contract):
 *   Every DB query MUST use withAgencyContext(db, agencyId, ...) — never raw SQL.
 *   This keeps agency_id SET LOCAL in effect for RLS enforcement.
 *
 * Threat T-03-002 mitigation:
 *   Atomic GETDEL consumes the refresh marker on first use.
 *   Second call finds null → triggers revokeFamilyTokens → returns null (caller force-logouts).
 *   Integration Test 2 in refresh.integration.test.ts proves both halves.
 */

import 'server-only'
import { eq, and, isNull } from 'drizzle-orm'
import { withAgencyContext, type AgencyDb } from '@mjagency/db'
import { sessions } from '@mjagency/db/schema'
import { REDIS_KEY } from '@mjagency/config'
import type { Redis } from 'ioredis'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './tokens.js'

const REFRESH_TTL_SECONDS = 7 * 24 * 3600

export interface RotationResult {
  accessToken: string
  refreshToken: string
}

/**
 * Rotates a refresh token atomically.
 *
 * Returns `{ accessToken, refreshToken }` on success.
 * Returns `null` on replay (caller should clear cookies + redirect to login).
 * Throws on cryptographic verification failure (expired, tampered, wrong audience/issuer).
 *
 * Flow:
 *   1. Cryptographic verification (jose jwtVerify — throws on invalid)
 *   2. Atomic GETDEL — consumes the one-time-use Redis marker
 *   3. If marker absent → replay detected → revoke entire family → return null
 *   4. Confirm family is still valid in DB (revokedAt IS NULL)
 *   5. Issue new pair (same familyId, fresh JTIs)
 *   6. Store new refresh marker + update family set
 */
export async function rotateRefreshToken(
  incomingRefreshToken: string,
  redis: Redis,
  db: AgencyDb,
  agencyId: string,
): Promise<RotationResult | null> {
  // 1. Cryptographic verification (jwtVerify throws on expired/invalid)
  const claims = await verifyRefreshToken(incomingRefreshToken)

  // 2. Atomic one-time-use check via GETDEL — single Redis op
  const stored = await redis.getdel(REDIS_KEY.session.rt(agencyId, claims.jti))
  if (!stored) {
    // Replay detected — revoke entire family
    await revokeFamilyTokens(redis, agencyId, claims.familyId)
    return null
  }

  // 3. Confirm the family is still valid in DB (revokedAt IS NULL)
  const session = await withAgencyContext(db, agencyId, async (tx) => {
    return tx
      .select()
      .from(sessions)
      .where(and(eq(sessions.tokenFamilyId, claims.familyId), isNull(sessions.revokedAt)))
      .limit(1)
  })
  if (session.length === 0) return null

  // 4. Issue new pair (same family, new JTIs)
  const newAccessJti  = crypto.randomUUID()
  const newRefreshJti = crypto.randomUUID()
  const role = (session[0] as { role?: string }).role as 'super_admin' | 'admin' | 'editor'

  const [newAccess, newRefresh] = await Promise.all([
    signAccessToken({
      sub: claims.sub, agencyId: claims.agencyId, role,
      jti: newAccessJti, familyId: claims.familyId,
    }),
    signRefreshToken({
      sub: claims.sub, agencyId: claims.agencyId,
      jti: newRefreshJti, familyId: claims.familyId,
    }),
  ])

  // 5. Store new refresh marker
  await redis.set(
    REDIS_KEY.session.rt(agencyId, newRefreshJti),
    JSON.stringify({ familyId: claims.familyId, userId: claims.sub, usedAt: null }),
    'EX', REFRESH_TTL_SECONDS,
  )

  // 6. Add to family set + refresh expiry
  const familyKey = REDIS_KEY.session.family(agencyId, claims.familyId)
  await redis.sadd(familyKey, newRefreshJti)
  await redis.expire(familyKey, REFRESH_TTL_SECONDS)

  return { accessToken: newAccess, refreshToken: newRefresh }
}

/**
 * Revokes all refresh markers in a token family.
 *
 * Deletes every rt:<jti> key in the family, then deletes the family set itself.
 * Safe to call multiple times — Redis DEL on missing keys is a no-op.
 */
export async function revokeFamilyTokens(
  redis: Redis,
  agencyId: string,
  familyId: string,
): Promise<void> {
  const familyKey = REDIS_KEY.session.family(agencyId, familyId)
  const members   = await redis.smembers(familyKey)
  if (members.length > 0) {
    await redis.del(...members.map((jti) => REDIS_KEY.session.rt(agencyId, jti)))
  }
  await redis.del(familyKey)
}
