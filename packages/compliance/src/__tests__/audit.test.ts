/**
 * packages/compliance/src/__tests__/audit.test.ts
 * Plan 11-05 / REQ-144 D-07: hash-chain composition.
 *
 * Tests the pure computeRecordHash function — DB integration is exercised in
 * the integration suite. We assert:
 *   1. Same inputs → same hash (deterministic)
 *   2. Different prev_hash → different record_hash (chain anchored)
 *   3. Different result payload → different record_hash (tamper-evident)
 *   4. Genesis prev_hash='' produces a valid hash
 */
import { describe, it, expect } from 'vitest'
import { computeRecordHash } from '../erasure/audit.js'

describe('computeRecordHash', () => {
  const baseInput = {
    prevHash: 'aaaa',
    requestId: 'req-1',
    system: 'postgres',
    occurredAt: '2026-04-28T00:00:00.000Z',
    result: { deleted: 5, skipped: 0 },
  }

  it('is deterministic for identical inputs', () => {
    const a = computeRecordHash(baseInput)
    const b = computeRecordHash(baseInput)
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('changes when prev_hash changes', () => {
    const a = computeRecordHash(baseInput)
    const b = computeRecordHash({ ...baseInput, prevHash: 'bbbb' })
    expect(a).not.toBe(b)
  })

  it('changes when system changes', () => {
    const a = computeRecordHash(baseInput)
    const b = computeRecordHash({ ...baseInput, system: 'redis' })
    expect(a).not.toBe(b)
  })

  it('changes when result payload changes', () => {
    const a = computeRecordHash(baseInput)
    const b = computeRecordHash({ ...baseInput, result: { deleted: 99, skipped: 0 } })
    expect(a).not.toBe(b)
  })

  it('produces a valid hash for the genesis row (empty prev_hash)', () => {
    const a = computeRecordHash({ ...baseInput, prevHash: '' })
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })
})
