import { describe, test, expect } from 'vitest'
import manifest from '../../../backend/shared/model-ids.json'
import { MODELS, MODELS_BY_PROVIDER, defaultModelFor } from './models'

describe('Frontend MODELS parity with shared manifest', () => {
  test('frontend MODELS keys equal manifest IDs (sorted)', () => {
    expect(Object.keys(MODELS).sort()).toEqual([...manifest].sort())
  })

  test('every MODEL has expected shape', () => {
    for (const m of Object.values(MODELS)) {
      expect(m.provider).toMatch(/^(gemini|claude|openai|deepseek)$/)
      expect(m.tier).toMatch(/^(flagship|fast|premium|experimental)$/)
      expect(m.capabilities.text).toBe(true)
      expect(typeof m.pricePerMInput).toBe('number')
      expect(typeof m.pricePerMOutput).toBe('number')
    }
  })

  test('MODELS_BY_PROVIDER has >=1 entry per provider', () => {
    for (const provider of ['gemini', 'claude', 'openai', 'deepseek'] as const) {
      expect(MODELS_BY_PROVIDER[provider]?.length ?? 0).toBeGreaterThan(0)
    }
  })

  test('defaultModelFor matches expected flagship per provider', () => {
    expect(defaultModelFor('claude')).toBe('claude-sonnet-4-6')
    expect(defaultModelFor('openai')).toBe('gpt-5.5')
    expect(defaultModelFor('gemini')).toBe('gemini-3.1-pro-preview')
    expect(defaultModelFor('deepseek')).toBe('deepseek-v4-pro')
  })
})
