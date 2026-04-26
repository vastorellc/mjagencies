/**
 * packages/auth/src/__tests__/sso-code.integration.test.ts
 *
 * Integration tests for SSO opaque code creation and redemption.
 * Gated on INTEGRATION_REDIS_URL — skips cleanly without Redis.
 *
 * Tests cover:
 *   1. Code created and redeemed once → payload returned matches input
 *   2. Second redemption returns null (single-use via GETDEL)
 *   3. TTL respected — key expires in ≤60s (verified via redis.ttl)
 *   4. Cross-agency namespace — key stored under accounts:sso:code:* NOT agency:*:session:*
 *   5. Invalid JSON in stored value returns null (defensive parse guard)
 *
 * T-03-011 mitigation: Tests 2 + 3 prove atomic single-use + 60s TTL cap.
 * Q2 resolution: Test 4 confirms platform-shared namespace.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import type { Redis } from 'ioredis'
import { REDIS_KEY } from '@mjagency/config'
import type { SsoCodePayload } from '../sso-code.js'

const SKIP = !process.env.INTEGRATION_REDIS_URL

let redis: Redis
let createSsoCode: (redis: Redis, payload: SsoCodePayload) => Promise<string>
let redeemSsoCode: (redis: Redis, codeId: string) => Promise<SsoCodePayload | null>

if (!SKIP) {
  beforeEach(async () => {
    const IORedis = (await import('ioredis')).default
    redis = new IORedis(process.env.INTEGRATION_REDIS_URL!, { lazyConnect: false })
    await redis.flushdb()
    const mod = await import('../sso-code.js')
    createSsoCode = mod.createSsoCode
    redeemSsoCode = mod.redeemSsoCode
  })

  afterAll(async () => {
    if (redis) await redis.quit()
  })
}

const payload: SsoCodePayload = {
  userId: '11111111-1111-1111-1111-111111111111',
  agencyId: 'ecommerce',
  familyId: '22222222-2222-2222-2222-222222222222',
  issuedAt: Date.now(),
}

describe('sso-code integration (Q2 resolution — accounts:sso:* namespace, T-03-011)', () => {
  it.skipIf(SKIP)('Test 1: code created and redeemed once — payload matches input', async () => {
    const code = await createSsoCode(redis, payload)
    expect(code).toMatch(/^[a-f0-9]{32}$/)
    const redeemed = await redeemSsoCode(redis, code)
    expect(redeemed).not.toBeNull()
    expect(redeemed!.userId).toBe(payload.userId)
    expect(redeemed!.agencyId).toBe(payload.agencyId)
    expect(redeemed!.familyId).toBe(payload.familyId)
  })

  it.skipIf(SKIP)('Test 2: second redemption returns null (single-use GETDEL)', async () => {
    const code = await createSsoCode(redis, payload)
    const first = await redeemSsoCode(redis, code)
    expect(first).not.toBeNull()
    const second = await redeemSsoCode(redis, code)
    expect(second).toBeNull()
  })

  it.skipIf(SKIP)('Test 3: TTL respected — key expires in ≤60s', async () => {
    const code = await createSsoCode(redis, payload)
    const ttl = await redis.ttl(REDIS_KEY.accounts.sso.code(code))
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(60)
  })

  it.skipIf(SKIP)('Test 4: cross-agency namespace — key stored under accounts:sso:code:* not agency:*:session:*', async () => {
    const code = await createSsoCode(redis, payload)
    const expectedKey = REDIS_KEY.accounts.sso.code(code)
    expect(expectedKey).toMatch(/^accounts:sso:code:/)
    expect(expectedKey).not.toMatch(/^agency:/)
    // Confirm the key actually exists in Redis under that key
    const raw = await redis.get(expectedKey)
    expect(raw).not.toBeNull()
  })

  it.skipIf(SKIP)('Test 5: invalid JSON in stored value returns null (defensive parse)', async () => {
    const badCode = 'bad1bad1bad1bad1bad1bad1bad1bad1' // 32 hex chars
    await redis.set(REDIS_KEY.accounts.sso.code(badCode), 'not-json', 'EX', 60)
    const result = await redeemSsoCode(redis, badCode)
    expect(result).toBeNull()
  })
})
