/**
 * packages/auth/src/__tests__/refresh.integration.test.ts
 *
 * Integration tests for refresh token rotation + family revocation.
 * Gated on INTEGRATION_REDIS_URL — skips cleanly without Redis.
 *
 * Uses a real ioredis client against INTEGRATION_REDIS_URL.
 * DB is stubbed — withAgencyContext call shape is preserved via fakeDb.
 * No hardcoded UUIDs — all test IDs are fresh crypto.randomUUID().
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { Redis } from 'ioredis'
import type { AgencyDb } from '@mjagency/db'
import { REDIS_KEY } from '@mjagency/config'

const SKIP = !process.env.INTEGRATION_REDIS_URL
const describeIntegration = SKIP ? describe.skip : describe

// ── Redis client (only created if INTEGRATION_REDIS_URL is set) ───────────────
let redis: Redis

if (!SKIP) {
  beforeAll(async () => {
    const { default: IORedis } = await import('ioredis')
    redis = new IORedis(process.env.INTEGRATION_REDIS_URL!, { lazyConnect: false, maxRetriesPerRequest: 3 })
  })

  afterAll(async () => {
    if (redis) await redis.quit()
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFakeDb(tokenFamilyId: string): AgencyDb {
  return {
    transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        execute: async () => undefined,
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ tokenFamilyId, revokedAt: null, role: 'admin' }],
            }),
          }),
        }),
      }),
  } as unknown as AgencyDb
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describeIntegration('rotateRefreshToken — integration', () => {
  beforeEach(async () => {
    await redis.flushdb()
  })

  it('Test 1: first rotation issues a new pair with same familyId', async () => {
    const { signRefreshToken, verifyAccessToken, verifyRefreshToken } = await import('../tokens.js')
    const { rotateRefreshToken } = await import('../refresh.js')

    const agencyId  = crypto.randomUUID()
    const userId    = crypto.randomUUID()
    const familyId  = crypto.randomUUID()
    const refreshJti = crypto.randomUUID()

    // Pre-seed env (needed for sign/verify)
    process.env.JWT_ACCESS_SECRET  = 'a'.repeat(64)
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(64)

    // Pre-seed Redis marker
    await redis.set(
      REDIS_KEY.session.rt(agencyId, refreshJti),
      JSON.stringify({ familyId, userId, usedAt: null }),
      'EX', 604800,
    )
    // Add jti to family set
    await redis.sadd(REDIS_KEY.session.family(agencyId, familyId), refreshJti)

    const incomingToken = await signRefreshToken({ sub: userId, agencyId, jti: refreshJti, familyId })
    const db = makeFakeDb(familyId)

    const result = await rotateRefreshToken(incomingToken, redis, db, agencyId)

    expect(result).not.toBeNull()
    expect(result!.accessToken).toBeTruthy()
    expect(result!.refreshToken).toBeTruthy()

    // familyId preserved in both new tokens
    const newAccess  = await verifyAccessToken(result!.accessToken)
    const newRefresh = await verifyRefreshToken(result!.refreshToken)
    expect(newAccess.familyId).toBe(familyId)
    expect(newRefresh.familyId).toBe(familyId)

    // Old refresh marker deleted
    const oldMarker = await redis.get(REDIS_KEY.session.rt(agencyId, refreshJti))
    expect(oldMarker).toBeNull()

    // New refresh marker exists
    const newJti = newRefresh.jti
    const newMarker = await redis.get(REDIS_KEY.session.rt(agencyId, newJti))
    expect(newMarker).not.toBeNull()
  })

  it('Test 2: replay of redeemed refresh token returns null AND revokes family', async () => {
    const { signRefreshToken } = await import('../tokens.js')
    const { rotateRefreshToken } = await import('../refresh.js')

    const agencyId  = crypto.randomUUID()
    const userId    = crypto.randomUUID()
    const familyId  = crypto.randomUUID()
    const refreshJti = crypto.randomUUID()

    process.env.JWT_ACCESS_SECRET  = 'a'.repeat(64)
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(64)

    await redis.set(
      REDIS_KEY.session.rt(agencyId, refreshJti),
      JSON.stringify({ familyId, userId, usedAt: null }),
      'EX', 604800,
    )
    await redis.sadd(REDIS_KEY.session.family(agencyId, familyId), refreshJti)

    const incomingToken = await signRefreshToken({ sub: userId, agencyId, jti: refreshJti, familyId })
    const db = makeFakeDb(familyId)

    // First rotation succeeds
    const first = await rotateRefreshToken(incomingToken, redis, db, agencyId)
    expect(first).not.toBeNull()

    // Add new jti to the family set (as rotateRefreshToken does)
    // (already done by rotateRefreshToken internally)

    // Replay the ORIGINAL token — should trigger family revocation
    const replay = await rotateRefreshToken(incomingToken, redis, db, agencyId)
    expect(replay).toBeNull()

    // Family set should be empty after revocation
    const familyMembers = await redis.smembers(REDIS_KEY.session.family(agencyId, familyId))
    expect(familyMembers.length).toBe(0)
  })

  it('Test 3: rotate of a family whose rt marker was already deleted returns null (double-revoke safe)', async () => {
    const { signRefreshToken } = await import('../tokens.js')
    const { rotateRefreshToken } = await import('../refresh.js')

    const agencyId  = crypto.randomUUID()
    const userId    = crypto.randomUUID()
    const familyId  = crypto.randomUUID()
    const refreshJti = crypto.randomUUID()

    process.env.JWT_ACCESS_SECRET  = 'a'.repeat(64)
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(64)

    // Do NOT pre-seed the rt marker (simulate prior revoke)
    await redis.sadd(REDIS_KEY.session.family(agencyId, familyId), refreshJti)

    const incomingToken = await signRefreshToken({ sub: userId, agencyId, jti: refreshJti, familyId })
    const db = makeFakeDb(familyId)

    const result = await rotateRefreshToken(incomingToken, redis, db, agencyId)
    expect(result).toBeNull() // No Redis marker → returns null safely
  })
})

describeIntegration('regenerateSession — integration', () => {
  beforeEach(async () => {
    await redis.flushdb()
  })

  it('Test 4: regenerateSession swaps the family and revokes the old one', async () => {
    const { verifyAccessToken, verifyRefreshToken } = await import('../tokens.js')
    const { regenerateSession } = await import('../session.js')

    const agencyId = crypto.randomUUID()
    const userId   = crypto.randomUUID()
    const familyA  = crypto.randomUUID()
    const oldJti   = crypto.randomUUID()

    process.env.JWT_ACCESS_SECRET  = 'a'.repeat(64)
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(64)

    // Pre-seed old family
    await redis.set(
      REDIS_KEY.session.rt(agencyId, oldJti),
      JSON.stringify({ familyId: familyA, userId, usedAt: null }),
      'EX', 604800,
    )
    await redis.sadd(REDIS_KEY.session.family(agencyId, familyA), oldJti)

    const result = await regenerateSession(familyA, userId, agencyId, 'admin', redis)

    // New familyId is different
    expect(result.familyId).not.toBe(familyA)

    // Old family set is empty
    const oldFamily = await redis.smembers(REDIS_KEY.session.family(agencyId, familyA))
    expect(oldFamily.length).toBe(0)

    // New family set contains the new refresh JTI
    const newRefreshPayload = await verifyRefreshToken(result.refreshToken)
    const newFamily = await redis.smembers(REDIS_KEY.session.family(agencyId, result.familyId))
    expect(newFamily).toContain(newRefreshPayload.jti)

    // Both new tokens carry the new familyId
    const newAccess = await verifyAccessToken(result.accessToken)
    expect(newAccess.familyId).toBe(result.familyId)
  })
})

describeIntegration('tampered refresh token — signature error', () => {
  it('Test 5: tampered refresh token throws JWTSignatureVerificationFailed (caller catches, does not get null)', async () => {
    const { signRefreshToken } = await import('../tokens.js')
    const { rotateRefreshToken } = await import('../refresh.js')

    const agencyId  = crypto.randomUUID()
    const familyId  = crypto.randomUUID()
    const refreshJti = crypto.randomUUID()

    process.env.JWT_ACCESS_SECRET  = 'a'.repeat(64)
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(64)

    const goodToken = await signRefreshToken({
      sub: crypto.randomUUID(), agencyId, jti: refreshJti, familyId,
    })

    // Replace signature segment entirely
    const parts = goodToken.split('.')
    parts[2] = 'x'.repeat(parts[2]!.length)
    const tampered = parts.join('.')

    const db = makeFakeDb(familyId)
    // Should throw (not return null) — jwtVerify throws before GETDEL
    await expect(rotateRefreshToken(tampered, redis, db, agencyId)).rejects.toThrow()
  })
})
