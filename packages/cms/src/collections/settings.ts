/**
 * packages/cms/src/collections/settings.ts
 *
 * Payload 3.82.1 CollectionConfig for the `settings` collection.
 * Per-agency settings — brand voice, SEO defaults, social links, analytics.
 *
 * REQ-052: settings collection
 * REQ-071, REQ-072: seo_plugins, algo_watcher_feeds, algo_watcher_keywords fields (Phase 6)
 * Security: delete is restricted to super_admin only (T-05-02-03)
 */
import type { CollectionConfig, Field, CollectionAfterOperationHook } from 'payload'
import { collectionAccess, superAdminOnly, fieldImmutable } from '../access/collection-access.js'
import { deleteSeoConfigCache } from '@mjagency/seo'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id',
  type: 'text',
  required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

/**
 * Cache invalidation hook — fires after settings create/update.
 * Pitfall 3 fix: result on partial save may lack agency_id — fall back to findByID.
 */
const invalidateSeoConfigCache: CollectionAfterOperationHook = async ({
  result,
  operation,
  req,
}) => {
  if (operation !== 'update' && operation !== 'create') return result
  // Pitfall 3 fix: result on partial save may lack agency_id — fall back to full doc lookup
  let agencyId = (result as Record<string, unknown>)['agency_id'] as string | undefined
  if (!agencyId && (result as Record<string, unknown>)['id']) {
    try {
      const doc = await req.payload.findByID({
        collection: 'settings',
        id: (result as Record<string, unknown>)['id'] as string,
        overrideAccess: true,
      })
      agencyId = (doc as Record<string, unknown>)['agency_id'] as string | undefined
    } catch {
      /* skip invalidation if lookup fails */
    }
  }
  if (agencyId) {
    await deleteSeoConfigCache(agencyId)
  }
  return result
}

export const settingsCollection: CollectionConfig = {
  slug: 'settings',
  admin: {
    useAsTitle: 'site_name',
    defaultColumns: ['site_name', 'site_url', 'agency_id'],
    group: 'Configuration',
    description: 'Per-agency global settings. Delete is restricted to super_admin.',
  },
  access: {
    read: collectionAccess,
    create: collectionAccess,
    update: collectionAccess,
    delete: superAdminOnly,
  },
  hooks: {
    afterOperation: [invalidateSeoConfigCache],
  },
  fields: [
    AGENCY_ID_FIELD,
    {
      name: 'site_name',
      type: 'text',
    },
    {
      name: 'site_url',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    {
      name: 'default_meta_title',
      type: 'text',
      maxLength: 60,
    },
    {
      name: 'default_meta_description',
      type: 'text',
      maxLength: 160,
    },
    {
      name: 'brand_voice',
      type: 'textarea',
      admin: {
        description:
          'Brand voice guidelines used by AI content generation (LiteLLM, Plan 05-06).',
      },
    },
    {
      name: 'seo_defaults',
      type: 'json',
      admin: {
        description: 'Default SEO configuration applied across all pages.',
      },
    },
    {
      name: 'seo_plugins',
      type: 'json',
      admin: {
        description:
          'Per-agency SEO plugin weight overrides (merge-patch against global defaults). Keys: seo_classic, aio_citations, geo_chunking, score_thresholds. Leave empty to use global defaults (D-02).',
      },
    },
    {
      name: 'algo_watcher_feeds',
      type: 'json',
      admin: {
        description:
          'Additional RSS feed URLs for algorithm watcher beyond Google Search Central (D-10). Array of strings.',
      },
    },
    {
      name: 'algo_watcher_keywords',
      type: 'json',
      admin: {
        description:
          'Keyword array for RSS match detection (D-11). e.g. ["core update", "helpful content", "spam", "ranking", "algorithm"].',
      },
    },
    {
      name: 'gtag_id',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Google Tag Manager or GA4 measurement ID (e.g. GTM-XXXXX or G-XXXXXXX).',
      },
    },
    {
      name: 'social_links',
      type: 'json',
      admin: {
        description: 'Social platform handles/URLs. Used in footer and structured data.',
      },
    },
  ],
}
