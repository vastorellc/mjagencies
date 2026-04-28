/**
 * packages/compliance/src/__tests__/legal-hold.test.ts
 * Plan 11-05 / REQ-144 / Pitfall 6.2: legal hold rules respected.
 */
import { describe, it, expect } from 'vitest'
import { shouldHonorLegalHold, type LegalHoldRules } from '../erasure/legal-hold.js'

const loader = (rules: LegalHoldRules | null) => async () => rules

describe('shouldHonorLegalHold', () => {
  it('skips esign_record by default 7-year retention when rules absent', async () => {
    const r = await shouldHonorLegalHold('agency-1', 'esign_record', loader(null))
    expect(r.skip).toBe(true)
    expect(r.reason).toMatch(/ESIGN Act 7-year/)
  })

  it('respects custom esign_retention_years override', async () => {
    const r = await shouldHonorLegalHold('agency-1', 'esign_record', loader({ esign_retention_years: 10 }))
    expect(r.skip).toBe(true)
    expect(r.reason).toMatch(/10-year/)
  })

  it('does not skip esign_record when retention years explicitly 0', async () => {
    const r = await shouldHonorLegalHold('agency-1', 'esign_record', loader({ esign_retention_years: 0 }))
    expect(r.skip).toBe(false)
  })

  it('skips medical_record only when hipaa_required: true', async () => {
    const off = await shouldHonorLegalHold('agency-1', 'medical_record', loader({ hipaa_required: false }))
    const on = await shouldHonorLegalHold('agency-1', 'medical_record', loader({ hipaa_required: true }))
    expect(off.skip).toBe(false)
    expect(on.skip).toBe(true)
  })

  it('skips tax_record when tax_retention_years > 0', async () => {
    const a = await shouldHonorLegalHold('agency-1', 'tax_record', loader({ tax_retention_years: 7 }))
    expect(a.skip).toBe(true)
    expect(a.reason).toMatch(/7-year/)
  })

  it('does not skip tax_record when no tax_retention_years', async () => {
    const a = await shouldHonorLegalHold('agency-1', 'tax_record', loader({}))
    expect(a.skip).toBe(false)
  })

  it('does not skip arbitrary data classes', async () => {
    const r = await shouldHonorLegalHold('agency-1', 'contact', loader({ esign_retention_years: 7 }))
    expect(r.skip).toBe(false)
  })
})
