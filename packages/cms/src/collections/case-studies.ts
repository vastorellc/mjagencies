/**
 * packages/cms/src/collections/case-studies.ts
 *
 * Payload 3.82.1 CollectionConfig for the `case-studies` collection.
 *
 * Case studies are agency-scoped marketing artifacts (challenge / solution /
 * results) that surface on /case-studies/[slug] routes across the agency apps.
 *
 * Mirrors the SeedCaseStudy interface in
 * packages/db/src/seeds/agency-seed-manifest.ts so seeded records flow through
 * the standard seed-payload-collections.ts pipeline without shape mismatches.
 *
 * Backlog 999.1 — Pre-D: required for case-studies/[slug]/page.tsx routes
 * (which did not exist anywhere before this commit).
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

const STATUS_FIELD: Field = {
  name: 'status',
  type: 'select',
  defaultValue: 'draft',
  options: [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' },
  ],
  admin: { position: 'sidebar' },
}

export const caseStudiesCollection: CollectionConfig = {
  slug: 'case-studies',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'client', 'status', 'agency_id', 'updatedAt'],
    group: 'Content',
  },
  access: {
    read: collectionAccess,
    create: collectionAccess,
    update: collectionAccess,
    delete: deleteAccess,
  },
  versions: {
    maxPerDoc: 20,
    drafts: { autosave: { interval: 30000 } },
  },
  fields: [
    AGENCY_ID_FIELD,
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { position: 'sidebar' },
    },
    STATUS_FIELD,
    { name: 'client', type: 'text', required: true },
    { name: 'challenge', type: 'textarea', required: true },
    { name: 'solution', type: 'textarea', required: true },
    { name: 'results', type: 'textarea', required: true },
    {
      name: 'content',
      type: 'richText',
      // Long-form narrative — Lexical features inherited from buildPayloadConfig
    },
    {
      name: 'meta_title',
      type: 'text',
      maxLength: 60,
      admin: { position: 'sidebar' },
    },
    {
      name: 'meta_description',
      type: 'text',
      maxLength: 160,
      admin: { position: 'sidebar' },
    },
    {
      name: 'aio_tldr',
      type: 'text',
      maxLength: 120,
      admin: { position: 'sidebar' },
    },
    {
      name: 'canonical_url',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    {
      name: 'featured_image',
      type: 'upload',
      relationTo: 'media_assets',
    },
  ],
}
