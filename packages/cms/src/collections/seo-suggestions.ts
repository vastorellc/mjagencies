/**
 * packages/cms/src/collections/seo-suggestions.ts
 * Payload 3.82.1 CollectionConfig for the `seo_suggestions` collection.
 * Global collection — super_admin only (no agency_id).
 * Stores AI-generated SEO weight adjustment suggestions pending human review.
 * REQ-073: self-learning loop writes here; admin reviews before applying.
 *
 * Security: superAdminOnly on all operations (Pitfall 6 in RESEARCH.md).
 */
import type { CollectionConfig } from 'payload'
import { superAdminOnly } from '../access/collection-access.js'

export const seoSuggestionsCollection: CollectionConfig = {
  slug: 'seo_suggestions',
  admin: {
    useAsTitle: 'agency_slug',
    defaultColumns: ['agency_slug', 'suggestion_type', 'status', 'createdAt'],
    group: 'SEO',
  },
  access: {
    read: superAdminOnly,
    create: superAdminOnly,
    update: superAdminOnly,
    delete: superAdminOnly,
  },
  fields: [
    {
      name: 'agency_slug',
      type: 'text',
      required: true,
      admin: {
        position: 'sidebar',
        description: 'Agency this suggestion applies to.',
      },
    },
    {
      name: 'suggestion_type',
      type: 'select',
      defaultValue: 'weight_adjustment',
      options: [
        { label: 'Weight Adjustment', value: 'weight_adjustment' },
        { label: 'Keyword Opportunity', value: 'keyword_opportunity' },
        { label: 'Content Gap', value: 'content_gap' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending_review',
      options: [
        { label: 'Pending Review', value: 'pending_review' },
        { label: 'Applied', value: 'applied' },
        { label: 'Dismissed', value: 'dismissed' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'signal_summary',
      type: 'json',
      admin: {
        description:
          'GSC + GA4 signal data that triggered this suggestion (impressions, CTR, bounce rate, etc.).',
      },
    },
    {
      name: 'suggested_config',
      type: 'json',
      admin: {
        description:
          'Suggested PluginDefaults override (merge-patch). Apply by copying to agency seo_plugins field in Settings.',
      },
    },
    {
      name: 'ai_rationale',
      type: 'textarea',
      admin: {
        description: 'AI-generated explanation for this suggestion.',
      },
    },
    {
      name: 'data_window',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Signal date range e.g. "2026-03-28 to 2026-04-25 (28 days)".',
      },
    },
  ],
}
