/**
 * packages/cms/src/dam/search.ts
 *
 * DAM asset search implementation (REQ-061).
 *
 * Supported search modes:
 *   text    — filename, alt text, caption, tags (Payload query)
 *   color   — dominant color match via LAB delta-E approximation (stored dominant_color field)
 *   semantic — embedding-based similarity (STUB in Phase 5; Phase 7 wires pgvector)
 *
 * Note: text search uses Payload's built-in query API (no Meilisearch in Phase 5).
 * Full Meilisearch integration is scoped to Phase 8 (search infrastructure).
 */
import type { Payload } from 'payload'

export interface DamSearchParams {
  /** Agency ID to scope search (required for non-super_admin views) */
  agencyId?: string
  /** Text query — matches filename, alt text, caption, tags */
  text?: string
  /** Dominant color hex to match (LAB delta-E ≤25 = match) */
  colorHex?: string
  /** Semantic query string (stub — returns empty in Phase 5) */
  semantic?: string
  /** Pagination */
  page?: number
  limit?: number
}

export interface DamSearchResult {
  docs: Array<{
    id: string
    alt: string
    caption?: string
    tags?: string[]
    dominant_color?: string
    swatches?: string[]
    blur_hash?: string
    agency_id: string
    mimeType?: string
    url?: string
  }>
  totalDocs: number
  totalPages: number
}

/**
 * Compute approximate color distance between two hex colors.
 * Uses Euclidean RGB distance as a proxy for LAB delta-E.
 * Returns true if distance ≤64 (≈ LAB delta-E ≤25 for typical images).
 *
 * Security note (T-05-05-05): non-hex input produces NaN distance via parseInt,
 * which is always > 64, so no matches are returned — safe by default.
 */
function colorMatchesHex(storedHex: string, targetHex: string): boolean {
  const parseHex = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '')
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ]
  }
  const [r1, g1, b1] = parseHex(storedHex)
  const [r2, g2, b2] = parseHex(targetHex)
  // Simplified Euclidean RGB distance (Phase 12 QA replaces with real LAB delta-E)
  const distance = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
  // RGB Euclidean ≤64 ≈ LAB delta-E ≤25 for typical images
  return distance <= 64
}

/**
 * Searches DAM assets using the provided params.
 * Requires a Payload instance (call from server context only).
 */
export async function searchDamAssets(
  payload: Payload,
  params: DamSearchParams
): Promise<DamSearchResult> {
  const { agencyId, text, colorHex, semantic, page = 1, limit = 20 } = params

  // Semantic search stub: Phase 7 wires real pgvector similarity search
  if (semantic && !text && !colorHex) {
    console.info('[DAM] Semantic search stub — returning empty results in Phase 5')
    return { docs: [], totalDocs: 0, totalPages: 0 }
  }

  // Build Payload where clause
  const where: Record<string, unknown> = {}
  if (agencyId) {
    where['agency_id'] = { equals: agencyId }
  }
  if (text) {
    where['or'] = [
      { alt: { like: text } },
      { caption: { like: text } },
      { tags: { contains: text } },
    ]
  }

  const result = await payload.find({
    collection: 'media_assets',
    where,
    page,
    limit,
    sort: '-updatedAt',
  })

  // Post-filter by color if colorHex provided
  let docs = result.docs as DamSearchResult['docs']
  if (colorHex) {
    docs = docs.filter(
      (doc) => doc.dominant_color != null && colorMatchesHex(doc.dominant_color, colorHex)
    )
  }

  return {
    docs,
    totalDocs: colorHex ? docs.length : result.totalDocs,
    totalPages: colorHex ? Math.ceil(docs.length / limit) : result.totalPages,
  }
}
