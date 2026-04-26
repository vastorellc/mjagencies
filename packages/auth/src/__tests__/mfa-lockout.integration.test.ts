/**
 * packages/auth/src/__tests__/mfa-lockout.integration.test.ts
 *
 * Integration tests for MFA lockout module (mfa-lockout.ts).
 * Assumption A2: 3 consecutive TOTP failures → 15-minute Redis lockout.
 *
 * Requires Redis. Gated on INTEGRATION_REDIS_URL env var — skipped in CI without Redis.
 *
 * Run manually:
 *   INTEGRATION_REDIS_URL=redis://localhost:6379 pnpm --filter=@mjagency/auth vitest run src/__tests__/mfa-lockout.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import IORedis, { type Redis } from 'ioredis'
import { REDIS_KEY } from '@mjagency/config'
import { isLockedOut, recordFailedAttempt, clearLockout } from '../mfa-lockout.js'

const SKIP = !process.env.INTEGRATION_REDIS_URL

const TEST_AGENCY_ID = 'test-agency-mfa-lockout'
const TEST_USER_ID   = 'test-user-mfa-lockout'

let redis: Redis

describe('MFA lockout integration', () => {
  beforeAll(() => {
    if (SKIP) return
    redis = new IORedis(process.env.INTEGRATION_REDIS_URL!)
  })

  afterAll(async () => {
    if (SKIP) return
    await redis.quit()
  })

  beforeEach(async () => {
    if (SKIP) return
    await redis.flushdb()
  })

  it.skipIf(SKIP)('isLockedOut returns false initially', async () => {
    const locked = await isLockedOut(redis, TEST_AGENCY_ID, TEST_USER_ID)
    expect(locked).toBe(false)
  })

  it.skipIf(SKIP)('after 1 failure, isLockedOut is still false (count < threshold)', async () => {
    await recordFailedAttempt(redis, TEST_AGENCY_ID, TEST_USER_ID)
    const locked = await isLockedOut(redis, TEST_AGENCY_ID, TEST_USER_ID)
    expect(locked).toBe(false)
  })

  it.skipIf(SKIP)('after 3 failures, isLockedOut is true', async () => {
    await recordFailedAttempt(redis, TEST_AGENCY_ID, TEST_USER_ID)
    await recordFailedAttempt(redis, TEST_AGENCY_ID, TEST_USER_ID)
    await recordFailedAttempt(redis, TEST_AGENCY_ID, TEST_USER_ID)
    const locked = await isLockedOut(redis, TEST_AGENCY_ID, TEST_USER_ID)
    expect(locked).toBe(true)
  })

  it.skipIf(SKIP)('clearLockout resets the lockout state to false', async () => {
    // Record 3 failures to trigger lockout
    await recordFailedAttempt(redis, TEST_AGENCY_ID, TEST_USER_ID)
    await recordFailedAttempt(redis, TEST_AGENCY_ID, TEST_USER_ID)
    await recordFailedAttempt(redis, TEST_AGENCY_ID, TEST_USER_ID)
    expect(await isLockedOut(redis, TEST_AGENCY_ID, TEST_USER_ID)).toBe(true)
    // Clear the lockout
    await clearLockout(redis, TEST_AGENCY_ID, TEST_USER_ID)
    expect(await isLockedOut(redis, TEST_AGENCY_ID, TEST_USER_ID)).toBe(false)
  })

  it.skipIf(SKIP)('TTL is set on the lockout key after a failure', async () => {
    await recordFailedAttempt(redis, TEST_AGENCY_ID, TEST_USER_ID)
    const key = REDIS_KEY.session.mfaLockout(TEST_AGENCY_ID, TEST_USER_ID)
    const ttl = await redis.ttl(key)
    // TTL should be between 1 and 900 (15 minutes = 900 seconds)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(900)
  })
})
