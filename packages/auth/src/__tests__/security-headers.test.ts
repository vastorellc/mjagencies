/**
 * packages/auth/src/__tests__/security-headers.test.ts
 *
 * Unit tests for applySecurityHeaders — validates the 6 security headers set here.
 *
 * Plan 11-07 update: Content-Security-Policy is NO LONGER set by this function. CSP is
 * generated per-request as a nonce-CSP in middleware.ts. See csp-nonce.test.ts for the
 * CSP coverage. The CI grep gate (.github/workflows/csp-static-grep-gate.yml) prevents
 * a static CSP from regressing into security-headers.ts.
 *
 * Uses a NextResponse-shaped object with a real Headers instance (no mocks needed).
 */

import { describe, it, expect } from 'vitest'
import { applySecurityHeaders } from '../security-headers.js'
import type { NextResponse } from 'next/server'

/** Minimal NextResponse-shaped stub with real Headers. */
function makeFakeResponse(): NextResponse {
  return { headers: new Headers() } as unknown as NextResponse
}

describe('applySecurityHeaders', () => {
  it('Test 1: sets all 6 expected security headers (CSP moved to middleware)', () => {
    const res = makeFakeResponse()
    applySecurityHeaders(res)

    expect(res.headers.get('Strict-Transport-Security')).not.toBeNull()
    expect(res.headers.get('X-Frame-Options')).not.toBeNull()
    expect(res.headers.get('X-XSS-Protection')).not.toBeNull()
    expect(res.headers.get('X-Content-Type-Options')).not.toBeNull()
    expect(res.headers.get('Referrer-Policy')).not.toBeNull()
    expect(res.headers.get('Permissions-Policy')).not.toBeNull()
  })

  it('Test 2: HSTS value is max-age=63072000; includeSubDomains; preload', () => {
    const res = makeFakeResponse()
    applySecurityHeaders(res)
    expect(res.headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains; preload',
    )
  })

  it('Test 3: X-Frame-Options is DENY', () => {
    const res = makeFakeResponse()
    applySecurityHeaders(res)
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('Test 4: does NOT set Content-Security-Policy (Plan 11-07 — CSP set in middleware)', () => {
    const res = makeFakeResponse()
    applySecurityHeaders(res)
    expect(res.headers.get('Content-Security-Policy')).toBeNull()
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeNull()
  })
})
