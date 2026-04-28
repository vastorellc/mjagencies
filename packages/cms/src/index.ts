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

// Plan 11-04: Analytics dashboard custom admin view registration (REQ-143).
// The view component itself lives at ./admin-views/DashboardView.tsx and is
// resolved by Payload via importMap (string Component path).
export { dashboardView } from './admin-views/dashboard-view-config.js'
// Plan 12-07: Brand Setup Wizard admin view registration at /admin/brand-setup.
export { brandSetupView } from './admin-views/brand-setup-view-config.js'

// Plan 05-05 DAM additions
export { DAM_VIEWS, getDamViewForRole } from './dam/views.js'
export type { DamViewId, DamViewConfig, DamTab } from './dam/views.js'
export { searchDamAssets } from './dam/search.js'
export type { DamSearchParams, DamSearchResult } from './dam/search.js'
export { generateBrandPortalUrl } from './dam/brand-portal.js'
export type { BrandPortalTokenClaims } from './dam/brand-portal.js'
export { getLivingBrandBook } from './dam/living-brand-book.js'
export type { LivingBrandBook, LivingBrandBookColor, LivingBrandBookFont } from './dam/living-brand-book.js'
export { svgSanitizeHook } from './hooks/svg-sanitize.js'
