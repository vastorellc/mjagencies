/**
 * packages/cms/src/collections/posts.ts
 *
 * Payload 3.82.1 CollectionConfig for the `posts` collection.
 * Blog posts — agency-scoped with full content workflow.
 *
 * REQ-052: posts collection
 * REQ-056: Draft/Review/Scheduled/Published workflow
 * REQ-057: Scheduled publishing via BullMQ
 * REQ-058: 20 rolling revisions
 */
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'
import {
  validateWordCount,
  validateInternalLinks,
  validatePlaybookNumbers,
  validateFtcDisclaimer,
  validateFtcTestimonial,
} from '../hooks/content-validators.js'
import { schedulePublishHook } from '../hooks/scheduled-publish.js'

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
    { label: 'Review', value: 'review' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' },
  ],
  admin: { position: 'sidebar' },
}

export const postsCollection: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'category', 'author', 'agency_id', 'updatedAt'],
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
  hooks: {
    beforeOperation: [
      validateWordCount,
      validateInternalLinks,
      validatePlaybookNumbers,
      validateFtcDisclaimer,
      validateFtcTestimonial,
    ],
    afterChange: [schedulePublishHook],
  },
  fields: [
    AGENCY_ID_FIELD,
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { position: 'sidebar' },
    },
    STATUS_FIELD,
    {
      name: 'publish_at',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      admin: { position: 'sidebar' },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'authors',
      admin: { position: 'sidebar' },
    },
    {
      name: 'is_composite_playbook',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'content',
      type: 'richText',
      // Plan 05-04 fills the full Lexical feature config
    },
    {
      name: 'excerpt',
      type: 'textarea',
      maxLength: 160,
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
