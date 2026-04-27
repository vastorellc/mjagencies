/**
 * packages/ai/src/__tests__/model-routing.test.ts
 *
 * Vitest unit tests for model-routing.ts (Plan 07-01 Task 2).
 * Verifies getModelForTier returns the correct primary model per tier.
 */
import { describe, it, expect } from 'vitest'
import { getModelForTier, MODEL_ROUTING } from '../model-routing.js'
import type { ModelTier } from '../model-routing.js'

describe('getModelForTier', () => {
  it('returns gemini-2.5-flash-lite for tier1-bulk', () => {
    expect(getModelForTier('tier1-bulk')).toBe('gemini-2.5-flash-lite')
  })

  it('returns claude-sonnet-4-6 for tier2-writing', () => {
    expect(getModelForTier('tier2-writing')).toBe('claude-sonnet-4-6')
  })

  it('returns gemini-2.5-pro for tier2-research', () => {
    expect(getModelForTier('tier2-research')).toBe('gemini-2.5-pro')
  })

  it('returns claude-opus-4-6 for tier3-max', () => {
    expect(getModelForTier('tier3-max')).toBe('claude-opus-4-6')
  })

  it('defaults to gemini-2.5-flash-lite (tier1-bulk) when tier is undefined', () => {
    expect(getModelForTier(undefined)).toBe('gemini-2.5-flash-lite')
  })
})

describe('MODEL_ROUTING', () => {
  it('tier1-bulk has gemini-2.5-flash-lite as primary and gpt-4.1-nano as fallback', () => {
    expect(MODEL_ROUTING['tier1-bulk'][0]).toBe('gemini-2.5-flash-lite')
    expect(MODEL_ROUTING['tier1-bulk'][1]).toBe('gpt-4.1-nano')
  })

  it('all tiers have at least one model', () => {
    const tiers: ModelTier[] = ['tier1-bulk', 'tier2-writing', 'tier2-research', 'tier3-max']
    for (const tier of tiers) {
      expect(MODEL_ROUTING[tier].length).toBeGreaterThan(0)
    }
  })
})
