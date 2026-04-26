/**
 * packages/auth/src/__tests__/middleware.test.ts
 *
 * Unit tests for createAuthMiddleware factory.
 *
 * Strategy:
 *   - Mock `jose` so jwtVerify is controllable without real JWTs.
 *   - Use standard `Request` (Fetch API) to construct fake NextRequest-shaped objects.
 *     NextRequest extends Request so `new Request(url, opts)` provides the base; we cast
 *     to NextRequest for the middleware call.
 *   - `next/server` is available in vitest node environment (no Edge runtime required for unit tests).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// jose mock — controlled by each test
// ---------------------------------------------------------------------------
const mockJwtVerify = vi.fn()
vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
}))

// ---------------------------------------------------------------------------
// Import AFTER mock registration so the factory picks up the mock
// ---------------------------------------------------------------------------
const { createAuthMiddleware } = await import('../middleware.js')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a NextRequest with controllable host + cookie + path. */
function makeRequest(opts: {
  host: string
  path?: string
  accessCookie?: string
}): NextRequest {
  const path = opts.path ?? '/'
  const url = `http://${opts.host}${path}`
  const headers: Record<string, string> = { host: opts.host }
  if (opts.accessCookie) {
    headers['cookie'] = `mj-access=${opts.accessCookie}`
  }
  return new NextRequest(url, { headers })
}

describe('createAuthMiddleware', () => {
  let middleware: (req: NextRequest) => Promise<import('next/server').NextResponse>

  beforeEach(() => {
    vi.clearAllMocks()
    // Re-create middleware so per-test mock state is clean
    middleware = createAuthMiddleware()
  })

  // -------------------------------------------------------------------------
  // Test 1 — Unknown subdomain → 404
  // -------------------------------------------------------------------------
  it('Test 1: unknown subdomain returns 404', async () => {
    const req = makeRequest({ host: 'notreal.brand.com' })
    const res = await middleware(req)
    expect(res.status).toBe(404)
  })

  // -------------------------------------------------------------------------
  // Test 2 — Known subdomain + missing token → redirect to /login with returnTo
  // -------------------------------------------------------------------------
  it('Test 2: known subdomain + missing token redirects to /login with returnTo', async () => {
    const req = makeRequest({ host: 'ecommerce.brand.com', path: '/dashboard' })
    const res = await middleware(req)
    expect(res.status).toBe(307)
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('/login')
    expect(location).toContain('returnTo')
    // returnTo is URL-encoded in the query string; %2F = /
    expect(location).toMatch(/dashboard/)
  })

  // -------------------------------------------------------------------------
  // Test 3 — Valid token + matching agencyId → next() with context headers + security headers
  // -------------------------------------------------------------------------
  it('Test 3: valid token + matching agencyId returns next() with context headers and security headers', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        sub: 'user-uuid-123',
        agencyId: 'ecommerce',
        role: 'admin',
        jti: 'jti-1',
        familyId: 'fam-1',
      },
    })

    const req = makeRequest({
      host: 'ecommerce.brand.com',
      path: '/dashboard',
      accessCookie: 'fake.valid.token',
    })
    const res = await middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('x-agency-id')).toBe('ecommerce')
    expect(res.headers.get('x-user-id')).toBe('user-uuid-123')
    expect(res.headers.get('x-user-role')).toBe('admin')
    // Security headers present
    expect(res.headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains; preload',
    )
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
  })

  // -------------------------------------------------------------------------
  // Test 4 — Valid token + MISMATCHED agencyId → redirect to /login
  // -------------------------------------------------------------------------
  it('Test 4: valid token with mismatched agencyId redirects to /login (anti-cross-tenant)', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        sub: 'user-uuid-999',
        agencyId: 'growth',   // token is for 'growth', but host is 'ecommerce'
        role: 'admin',
        jti: 'jti-2',
        familyId: 'fam-2',
      },
    })

    const req = makeRequest({
      host: 'ecommerce.brand.com',
      path: '/dashboard',
      accessCookie: 'fake.cross.tenant.token',
    })
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location') ?? '').toContain('/login')
  })

  // -------------------------------------------------------------------------
  // Test 5 — Bypass paths /login, /sso, /auth/callback pass through without token
  // -------------------------------------------------------------------------
  it('Test 5: bypass paths (/login, /sso, /auth/callback) return next() without a token', async () => {
    const bypassPaths = ['/login', '/sso', '/auth/callback', '/auth/callback/google']

    for (const path of bypassPaths) {
      vi.clearAllMocks()
      middleware = createAuthMiddleware()
      const req = makeRequest({ host: 'ecommerce.brand.com', path })
      const res = await middleware(req)

      expect(res.status).toBe(200)
      // x-agency-id should still be injected on bypass paths
      expect(res.headers.get('x-agency-id')).toBe('ecommerce')
      // jwtVerify should NOT have been called
      expect(mockJwtVerify).not.toHaveBeenCalled()
    }
  })

  // -------------------------------------------------------------------------
  // Test 6 — Expired/invalid token (jwtVerify throws) → redirect to /login
  // -------------------------------------------------------------------------
  it('Test 6: expired/invalid token (jwtVerify throws) redirects to /login', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('JWTExpired'))

    const req = makeRequest({
      host: 'ecommerce.brand.com',
      path: '/dashboard',
      accessCookie: 'expired.token.here',
    })
    const res = await middleware(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('/login')
    expect(location).toContain('returnTo')
  })
})
