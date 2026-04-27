/**
 * packages/ai/src/model-routing.ts
 *
 * AI model routing table for Phase 7 features (REQ-080).
 *
 * Tiers:
 *   tier1-bulk     — bulk content generation (default for editor features)
 *   tier2-writing  — high-quality writing with Claude
 *   tier2-research — research and analysis with Gemini Pro
 *   tier3-max      — maximum quality, Claude Opus
 *
 * Default tier when undefined → 'tier1-bulk' (gemini-2.5-flash-lite)
 */

export type ModelTier = 'tier1-bulk' | 'tier2-writing' | 'tier2-research' | 'tier3-max'

/**
 * Model routing table: each tier maps to an ordered array of model names.
 * First entry is the primary model; subsequent entries are fallbacks.
 */
export const MODEL_ROUTING: Record<ModelTier, readonly string[]> = {
  'tier1-bulk': ['gemini-2.5-flash-lite', 'gpt-4.1-nano'],
  'tier2-writing': ['claude-sonnet-4-6'],
  'tier2-research': ['gemini-2.5-pro'],
  'tier3-max': ['claude-opus-4-6'],
} as const

/**
 * Returns the primary model string for the given tier.
 * Defaults to 'tier1-bulk' when tier is undefined.
 */
export function getModelForTier(tier?: ModelTier): string {
  const t = tier ?? 'tier1-bulk'
  return MODEL_ROUTING[t][0] ?? 'gemini-2.5-flash-lite'
}
