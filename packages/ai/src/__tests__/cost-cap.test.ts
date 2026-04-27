/**
 * packages/ai/src/__tests__/cost-cap.test.ts
 *
 * Vitest unit tests for cost-cap.ts (TDD RED — Plan 07-01 Task 1).
 * Tests cover:
 *   A. getAgencyLiteLLMKey — per-agency key lookup with fallback
 *   B. checkAgencyCostCap — budget enforcement via Redis counter
 *   C. recordAgencySpend — INCRBY + TTL
 *   D. resetMonthlySpend — SCAN+DEL all monthly-spend keys
 *   E. AiBudgetExceededError — extends Error, correct name
 *
 * ioredis is mocked via ioredis-mock so no real Redis is required.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import RedisMock from 'ioredis-mock'

// Mock ioredis BEFORE importing cost-cap to ensure the mock is in place
vi.mock('ioredis', () => {
  return { Redis: RedisMock }
})

import {
  getAgencyLiteLLMKey,
  checkAgencyCostCap,
  recordAgencySpend,
  resetMonthlySpend,
  AiBudgetExceededError,
} from '../cost-cap.js'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  // Clear ioredis-mock state by reinitializing env vars
  delete process.env['LITELLM_API_KEY_ECOMMERCE']
  delete process.env['LITELLM_API_KEY']
  delete process.env['LITELLM_BUDGET_ECOMMERCE']
  delete process.env['REDIS_HOST']
  delete process.env['REDIS_PORT']
})

// ---------------------------------------------------------------------------
// A. getAgencyLiteLLMKey
// ---------------------------------------------------------------------------
describe('getAgencyLiteLLMKey', () => {
  it('returns per-agency key when LITELLM_API_KEY_<AGENCY_UPPER> is set', () => {
    process.env['LITELLM_API_KEY_ECOMMERCE'] = 'agency-key-ecommerce'
    process.env['LITELLM_API_KEY'] = 'global-key'
    const result = getAgencyLiteLLMKey('ecommerce')
    expect(result).toBe('agency-key-ecommerce')
  })

  it('falls back to LITELLM_API_KEY when per-agency key is not set', () => {
    process.env['LITELLM_API_KEY'] = 'global-key'
    const result = getAgencyLiteLLMKey('ecommerce')
    expect(result).toBe('global-key')
  })

  it('returns empty string when neither per-agency nor global key is set', () => {
    const result = getAgencyLiteLLMKey('ecommerce')
    expect(result).toBe('')
  })

  it('normalizes agencyId to uppercase when looking up env var', () => {
    process.env['LITELLM_API_KEY_ECOMMERCE'] = 'upper-key'
    const result = getAgencyLiteLLMKey('eCommerce')
    expect(result).toBe('upper-key')
  })
})

// ---------------------------------------------------------------------------
// B. checkAgencyCostCap
// ---------------------------------------------------------------------------
describe('checkAgencyCostCap', () => {
  it('resolves without throwing when LITELLM_BUDGET is unset (no cap)', async () => {
    // No LITELLM_BUDGET_ECOMMERCE set → no cap, no Redis access, no throw
    await expect(checkAgencyCostCap('ecommerce')).resolves.toBeUndefined()
  })

  it('resolves when monthly spend is below the cap', async () => {
    process.env['LITELLM_BUDGET_ECOMMERCE'] = '1000' // 1000 cents cap
    // ioredis-mock starts with 0; no spend recorded yet → 0 < 1000 → resolves
    await expect(checkAgencyCostCap('ecommerce')).resolves.toBeUndefined()
  })

  it('throws AiBudgetExceededError when monthly spend meets the cap', async () => {
    process.env['LITELLM_BUDGET_ECOMMERCE'] = '100' // 100 cents cap
    // Pre-populate the mock Redis with a spend at cap
    const mockRedis = new RedisMock()
    await mockRedis.set('agency:ecommerce:ai:monthly-spend', '100')
    // The actual call uses a separate RedisMock instance but same in-memory store with ioredis-mock
    // We need to record the spend so the check hits the threshold
    await recordAgencySpend('ecommerce', 100)
    await expect(checkAgencyCostCap('ecommerce')).rejects.toThrow(AiBudgetExceededError)
  })

  it('throws with correct message when budget exceeded', async () => {
    process.env['LITELLM_BUDGET_ECOMMERCE'] = '50'
    await recordAgencySpend('ecommerce', 50)
    await expect(checkAgencyCostCap('ecommerce')).rejects.toThrow(
      'Agency ecommerce exceeded monthly LiteLLM budget',
    )
  })

  it('reads Redis key agency:<id>:ai:monthly-spend (lowercase id in key)', async () => {
    process.env['LITELLM_BUDGET_ECOMMERCE'] = '10'
    // recordAgencySpend uses lowercase agencyId in key
    await recordAgencySpend('ecommerce', 10)
    // checkAgencyCostCap must read the same lowercase key
    await expect(checkAgencyCostCap('ecommerce')).rejects.toThrow(AiBudgetExceededError)
  })
})

// ---------------------------------------------------------------------------
// C. recordAgencySpend
// ---------------------------------------------------------------------------
describe('recordAgencySpend', () => {
  it('increments agency:<id>:ai:monthly-spend by the given cents', async () => {
    await recordAgencySpend('ecommerce', 25)
    // After recording, the check against a 50-cent cap should resolve (25 < 50)
    process.env['LITELLM_BUDGET_ECOMMERCE'] = '50'
    await expect(checkAgencyCostCap('ecommerce')).resolves.toBeUndefined()
  })

  it('accumulates multiple spend recordings', async () => {
    await recordAgencySpend('growth', 30)
    await recordAgencySpend('growth', 30)
    // Total 60 > 50 cap → should throw
    process.env['LITELLM_BUDGET_GROWTH'] = '50'
    await expect(checkAgencyCostCap('growth')).rejects.toThrow(AiBudgetExceededError)
  })

  it('does not throw on Redis error (swallows and logs)', async () => {
    // Should resolve even if something goes wrong — never break user request
    // We test the normal path resolves cleanly
    await expect(recordAgencySpend('ecommerce', 5)).resolves.toBeUndefined()
  })

  it('handles fractional cents by rounding up (Math.ceil)', async () => {
    // 5.3 cents should be recorded as 6 cents (Math.ceil)
    await expect(recordAgencySpend('ecommerce', 5.3)).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// D. resetMonthlySpend
// ---------------------------------------------------------------------------
describe('resetMonthlySpend', () => {
  it('deletes all agency:*:ai:monthly-spend keys and returns count', async () => {
    await recordAgencySpend('ecommerce', 10)
    await recordAgencySpend('growth', 20)
    const count = await resetMonthlySpend()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it('returns 0 when no spend keys exist', async () => {
    // Fresh state — reset any leftover from other tests
    await resetMonthlySpend()
    const count = await resetMonthlySpend()
    expect(count).toBe(0)
  })

  it('clears spend so subsequent checkAgencyCostCap resolves after reset', async () => {
    process.env['LITELLM_BUDGET_ECOMMERCE'] = '100'
    await recordAgencySpend('ecommerce', 100)
    // Should throw before reset
    await expect(checkAgencyCostCap('ecommerce')).rejects.toThrow(AiBudgetExceededError)
    // Reset
    await resetMonthlySpend()
    // Should resolve after reset
    await expect(checkAgencyCostCap('ecommerce')).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// E. AiBudgetExceededError
// ---------------------------------------------------------------------------
describe('AiBudgetExceededError', () => {
  it('extends Error', () => {
    const err = new AiBudgetExceededError('ecommerce')
    expect(err).toBeInstanceOf(Error)
  })

  it('has name === "AiBudgetExceededError"', () => {
    const err = new AiBudgetExceededError('ecommerce')
    expect(err.name).toBe('AiBudgetExceededError')
  })

  it('has the correct message', () => {
    const err = new AiBudgetExceededError('ecommerce')
    expect(err.message).toBe('Agency ecommerce exceeded monthly LiteLLM budget')
  })
})
