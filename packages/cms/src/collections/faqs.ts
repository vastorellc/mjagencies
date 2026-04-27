/**
 * packages/cms/src/collections/faqs.ts
 *
 * Payload 3.82.1 CollectionConfig for the `faqs` collection.
 * Agency-scoped FAQ items for FAQPage JSON-LD generation (REQ-076).
 * D-07: dedicated collection, agency-scoped.
 * D-09: question (text) + answer (textarea) — plain text for clean JSON-LD output.
 *
 * CLAUDE.md §8: every agency-scoped collection must include AGENCY_ID_FIELD
 * with access: { update: fieldImmutable } to prevent cross-agency tampering.
 */
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id',
  type: 'text',
  required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

export const faqsCollection: CollectionConfig = {
  slug: 'faqs',
  admin: {
    useAsTitle: 'question',
    defaultColumns: ['question', 'agency_id', 'updatedAt'],
    group: 'SEO',
  },
  access: {
    read: collectionAccess,
    create: collectionAccess,
    update: collectionAccess,
    delete: deleteAccess,
  },
  fields: [
    AGENCY_ID_FIELD,
    {
      name: 'question',
      type: 'text',
      required: true,
    },
    {
      name: 'answer',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Plain text answer used in FAQPage JSON-LD structured data (D-09).',
      },
    },
  ],
}
