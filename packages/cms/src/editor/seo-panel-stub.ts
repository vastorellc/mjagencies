/**
 * packages/cms/src/editor/seo-panel-stub.ts
 *
 * SEO/AIO/GEO scoring stubs for Phase 5 (REQ-055).
 * Phase 5: returns mock scores from 0-100.
 * Phase 6: replaces these with the real plugin engine.
 *
 * SeoScores is the shape used by SeoPanel.tsx in apps/web-main/admin/components.
 */

export interface SeoScores {
  /** Overall SEO score 0-100 */
  seo: number
  /** AIO (AI Mode citation readiness) score 0-100 */
  aio: number
  /** GEO (Generative Engine Optimization) score 0-100 */
  geo: number
  /** Meta title character count (warn if >60) */
  metaTitleLength: number
  /** Meta description character count (warn if >160) */
  metaDescriptionLength: number
  /** AIO TL;DR character count (required, warn if >120 or missing) */
  tldrLength: number
  /** Focus keyword density 0-1 */
  keywordDensity: number
  /** Number of headings found (h1-h6) */
  headingCount: number
  /** Number of internal links found */
  internalLinkCount: number
  /** Image alt coverage 0-1 */
  altCoverage: number
  /** Total word count */
  wordCount: number
  /** Estimated AI content ratio 0-1 */
  aiContentRatio: number
  /** Estimated originality score 0-1 */
  originalityScore: number
}

/**
 * Stub implementation — returns deterministic mock scores based on content length.
 * Phase 6 replaces this with the real SEO plugin engine.
 *
 * @param content - Lexical JSON string or plain text
 * @param meta - Optional meta fields for scoring
 */
export function computeSeoScore(
  content: string,
  meta?: {
    metaTitle?: string
    metaDescription?: string
    aioTldr?: string
    focusKeyword?: string
  }
): SeoScores {
  // Stub: derive rough scores from content length to show plausible UI
  const wordCount = content.split(/\s+/).filter(Boolean).length
  const baseScore = Math.min(100, Math.round((wordCount / 1500) * 70) + 10)

  return {
    seo: baseScore,
    aio: Math.max(0, baseScore - 10),
    geo: Math.max(0, baseScore - 15),
    metaTitleLength: meta?.metaTitle?.length ?? 0,
    metaDescriptionLength: meta?.metaDescription?.length ?? 0,
    tldrLength: meta?.aioTldr?.length ?? 0,
    keywordDensity: 0.015, // 1.5% stub
    headingCount: (content.match(/"type":"heading"/g) ?? []).length,
    internalLinkCount: (content.match(/"type":"link".*?"\/[^"]+"/g) ?? []).length,
    altCoverage: 0.8, // 80% stub
    wordCount,
    aiContentRatio: 0, // Phase 7 computes real ratio
    originalityScore: 0.9, // Phase 7 computes real score
  }
}
