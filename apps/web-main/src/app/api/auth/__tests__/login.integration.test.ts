/**
 * apps/web-main/src/app/api/auth/__tests__/login.integration.test.ts
 *
 * Integration tests for /api/auth/login route handler.
 * Gated on INTEGRATION_REDIS_URL — skips cleanly without Redis.
 *
 * Tests cover:
 *   1. Production login without proper credentials returns 501 (T-03-013 mitigation)
 *   2. Dev login with correct LOGIN_DEV_USER_EMAIL + LOGIN_DEV_USER_PASSWORD succeeds (200 or 302 for SSO path)
 *   3. Wrong password in dev returns 401
 *   4. Missing body returns 400
 *
 * T-03-013: Production path returns 501 BEFORE any credential check.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

const SKIP = !process.env.INTEGRATION_REDIS_URL

// Stub env vars before module import
vi.stubEnv('JWT_ACCESS_SECRET', 'a'.repeat(64))
vi.stubEnv('JWT_REFRESH_SECRET', 'b'.repeat(64))
vi.stubEnv('SSO_STATE_SECRET', 'c'.repeat(64))
vi.stubEnv('REDIS_URL', process.env.INTEGRATION_REDIS_URL ?? 'redis://localhost:6379')
vi.stubEnv('LOGIN_DEV_USER_EMAIL', 'admin@example.com')
vi.stubEnv('LOGIN_DEV_USER_PASSWORD', 'devpassword123')
vi.stubEnv('LOGIN_DEV_USER_ID', '11111111-1111-1111-1111-111111111111')

// Mock next/headers so cookies() doesn't crash in test environment
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get:    vi.fn(() => undefined),
    set:    vi.fn(),
    delete: vi.fn(),
  })),
}))

// Mock server-only
vi.mock('server-only', () => ({}))

afterEach(() => {
  vi.resetModules()
})

describe('/api/auth/login (Plan 03-03, T-03-013)', () => {
  it.skipIf(SKIP)('Test 1: production login returns 501 before any credential check (T-03-013)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { POST } = await import('../login/route.js')
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'anypassword', agency: 'brand' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(501)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.error).toBeTruthy()
    vi.unstubAllEnvs()
    // Re-stub common vars
    vi.stubEnv('JWT_ACCESS_SECRET', 'a'.repeat(64))
    vi.stubEnv('JWT_REFRESH_SECRET', 'b'.repeat(64))
    vi.stubEnv('LOGIN_DEV_USER_EMAIL', 'admin@example.com')
    vi.stubEnv('LOGIN_DEV_USER_PASSWORD', 'devpassword123')
    vi.stubEnv('LOGIN_DEV_USER_ID', '11111111-1111-1111-1111-111111111111')
    vi.stubEnv('REDIS_URL', process.env.INTEGRATION_REDIS_URL ?? 'redis://localhost:6379')
  })

  it.skipIf(SKIP)('Test 2: dev login with correct credentials succeeds (200 or 302 for SSO path)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { POST } = await import('../login/route.js')
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'devpassword123',
        agency: 'brand',
      }),
    })
    const res = await POST(req)
    // Either 200 (direct login) or 302 (SSO redirect) are acceptable
    expect([200, 302]).toContain(res.status)
  })

  it.skipIf(SKIP)('Test 3: wrong password in dev returns 401', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { POST } = await import('../login/route.js')
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'wrongpassword', agency: 'brand' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it.skipIf(SKIP)('Test 4: missing body returns 400', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { POST } = await import('../login/route.js')
    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
