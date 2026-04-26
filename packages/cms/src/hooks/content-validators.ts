/**
 * packages/cms/src/hooks/content-validators.ts
 *
 * Payload beforeOperation hooks implementing all publish-gate validators.
 * Validators throw Error to block publish; they warn (console.warn) at draft.
 *
 * REQ-201: word count floors  (blog 1500+, service 1500+, tool 2200+)
 * REQ-203: internal links >=3 per article
 * REQ-205/REQ-411: playbook numbers must be ranges, no exact figures
 * REQ-207/REQ-410: FTC disclaimer required on composite playbook pages
 * REQ-421: FTC testimonial disclaimer required on testimonial blocks
 * REQ-412: is_composite_playbook validation on flip to true
 */
import type { CollectionBeforeOperationHook } from 'payload'

// FTC disclaimer exact text (REQ-207, REQ-410, CONTEXT.md specifics)
export const FTC_DISCLAIMER_TEXT =
  'Results not typical. Individual results may vary based on market conditions, industry, and individual effort.'

// FTC testimonial disclaimer exact text (REQ-421)
export const FTC_TESTIMONIAL_DISCLAIMER =
  'Individual results may vary. Testimonials are not necessarily representative of all users.'

// Word count floors by page type (specs/cms.md CONTENT VALIDATORS)
const WORD_COUNT_FLOORS: Record<string, number> = {
  blog: 1500,
  service: 1500,
  tool: 2200,
  cornerstone: 3000,
  faq: 100,
  legal: 1500,
}

/** Extract plain-text word count from Lexical JSON (approximate) */
function countWords(lexicalJson: unknown): number {
  if (!lexicalJson) return 0
  const text = JSON.stringify(lexicalJson).replace(/"type":"[^"]+"/g, '')
  const words = text.match(/\b\w{2,}\b/g) ?? []
  return words.length
}

/** Extract internal link count from Lexical JSON or HTML content */
function countInternalLinks(lexicalJson: unknown, siteUrl = ''): number {
  if (!lexicalJson) return 0
  const str = typeof lexicalJson === 'string' ? lexicalJson : JSON.stringify(lexicalJson)
  // Match href values that are relative (start with /) or match site domain
  const relativeLinks = (str.match(/"url"\s*:\s*"\/[^"]+"/g) ?? []).length
  const hrefRelative = (str.match(/href="\/[^"]+"/g) ?? []).length
  const domainLinks = siteUrl
    ? (str.match(new RegExp(`"url"\\s*:\\s*"https?://${siteUrl.replace(/\./g, '\\.')}[^"]*"`, 'g')) ?? []).length
    : 0
  return relativeLinks + hrefRelative + domainLinks
}

/** Detect exact numeric figures (not ranges like "30-45%") in text */
function hasExactFigures(text: string): boolean {
  // Ranges like "30-45%" or "30 to 45%" are allowed; lone exact percentages like "42%" are not
  const exactFigurePattern = /\b(\d{1,3}(?:\.\d+)?)\s*%(?!\s*[-–]\s*\d)/g
  return exactFigurePattern.test(text)
}

/**
 * Validates word count floor for publish operations.
 * Throws on publish if below floor; warns on draft.
 */
export const validateWordCount: CollectionBeforeOperationHook = async ({ args, operation }) => {
  if (operation !== 'create' && operation !== 'update') return
  const data = args.data as Record<string, unknown> | undefined
  if (!data) return

  const isPublish = data['status'] === 'published'
  const pageType = (data['page_type'] as string | undefined) ?? 'blog'
  const floor = WORD_COUNT_FLOORS[pageType] ?? 1500

  const content = data['content'] ?? data['body']
  const wordCount = countWords(content)

  if (wordCount < floor) {
    if (isPublish) {
      throw new Error(
        `Word count ${wordCount} is below the required minimum of ${floor} for ${pageType} pages (REQ-201).`
      )
    } else {
      console.warn(`[CMS] Word count warning: ${wordCount}/${floor} words for ${pageType} page (draft).`)
    }
  }
}

/**
 * Validates minimum 3 internal links on publish (REQ-203).
 */
export const validateInternalLinks: CollectionBeforeOperationHook = async ({ args, operation }) => {
  if (operation !== 'create' && operation !== 'update') return
  const data = args.data as Record<string, unknown> | undefined
  if (!data) return

  const isPublish = data['status'] === 'published'
  const content = data['content'] ?? data['body']
  const linkCount = countInternalLinks(content)

  if (linkCount < 3) {
    if (isPublish) {
      throw new Error(
        `Internal link count ${linkCount} is below required minimum of 3 (REQ-203). Add more internal links before publishing.`
      )
    } else {
      console.warn(`[CMS] Internal link warning: ${linkCount}/3 internal links (draft).`)
    }
  }
}

/**
 * Validates that playbook numbers are ranges, not exact figures (REQ-205, REQ-411).
 * Only enforced on composite playbook pages at publish.
 */
export const validatePlaybookNumbers: CollectionBeforeOperationHook = async ({ args, operation }) => {
  if (operation !== 'create' && operation !== 'update') return
  const data = args.data as Record<string, unknown> | undefined
  if (!data) return

  // Only enforce on composite playbook pages
  if (!data['is_composite_playbook']) return
  if (data['status'] !== 'published') return

  const contentStr = JSON.stringify(data['content'] ?? data['body'] ?? '')
  if (hasExactFigures(contentStr)) {
    throw new Error(
      'Playbook content contains exact percentage figures. Use ranges (e.g. "30-45%") instead of exact figures (REQ-205, REQ-411).'
    )
  }
}

/**
 * Validates FTC disclaimer presence on composite playbook pages (REQ-207, REQ-410, REQ-412).
 * Fires when is_composite_playbook is true and status transitions to published.
 */
export const validateFtcDisclaimer: CollectionBeforeOperationHook = async ({ args, operation }) => {
  if (operation !== 'create' && operation !== 'update') return
  const data = args.data as Record<string, unknown> | undefined
  if (!data) return

  if (!data['is_composite_playbook']) return
  if (data['status'] !== 'published') return

  const contentStr = JSON.stringify(data['content'] ?? data['body'] ?? '')
  if (!contentStr.includes('Results not typical')) {
    throw new Error(
      `Composite playbook pages require the FTC disclaimer: "${FTC_DISCLAIMER_TEXT}" (REQ-207, REQ-410).`
    )
  }
}

/**
 * Validates FTC testimonial disclaimer on testimonials blocks (REQ-421).
 */
export const validateFtcTestimonial: CollectionBeforeOperationHook = async ({ args, operation }) => {
  if (operation !== 'create' && operation !== 'update') return
  const data = args.data as Record<string, unknown> | undefined
  if (!data) return

  if (data['status'] !== 'published') return

  const contentStr = JSON.stringify(data['content'] ?? data['blocks'] ?? '')
  const hasTestimonialBlock =
    contentStr.includes('testimonials-grid') ||
    contentStr.includes('testimonials-slider') ||
    (data['hasTestimonials'] === true)

  if (!hasTestimonialBlock) return

  if (!contentStr.includes('Individual results may vary')) {
    throw new Error(
      `Pages with testimonial blocks require the FTC testimonial disclaimer: "${FTC_TESTIMONIAL_DISCLAIMER}" (REQ-421).`
    )
  }
}
