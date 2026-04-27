/**
 * packages/seo/src/plugins/seo-classic.ts
 *
 * seo-classic scoring plugin — pure function, no I/O.
 * REQ-070: seo-classic is one of 3 required SEO plugins.
 * Algorithm weights from RESEARCH.md Pattern 2 (Rank Math criteria).
 *
 * Seven weighted sub-factors (total 100 pts):
 *  1. title-length      (20 pts)
 *  2. meta-description  (15 pts)
 *  3. keyword-density   (20 pts)
 *  4. word-count        (25 pts — graduated)
 *  5. h1-presence       (10 pts)
 *  6. h2-presence        (5 pts)
 *  7. internal-links     (5 pts)
 */
import type { LexicalExtracts } from '../lexical-parser.js'
import type { PluginResult } from '../engine.js'
import { registerPlugin } from '../engine.js'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface SeoClassicConfig {
  titleMinChars: number
  titleMaxChars: number
  metaDescMinChars: number
  metaDescMaxChars: number
  keywordDensityMin: number
  keywordDensityMax: number
  wordCountFloor: number
  internalLinkMin: number
}

export interface SeoClassicResult extends PluginResult {
  score: number
  findings: Array<{ rule: string; passed: boolean; detail: string }>
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function scoreTitleLength(
  title: string | undefined,
  config: SeoClassicConfig,
): { pts: number; finding: { rule: string; passed: boolean; detail: string } } {
  const len = (title ?? '').length
  if (len === 0) {
    return {
      pts: 0,
      finding: { rule: 'title-length', passed: false, detail: 'No title tag found — add a title between 40–60 characters.' },
    }
  }
  if (len >= config.titleMinChars && len <= config.titleMaxChars) {
    return {
      pts: 20,
      finding: { rule: 'title-length', passed: true, detail: `Title is ${len} chars — good length (${config.titleMinChars}–${config.titleMaxChars}).` },
    }
  }
  const hint = len < config.titleMinChars
    ? `Lengthen to at least ${config.titleMinChars} characters.`
    : `Shorten to ${config.titleMaxChars} characters or fewer.`
  return {
    pts: 8,
    finding: { rule: 'title-length', passed: false, detail: `Title is ${len} chars — ${hint}` },
  }
}

function scoreMetaDescription(
  metaDescription: string | undefined,
  config: SeoClassicConfig,
): { pts: number; finding: { rule: string; passed: boolean; detail: string } } {
  const len = (metaDescription ?? '').length
  if (len === 0) {
    return {
      pts: 0,
      finding: { rule: 'meta-description', passed: false, detail: 'No meta description found — add one between 120–160 characters.' },
    }
  }
  if (len >= config.metaDescMinChars && len <= config.metaDescMaxChars) {
    return {
      pts: 15,
      finding: { rule: 'meta-description', passed: true, detail: `Meta description is ${len} chars — good length (${config.metaDescMinChars}–${config.metaDescMaxChars}).` },
    }
  }
  const hint = len < config.metaDescMinChars
    ? `Expand to at least ${config.metaDescMinChars} characters.`
    : `Trim to ${config.metaDescMaxChars} characters or fewer.`
  return {
    pts: 5,
    finding: { rule: 'meta-description', passed: false, detail: `Meta description is ${len} chars — ${hint}` },
  }
}

function scoreKeywordDensity(
  extracts: LexicalExtracts,
  focusKeyword: string | undefined,
  config: SeoClassicConfig,
): { pts: number; finding: { rule: string; passed: boolean; detail: string } } {
  const keyword = (focusKeyword ?? '').trim()
  if (!keyword || extracts.wordCount === 0) {
    return {
      pts: 0,
      finding: { rule: 'keyword-density', passed: false, detail: 'No focus keyword set — add one to measure keyword density.' },
    }
  }

  // DoS mitigation: clamp plainText at 50,000 chars before keyword regex (T-06-02-02)
  const textForKeyword = extracts.plainText.slice(0, 50000)

  // Escape special regex characters in the keyword (T-06-02-01)
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'gi')
  const matches = textForKeyword.match(regex)
  const count = matches ? matches.length : 0
  const density = count / extracts.wordCount

  const pct = (density * 100).toFixed(2)

  if (density >= config.keywordDensityMin && density <= config.keywordDensityMax) {
    return {
      pts: 20,
      finding: {
        rule: 'keyword-density',
        passed: true,
        detail: `Focus keyword density is ${pct}% — within the target range (${(config.keywordDensityMin * 100).toFixed(1)}%–${(config.keywordDensityMax * 100).toFixed(1)}%).`,
      },
    }
  }

  if (density > config.keywordDensityMax) {
    return {
      pts: 0,
      finding: {
        rule: 'keyword-density',
        passed: false,
        detail: `Keyword density is ${pct}% — too high (stuffing). Reduce to below ${(config.keywordDensityMax * 100).toFixed(1)}%.`,
      },
    }
  }

  // density > 0 but below min
  if (count > 0) {
    return {
      pts: 10,
      finding: {
        rule: 'keyword-density',
        passed: false,
        detail: `Keyword density is ${pct}% — below the target minimum of ${(config.keywordDensityMin * 100).toFixed(1)}%. Use the focus keyword more naturally throughout the content.`,
      },
    }
  }

  return {
    pts: 0,
    finding: {
      rule: 'keyword-density',
      passed: false,
      detail: `Focus keyword "${keyword}" not found in content — add it naturally to reach ${(config.keywordDensityMin * 100).toFixed(1)}%–${(config.keywordDensityMax * 100).toFixed(1)}% density.`,
    },
  }
}

function scoreWordCount(
  wordCount: number,
  config: SeoClassicConfig,
): { pts: number; finding: { rule: string; passed: boolean; detail: string } } {
  const pts = Math.round(Math.min(wordCount / config.wordCountFloor, 1) * 25)
  const passed = wordCount >= config.wordCountFloor
  const detail = passed
    ? `Content has ${wordCount} words — meets the ${config.wordCountFloor}-word target.`
    : `Content has ${wordCount} words — aim for at least ${config.wordCountFloor} words for best results.`
  return { pts, finding: { rule: 'word-count', passed, detail } }
}

function scoreH1(
  headings: LexicalExtracts['headings'],
): { pts: number; finding: { rule: string; passed: boolean; detail: string } } {
  const h1Count = headings.filter((h) => h.tag === 'h1').length
  if (h1Count === 1) {
    return {
      pts: 10,
      finding: { rule: 'h1-presence', passed: true, detail: 'Page has exactly one H1 heading — good.' },
    }
  }
  if (h1Count === 0) {
    return {
      pts: 0,
      finding: { rule: 'h1-presence', passed: false, detail: 'No H1 heading found — add exactly one H1 to identify the main topic.' },
    }
  }
  return {
    pts: 0,
    finding: { rule: 'h1-presence', passed: false, detail: `Page has ${h1Count} H1 headings — use exactly one H1 to avoid confusing search engines.` },
  }
}

function scoreH2(
  headings: LexicalExtracts['headings'],
): { pts: number; finding: { rule: string; passed: boolean; detail: string } } {
  const h2Count = headings.filter((h) => h.tag === 'h2').length
  if (h2Count >= 1) {
    return {
      pts: 5,
      finding: { rule: 'h2-presence', passed: true, detail: `Page has ${h2Count} H2 heading${h2Count > 1 ? 's' : ''} — good structure.` },
    }
  }
  return {
    pts: 0,
    finding: { rule: 'h2-presence', passed: false, detail: 'No H2 headings found — add at least one H2 to organise content sections.' },
  }
}

function scoreInternalLinks(
  internalLinks: number,
  config: SeoClassicConfig,
): { pts: number; finding: { rule: string; passed: boolean; detail: string } } {
  if (internalLinks >= config.internalLinkMin) {
    return {
      pts: 5,
      finding: {
        rule: 'internal-links',
        passed: true,
        detail: `Page has ${internalLinks} internal link${internalLinks !== 1 ? 's' : ''} — meets the minimum of ${config.internalLinkMin}.`,
      },
    }
  }
  const pts = Math.round((internalLinks / config.internalLinkMin) * 5)
  return {
    pts,
    finding: {
      rule: 'internal-links',
      passed: false,
      detail: `Page has ${internalLinks} internal link${internalLinks !== 1 ? 's' : ''} — add at least ${config.internalLinkMin - internalLinks} more to reach the minimum of ${config.internalLinkMin}.`,
    },
  }
}

// ---------------------------------------------------------------------------
// Main scoring function (pure, no I/O)
// ---------------------------------------------------------------------------

export function scoreSeoClassic(
  extracts: LexicalExtracts,
  meta: { title?: string; metaDescription?: string; focusKeyword?: string },
  config: SeoClassicConfig,
): SeoClassicResult {
  const titleResult = scoreTitleLength(meta.title, config)
  const metaResult = scoreMetaDescription(meta.metaDescription, config)
  const keywordResult = scoreKeywordDensity(extracts, meta.focusKeyword, config)
  const wordCountResult = scoreWordCount(extracts.wordCount, config)
  const h1Result = scoreH1(extracts.headings)
  const h2Result = scoreH2(extracts.headings)
  const linksResult = scoreInternalLinks(extracts.internalLinks, config)

  const total =
    titleResult.pts +
    metaResult.pts +
    keywordResult.pts +
    wordCountResult.pts +
    h1Result.pts +
    h2Result.pts +
    linksResult.pts

  return {
    score: Math.min(100, total),
    findings: [
      titleResult.finding,
      metaResult.finding,
      keywordResult.finding,
      wordCountResult.finding,
      h1Result.finding,
      h2Result.finding,
      linksResult.finding,
    ],
  }
}

// ---------------------------------------------------------------------------
// Plugin registration — runs at module load so engine picks it up (REQ-070)
// ---------------------------------------------------------------------------
registerPlugin('seo-classic', (extracts, input, config) =>
  scoreSeoClassic(
    extracts,
    { title: input.metaTitle, metaDescription: input.metaDescription, focusKeyword: input.focusKeyword },
    config.seo_classic,
  )
)
