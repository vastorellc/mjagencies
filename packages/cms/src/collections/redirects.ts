/**
 * packages/cms/src/collections/redirects.ts
 *
 * Payload 3.82.1 CollectionConfig for the `redirects` collection.
 * 301/302 redirects with broken link tracking.
 *
 * REQ-052: redirects collection
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

export const redirectsCollection: CollectionConfig = {
  slug: 'redirects',
  admin: {
    useAsTitle: 'from_path',
    defaultColumns: ['from_path', 'to_path', 'type', 'is_broken', 'agency_id'],
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
      name: 'from_path',
      type: 'text',
      required: true,
      admin: {
        description: 'The path being redirected (e.g. /old-page or /old-page/).',
      },
    },
    {
      name: 'to_path',
      type: 'text',
      required: true,
      admin: {
        description: 'The destination path or URL.',
      },
    },
    {
      name: 'type',
      type: 'select',
      defaultValue: '301',
      options: [
        { label: '301 — Permanent Redirect', value: '301' },
        { label: '302 — Temporary Redirect', value: '302' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'is_broken',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Set by the broken-link scanner when the destination returns 4xx/5xx.',
      },
    },
    {
      name: 'broken_detected_at',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'Timestamp when the redirect was last detected as broken.',
      },
    },
  ],
}
