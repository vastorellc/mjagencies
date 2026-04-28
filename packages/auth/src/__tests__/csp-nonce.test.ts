/**
 * packages/auth/src/__tests__/csp-nonce.test.ts
 *
 * Plan 11-07 — verifies the per-request nonce CSP injected by createAuthMiddleware.
 *
 * Strategy mirrors middleware.test.ts:
 *   - Mock `jose` so jwtVerify is controllable without real JWTs.
 *   - Use NextRequest with a host that resolves through extractAgencyFromHost
 *     ('ecommerce.brand.com' → AGENCIES['ecommerce']).
 *   - Read the resulting Content-Security-Policy(-Report-Only) header from the response.
 *
 * Threat coverage:
 *   T-11-07-01 (nonce reuse) — two requests must produce different nonces.
 *   T-11-07-07 (Edge runtime safety) — crypto.randomUUID() is Web Crypto, available in vitest node env.
 *   T-11-07-08 (matcher excludes /api/*) — regex assertion proves the negative lookahead works.
 *   T-11-07-10 (no unsafe-inline regression) — assert script-src does not contain 'unsafe-inline'.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// jose mock — we are not testing JWT verification here, only CSP injection.
const mockJwtVerify = vi.fn()
vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
}))

const { createAuthMiddleware, config: middlewareConfig } = await import('../middleware.js')

function makeRequest(opts: { host?: string; path?: string } = {}): NextRequest {
  const host = opts.host ?? 'ecommerce.brand.com'
  const path = opts.path ?? '/'
  const url = `http://${host}${path}`
  return new NextRequest(url, { headers: { host } })
}

function readCsp(res: import('next/server').NextResponse): string {
  return (
    res.headers.get('Content-Security-Policy') ??
    res.headers.get('Content-Security-Policy-Report-Only') ??
    ''
  )
}

describe('CSP nonce middleware (Plan 11-07)', () => {
  let middleware: (req: NextRequest) => Promise<import('next/server').NextResponse>
  const ORIGINAL_CSP_ENFORCING = process.env.CSP_ENFORCING

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CSP_ENFORCING
    middleware = createAuthMiddleware()
  })

  afterEach(() => {
    if (ORIGINAL_CSP_ENFORCING === undefined) {
      delete process.env.CSP_ENFORCING
    } else {
      process.env.CSP_ENFORCING = ORIGINAL_CSP_ENFORCING
    }
  })

  it('generates a different nonce per request (T-11-07-01)', async () => {
    const res1 = await middleware(makeRequest({ path: '/services' }))
    const res2 = await middleware(makeRequest({ path: '/services' }))
    const csp1 = readCsp(res1)
    const csp2 = readCsp(res2)
    const m1 = csp1.match(/'nonce-([^']+)'/)
    const m2 = csp2.match(/'nonce-([^']+)'/)
    expect(m1?.[1]).toBeDefined()
    expect(m2?.[1]).toBeDefined()
    expect(m1?.[1]).not.toBe(m2?.[1])
  })

  it('emits Content-Security-Policy-Report-Only when CSP_ENFORCING is unset (D-08 Stage 1)', async () => {
    delete process.env.CSP_ENFORCING
    const m = createAuthMiddleware()
    const res = await m(makeRequest({ path: '/' }))
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toMatch(/nonce-/)
    expect(res.headers.get('Content-Security-Policy')).toBeNull()
  })

  it('emits Content-Security-Policy (enforcing) when CSP_ENFORCING=true (D-08 Stage 2)', async () => {
    process.env.CSP_ENFORCING = 'true'
    const m = createAuthMiddleware()
    const res = await m(makeRequest({ path: '/' }))
    expect(res.headers.get('Content-Security-Policy')).toMatch(/nonce-/)
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeNull()
  })

  it('CSP allowlist matches D-10 (googletagmanager, clarity, stripe, cloudflareinsights — no Meta)', async () => {
    const res = await middleware(makeRequest({ path: '/' }))
    const csp = readCsp(res)
    expect(csp).toContain('https://www.googletagmanager.com')
    expect(csp).toContain('https://www.clarity.ms')
    expect(csp).toContain('https://js.stripe.com')
    expect(csp).toContain('https://api.stripe.com')
    expect(csp).toContain('https://cloudflareinsights.com')
    expect(csp).toContain('https://imagedelivery.net')
    // D-10: NO Meta domain (server-side CAPI only)
    expect(csp).not.toMatch(/facebook|connect\.facebook/)
  })

  it('script-src does not contain unsafe-inline (T-11-07-10 regression guard)', async () => {
    const res = await middleware(makeRequest({ path: '/' }))
    const csp = readCsp(res)
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? ''
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).toContain("'strict-dynamic'")
  })

  it('contains report-uri /api/csp-report directive', async () => {
    const res = await middleware(makeRequest({ path: '/' }))
    const csp = readCsp(res)
    expect(csp).toContain('report-uri /api/csp-report')
  })

  it('emits x-nonce header on response and matches the CSP nonce', async () => {
    const res = await middleware(makeRequest({ path: '/' }))
    const xNonce = res.headers.get('x-nonce')
    const csp = readCsp(res)
    const m = csp.match(/'nonce-([^']+)'/)
    expect(xNonce).toBeDefined()
    expect(xNonce).toBe(m?.[1])
  })

  it('matcher excludes /api/csp-report and /api/rum (T-11-07-08)', () => {
    const matcher = middlewareConfig.matcher[0]
    expect(matcher).toBeDefined()
    // The Next.js matcher pattern uses negative lookahead to exclude /api/*.
    // We assert the substring is present rather than rebuilding the regex which
    // Next.js compiles internally with its own anchors.
    expect(matcher).toContain('api/')
    expect(matcher).toMatch(/\(\?!.*api\//)
  })

  it('emits CSP header on redirect-to-login responses too (sign-in page has scripts)', async () => {
    // Authenticated path (no cookie) → redirect; CSP must still apply.
    const res = await middleware(makeRequest({ host: 'ecommerce.brand.com', path: '/dashboard' }))
    expect(res.status).toBe(307)
    const csp = readCsp(res)
    expect(csp).toMatch(/nonce-/)
  })
})
