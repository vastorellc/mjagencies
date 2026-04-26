/**
 * packages/seo/src/stub-scorer.ts
 *
 * SEO scoring stub for content sprint validation (Phase 5).
 * Phase 6 replaces this with the real seo-classic + aio-citations + geo-chunking plugins.
 *
 * computeSeoScoreForContent() is called by the content sprint seed script to validate
 * that generated content meets minimum SEO requirements before Payload write.
 */

export interface SeoScoreInput {
  text: string
  metaTitle?: string
  metaDescription?: string
  aioTldr?: string
  focusKeyword?: string
}

export interface SeoScoreOutput {
  seoScore: number // 0-100 stub
  wordCount: number
  internalLinkCount: number
  hasAioTldr: boolean
  metaTitleLength: number
  metaDescriptionLength: number
  passesMinimum: boolean // true if wordCount >= floor
}

/**
 * Computes basic SEO metrics for content sprint validation.
 * Phase 6 replaces with real plugin engine.
 */
export function computeSeoScoreForContent(input: SeoScoreInput, wordCountFloor = 1500): SeoScoreOutput {
  const words = input.text.split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const internalLinkCount = (input.text.match(/href=['"]\/[^'"]+['"]/g) ?? []).length
  const hasAioTldr = !!input.aioTldr && input.aioTldr.length > 0 && input.aioTldr.length <= 120

  const baseScore = Math.min(
    100,
    Math.round((wordCount / wordCountFloor) * 60) +
      (internalLinkCount >= 3 ? 20 : internalLinkCount * 5) +
      (hasAioTldr ? 10 : 0) +
      (input.metaTitle ? 5 : 0) +
      (input.metaDescription ? 5 : 0),
  )

  return {
    seoScore: baseScore,
    wordCount,
    internalLinkCount,
    hasAioTldr,
    metaTitleLength: input.metaTitle?.length ?? 0,
    metaDescriptionLength: input.metaDescription?.length ?? 0,
    passesMinimum: wordCount >= wordCountFloor,
  }
}
