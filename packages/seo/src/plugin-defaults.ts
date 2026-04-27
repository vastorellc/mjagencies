/**
 * packages/seo/src/plugin-defaults.ts
 *
 * Global default weights for all 4 tunable SEO plugin categories.
 * Agency overrides stored in settings.seo_plugins use merge-patch against these (D-02).
 */

export interface SeoClassicDefaults {
  titleMinChars: number
  titleMaxChars: number
  metaDescMinChars: number
  metaDescMaxChars: number
  keywordDensityMin: number
  keywordDensityMax: number
  wordCountFloor: number
  internalLinkMin: number
}

export interface AioCitationsDefaults {
  requiredSourceTypes: string[]
  maxCitationAgeMonths: number
  blockPublishOnUnsourcedStat: boolean
}

export interface GeoChunkingDefaults {
  targetRadius: number
  targetCities: string[]
  chunkCountMin: number
  requiredOnServicePages: boolean
}

export interface ScoreThresholdDefaults {
  seoClassic: number
  aioCitations: number
  geoChunking: number
}

export interface PluginDefaults {
  seo_classic: SeoClassicDefaults
  aio_citations: AioCitationsDefaults
  geo_chunking: GeoChunkingDefaults
  score_thresholds: ScoreThresholdDefaults
}

export const PLUGIN_DEFAULTS: PluginDefaults = {
  seo_classic: {
    titleMinChars: 40,
    titleMaxChars: 60,
    metaDescMinChars: 120,
    metaDescMaxChars: 160,
    keywordDensityMin: 0.01,
    keywordDensityMax: 0.025,
    wordCountFloor: 1500,
    internalLinkMin: 3,
  },
  aio_citations: {
    requiredSourceTypes: ['government', 'academic', 'news'],
    maxCitationAgeMonths: 24,
    blockPublishOnUnsourcedStat: false,
  },
  geo_chunking: {
    targetRadius: 25,
    targetCities: [],
    chunkCountMin: 2,
    requiredOnServicePages: true,
  },
  score_thresholds: {
    seoClassic: 70,
    aioCitations: 60,
    geoChunking: 50,
  },
}
