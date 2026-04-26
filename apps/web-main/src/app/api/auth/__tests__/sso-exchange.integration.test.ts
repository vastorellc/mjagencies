/**
 * apps/web-main/src/app/api/auth/__tests__/sso-exchange.integration.test.ts
 *
 * Integration tests for /api/sso/exchange route handler (server-to-server SSO code exchange).
 * Gated on INTEGRATION_REDIS_URL — skips cleanly without Redis.
 *
 * Tests cover:
 *   1. Without x-mjagency-internal header → 403 (T-03-012 mitigation)
 *   2. With wrong x-mjagency-internal value → 403
 *   3. With correct internal header AND valid code → 200 + { accessToken, refreshToken }
 *   4. Already-redeemed code → 401
 *   5. Invalid body shape → 400
 *
 * T-03-012: Internal-header gate checked BEFORE body parse (defense-in-depth).
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import type { Redis } from 'ioredis'

const SKIP = !process.env.INTEGRATION_REDIS_URL

vi.stubEnv('JWT_ACCESS_SECRET', 'a'.repeat(64))
vi.stubEnv('JWT_REFRESH_SECRET', 'b'.repeat(64))
vi.stubEnv('SSO_STATE_SECRET', 'c'.repeat(64))
vi.stubEnv('SSO_INTERNAL_TOKEN', 'test-internal-token-xyz')
vi.stubEnv('REDIS_URL', process.env.INTEGRATION_REDIS_URL ?? 'redis://localhost:6379')

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get:    vi.fn(() => undefined),
    set:    vi.fn(),
    delete: vi.fn(),
  })),
}))

// Mock server-only
vi.mock('server-only', () => ({}))

let redis: Redis

if (!SKIP) {
  beforeEach(async () => {
    const IORedis = (await import('ioredis')).default
    redis = new IORedis(process.env.INTEGRATION_REDIS_URL!, { lazyConnect: false })
    await redis.flushdb()
    vi.resetModules()
  })

  afterAll(async () => {
    if (redis) await redis.quit()
  })
}

describe('/api/sso/exchange (Plan 03-03, T-03-012)', () => {
  it.skipIf(SKIP)('Test 1: without x-mjagency-internal header → 403', async () => {
    const { POST } = await import('../../sso/exchange/route.js')
    const req = new Request('http://localhost:3000/api/sso/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'a'.repeat(32) }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it.skipIf(SKIP)('Test 2: with wrong x-mjagency-internal value → 403', async () => {
    const { POST } = await import('../../sso/exchange/route.js')
    const req = new Request('http://localhost:3000/api/sso/exchange', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-mjagency-internal': 'wrong-token',
      },
      body: JSON.stringify({ code: 'a'.repeat(32) }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it.skipIf(SKIP)('Test 3: correct internal header + valid code → 200 + { accessToken, refreshToken }', async () => {
    // Pre-create an SSO code via createSsoCode
    const { createSsoCode } = await import('@mjagency/auth')
    const code = await createSsoCode(redis, {
      userId:   '11111111-1111-1111-1111-111111111111',
      agencyId: 'ecommerce',
      familyId: '22222222-2222-2222-2222-222222222222',
      issuedAt: Date.now(),
    })

    vi.resetModules()
    const { POST } = await import('../../sso/exchange/route.js')
    const req = new Request('http://localhost:3000/api/sso/exchange', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-mjagency-internal': 'test-internal-token-xyz',
      },
      body: JSON.stringify({ code }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(typeof body.accessToken).toBe('string')
    expect(typeof body.refreshToken).toBe('string')
  })

  it.skipIf(SKIP)('Test 4: already-redeemed code → 401', async () => {
    const { createSsoCode } = await import('@mjagency/auth')
    const code = await createSsoCode(redis, {
      userId:   '11111111-1111-1111-1111-111111111111',
      agencyId: 'ecommerce',
      familyId: '33333333-3333-3333-3333-333333333333',
      issuedAt: Date.now(),
    })

    vi.resetModules()
    const { POST } = await import('../../sso/exchange/route.js')
    const reqBody = JSON.stringify({ code })

    // First redemption
    const res1 = await POST(new Request('http://localhost:3000/api/sso/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mjagency-internal': 'test-internal-token-xyz' },
      body: reqBody,
    }))
    expect(res1.status).toBe(200)

    // Second redemption (replay attack)
    vi.resetModules()
    const { POST: POST2 } = await import('../../sso/exchange/route.js')
    const res2 = await POST2(new Request('http://localhost:3000/api/sso/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mjagency-internal': 'test-internal-token-xyz' },
      body: reqBody,
    }))
    expect(res2.status).toBe(401)
  })

  it.skipIf(SKIP)('Test 5: invalid body shape → 400', async () => {
    const { POST } = await import('../../sso/exchange/route.js')
    const req = new Request('http://localhost:3000/api/sso/exchange', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-mjagency-internal': 'test-internal-token-xyz',
      },
      body: JSON.stringify({ code: 'not-32-hex-chars' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
