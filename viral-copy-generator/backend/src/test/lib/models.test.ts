import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MODELS, MODELS_BY_PROVIDER, defaultModelFor } from '../../lib/models.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const manifest: string[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../../shared/model-ids.json'), 'utf8')
)

describe('MODELS parity with shared manifest', () => {
  test('backend MODELS keys equal manifest IDs (sorted)', () => {
    expect(Object.keys(MODELS).sort()).toEqual([...manifest].sort())
  })

  test('every MODEL has provider in {gemini,claude,openai,deepseek}', () => {
    for (const m of Object.values(MODELS)) {
      expect(m.provider).toMatch(/^(gemini|claude|openai|deepseek)$/)
    }
  })

  test('every MODEL has tier in known set + text capability', () => {
    for (const m of Object.values(MODELS)) {
      expect(m.tier).toMatch(/^(flagship|fast|premium|experimental)$/)
      expect(m.capabilities.text).toBe(true)
    }
  })

  test('MODELS_BY_PROVIDER has at least 1 entry per provider', () => {
    for (const provider of ['gemini', 'claude', 'openai', 'deepseek'] as const) {
      expect(MODELS_BY_PROVIDER[provider]?.length ?? 0).toBeGreaterThan(0)
    }
  })

  test('defaultModelFor returns expected flagship per provider', () => {
    expect(defaultModelFor('claude')).toBe('claude-sonnet-4-6')
    expect(defaultModelFor('openai')).toBe('gpt-5.5')
    expect(defaultModelFor('gemini')).toBe('gemini-3.1-pro-preview')
    expect(defaultModelFor('deepseek')).toBe('deepseek-v4-pro')
  })
})
