/**
 * packages/cms/src/hooks/anti-fab-validators.ts
 *
 * Phase 7 — anti-fabrication publish gates (REQ-082).
 * Throws on publish, warns on draft (matches Phase 5 content-validators.ts pattern).
 *
 * Validators:
 *   validateStatSources   — blocks publish when a stat has no nearby citation link
 *   validateQuoteSources  — blocks publish when a quote has no nearby attribution
 *   validateNoPlaceholders — blocks publish on placeholder text (CLAUDE.md §5)
 */
import type { CollectionBeforeOperationHook } from 'payload'

// ---------------------------------------------------------------------------
// Stat patterns (bare numbers, not ranges like "30-45%")
// ---------------------------------------------------------------------------

// Percentage: bare "42%" but NOT "30-45%" (negative lookbehind for range dash)
const STAT_PERCENT_PATTERN = /(?<!\d[-–])\b(\d{1,4}(?:\.\d+)?)\s*%(?!\s*[-–]\s*\d)/g

// Dollar amounts: $1,250 / $1.5M / $50 billion
const STAT_DOLLAR_PATTERN =
  /\$\s*\d{1,3}(?:[,.]\d{3})*(?:\.\d+)?(?:\s*(million|billion|m|bn|k))?/gi

// "73 percent" written out
const STAT_PERCENT_WORD_PATTERN = /\b\d+(?:\.\d+)?\s+percent\b/gi

// "N out of M"
const STAT_RATIO_PATTERN = /\b\d+\s+out\s+of\s+\d+\b/gi

const STAT_PATTERNS: RegExp[] = [
  STAT_PERCENT_PATTERN,
  STAT_DOLLAR_PATTERN,
  STAT_PERCENT_WORD_PATTERN,
  STAT_RATIO_PATTERN,
]

// ---------------------------------------------------------------------------
// Placeholder patterns (CLAUDE.md §5 CONTENT-COMPLETE rule)
// ---------------------------------------------------------------------------
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\[insert[^\]]*\]/i,
  /\[tbd\]/i,
  /\[todo\]/i,
  /\bcoming\s+soon\b/i,
  /\blorem\s+ipsum\b/i,
]

// ---------------------------------------------------------------------------
// Citation detection
// ---------------------------------------------------------------------------

// Stat citations: Markdown link [text](url), <a href=, or Lexical JSON "url":"https://..."
const STAT_CITATION_PATTERN = /\[[^\]]+\]\([^)]+\)|<a\s+href=|"url"\s*:\s*"https?:/i

// Quote attribution: broader — also recognises plain parenthetical "(Source Name Year)" or
// "said/by/attributed to Name", not just hyperlinks.
const QUOTE_ATTRIBUTION_PATTERN =
  /\[[^\]]+\]\([^)]+\)|<a\s+href=|"url"\s*:\s*"https?:|said\s+\w+|\((?:[A-Z][^)]{2,60})\)/i

const STAT_CITATION_WINDOW = 150
const QUOTE_CITATION_WINDOW = 200

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Flatten content to a plain string for regex scanning */
function flatten(content: unknown): string {
  if (!content) return ''
  return typeof content === 'string' ? content : JSON.stringify(content)
}

/** Check whether a citation/attribution appears within `window` chars of the given match */
function hasNearbyCitation(
  haystack: string,
  matchIdx: number,
  matchLen: number,
  window: number,
  pattern: RegExp = STAT_CITATION_PATTERN
): boolean {
  const start = Math.max(0, matchIdx - window)
  const end = Math.min(haystack.length, matchIdx + matchLen + window)
  const snippet = haystack.slice(start, end)
  return pattern.test(snippet)
}

// ---------------------------------------------------------------------------
// validateStatSources
// ---------------------------------------------------------------------------

/**
 * Validates that every numeric statistic (percentage, dollar amount, etc.) in
 * the content field has a citation link within 150 characters.
 *
 * Throws on publish if any unsourced stat is found; warns on draft.
 * Ranges like "30-45%" are excluded from stat detection (existing Phase 5 behavior).
 *
 * REQ-082.
 */
export const validateStatSources: CollectionBeforeOperationHook = async ({
  args,
  operation,
}) => {
  if (operation !== 'create' && operation !== 'update') return
  const data = args.data as Record<string, unknown> | undefined
  if (!data) return

  const isPublish = data['status'] === 'published'
  const haystack = flatten(data['content'] ?? data['body'])
  if (!haystack) return

  for (const pattern of STAT_PATTERNS) {
    pattern.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = pattern.exec(haystack)) !== null) {
      if (!hasNearbyCitation(haystack, m.index, m[0].length, STAT_CITATION_WINDOW, STAT_CITATION_PATTERN)) {
        const msg = `Unsourced statistic detected: "${m[0]}". Every stat needs a citation link within 150 chars (REQ-082).`
        if (isPublish) throw new Error(msg)
        console.warn(`[CMS] ${msg} (draft)`)
        return // warn once per draft to avoid noise
      }
    }
  }
}

// ---------------------------------------------------------------------------
// validateQuoteSources
// ---------------------------------------------------------------------------

/**
 * Validates that every quoted string (inline "..." or Lexical blockquote node)
 * has an attribution or citation link within 200 characters.
 *
 * Throws on publish if any unsourced quote found; warns on draft.
 *
 * REQ-082.
 */
export const validateQuoteSources: CollectionBeforeOperationHook = async ({
  args,
  operation,
}) => {
  if (operation !== 'create' && operation !== 'update') return
  const data = args.data as Record<string, unknown> | undefined
  if (!data) return

  const isPublish = data['status'] === 'published'
  const haystack = flatten(data['content'] ?? data['body'])
  if (!haystack) return

  // Quoted text: "..." with at least 6 chars inside (avoids single-word quotes)
  const quotedTextPattern = /"([^"]{6,})"/g

  // Lexical blockquote node marker
  const blockquotePattern = /"type"\s*:\s*"quote"/g

  let m: RegExpExecArray | null

  // Check inline quoted strings first
  quotedTextPattern.lastIndex = 0
  while ((m = quotedTextPattern.exec(haystack)) !== null) {
    if (!hasNearbyCitation(haystack, m.index, m[0].length, QUOTE_CITATION_WINDOW, QUOTE_ATTRIBUTION_PATTERN)) {
      const preview = m[0].length > 60 ? m[0].slice(0, 60) + '...' : m[0]
      const msg = `Unsourced quote detected: ${preview}. Quotes need attribution within 200 chars (REQ-082).`
      if (isPublish) throw new Error(msg)
      console.warn(`[CMS] ${msg} (draft)`)
      return // warn once per draft
    }
  }

  // Check Lexical blockquote nodes
  blockquotePattern.lastIndex = 0
  while ((m = blockquotePattern.exec(haystack)) !== null) {
    if (!hasNearbyCitation(haystack, m.index, m[0].length, QUOTE_CITATION_WINDOW, QUOTE_ATTRIBUTION_PATTERN)) {
      const msg = `Unsourced blockquote node — needs attribution within 200 chars (REQ-082).`
      if (isPublish) throw new Error(msg)
      console.warn(`[CMS] ${msg} (draft)`)
      return
    }
  }
}

// ---------------------------------------------------------------------------
// validateNoPlaceholders
// ---------------------------------------------------------------------------

/**
 * Validates that content contains no placeholder text per CLAUDE.md §5
 * CONTENT-COMPLETE rule. Checks for [insert], [TBD], [TODO], "coming soon",
 * and "lorem ipsum" (all case-insensitive).
 *
 * Throws on publish if any placeholder detected; warns on draft.
 *
 * REQ-082.
 */
export const validateNoPlaceholders: CollectionBeforeOperationHook = async ({
  args,
  operation,
}) => {
  if (operation !== 'create' && operation !== 'update') return
  const data = args.data as Record<string, unknown> | undefined
  if (!data) return

  const isPublish = data['status'] === 'published'
  const haystack = flatten(data['content'] ?? data['body'])
  if (!haystack) return

  for (const pattern of PLACEHOLDER_PATTERNS) {
    const m = pattern.exec(haystack)
    if (m) {
      const msg = `Placeholder text detected: "${m[0]}". CLAUDE.md §5: NEVER ship placeholders (REQ-082).`
      if (isPublish) throw new Error(msg)
      console.warn(`[CMS] ${msg} (draft)`)
      return // warn once per draft
    }
  }
}
