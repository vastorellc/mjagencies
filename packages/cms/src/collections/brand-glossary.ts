/**
 * packages/cms/src/collections/brand-glossary.ts
 *
 * Payload 3.82.1 CollectionConfig for the `brand_glossary` collection.
 * Per-agency glossary entries — preferred terms, definitions, and banned alternatives.
 *
 * REQ-083: Brand Voice + Glossary stored in Payload, drives AI Brand Voice Rewrite action.
 *
 * Security:
 *   - collectionAccess: super_admin unrestricted; admin/editor own agency only (T-07-04-01)
 *   - AGENCY_ID_FIELD: fieldImmutable on update — prevents cross-tenant data leakage (T-07-04-02)
 *   - delete: superAdminOnly
 *
 * Note: avoid_phrases is an array field nested under each glossary entry (not a separate
 * banned-phrases collection). Decision captured in STATE.md: "Banned phrases are an
 * avoid_phrases array field inside brand_glossary collection."
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

export const brandGlossaryCollection: CollectionConfig = {
  slug: 'brand_glossary',
  admin: {
    useAsTitle: 'term',
    defaultColumns: ['term', 'preferred_usage', 'agency_id', 'updatedAt'],
    group: 'Branding',
    description:
      'Per-agency glossary entries. Each term documents preferred usage and banned alternatives.',
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
      name: 'term',
      type: 'text',
      required: true,
      admin: {
        description:
          'Brand term (e.g. Customer Success - never Customer Support).',
      },
    },
    {
      name: 'definition',
      type: 'textarea',
      admin: {
        description: 'What the term means in agency context.',
      },
    },
    {
      name: 'preferred_usage',
      type: 'textarea',
      admin: {
        description: 'How and when to use this term in copy.',
      },
    },
    {
      name: 'avoid_phrases',
      type: 'array',
      admin: {
        description: 'Phrases that MUST NOT appear in copy when this term applies.',
      },
      fields: [
        {
          name: 'phrase',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
}
