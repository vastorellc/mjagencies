/**
 * @mjagency/seo — SEO plugin engine.
 * Phase 5: stub scorer for content sprint validation.
 * Phase 6: full seo-classic, aio-citations, geo-chunking plugins.
 */

// Phase 5 exports — preserved for backward compat with content sprint seed script
export { computeSeoScoreForContent } from './stub-scorer.js'
export type { SeoScoreInput, SeoScoreOutput } from './stub-scorer.js'

// Phase 6 exports — plugin engine
export { runPluginEngine, registerPlugin } from './engine.js'
export type { PluginEngineInput, PluginEngineOutput, LiveSeoScore, PluginResult } from './engine.js'

export { parseLexicalJson } from './lexical-parser.js'
export type { LexicalExtracts } from './lexical-parser.js'

export { PLUGIN_DEFAULTS } from './plugin-defaults.js'
export type {
  PluginDefaults,
  SeoClassicDefaults,
  AioCitationsDefaults,
  GeoChunkingDefaults,
  ScoreThresholdDefaults,
} from './plugin-defaults.js'

export { getAgencySeoConfig, setAgencySeoConfig, deleteSeoConfigCache } from './config-cache.js'
