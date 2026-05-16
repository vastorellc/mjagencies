// PARITY: must export identical MODELS keys to backend/src/lib/models.ts
// Enforced by frontend/src/lib/models.test.ts asserting Object.keys(MODELS).sort()
// equals backend/shared/model-ids.json.
// Update both sides + the JSON manifest in the same commit when bumping models.

import type { AIProvider, ModelCapabilities } from './types'
export type { AIProvider, ModelCapabilities }

export interface ModelEntry {
  id: string
  provider: AIProvider
  displayName: string
  tier: 'flagship' | 'fast' | 'premium' | 'experimental'
  capabilities: ModelCapabilities
  pricePerMInput: number
  pricePerMOutput: number
  releasedAt: string
  retiresAt?: string
  notes?: string
}

export const MODELS: Record<string, ModelEntry> = {
  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview',
    provider: 'gemini',
    displayName: 'Gemini 3.1 Pro (preview)',
    tier: 'flagship',
    capabilities: {
      text: true, vision: true, audio: true, video: true,
      maxInputTokens: 1_048_576, maxOutputTokens: 65_536,
      maxImagePixels: 16_000_000, maxVideoSizeGB: 20,
      supportsJsonMode: true, supportsFunctionCalling: true,
      supportsCaching: true, supportsSystemPrompt: true,
    },
    pricePerMInput: 2.00, pricePerMOutput: 12.00,
    releasedAt: '2026-02-01',
    notes: 'Preview API ID — GA window ~2026-02-19. Use Files API for video (CLAUDE.md rule).',
  },
  'gemini-3.1-flash-lite': {
    id: 'gemini-3.1-flash-lite',
    provider: 'gemini',
    displayName: 'Gemini 3.1 Flash-Lite',
    tier: 'fast',
    capabilities: {
      text: true, vision: true, audio: true, video: true,
      maxInputTokens: 1_000_000, maxOutputTokens: 65_536,
      maxImagePixels: 16_000_000, maxVideoSizeGB: 20,
      supportsJsonMode: true, supportsFunctionCalling: true,
      supportsCaching: true, supportsSystemPrompt: true,
    },
    pricePerMInput: 0.25, pricePerMOutput: 1.50,
    releasedAt: '2026-03-03',
    notes: 'Background/batch route. Audio at $0.50/MTok input.',
  },
  'claude-opus-4-7': {
    id: 'claude-opus-4-7',
    provider: 'claude',
    displayName: 'Claude Opus 4.7',
    tier: 'premium',
    capabilities: {
      text: true, vision: true, audio: false, video: false,
      maxInputTokens: 1_000_000, maxOutputTokens: 128_000,
      maxImagePixels: 3_750_000,
      supportsJsonMode: false, supportsFunctionCalling: true,
      supportsCaching: true, supportsSystemPrompt: true,
    },
    pricePerMInput: 5.00, pricePerMOutput: 25.00,
    releasedAt: '2026-04-16',
    notes: 'New tokenizer = ~35% more tokens vs 4.6 — real unit cost is higher than headline.',
  },
  'claude-sonnet-4-6': {
    id: 'claude-sonnet-4-6',
    provider: 'claude',
    displayName: 'Claude Sonnet 4.6',
    tier: 'flagship',
    capabilities: {
      text: true, vision: true, audio: false, video: false,
      maxInputTokens: 1_000_000, maxOutputTokens: 64_000,
      maxImagePixels: 3_750_000,
      supportsJsonMode: false, supportsFunctionCalling: true,
      supportsCaching: true, supportsSystemPrompt: true,
    },
    pricePerMInput: 3.00, pricePerMOutput: 15.00,
    releasedAt: '2026-03-01',
    notes: 'Cost-effective default for end-user copy generation.',
  },
  'gpt-5.5': {
    id: 'gpt-5.5',
    provider: 'openai',
    displayName: 'GPT-5.5',
    tier: 'flagship',
    capabilities: {
      text: true, vision: true, audio: false, video: false,
      maxInputTokens: 1_050_000, maxOutputTokens: 128_000,
      supportsJsonMode: true, supportsFunctionCalling: true,
      supportsCaching: true, supportsSystemPrompt: true,
    },
    pricePerMInput: 5.00, pricePerMOutput: 30.00,
    releasedAt: '2026-04-24',
    notes: 'Cached input $0.50/M. Surcharge 2x in / 1.5x out when input > 272k.',
  },
  'gpt-5.5-pro': {
    id: 'gpt-5.5-pro',
    provider: 'openai',
    displayName: 'GPT-5.5 Pro',
    tier: 'premium',
    capabilities: {
      text: true, vision: true, audio: false, video: false,
      maxInputTokens: 1_050_000, maxOutputTokens: 128_000,
      supportsJsonMode: true, supportsFunctionCalling: true,
      supportsCaching: true, supportsSystemPrompt: true,
    },
    pricePerMInput: 30.00, pricePerMOutput: 180.00,
    releasedAt: '2026-04-24',
    notes: 'Reserve for explicit "max quality" user toggle.',
  },
  'deepseek-v4-pro': {
    id: 'deepseek-v4-pro',
    provider: 'deepseek',
    displayName: 'DeepSeek V4 Pro',
    tier: 'flagship',
    capabilities: {
      text: true, vision: false, audio: false, video: false,
      maxInputTokens: 1_000_000, maxOutputTokens: 384_000,
      supportsJsonMode: true, supportsFunctionCalling: true,
      supportsCaching: true, supportsSystemPrompt: true,
    },
    pricePerMInput: 1.74, pricePerMOutput: 3.48,
    releasedAt: '2026-04-24',
    notes: 'List pricing (75% discount through 2026-05-31). Vision UNVERIFIED on official docs — keep false. Replaces deepseek-reasoner.',
  },
  'deepseek-v4-flash': {
    id: 'deepseek-v4-flash',
    provider: 'deepseek',
    displayName: 'DeepSeek V4 Flash',
    tier: 'fast',
    capabilities: {
      text: true, vision: false, audio: false, video: false,
      maxInputTokens: 1_000_000, maxOutputTokens: 32_768,
      supportsJsonMode: true, supportsFunctionCalling: true,
      supportsCaching: true, supportsSystemPrompt: true,
    },
    pricePerMInput: 0.14, pricePerMOutput: 0.28,
    releasedAt: '2026-04-24',
    notes: 'Replaces deepseek-chat which retires 2026-07-24 15:59 UTC.',
  },
}

export const MODELS_BY_PROVIDER: Record<AIProvider, ModelEntry[]> =
  Object.values(MODELS).reduce((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = []
    acc[m.provider].push(m)
    return acc
  }, {} as Record<AIProvider, ModelEntry[]>)

/**
 * Returns the canonical default model ID for a provider.
 * Picks first 'flagship' tier entry; falls back to first entry if no flagship.
 */
export function defaultModelFor(provider: AIProvider): string {
  const candidates = MODELS_BY_PROVIDER[provider] ?? []
  if (candidates.length === 0) {
    throw new Error(`No models registered for provider: ${provider}`)
  }
  const flagship = candidates.find((m) => m.tier === 'flagship')
  return (flagship ?? candidates[0]).id
}
