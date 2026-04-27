/**
 * packages/seo/src/plugins/geo-chunking.ts
 *
 * geo-chunking scoring plugin — geographic content density scoring.
 * REQ-070: one of 3 required SEO plugins.
 *
 * Algorithm from RESEARCH.md Pattern 4 [CITED: searchengineland.com/geo-local-seo-future-discovery].
 * Note: ASSUMED scoring thresholds (A2 in RESEARCH.md) — admin-tunable via config.chunkCountMin.
 *
 * Plugin self-registration follows the same index.ts export chain pattern as seo-classic.ts
 * and aio-citations.ts (see 06-02 SUMMARY: engine.ts direct import causes circular ESM issue;
 * index.ts export triggers registration after engine.ts is fully initialized).
 *
 * DoS mitigation (T-06-04-01): city names are regex-escaped before compile.
 */
import type { LexicalExtracts } from '../lexical-parser.js'
import type { PluginResult } from '../engine.js'
import { registerPlugin } from '../engine.js'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface GeoChunkingConfig {
  targetRadius: number
  targetCities: string[]
  chunkCountMin: number
  requiredOnServicePages: boolean
}

export interface GeoChunkingResult extends PluginResult {
  score: number
  geoMentionCount: number
  findings: Array<{ rule: string; passed: boolean; detail: string }>
}

// ---------------------------------------------------------------------------
// Main scoring function (pure, no I/O)
// ---------------------------------------------------------------------------

/**
 * Scores geographic content density for a page.
 *
 * @param extracts - Lexical-parsed content (headings + paragraphs used for fullText)
 * @param pageType - Page type string (e.g. 'services', 'blog', 'home')
 * @param config   - Per-agency geo-chunking config (targetCities, chunkCountMin, etc.)
 * @returns GeoChunkingResult with score 0–100, geoMentionCount, and per-city findings
 */
export function scoreGeoChunking(
  extracts: LexicalExtracts,
  pageType: string,
  config: GeoChunkingConfig,
): GeoChunkingResult {
  // Non-applicable short-circuit: geo scoring is only required on service pages.
  // An empty pageType string also triggers this path (empty string !== 'services').
  if (config.requiredOnServicePages && pageType !== 'services') {
    return {
      score: 100,
      geoMentionCount: 0,
      findings: [
        {
          rule: 'geo-not-applicable',
          passed: true,
          detail: 'Geo scoring not required for this page type',
        },
      ],
    }
  }

  // No cities configured — cannot score
  if (!config.targetCities || config.targetCities.length === 0) {
    return {
      score: 0,
      geoMentionCount: 0,
      findings: [
        {
          rule: 'geo-cities-not-configured',
          passed: false,
          detail: 'No target cities configured — add cities to agency settings to enable geo scoring',
        },
      ],
    }
  }

  // Build fullText from heading texts + paragraph texts, lowercased for case-insensitive matching
  const fullText = [
    ...extracts.headings.map((h) => h.text),
    ...extracts.paragraphs,
  ]
    .join(' ')
    .toLowerCase()

  let totalMentions = 0
  const findings: GeoChunkingResult['findings'] = []

  for (const city of config.targetCities) {
    // DoS mitigation (T-06-04-01): escape special regex characters in city name
    const escapedCity = city.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\b${escapedCity}\\b`, 'g')
    const matches = fullText.match(pattern) ?? []
    const mentionCount = matches.length
    totalMentions += mentionCount

    findings.push({
      rule: 'city-mentions',
      passed: mentionCount > 0,
      detail:
        mentionCount > 0
          ? `"${city}" mentioned ${mentionCount} time${mentionCount === 1 ? '' : 's'}`
          : `"${city}" not found in content — add city references for local SEO`,
    })
  }

  // score = Math.min(100, Math.round((totalMentions / Math.max(chunkCountMin, 1)) * 100))
  const score = Math.min(
    100,
    Math.round((totalMentions / Math.max(config.chunkCountMin, 1)) * 100),
  )

  return { score, geoMentionCount: totalMentions, findings }
}

// ---------------------------------------------------------------------------
// Plugin registration — runs at module load so engine picks it up (REQ-070)
// Triggered by the export in index.ts (not engine.ts) to avoid circular ESM import.
// ---------------------------------------------------------------------------
registerPlugin('geo-chunking', (extracts, input, config) =>
  scoreGeoChunking(extracts, input.pageType ?? '', config.geo_chunking),
)
