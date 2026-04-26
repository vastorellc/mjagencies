/**
 * packages/auth/src/__tests__/recovery-codes.test.ts
 *
 * Unit tests for recovery codes module (recovery-codes.ts).
 * REQ-025, REQ-309, SEC-12 — 8 single-use bcrypt-hashed codes.
 *
 * No DB, no Redis — pure in-process unit tests.
 */

import { describe, it, expect } from 'vitest'
import {
  generateRecoveryCodes,
  hashRecoveryCodes,
  verifyRecoveryCode,
  invalidateRecoverySlot,
} from '../recovery-codes.js'

describe('generateRecoveryCodes', () => {
  it('returns array of length 8', () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(8)
  })

  it('all 8 codes are unique', () => {
    const codes = generateRecoveryCodes()
    const unique = new Set(codes)
    expect(unique.size).toBe(8)
  })

  it('each code is 32 hex chars', () => {
    const codes = generateRecoveryCodes()
    for (const code of codes) {
      expect(code).toMatch(/^[a-f0-9]{32}$/)
    }
  })
})

describe('hashRecoveryCodes', () => {
  it('returns 8 hashes each starting with $2b$12$', async () => {
    const codes = generateRecoveryCodes()
    const hashes = await hashRecoveryCodes(codes)
    expect(hashes).toHaveLength(8)
    for (const hash of hashes) {
      expect(hash).toMatch(/^\$2b\$12\$/)
    }
  }, 30_000) // bcrypt cost 12 × 8 — generous timeout
})

describe('verifyRecoveryCode', () => {
  it('returns the correct index for a valid code', async () => {
    const codes = generateRecoveryCodes()
    const hashes = await hashRecoveryCodes(codes)
    const idx = await verifyRecoveryCode(codes[3]!, hashes)
    expect(idx).toBe(3)
  }, 30_000)

  it('returns -1 for an unknown plain code', async () => {
    const codes = generateRecoveryCodes()
    const hashes = await hashRecoveryCodes(codes)
    const idx = await verifyRecoveryCode('cafebabe00000000cafebabe00000000', hashes)
    expect(idx).toBe(-1)
  }, 30_000)

  it('skips empty-string slots (single-use invalidation)', async () => {
    const codes = generateRecoveryCodes()
    const hashes = await hashRecoveryCodes(codes)
    // Invalidate slot 0
    const invalidated = [...hashes]
    invalidated[0] = ''
    // codes[0] was the plain for slot 0 — now should return -1
    const idx = await verifyRecoveryCode(codes[0]!, invalidated)
    expect(idx).toBe(-1)
  }, 30_000)
})

describe('invalidateRecoverySlot', () => {
  it('returns a NEW array with the target index set to empty string', async () => {
    const codes = generateRecoveryCodes()
    const hashes = await hashRecoveryCodes(codes)
    const original = [...hashes]
    const next = invalidateRecoverySlot(hashes, 2)
    expect(next[2]).toBe('')
    // Other slots are unchanged
    expect(next[0]).toBe(original[0])
    expect(next[1]).toBe(original[1])
    // Original array is NOT mutated
    expect(hashes[2]).not.toBe('')
    expect(hashes[2]).toBe(original[2])
  }, 30_000)
})
