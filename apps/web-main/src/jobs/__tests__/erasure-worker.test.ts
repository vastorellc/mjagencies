/**
 * apps/web-main/src/jobs/__tests__/erasure-worker.test.ts
 *
 * Unit tests for the CCPA erasure worker bootstrap (loadLegalHoldRules).
 *
 * The worker fan-out itself lives in @mjagency/compliance and is not retested
 * here — those 7-system delete operations have their own coverage in the
 * compliance package. What IS tested here is the loader contract this app
 * provides:
 *
 *   1. No env vars set → returns null (safe defaults kick in inside
 *      shouldHonorLegalHold). This is the most important property — a bug
 *      that returns `{ esign_retention_years: 0 }` when no overrides exist
 *      would silently delete signed contracts on every erasure request.
 *   2. Per-agency env vars produce the corresponding LegalHoldRules object.
 *   3. Agency-id casing / hyphens normalize correctly into the env var name.
 *   4. Empty / unparseable env values are treated as unset (don't crash).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadLegalHoldRules } from '../erasure-worker.js'

// We mutate process.env directly inside tests because the loader reads it
// at call time. vi.stubEnv would also work but pure assignment is simpler
// and we always restore in afterEach.
const savedEnv = { ...process.env }
afterEach(() => {
  // Wipe any LEGAL_HOLD_* keys this test may have set, then restore.
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('LEGAL_HOLD_')) delete process.env[key]
  }
  Object.assign(process.env, savedEnv)
})

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('LEGAL_HOLD_')) delete process.env[key]
  }
})

describe('loadLegalHoldRules — defaults (no env overrides)', () => {
  it('Test 1: returns null when no LEGAL_HOLD_* env vars are set', async () => {
    expect(await loadLegalHoldRules('finance')).toBeNull()
    expect(await loadLegalHoldRules('main')).toBeNull()
    expect(await loadLegalHoldRules('ecommerce')).toBeNull()
  })

  it('Test 2: returning null is the safe-default path that triggers ESIGN Act 7yr retention', async () => {
    // This is a contract test: shouldHonorLegalHold (in @mjagency/compliance)
    // treats `null` rules as "use defaults", which means esign records get
    // skipped under a 7-year ESIGN retention. Verifying our loader returns
    // null here protects against silently bypassing that retention.
    const result = await loadLegalHoldRules('any-agency')
    expect(result).toBeNull()
  })

  it('Test 3: empty string env vars are treated as unset (not parsed as 0)', async () => {
    // An empty string would parse via parseInt as NaN; the loader must NOT
    // produce { esign_retention_years: NaN } and must NOT default to 0.
    process.env['LEGAL_HOLD_FINANCE_ESIGN_YEARS'] = ''
    process.env['LEGAL_HOLD_FINANCE_TAX_YEARS']   = ''

    expect(await loadLegalHoldRules('finance')).toBeNull()
  })

  it('Test 4: unparseable env vars are treated as unset (not crash)', async () => {
    process.env['LEGAL_HOLD_FINANCE_ESIGN_YEARS'] = 'seven'
    process.env['LEGAL_HOLD_FINANCE_TAX_YEARS']   = 'definitely-not-a-number'

    // Should not throw, and should not produce NaN-bearing rules
    const rules = await loadLegalHoldRules('finance')
    expect(rules).toBeNull()
  })
})

describe('loadLegalHoldRules — per-agency overrides', () => {
  it('Test 5: ESIGN_YEARS=7 produces { esign_retention_years: 7 }', async () => {
    process.env['LEGAL_HOLD_FINANCE_ESIGN_YEARS'] = '7'
    expect(await loadLegalHoldRules('finance')).toEqual({
      esign_retention_years: 7,
    })
  })

  it('Test 6: TAX_YEARS=7 produces { tax_retention_years: 7 }', async () => {
    process.env['LEGAL_HOLD_FINANCE_TAX_YEARS'] = '7'
    expect(await loadLegalHoldRules('finance')).toEqual({
      tax_retention_years: 7,
    })
  })

  it('Test 7: HIPAA=true produces { hipaa_required: true }', async () => {
    process.env['LEGAL_HOLD_HEALTHCARE_HIPAA'] = 'true'
    expect(await loadLegalHoldRules('healthcare')).toEqual({
      hipaa_required: true,
    })
  })

  it('Test 8: HIPAA=anything-other-than-"true" is treated as false', async () => {
    process.env['LEGAL_HOLD_FINANCE_HIPAA'] = '1'         // not "true"
    process.env['LEGAL_HOLD_FINANCE_ESIGN_YEARS'] = '0'   // override exists
    const rules = await loadLegalHoldRules('finance')
    expect(rules?.hipaa_required).toBeUndefined()
  })

  it('Test 9: ESIGN_YEARS=0 explicitly allows esign deletion (override of default 7yr)', async () => {
    process.env['LEGAL_HOLD_TEST_ESIGN_YEARS'] = '0'
    const rules = await loadLegalHoldRules('test')
    expect(rules).toEqual({ esign_retention_years: 0 })
    // Note: shouldHonorLegalHold treats years=0 as "delete allowed". This
    // is the only path by which an admin can explicitly opt into deleting
    // esign records — it requires an explicit ESIGN_YEARS=0 in env.
  })

  it('Test 10: all three overrides combine into one rules object', async () => {
    process.env['LEGAL_HOLD_HEALTHCARE_ESIGN_YEARS'] = '7'
    process.env['LEGAL_HOLD_HEALTHCARE_TAX_YEARS']   = '10'
    process.env['LEGAL_HOLD_HEALTHCARE_HIPAA']       = 'true'

    expect(await loadLegalHoldRules('healthcare')).toEqual({
      esign_retention_years: 7,
      tax_retention_years:   10,
      hipaa_required:        true,
    })
  })
})

describe('loadLegalHoldRules — agency-id normalisation', () => {
  it('Test 11: lowercase agency id maps to UPPERCASE env var name', async () => {
    process.env['LEGAL_HOLD_FINANCE_ESIGN_YEARS'] = '5'
    expect(await loadLegalHoldRules('finance')).toEqual({ esign_retention_years: 5 })
  })

  it('Test 12: hyphenated agency id is normalised to underscore env var name', async () => {
    // 'web-finance' → 'WEB_FINANCE' as the env-var prefix
    process.env['LEGAL_HOLD_WEB_FINANCE_ESIGN_YEARS'] = '5'
    expect(await loadLegalHoldRules('web-finance')).toEqual({ esign_retention_years: 5 })
  })

  it('Test 13: per-agency env vars do NOT leak across agencies', async () => {
    process.env['LEGAL_HOLD_FINANCE_HIPAA'] = 'true'
    expect(await loadLegalHoldRules('main')).toBeNull()
    expect(await loadLegalHoldRules('ecommerce')).toBeNull()
    expect(await loadLegalHoldRules('finance')).toEqual({ hipaa_required: true })
  })
})
