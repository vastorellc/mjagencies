/**
 * packages/auth/src/__tests__/security-headers.test.ts
 *
 * Unit tests for applySecurityHeaders — validates all 7 security headers are set correctly.
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
  it('Test 1: sets all 7 expected security headers', () => {
    const res = makeFakeResponse()
    applySecurityHeaders(res)

    expect(res.headers.get('Strict-Transport-Security')).not.toBeNull()
    expect(res.headers.get('X-Frame-Options')).not.toBeNull()
    expect(res.headers.get('X-XSS-Protection')).not.toBeNull()
    expect(res.headers.get('X-Content-Type-Options')).not.toBeNull()
    expect(res.headers.get('Referrer-Policy')).not.toBeNull()
    expect(res.headers.get('Permissions-Policy')).not.toBeNull()
    expect(res.headers.get('Content-Security-Policy')).not.toBeNull()
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

  it("Test 4: CSP contains default-src 'self' AND frame-ancestors 'none'", () => {
    const res = makeFakeResponse()
    applySecurityHeaders(res)
    const csp = res.headers.get('Content-Security-Policy') ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
  })
})
