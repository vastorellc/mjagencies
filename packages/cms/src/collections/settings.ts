/**
 * packages/cms/src/collections/settings.ts
 *
 * Payload 3.82.1 CollectionConfig for the `settings` collection.
 * Per-agency settings — brand voice, SEO defaults, social links, analytics.
 *
 * REQ-052: settings collection
 * Security: delete is restricted to super_admin only (T-05-02-03)
 */
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, superAdminOnly, fieldImmutable } from '../access/collection-access.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id',
  type: 'text',
  required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
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
