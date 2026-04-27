/**
 * packages/seo/src/plugins/aio-citations.ts
 *
 * aio-citations scoring plugin — detects unsourced statistics.
 * REQ-070: one of 3 required SEO plugins.
 * Stat detection regex from RESEARCH.md Pattern 3.
 *
 * Plugin self-registration follows the same index.ts export chain pattern as seo-classic.ts
 * (see 06-02 SUMMARY: engine.ts direct import causes circular ESM issue; index.ts export triggers
 * registration after engine.ts is fully initialized).
 */
import type { LexicalExtracts } from '../lexical-parser.js'
import type { PluginResult } from '../engine.js'
import { registerPlugin } from '../engine.js'

// Stat indicator patterns (RESEARCH.md Pattern 3)
const STAT_PATTERNS: RegExp[] = [
  /\d+\.?\d*\s*%/,                                                              // percentage: "42%", "3.5%"
  /\$\s*\d[\d,]*/,                                                               // dollar amounts: "$1,200"
  /\b\d+\s*(?:times|x)\b/i,                                                     // "3 times", "5x"
  /\b(?:according\s+to|research\s+shows|studies?\s+(?:show|find|found|suggest))/i, // attribution phrases
  /\b\d+\s*(?:out\s+of|in)\s*\d+\b/i,                                          // "3 out of 4", "1 in 5"
]

export interface AioCitationsConfig {
  requiredSourceTypes: string[]
  maxCitationAgeMonths: number
  blockPublishOnUnsourcedStat: boolean
}

export interface AioCitationsResult extends PluginResult {
  score: number
  unsourcedStatCount: number
  totalStatCount: number
  findings: Array<{ rule: string; passed: boolean; detail: string }>
}

export interface CitationFinding {
  sentenceSnippet: string
  hasAdjacentLink: boolean
}

function detectUnsourcedStats(
  paragraphs: string[],
  lexicalRaw: unknown,
): CitationFinding[] {
  const findings: CitationFinding[] = []
  const rawStr = JSON.stringify(lexicalRaw ?? '')
  for (const para of paragraphs) {
    const sentences = para.split(/[.!?]+/).filter(s => s.trim().length > 20)
    for (const sentence of sentences) {
      const hasStat = STAT_PATTERNS.some(p => p.test(sentence))
      if (!hasStat) continue
      const snippetKey = sentence.trim().slice(0, 30)
      const snippetIdx = rawStr.indexOf(snippetKey)
      const window =
        snippetIdx > 0
          ? rawStr.slice(Math.max(0, snippetIdx - 100), snippetIdx + 300)
          : ''
      const hasAdjacentLink = /"url"\s*:\s*"https?:\/\//.test(window)
      findings.push({ sentenceSnippet: sentence.trim().slice(0, 100), hasAdjacentLink })
    }
  }
  return findings
}

export function scoreAioCitations(
  extracts: LexicalExtracts,
  lexicalRaw: unknown,
  config: AioCitationsConfig,
): AioCitationsResult {
  const citationFindings = detectUnsourcedStats(extracts.paragraphs, lexicalRaw)
  const totalStatCount = citationFindings.length
  const unsourcedStatCount = citationFindings.filter(f => !f.hasAdjacentLink).length

  const score =
    totalStatCount === 0
      ? 100
      : Math.max(0, Math.round(((totalStatCount - unsourcedStatCount) / totalStatCount) * 100))

  const findings = citationFindings.map(f => ({
    rule: 'citation-link',
    passed: f.hasAdjacentLink,
    detail: f.hasAdjacentLink
      ? `Stat has adjacent source link — good`
      : `Stat missing source link: "${f.sentenceSnippet.slice(0, 60)}"`,
  }))

  // Note: config.blockPublishOnUnsourcedStat is intentionally NOT used here.
  // It is evaluated by the publish hook (validateAioTldr / CMS layer), not the scorer.
  // Keeping it in the config type preserves the interface contract; suppressing unused warning:
  void config.blockPublishOnUnsourcedStat

  return { score, unsourcedStatCount, totalStatCount, findings }
}

// Register with the plugin engine.
// This call runs when index.ts exports this module — engine.ts is already fully
// initialized at that point (exported earlier in index.ts barrel).
registerPlugin('aio-citations', (extracts, input, config) =>
  scoreAioCitations(extracts, input.lexicalRaw, config.aio_citations),
)
