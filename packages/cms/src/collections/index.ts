/**
 * packages/cms/src/collections/index.ts
 *
 * Barrel export for all core Payload CMS collections.
 * CORE_COLLECTIONS is the array passed to `buildPayloadConfig({ collections })`.
 *
 * 11 collections in canonical order (matches specs/cms.md CORE COLLECTIONS):
 *   pages, posts, authors, categories, media_assets, tools,
 *   forms, redirects, settings, templates, global_blocks
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
import { templatesCollection } from './templates.js'
import { globalBlocksCollection } from './global-blocks.js'

export const CORE_COLLECTIONS: CollectionConfig[] = [
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
]

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
}
