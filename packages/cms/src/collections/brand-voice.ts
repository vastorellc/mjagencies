/**
 * packages/cms/src/collections/brand-voice.ts
 *
 * Payload 3.82.1 CollectionConfig for the `brand_voice` collection.
 * Per-agency brand voice configuration — tone, style, formality, examples.
 *
 * REQ-083: Brand Voice + Glossary stored in Payload, drives AI Brand Voice Rewrite action.
 *
 * Security:
 *   - collectionAccess: super_admin unrestricted; admin/editor own agency only (T-07-04-01)
 *   - AGENCY_ID_FIELD: fieldImmutable on update — prevents cross-tenant data leakage (T-07-04-02)
 *   - delete: superAdminOnly
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

export const brandVoiceCollection: CollectionConfig = {
  slug: 'brand_voice',
  admin: {
    useAsTitle: 'tone_description',
    defaultColumns: ['tone_description', 'formality_level', 'agency_id', 'updatedAt'],
    group: 'Branding',
    description:
      'Per-agency brand voice configuration. Drives the Brand Voice Rewrite AI action.',
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
      name: 'tone_description',
      type: 'textarea',
      required: true,
      admin: {
        description:
          'Describe the agency tone in 2-3 sentences (e.g. Confident, data-driven, no jargon).',
      },
    },
    {
      name: 'writing_style_notes',
      type: 'textarea',
      admin: {
        description: 'Style guide bullets - sentence length, voice, perspective.',
      },
    },
    {
      name: 'target_audience',
      type: 'text',
      admin: {
        description:
          'Primary audience (e.g. VPs of Marketing at B2B SaaS companies).',
      },
    },
    {
      name: 'formality_level',
      type: 'select',
      defaultValue: 'neutral',
      options: [
        { label: 'Casual', value: 'casual' },
        { label: 'Neutral', value: 'neutral' },
        { label: 'Formal', value: 'formal' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'example_good_paragraph',
      type: 'textarea',
      admin: {
        description:
          'Paragraph that exemplifies the brand voice. AI uses as positive example.',
      },
    },
    {
      name: 'example_bad_paragraph',
      type: 'textarea',
      admin: {
        description:
          'Paragraph that violates the brand voice. AI uses as negative example.',
      },
    },
  ],
}
