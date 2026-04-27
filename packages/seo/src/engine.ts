/**
 * packages/seo/src/engine.ts
 *
 * Plugin engine orchestrator — runs all three SEO plugins and aggregates scores.
 * Plugin registry is populated by plans 02–04 via registerPlugin().
 * Until then, unregistered plugins return score: 0.
 */
import { parseLexicalJson } from './lexical-parser.js'
import type { LexicalExtracts } from './lexical-parser.js'
import { getAgencySeoConfig } from './config-cache.js'
import type { PluginDefaults } from './plugin-defaults.js'

export interface PluginEngineInput {
  lexicalRaw: unknown
  metaTitle?: string
  metaDescription?: string
  focusKeyword?: string
  aioTldr?: string
  pageType?: string
  agencyId: string
}

export interface PluginResult {
  score: number
  findings: Array<{ rule: string; passed: boolean; detail: string }>
}

export interface PluginEngineOutput {
  seoClassicScore: number
  aioCitationsScore: number
  geoChunkingScore: number
  aggregateScore: number
  seoClassicFindings: PluginResult['findings']
  aioCitationsFindings: PluginResult['findings']
  geoChunkingFindings: PluginResult['findings']
}

export type LiveSeoScore = PluginEngineOutput

// Plugin function type
type PluginFn = (
  extracts: LexicalExtracts,
  input: PluginEngineInput,
  config: PluginDefaults,
) => PluginResult

// Plugin registry — populated by plans 02, 03, 04 calling registerPlugin()
const plugins: Record<string, PluginFn> = {}

/**
 * Registers a named plugin function.
 * Called by each plugin plan (02: seo-classic, 03: aio-citations, 04: geo-chunking).
 */
export function registerPlugin(
  name: 'seo-classic' | 'aio-citations' | 'geo-chunking',
  fn: PluginFn,
): void {
  plugins[name] = fn
}

/**
 * Runs all three plugins and returns aggregate scores.
 * Unregistered plugins return score: 0 with a "Plugin not registered yet" finding.
 */
export async function runPluginEngine(input: PluginEngineInput): Promise<PluginEngineOutput> {
  const extracts = parseLexicalJson(input.lexicalRaw)
  const config = await getAgencySeoConfig(input.agencyId)

  const runPlugin = (name: string): PluginResult =>
    plugins[name]
      ? (plugins[name] as PluginFn)(extracts, input, config)
      : {
          score: 0,
          findings: [{ rule: name, passed: false, detail: 'Plugin not registered yet' }],
        }

  const classic = runPlugin('seo-classic')
  const citations = runPlugin('aio-citations')
  const geo = runPlugin('geo-chunking')

  return {
    seoClassicScore: classic.score,
    aioCitationsScore: citations.score,
    geoChunkingScore: geo.score,
    aggregateScore: Math.round((classic.score + citations.score + geo.score) / 3),
    seoClassicFindings: classic.findings,
    aioCitationsFindings: citations.findings,
    geoChunkingFindings: geo.findings,
  }
}
