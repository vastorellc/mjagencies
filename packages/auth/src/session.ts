/**
 * packages/auth/src/session.ts
 *
 * Privilege-escalation token-family swap.
 *
 * Requirements satisfied:
 *   REQ-027: regenerateSession issues a brand-new family on privilege escalation
 *   SEC-17: Old family is revoked BEFORE new pair is issued (prevent session cloning)
 *
 * Usage:
 *   - Plan 03-02 (MFA): call after TOTP verify to add mfaVerifiedAt to new access token
 *   - Plan 03-05 (server actions): call after role change to invalidate old tokens
 *   - Plan 03-06 (audit): Phase 2 audit triggers fire on sessions UPDATE automatically
 */

import 'server-only'
import { REDIS_KEY } from '@mjagency/config'
import type { Redis } from 'ioredis'
import { signAccessToken, signRefreshToken, type AccessTokenClaims } from './tokens.js'
import { revokeFamilyTokens } from './refresh.js'

const REFRESH_TTL_SECONDS = 7 * 24 * 3600

/**
 * Revokes the old token family and issues a brand-new family.
 *
 * Returns `{ accessToken, refreshToken, familyId }` where familyId is a fresh UUID.
 * The caller is responsible for updating the sessions DB row with the new familyId.
 *
 * @param oldFamilyId - Family ID to revoke (from the current session's token)
 * @param userId      - User UUID (sub claim)
 * @param agencyId    - Agency UUID (for Redis key namespacing per CLAUDE.md §8)
 * @param role        - Role for new access token
 * @param redis       - Shared ioredis client
 * @param opts.mfaVerifiedAt - ISO timestamp; included in access token if present (Plan 03-02)
 */
export async function regenerateSession(
  oldFamilyId: string,
  userId: string,
  agencyId: string,
  role: AccessTokenClaims['role'],
  redis: Redis,
  opts: { mfaVerifiedAt?: Date } = {},
): Promise<{ accessToken: string; refreshToken: string; familyId: string }> {
  // Revoke old family first — SEC-17: must happen before issuing the new pair
  await revokeFamilyTokens(redis, agencyId, oldFamilyId)

  const newFamilyId   = crypto.randomUUID()
  const newAccessJti  = crypto.randomUUID()
  const newRefreshJti = crypto.randomUUID()

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({
      sub: userId, agencyId, role,
      jti: newAccessJti, familyId: newFamilyId,
      ...(opts.mfaVerifiedAt ? { mfaVerifiedAt: opts.mfaVerifiedAt.toISOString() } : {}),
    }),
    signRefreshToken({ sub: userId, agencyId, jti: newRefreshJti, familyId: newFamilyId }),
  ])

  await redis.set(
    REDIS_KEY.session.rt(agencyId, newRefreshJti),
    JSON.stringify({ familyId: newFamilyId, userId, usedAt: null }),
    'EX', REFRESH_TTL_SECONDS,
  )
  await redis.sadd(REDIS_KEY.session.family(agencyId, newFamilyId), newRefreshJti)
  await redis.expire(REDIS_KEY.session.family(agencyId, newFamilyId), REFRESH_TTL_SECONDS)

  return { accessToken, refreshToken, familyId: newFamilyId }
}
