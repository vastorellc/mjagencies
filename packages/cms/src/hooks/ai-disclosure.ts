/**
 * packages/cms/src/hooks/ai-disclosure.ts
 *
 * Phase 7 — AI content ratio compute + disclosure flag (REQ-086, REQ-409).
 * Sets data.ai_content_ratio (0..1) and data.ai_disclosure_required (boolean).
 *
 * Dynamic denominator: counts only populated tracked fields present in the
 * document (not a fixed constant). This prevents inflation of the ratio when
 * optional fields are absent.
 *
 * Threshold: ratio > 0.70 triggers disclosure flag.
 */
import type { CollectionBeforeOperationHook } from 'payload'

/** Threshold above which AI disclosure is required (REQ-086). */
export const AI_DISCLOSURE_THRESHOLD = 0.70

/** Tracked fields whose AI-generation status counts toward the ratio. */
const TRACKED_FIELDS = ['title', 'content', 'meta_description', 'aio_tldr'] as const

/**
 * Computes the AI content ratio for a document and sets:
 *   - `data.ai_content_ratio`       — number 0..1 (rounded to 3 decimal places)
 *   - `data.ai_disclosure_required` — boolean; true when ratio > AI_DISCLOSURE_THRESHOLD
 *
 * Reads `data.ai_generated_fields` (string[]) set by the AI editor actions.
 *
 * REQ-086, REQ-409.
 */
export const computeAiContentRatio: CollectionBeforeOperationHook = async ({
  args,
  operation,
}) => {
  if (operation !== 'create' && operation !== 'update') return
  const data = args.data as Record<string, unknown> | undefined
  if (!data) return

  const aiGeneratedFields = (data['ai_generated_fields'] as string[] | undefined) ?? []

  // Dynamic denominator: count only tracked fields that are present and non-empty
  const populatedTracked = TRACKED_FIELDS.filter((f) => {
    const val = (data as Record<string, unknown>)[f]
    return val != null && String(val).trim() !== ''
  }).length

  // Count how many of the populated tracked fields are AI-generated
  const aiCount = TRACKED_FIELDS.filter((f) => aiGeneratedFields.includes(f)).length

  // Guard against zero denominator — treat absent content as denominator of 1
  const ratio = aiCount / Math.max(populatedTracked, 1)

  data['ai_content_ratio'] = Number(Math.min(1, Math.max(0, ratio)).toFixed(3))
  data['ai_disclosure_required'] = ratio > AI_DISCLOSURE_THRESHOLD
}
