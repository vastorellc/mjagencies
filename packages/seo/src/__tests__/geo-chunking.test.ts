/**
 * packages/seo/src/__tests__/geo-chunking.test.ts
 *
 * TDD RED phase — geo-chunking scoring plugin tests.
 * REQ-070: geo-chunking is one of 3 required SEO plugins.
 *
 * All tests MUST FAIL until packages/seo/src/plugins/geo-chunking.ts is created.
 *
 * Algorithm (RESEARCH.md Pattern 4):
 *   fullText = (headings.map(h => h.text) + paragraphs).join(' ').toLowerCase()
 *   For each city: count \b<city>\b regex matches (case-insensitive)
 *   totalMentions = sum of all city counts
 *   score = Math.min(100, Math.round((totalMentions / Math.max(chunkCountMin, 1)) * 100))
 */
import { describe, it, expect } from 'vitest'
import { PLUGIN_DEFAULTS } from '../plugin-defaults.js'
import { scoreGeoChunking } from '../plugins/geo-chunking.js'
import type { GeoChunkingConfig, GeoChunkingResult } from '../plugins/geo-chunking.js'
import type { LexicalExtracts } from '../lexical-parser.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default config (mirrors PLUGIN_DEFAULTS.geo_chunking) */
const DEFAULT_CONFIG: GeoChunkingConfig = PLUGIN_DEFAULTS.geo_chunking

/** Minimal empty extracts */
function emptyExtracts(): LexicalExtracts {
  return {
    plainText: '',
    wordCount: 0,
    headings: [],
    internalLinks: 0,
    paragraphs: [],
  }
}

/** Extracts with Austin mentioned in 2 paragraphs */
function austinTwiceParagraphs(): LexicalExtracts {
  return {
    plainText: 'We serve Austin and the greater Austin area.',
    wordCount: 9,
    headings: [],
    internalLinks: 0,
    paragraphs: [
      'We serve Austin and surrounding areas.',
      'Our Austin office is open Monday through Friday.',
    ],
  }
}

/** Extracts with Austin mentioned once in a paragraph */
function austinOnceParagraph(): LexicalExtracts {
  return {
    plainText: 'We serve Austin.',
    wordCount: 3,
    headings: [],
    internalLinks: 0,
    paragraphs: ['We serve Austin.'],
  }
}

/** Extracts with no city mentions */
function noCityMentions(): LexicalExtracts {
  return {
    plainText: 'We provide excellent services to our customers.',
    wordCount: 8,
    headings: [],
    internalLinks: 0,
    paragraphs: ['We provide excellent services to our customers.'],
  }
}

/** Extracts with Austin and Dallas mentioned */
function austinAndDallas(): LexicalExtracts {
  return {
    plainText: 'We serve Austin and Dallas.',
    wordCount: 5,
    headings: [],
    internalLinks: 0,
    paragraphs: [
      'Our Austin office serves clients locally.',
      'We also operate out of Dallas.',
    ],
  }
}

// ---------------------------------------------------------------------------
// Test: targetCities=[] → score=0, geo-cities-not-configured
// ---------------------------------------------------------------------------
describe('scoreGeoChunking — empty targetCities', () => {
  it('returns score=0 and geo-cities-not-configured finding when targetCities is empty', () => {
    const config: GeoChunkingConfig = { ...DEFAULT_CONFIG, targetCities: [] }
    const result: GeoChunkingResult = scoreGeoChunking(austinTwiceParagraphs(), 'services', config)
    expect(result.score).toBe(0)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]!.rule).toBe('geo-cities-not-configured')
    expect(result.findings[0]!.passed).toBe(false)
  })

  it('returns score=0 for not-configured even when content has city names', () => {
    const config: GeoChunkingConfig = { ...DEFAULT_CONFIG, targetCities: [] }
    const result = scoreGeoChunking(austinTwiceParagraphs(), 'services', config)
    expect(result.score).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Test: pageType !== 'services' + requiredOnServicePages=true → score=100
// ---------------------------------------------------------------------------
describe('scoreGeoChunking — non-service page', () => {
  it('pageType=blog, requiredOnServicePages=true → score=100, geo-not-applicable', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin'],
      requiredOnServicePages: true,
    }
    const result: GeoChunkingResult = scoreGeoChunking(emptyExtracts(), 'blog', config)
    expect(result.score).toBe(100)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]!.rule).toBe('geo-not-applicable')
    expect(result.findings[0]!.passed).toBe(true)
  })

  it('pageType="" (empty string), requiredOnServicePages=true → score=100, geo-not-applicable', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin'],
      requiredOnServicePages: true,
    }
    const result: GeoChunkingResult = scoreGeoChunking(emptyExtracts(), '', config)
    expect(result.score).toBe(100)
    expect(result.findings[0]!.rule).toBe('geo-not-applicable')
  })

  it('pageType=services, requiredOnServicePages=true → runs scoring (not short-circuit)', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin'],
      requiredOnServicePages: true,
      chunkCountMin: 2,
    }
    // Austin appears twice → score should be 100, NOT short-circuited to geo-not-applicable
    const result = scoreGeoChunking(austinTwiceParagraphs(), 'services', config)
    // Should not have geo-not-applicable
    expect(result.findings.some(f => f.rule === 'geo-not-applicable')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Test: pageType='services', targetCities=['Austin'], 2 mentions, chunkCountMin=2 → score=100
// ---------------------------------------------------------------------------
describe('scoreGeoChunking — scoring algorithm', () => {
  it('2 Austin mentions with chunkCountMin=2 → score=100', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin'],
      chunkCountMin: 2,
      requiredOnServicePages: true,
    }
    const result = scoreGeoChunking(austinTwiceParagraphs(), 'services', config)
    expect(result.score).toBe(100)
  })

  it('1 Austin mention with chunkCountMin=2 → score=50', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin'],
      chunkCountMin: 2,
      requiredOnServicePages: true,
    }
    const result = scoreGeoChunking(austinOnceParagraph(), 'services', config)
    // Math.min(100, Math.round((1 / 2) * 100)) = Math.min(100, 50) = 50
    expect(result.score).toBe(50)
  })

  it('Austin and Dallas both mentioned with chunkCountMin=2 → score=100', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin', 'Dallas'],
      chunkCountMin: 2,
      requiredOnServicePages: true,
    }
    // 1 Austin + 1 Dallas = 2 total → Math.min(100, Math.round((2 / 2) * 100)) = 100
    const result = scoreGeoChunking(austinAndDallas(), 'services', config)
    expect(result.score).toBe(100)
  })

  it('0 Austin mentions with chunkCountMin=2 → score=0', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin'],
      chunkCountMin: 2,
      requiredOnServicePages: true,
    }
    const result = scoreGeoChunking(noCityMentions(), 'services', config)
    expect(result.score).toBe(0)
  })

  it('score does not exceed 100 (Math.min cap)', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin'],
      chunkCountMin: 1,
      requiredOnServicePages: true,
    }
    // Austin appears twice, chunkCountMin=1 → Math.min(100, 200) = 100
    const result = scoreGeoChunking(austinTwiceParagraphs(), 'services', config)
    expect(result.score).toBe(100)
    expect(result.score).toBeLessThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// Test: findings array includes one entry per city in targetCities
// ---------------------------------------------------------------------------
describe('scoreGeoChunking — findings per city', () => {
  it('findings contains one entry per city in targetCities', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin', 'Dallas'],
      chunkCountMin: 2,
      requiredOnServicePages: true,
    }
    const result = scoreGeoChunking(austinAndDallas(), 'services', config)
    expect(result.findings).toHaveLength(2)
  })

  it('findings entry for found city has passed=true', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin'],
      chunkCountMin: 2,
      requiredOnServicePages: true,
    }
    const result = scoreGeoChunking(austinOnceParagraph(), 'services', config)
    expect(result.findings[0]!.passed).toBe(true)
  })

  it('findings entry for missing city has passed=false', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin'],
      chunkCountMin: 2,
      requiredOnServicePages: true,
    }
    const result = scoreGeoChunking(noCityMentions(), 'services', config)
    expect(result.findings[0]!.passed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Test: case-insensitive matching
// ---------------------------------------------------------------------------
describe('scoreGeoChunking — case-insensitive city matching', () => {
  it('lowercase "austin" in content matches targetCity "Austin"', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin'],
      chunkCountMin: 1,
      requiredOnServicePages: true,
    }
    const extracts: LexicalExtracts = {
      plainText: 'we serve austin',
      wordCount: 3,
      headings: [],
      internalLinks: 0,
      paragraphs: ['we serve austin'],
    }
    const result = scoreGeoChunking(extracts, 'services', config)
    expect(result.score).toBe(100)
    expect(result.findings[0]!.passed).toBe(true)
  })

  it('uppercase "AUSTIN" in content matches targetCity "Austin"', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin'],
      chunkCountMin: 1,
      requiredOnServicePages: true,
    }
    const extracts: LexicalExtracts = {
      plainText: 'WE SERVE AUSTIN',
      wordCount: 3,
      headings: [],
      internalLinks: 0,
      paragraphs: ['WE SERVE AUSTIN'],
    }
    // fullText is lowercased before matching, so AUSTIN → austin → matches \baustin\b
    const result = scoreGeoChunking(extracts, 'services', config)
    expect(result.score).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// Test: word boundary — 'Austins' does NOT count as 'Austin'
// ---------------------------------------------------------------------------
describe('scoreGeoChunking — word boundary enforcement', () => {
  it('"Austins" does NOT count as an "Austin" match (word boundary)', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin'],
      chunkCountMin: 2,
      requiredOnServicePages: true,
    }
    const extracts: LexicalExtracts = {
      plainText: 'The Austins family lives here.',
      wordCount: 6,
      headings: [],
      internalLinks: 0,
      paragraphs: ['The Austins family lives here.'],
    }
    const result = scoreGeoChunking(extracts, 'services', config)
    // "Austins" should NOT match \bausting\b — score should be 0
    expect(result.score).toBe(0)
    expect(result.findings[0]!.passed).toBe(false)
  })

  it('city mention in heading text is counted', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin'],
      chunkCountMin: 1,
      requiredOnServicePages: true,
    }
    const extracts: LexicalExtracts = {
      plainText: 'SEO Services in Austin',
      wordCount: 4,
      headings: [{ tag: 'h1', text: 'SEO Services in Austin' }],
      internalLinks: 0,
      paragraphs: [],
    }
    // Austin in heading text should be included in fullText
    const result = scoreGeoChunking(extracts, 'services', config)
    expect(result.score).toBe(100)
    expect(result.findings[0]!.passed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test: geoMentionCount field on result
// ---------------------------------------------------------------------------
describe('scoreGeoChunking — geoMentionCount', () => {
  it('geoMentionCount reflects total city mentions across all cities', () => {
    const config: GeoChunkingConfig = {
      ...DEFAULT_CONFIG,
      targetCities: ['Austin', 'Dallas'],
      chunkCountMin: 2,
      requiredOnServicePages: true,
    }
    const result = scoreGeoChunking(austinAndDallas(), 'services', config)
    // 1 Austin + 1 Dallas = 2 total
    expect(result.geoMentionCount).toBe(2)
  })

  it('geoMentionCount is 0 when targetCities is empty', () => {
    const config: GeoChunkingConfig = { ...DEFAULT_CONFIG, targetCities: [] }
    const result = scoreGeoChunking(austinTwiceParagraphs(), 'services', config)
    expect(result.geoMentionCount).toBe(0)
  })
})
