/**
 * packages/cms/src/index.ts
 *
 * Barrel export for @mjagency/cms.
 *
 * Plan 05-01 exports:
 *   buildPayloadConfig — shared Payload config factory
 *   collectionAccess, deleteAccess, fieldImmutable, superAdminOnly — access control helpers
 *
 * Plan 05-02 additions:
 *   CORE_COLLECTIONS — array of all 11 CollectionConfig objects
 *   Individual collection exports
 *   Content validator hooks (validateWordCount, etc.)
 *   schedulePublishHook — BullMQ scheduled-publish afterChange hook
 *   FTC_DISCLAIMER_TEXT, FTC_TESTIMONIAL_DISCLAIMER — compliance text constants
 */

// Plan 05-01 exports
export { buildPayloadConfig } from './config/build-payload-config.js'
export type { BuildPayloadConfigOptions } from './config/build-payload-config.js'
export {
  collectionAccess,
  deleteAccess,
  fieldImmutable,
  superAdminOnly,
} from './access/collection-access.js'

// Plan 05-02 additions
export { CORE_COLLECTIONS } from './collections/index.js'
export {
  pagesCollection,
  postsCollection,
  authorsCollection,
  categoriesCollection,
  mediaAssetsCollection,
  toolsCollection,
  formsCollection,
  redirectsCollection,
  settingsCollection,
  templatesCollection,
  globalBlocksCollection,
} from './collections/index.js'

export {
  validateWordCount,
  validateInternalLinks,
  validatePlaybookNumbers,
  validateFtcDisclaimer,
  validateFtcTestimonial,
  FTC_DISCLAIMER_TEXT,
  FTC_TESTIMONIAL_DISCLAIMER,
} from './hooks/content-validators.js'
export { schedulePublishHook } from './hooks/scheduled-publish.js'
export type { ScheduledPublishJobData } from './hooks/scheduled-publish.js'

// Plan 05-04 additions
export { getLexicalFeatures, SLASH_COMMANDS } from './editor/lexical-features.js'
export type { SlashCommand } from './editor/lexical-features.js'
export { computeSeoScore } from './editor/seo-panel-stub.js'
export type { SeoScores } from './editor/seo-panel-stub.js'
export {
  aiRewrite,
  aiExpand,
  aiShorten,
  aiBrandVoiceRewrite,
  aiGenerateFaq,
  aiSuggestInternalLinks,
  aiTldr,
  aiMetaDescription,
  aiAltText,
} from './editor/ai-hooks-stub.js'
export type { AiActionResult } from './editor/ai-hooks-stub.js'
export { PAYLOAD_BLOCKS } from './blocks/payload-blocks.js'
