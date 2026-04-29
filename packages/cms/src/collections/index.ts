/**
 * packages/cms/src/collections/index.ts
 *
 * Barrel export for all core Payload CMS collections.
 * CORE_COLLECTIONS is the array passed to `buildPayloadConfig({ collections })`.
 *
 * 17 collections in canonical order (matches specs/cms.md CORE COLLECTIONS + seo_suggestions + algo_alerts + brand_voice + brand_glossary + users):
 *   users (Payload admin auth — required), pages, posts, authors, categories, media_assets, tools,
 *   forms, redirects, settings, faqs, templates, global_blocks, seo_suggestions, algo_alerts,
 *   brand_voice, brand_glossary
 */
import type { CollectionConfig } from 'payload'
import { pagesCollection } from './pages.js'
import { postsCollection } from './posts.js'
import { authorsCollection } from './authors.js'
import { categoriesCollection } from './categories.js'
import { mediaAssetsCollection } from './media-assets.js'
import { toolsCollection } from './tools.js'
import { formsCollection } from './forms.js'
import { redirectsCollection } from './redirects.js'
import { settingsCollection } from './settings.js'
import { faqsCollection } from './faqs.js'
import { templatesCollection } from './templates.js'
import { globalBlocksCollection } from './global-blocks.js'
import { seoSuggestionsCollection } from './seo-suggestions.js'
import { algoAlertsCollection } from './algo-alerts.js'
import { brandVoiceCollection } from './brand-voice.js'
import { brandGlossaryCollection } from './brand-glossary.js'
import { caseStudiesCollection } from './case-studies.js'
import { usersCollection } from './users.js'

export const CORE_COLLECTIONS: CollectionConfig[] = [
  usersCollection,
  pagesCollection,
  postsCollection,
  authorsCollection,
  categoriesCollection,
  mediaAssetsCollection,
  toolsCollection,
  formsCollection,
  redirectsCollection,
  settingsCollection,
  faqsCollection,
  templatesCollection,
  globalBlocksCollection,
  seoSuggestionsCollection,
  algoAlertsCollection,
  brandVoiceCollection,
  brandGlossaryCollection,
  caseStudiesCollection,
]

export {
  usersCollection,
  pagesCollection,
  postsCollection,
  authorsCollection,
  categoriesCollection,
  mediaAssetsCollection,
  toolsCollection,
  formsCollection,
  redirectsCollection,
  settingsCollection,
  faqsCollection,
  templatesCollection,
  globalBlocksCollection,
  seoSuggestionsCollection,
  algoAlertsCollection,
  brandVoiceCollection,
  brandGlossaryCollection,
  caseStudiesCollection,
}
