/**
 * packages/auth/src/__tests__/sso-state.test.ts
 *
 * Unit tests for HMAC-SHA256 SSO state token generation and verification.
 * No external deps — no DB, no Redis. All secrets stubbed via vi.stubEnv.
 *
 * Tests cover:
 *   1. Roundtrip: generate + verify with correct agency → valid:true, returnTo matches
 *   2. Wrong agency rejected: verify with wrong agency → valid:false
 *   3. Tampered signature rejected: mutated signature → valid:false
 *   4. returnTo URL-encoding preserved: complex URLs survive encode/decode
 *   5. Malformed state (garbage) returns valid:false without throwing
 *   6. Length-mismatched signature buffer rejected without throwing (timingSafeEqual guard)
 *
 * T-03-010 mitigation: Tests 2 + 3 prove HMAC signature + agency-check rejection.
 * RESEARCH §5.2 compliance: createHmac('sha256') + timingSafeEqual + length guard.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createHmac } from 'node:crypto'

const TEST_STATE_SECRET = 'c'.repeat(64)

let generateSsoState: (agencyId: string, returnTo: string) => string
let verifySsoState: (state: string, expectedAgencyId: string) => { valid: boolean; returnTo: string; agencyId: string | null }

beforeAll(() => {
  vi.stubEnv('SSO_STATE_SECRET', TEST_STATE_SECRET)
})

afterAll(() => {
  vi.unstubAllEnvs()
})

// Dynamic import to pick up stubbed env
const getModule = async () => {
  // Clear module cache so env is picked up fresh
  const mod = await import('../sso-state.js')
  generateSsoState = mod.generateSsoState
  verifySsoState = mod.verifySsoState
}

describe('sso-state HMAC (REQ-026, RESEARCH §5.2, T-03-010)', () => {
  beforeAll(async () => {
    await getModule()
  })

  it('Test 1: roundtrip — generate then verify with correct agency returns valid:true and correct returnTo', () => {
    const state = generateSsoState('ecommerce', '/dashboard')
    const result = verifySsoState(state, 'ecommerce')
    expect(result.valid).toBe(true)
    expect(result.returnTo).toBe('/dashboard')
    expect(result.agencyId).toBe('ecommerce')
  })

  it('Test 2: wrong agency rejected — generate for agencyA, verify with agencyB returns valid:false', () => {
    const state = generateSsoState('ecommerce', '/dashboard')
    const result = verifySsoState(state, 'growth')
    expect(result.valid).toBe(false)
    expect(result.returnTo).toBe('/dashboard')
  })

  it('Test 3: tampered signature rejected — mutating last char of signature returns valid:false', () => {
    const state = generateSsoState('ecommerce', '/dashboard')
    // Decode, mutate the last char of the signature segment, re-encode
    const decoded = Buffer.from(state, 'base64url').toString('utf8')
    const parts = decoded.split(':')
    // parts: [agencyId, encodedReturnTo, nonce, signature]
    const sig = parts[parts.length - 1]!
    const tamperedSig = sig.slice(0, -1) + (sig.endsWith('a') ? 'b' : 'a')
    parts[parts.length - 1] = tamperedSig
    const tamperedState = Buffer.from(parts.join(':')).toString('base64url')
    const result = verifySsoState(tamperedState, 'ecommerce')
    expect(result.valid).toBe(false)
    expect(result.returnTo).toBe('/dashboard')
  })

  it('Test 4: returnTo URL-encoding preserved — complex URL with query + hash survives', () => {
    const complexUrl = '/x?y=1&z=2#hash'
    const state = generateSsoState('ecommerce', complexUrl)
    const result = verifySsoState(state, 'ecommerce')
    expect(result.valid).toBe(true)
    expect(result.returnTo).toBe(complexUrl)
  })

  it('Test 5: malformed state (random garbage) returns valid:false without throwing', () => {
    const result = verifySsoState('not-valid-base64url-garbage!!!', 'ecommerce')
    expect(result.valid).toBe(false)
    expect(result.returnTo).toBe('/dashboard')
    expect(result.agencyId).toBeNull()
  })

  it('Test 6: length-mismatched signature buffer rejected — no timingSafeEqual throw', () => {
    // Manually craft a state with a 1-char signature (hex length 1 — odd, so Buffer.from wraps to 0 bytes or 1 nibble)
    // Use 2 hex chars (1 byte) to ensure the sig buffer length is 1 byte vs expected 32 bytes → reject
    const agencyId = 'ecommerce'
    const encodedReturnTo = encodeURIComponent('/dashboard')
    const nonce = 'fake-nonce'
    const shortSig = 'ab' // 1 byte vs expected 32 bytes for sha256
    const payload = `${agencyId}:${encodedReturnTo}:${nonce}:${shortSig}`
    const craftedState = Buffer.from(payload).toString('base64url')
    const result = verifySsoState(craftedState, agencyId)
    // Must NOT throw — length guard catches this before timingSafeEqual
    expect(result.valid).toBe(false)
    expect(result.returnTo).toBe('/dashboard')
  })
})
