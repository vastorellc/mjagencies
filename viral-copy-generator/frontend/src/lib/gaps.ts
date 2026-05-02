import type { ChecklistItem, ChecklistCategory } from './types'

// D-19: Group order for gap analysis output.
// Metadata Quality is intentionally absent — those items are always 'pending'
// (Phase 5 fills them when AI copy is generated).
const GAP_GROUP_ORDER: ChecklistCategory[] = [
  'video-technical',
  'virality-boosters',
  'niche-pakistan',
]

/**
 * buildGapAnalysis (SCORE-07, D-19)
 *
 * Filters a checklist to the rule-based gap-analysis list:
 * - Only items with status === 'fail' surface.
 * - Items with empty `fix` are skipped (info-only rows).
 * - Items in the 'metadata-quality' category are never surfaced (always 'pending').
 * - Output preserves insertion order within each category, with categories
 *   emitted in this order: video-technical -> virality-boosters -> niche-pakistan.
 *
 * Returns the already-interpolated `fix` strings; UI renders them as a
 * numbered list. Zero AI calls.
 */
export function buildGapAnalysis(checklist: ChecklistItem[]): string[] {
  // Index by category, preserve insertion order within each category.
  const byCat = new Map<ChecklistCategory, string[]>()
  for (const cat of GAP_GROUP_ORDER) byCat.set(cat, [])

  for (const item of checklist) {
    if (item.status !== 'fail') continue
    if (!item.fix) continue
    const bucket = byCat.get(item.category)
    if (!bucket) continue // metadata-quality items skipped (not in GAP_GROUP_ORDER)
    bucket.push(item.fix)
  }

  const out: string[] = []
  for (const cat of GAP_GROUP_ORDER) {
    const bucket = byCat.get(cat)
    if (bucket) out.push(...bucket)
  }
  return out
}
