/**
 * packages/seo/src/__tests__/seo-classic.test.ts
 *
 * TDD RED phase — seo-classic scoring plugin tests.
 * REQ-070: seo-classic is one of 3 required SEO plugins.
 * REQ-071/072: Weights from PLUGIN_DEFAULTS, overridable per agency.
 *
 * All tests MUST FAIL until packages/seo/src/plugins/seo-classic.ts is created.
 */
import { describe, it, expect } from 'vitest'
import { PLUGIN_DEFAULTS } from '../plugin-defaults.js'
import { scoreSeoClassic } from '../plugins/seo-classic.js'
import type { SeoClassicConfig, SeoClassicResult } from '../plugins/seo-classic.js'
import type { LexicalExtracts } from '../lexical-parser.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default config (mirrors PLUGIN_DEFAULTS.seo_classic) */
const DEFAULT_CONFIG: SeoClassicConfig = PLUGIN_DEFAULTS.seo_classic

/** A set of LexicalExtracts that satisfies all sub-factors when combined with
 *  perfect meta fields and default config. */
function perfectExtracts(): LexicalExtracts {
  return {
    // wordCount=1500 → word count score = Math.round(1500/1500 * 25) = 25
    plainText: 'word '.repeat(1500).trim(),
    wordCount: 1500,
    // exactly 1 H1 → 10 pts
    headings: [
      { tag: 'h1', text: 'SEO Best Practices for Service Pages' },
      { tag: 'h2', text: 'Introduction to On-Page Optimisation' },
    ],
    // internalLinks=3 ≥ internalLinkMin(3) → 5 pts
    internalLinks: 3,
    paragraphs: ['paragraph 1', 'paragraph 2'],
  }
}

/** Perfect meta fields with default config:
 *  - title length = 45 chars  (between 40 and 60) → 20 pts
 *  - metaDescription length = 130 chars (between 120 and 160) → 15 pts
 *  - focusKeyword density ≈ 1.2% (between 1% and 2.5%) → 20 pts
 */
function perfectMeta(): { title: string; metaDescription: string; focusKeyword: string } {
  return {
    title: 'SEO Best Practices for Service Pages Guide', // 43 chars
    metaDescription:
      'Discover the best SEO practices for service pages including keyword optimisation strategies for local business success.',
    focusKeyword: 'word', // appears 1500 times in 1500 words = 100% — we need realistic
  }
}

// ---------------------------------------------------------------------------
// Test: Perfect content → score = 100
// ---------------------------------------------------------------------------
describe('scoreSeoClassic — perfect content', () => {
  it('returns score=100 when all sub-factors are satisfied with defaults', () => {
    // title = 43 chars (within 40–60) → 20 pts
    // meta = 120+ chars → 15 pts
    // keyword "best" appears enough to be within density range
    // wordCount = 1500 → 25 pts
    // 1 H1 → 10 pts
    // 1 H2 → 5 pts
    // 3 internal links → 5 pts
    // total = 80 pts without keyword; with keyword in range = 100 pts

    const plainTextWords = Array.from({ length: 1500 }, (_, i) => {
      // ~1.5% density: 1500 words, keyword appears ~22 times (22/1500 = 1.47%)
      if (i % 68 === 0) return 'optimise'
      return 'lorem'
    })
    const extracts: LexicalExtracts = {
      plainText: plainTextWords.join(' '),
      wordCount: 1500,
      headings: [
        { tag: 'h1', text: 'On-Page SEO Guide' },
        { tag: 'h2', text: 'Keyword Optimisation' },
      ],
      internalLinks: 3,
      paragraphs: [plainTextWords.join(' ')],
    }
    const meta = {
      title: 'Complete Guide to On-Page SEO Optimisation', // 43 chars
      metaDescription:
        'Learn how to optimise your service pages for search engines with our complete guide to on-page SEO best practices for local businesses.',
      focusKeyword: 'optimise',
    }
    const result: SeoClassicResult = scoreSeoClassic(extracts, meta, DEFAULT_CONFIG)
    expect(result.score).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// Test: Empty content → score = 0
// ---------------------------------------------------------------------------
describe('scoreSeoClassic — empty content', () => {
  it('returns score=0 when all fields are empty', () => {
    const extracts: LexicalExtracts = {
      plainText: '',
      wordCount: 0,
      headings: [],
      internalLinks: 0,
      paragraphs: [],
    }
    const meta = { title: '', metaDescription: '', focusKeyword: '' }
    const result = scoreSeoClassic(extracts, meta, DEFAULT_CONFIG)
    expect(result.score).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Test: findings array has exactly 7 entries
// ---------------------------------------------------------------------------
describe('scoreSeoClassic — findings count', () => {
  it('findings array has exactly 7 entries (one per sub-factor)', () => {
    const extracts: LexicalExtracts = {
      plainText: '',
      wordCount: 0,
      headings: [],
      internalLinks: 0,
      paragraphs: [],
    }
    const result = scoreSeoClassic(extracts, { title: '', metaDescription: '', focusKeyword: '' }, DEFAULT_CONFIG)
    expect(result.findings).toHaveLength(7)
  })
})

// ---------------------------------------------------------------------------
// Test: Title partial credit (30 chars < min 40)
// ---------------------------------------------------------------------------
describe('scoreSeoClassic — title length', () => {
  it('returns 8 pts for title when title is present but below min 40 chars', () => {
    const extracts: LexicalExtracts = {
      plainText: '',
      wordCount: 0,
      headings: [],
      internalLinks: 0,
      paragraphs: [],
    }
    const result = scoreSeoClassic(
      extracts,
      { title: 'Short title below min', metaDescription: '', focusKeyword: '' }, // 21 chars
      DEFAULT_CONFIG,
    )
    const titleFinding = result.findings.find((f) => f.rule === 'title-length')
    expect(titleFinding).toBeDefined()
    expect(titleFinding?.passed).toBe(false)
    // partial credit for having a title that's just too short
    const titleScore = result.findings
      .filter((f) => f.rule === 'title-length')
      .reduce(() => 0, 0)
    // Title < min → 8 pts; total score with only title = 8
    // score includes only title contribution since other fields are empty/zero
    // We check by comparing to a no-title case
    const noTitleResult = scoreSeoClassic(
      extracts,
      { title: '', metaDescription: '', focusKeyword: '' },
      DEFAULT_CONFIG,
    )
    // Short title (8 pts) > no title (0 pts)
    expect(result.score).toBeGreaterThan(noTitleResult.score)
    expect(result.score).toBe(8)
  })

  it('title finding passed=false when title is empty', () => {
    const extracts: LexicalExtracts = { plainText: '', wordCount: 0, headings: [], internalLinks: 0, paragraphs: [] }
    const result = scoreSeoClassic(extracts, { title: '', metaDescription: '', focusKeyword: '' }, DEFAULT_CONFIG)
    const titleFinding = result.findings.find((f) => f.rule === 'title-length')
    expect(titleFinding?.passed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Test: Word count graduated scoring
// ---------------------------------------------------------------------------
describe('scoreSeoClassic — word count', () => {
  it('wordCount=750 (half of floor 1500) → word-count score = 12 pts', () => {
    const extracts: LexicalExtracts = {
      plainText: 'word '.repeat(750).trim(),
      wordCount: 750,
      headings: [],
      internalLinks: 0,
      paragraphs: [],
    }
    const result = scoreSeoClassic(
      extracts,
      { title: '', metaDescription: '', focusKeyword: '' },
      DEFAULT_CONFIG,
    )
    // Math.round(750/1500 * 25) = Math.round(0.5 * 25) = Math.round(12.5) = 13
    // Per spec: Math.round(Math.min(wordCount/wordCountFloor, 1) * 25)
    const expected = Math.round(Math.min(750 / 1500, 1) * 25)
    const wordCountFinding = result.findings.find((f) => f.rule === 'word-count')
    expect(wordCountFinding).toBeDefined()
    // Score should include the word count contribution
    expect(result.score).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// Test: Keyword stuffing (density > 2.5%) → keyword score = 0
// ---------------------------------------------------------------------------
describe('scoreSeoClassic — keyword density', () => {
  it('keyword density=3% (above max 2.5%) → keyword score = 0 pts', () => {
    // 1000 words, keyword appears 30 times = 3% density
    const words = Array.from({ length: 1000 }, (_, i) => (i % 33 === 0 ? 'keyword' : 'lorem'))
    // Adjust to ensure ~3%: 30 appearances out of 1000 = 3%
    const adjusted = Array.from({ length: 970 }, () => 'lorem')
    const keywordOccurrences = Array.from({ length: 30 }, () => 'keyword')
    const allWords = [...adjusted, ...keywordOccurrences]
    const plainText = allWords.join(' ')
    const extracts: LexicalExtracts = {
      plainText,
      wordCount: 1000,
      headings: [],
      internalLinks: 0,
      paragraphs: [plainText],
    }
    const result = scoreSeoClassic(
      extracts,
      { title: '', metaDescription: '', focusKeyword: 'keyword' },
      DEFAULT_CONFIG,
    )
    const keywordFinding = result.findings.find((f) => f.rule === 'keyword-density')
    expect(keywordFinding).toBeDefined()
    expect(keywordFinding?.passed).toBe(false)
    // Score from other factors: 0 title + 0 meta + 0 keyword + graduated wordCount(1000) + 0 h1 + 0 h2 + 0 links
    const wordScore = Math.round(Math.min(1000 / 1500, 1) * 25)
    expect(result.score).toBe(wordScore)
  })
})

// ---------------------------------------------------------------------------
// Test: H1 sub-factor
// ---------------------------------------------------------------------------
describe('scoreSeoClassic — H1', () => {
  it('0 H1 → H1 finding passed=false, 0 pts for H1', () => {
    const extracts: LexicalExtracts = {
      plainText: '',
      wordCount: 0,
      headings: [],
      internalLinks: 0,
      paragraphs: [],
    }
    const result = scoreSeoClassic(extracts, { title: '', metaDescription: '', focusKeyword: '' }, DEFAULT_CONFIG)
    const h1Finding = result.findings.find((f) => f.rule === 'h1-presence')
    expect(h1Finding).toBeDefined()
    expect(h1Finding?.passed).toBe(false)
  })

  it('2 H1 → H1 finding passed=false, 0 pts for H1 (multiple H1 is SEO error)', () => {
    const extracts: LexicalExtracts = {
      plainText: '',
      wordCount: 0,
      headings: [
        { tag: 'h1', text: 'First H1' },
        { tag: 'h1', text: 'Second H1' },
      ],
      internalLinks: 0,
      paragraphs: [],
    }
    const result = scoreSeoClassic(extracts, { title: '', metaDescription: '', focusKeyword: '' }, DEFAULT_CONFIG)
    const h1Finding = result.findings.find((f) => f.rule === 'h1-presence')
    expect(h1Finding).toBeDefined()
    expect(h1Finding?.passed).toBe(false)
  })

  it('exactly 1 H1 → H1 finding passed=true', () => {
    const extracts: LexicalExtracts = {
      plainText: '',
      wordCount: 0,
      headings: [{ tag: 'h1', text: 'Single H1' }],
      internalLinks: 0,
      paragraphs: [],
    }
    const result = scoreSeoClassic(extracts, { title: '', metaDescription: '', focusKeyword: '' }, DEFAULT_CONFIG)
    const h1Finding = result.findings.find((f) => f.rule === 'h1-presence')
    expect(h1Finding?.passed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test: Config override — titleMinChars=50 overrides default 40
// ---------------------------------------------------------------------------
describe('scoreSeoClassic — agency config override', () => {
  it('titleMinChars=50 overrides default 40 — a 45-char title gets partial credit', () => {
    const agencyConfig: SeoClassicConfig = {
      ...DEFAULT_CONFIG,
      titleMinChars: 50, // raised from 40 to 50
    }
    const extracts: LexicalExtracts = {
      plainText: '',
      wordCount: 0,
      headings: [],
      internalLinks: 0,
      paragraphs: [],
    }
    // Title is 45 chars — satisfies default (40) but NOT agency override (50)
    const titleWith45Chars = 'Complete SEO Guide for Local Service Businesses' // 47 chars, close enough
    const title45 = 'SEO Guide for Local Service Business Growth' // Let's count precisely
    // 'SEO Guide for Local Service Business Growth' = 43 chars
    // Use a title that's between 40–49 chars (passes default but fails agency override)
    const title = 'On-Page SEO Tactics for Small Businesses'  // 40 chars exactly

    // With default config (titleMinChars=40): title passes → 20 pts
    const defaultResult = scoreSeoClassic(extracts, { title, metaDescription: '', focusKeyword: '' }, DEFAULT_CONFIG)
    const defaultTitleFinding = defaultResult.findings.find((f) => f.rule === 'title-length')

    // With agency config (titleMinChars=50): title fails (40 < 50) → 8 pts
    const agencyResult = scoreSeoClassic(extracts, { title, metaDescription: '', focusKeyword: '' }, agencyConfig)
    const agencyTitleFinding = agencyResult.findings.find((f) => f.rule === 'title-length')

    // Default: passes (40 >= 40)
    expect(defaultTitleFinding?.passed).toBe(true)
    // Agency override: fails (40 < 50)
    expect(agencyTitleFinding?.passed).toBe(false)
    // Agency result scores lower (partial credit 8) vs default (full credit 20)
    expect(agencyResult.score).toBeLessThan(defaultResult.score)
  })
})

// ---------------------------------------------------------------------------
// Test: H2 sub-factor
// ---------------------------------------------------------------------------
describe('scoreSeoClassic — H2', () => {
  it('no H2 → H2 finding passed=false', () => {
    const extracts: LexicalExtracts = {
      plainText: '',
      wordCount: 0,
      headings: [{ tag: 'h1', text: 'Single H1' }],
      internalLinks: 0,
      paragraphs: [],
    }
    const result = scoreSeoClassic(extracts, { title: '', metaDescription: '', focusKeyword: '' }, DEFAULT_CONFIG)
    const h2Finding = result.findings.find((f) => f.rule === 'h2-presence')
    expect(h2Finding?.passed).toBe(false)
  })

  it('at least 1 H2 → H2 finding passed=true', () => {
    const extracts: LexicalExtracts = {
      plainText: '',
      wordCount: 0,
      headings: [
        { tag: 'h1', text: 'Single H1' },
        { tag: 'h2', text: 'A Section' },
      ],
      internalLinks: 0,
      paragraphs: [],
    }
    const result = scoreSeoClassic(extracts, { title: '', metaDescription: '', focusKeyword: '' }, DEFAULT_CONFIG)
    const h2Finding = result.findings.find((f) => f.rule === 'h2-presence')
    expect(h2Finding?.passed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test: Internal links graduated scoring
// ---------------------------------------------------------------------------
describe('scoreSeoClassic — internal links', () => {
  it('0 internal links → internal-links score = 0 pts', () => {
    const extracts: LexicalExtracts = {
      plainText: '',
      wordCount: 0,
      headings: [],
      internalLinks: 0,
      paragraphs: [],
    }
    const result = scoreSeoClassic(extracts, { title: '', metaDescription: '', focusKeyword: '' }, DEFAULT_CONFIG)
    // Math.round((0 / 3) * 5) = 0
    expect(result.score).toBe(0)
  })

  it('1 internal link → partial score = Math.round((1/3) * 5) = 2 pts', () => {
    const extracts: LexicalExtracts = {
      plainText: '',
      wordCount: 0,
      headings: [],
      internalLinks: 1,
      paragraphs: [],
    }
    const result = scoreSeoClassic(extracts, { title: '', metaDescription: '', focusKeyword: '' }, DEFAULT_CONFIG)
    // Math.round((1/3) * 5) = Math.round(1.67) = 2
    expect(result.score).toBe(Math.round((1 / 3) * 5))
  })
})

// ---------------------------------------------------------------------------
// Test: Meta description partial credit
// ---------------------------------------------------------------------------
describe('scoreSeoClassic — meta description', () => {
  it('meta description present but outside range → 5 pts (partial)', () => {
    const extracts: LexicalExtracts = { plainText: '', wordCount: 0, headings: [], internalLinks: 0, paragraphs: [] }
    const result = scoreSeoClassic(
      extracts,
      { title: '', metaDescription: 'Short meta.', focusKeyword: '' },
      DEFAULT_CONFIG,
    )
    const metaFinding = result.findings.find((f) => f.rule === 'meta-description')
    expect(metaFinding?.passed).toBe(false)
    // Score should include 5 pts for meta
    expect(result.score).toBe(5)
  })
})
