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

// Auto-register all plugins on import of this barrel.
// Kept in index.ts (not engine.ts) to avoid circular ESM import issues:
// seo-classic.ts calls registerPlugin() from engine.ts — engine.ts must be
// fully initialized before the side-effect import runs.
export { scoreSeoClassic } from './plugins/seo-classic.js'
export type { SeoClassicConfig, SeoClassicResult } from './plugins/seo-classic.js'

// Plan 06-03: aio-citations plugin (self-registers on export; same pattern as seo-classic)
export { scoreAioCitations } from './plugins/aio-citations.js'
export type { AioCitationsConfig, AioCitationsResult, CitationFinding } from './plugins/aio-citations.js'

// Plan 06-03: FAQPage JSON-LD utility (utility only; Phase 8 SSR injects into <head>)
export { buildFaqJsonLd, serializeFaqJsonLd } from './plugins/faq-jsonld.js'
export type { FaqItem } from './plugins/faq-jsonld.js'
