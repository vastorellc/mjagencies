/**
 * packages/auth/src/__tests__/redirect.test.ts
 *
 * Unit tests for validateReturnTo — same-origin URL gate.
 * Requirements: REQ-308, REQ-424, SEC-N5 (open-redirect prevention).
 *
 * No DB dependency — pure string parsing.
 */

import { describe, it, expect } from 'vitest'
import { validateReturnTo } from '../redirect.js'

const ORIGIN = 'https://accounts.brand.com'

describe('validateReturnTo', () => {
  // Test 1: Empty / null / undefined returnTo → '/dashboard'
  it('returns /dashboard when returnTo is null', () => {
    expect(validateReturnTo(null, ORIGIN)).toBe('/dashboard')
  })

  it('returns /dashboard when returnTo is undefined', () => {
    expect(validateReturnTo(undefined, ORIGIN)).toBe('/dashboard')
  })

  it('returns /dashboard when returnTo is an empty string', () => {
    expect(validateReturnTo('', ORIGIN)).toBe('/dashboard')
  })

  // Test 2: Same-origin path '/dashboard' → '/dashboard'
  it('passes through a same-origin path /dashboard', () => {
    expect(validateReturnTo('/dashboard', ORIGIN)).toBe('/dashboard')
  })

  // Test 3: Same-origin nested path with query and hash
  it('passes through a same-origin nested path preserving query and hash', () => {
    const result = validateReturnTo('/agency/ecommerce/posts?x=1#hash', ORIGIN)
    expect(result).toBe('/agency/ecommerce/posts?x=1#hash')
  })

  // Test 4: External URL → '/dashboard'
  it('rejects an external URL https://evil.com/x', () => {
    expect(validateReturnTo('https://evil.com/x', ORIGIN)).toBe('/dashboard')
  })

  // Test 5: Protocol-relative URL → '/dashboard'
  it('rejects protocol-relative URL //evil.com/x', () => {
    expect(validateReturnTo('//evil.com/x', ORIGIN)).toBe('/dashboard')
  })

  // Test 6: javascript: URI → '/dashboard'
  it('rejects javascript: URI', () => {
    expect(validateReturnTo('javascript:alert(1)', ORIGIN)).toBe('/dashboard')
  })

  // Test 7: data: URI → '/dashboard'
  it('rejects data: URI', () => {
    expect(validateReturnTo('data:text/html,<h1>evil</h1>', ORIGIN)).toBe('/dashboard')
  })

  // Test 8: vbscript: URI → '/dashboard'
  it('rejects vbscript: URI', () => {
    expect(validateReturnTo('vbscript:msgbox(1)', ORIGIN)).toBe('/dashboard')
  })

  // Test 9: file: URI → '/dashboard'
  it('rejects file: URI', () => {
    expect(validateReturnTo('file:///etc/passwd', ORIGIN)).toBe('/dashboard')
  })

  // Test 10: Malformed URL → '/dashboard'
  it('returns /dashboard on malformed URL (URL constructor throws)', () => {
    // 'http://' with no host is invalid; new URL('http://', origin) throws
    expect(validateReturnTo('http://', ORIGIN)).toBe('/dashboard')
  })

  // Test 11: Cross-subdomain in production → '/dashboard'
  it('rejects cross-subdomain URL even within the same root domain', () => {
    const agencyOrigin = 'https://ecommerce.brand.com'
    expect(validateReturnTo('https://other.brand.com/x', agencyOrigin)).toBe('/dashboard')
  })
})
