/**
 * packages/cms/src/collections/tools.ts
 *
 * Payload 3.82.1 CollectionConfig for the `tools` collection.
 * Tool pages with benchmark data and scheduled publishing.
 *
 * REQ-052: tools collection
 * REQ-056: Draft/Review/Scheduled/Published workflow
 * REQ-057: Scheduled publishing via BullMQ
 * REQ-201: word count floor (tool = 2200 min)
 */
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'
import { validateWordCount } from '../hooks/content-validators.js'
import { schedulePublishHook } from '../hooks/scheduled-publish.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id',
  type: 'text',
  required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

export const toolsCollection: CollectionConfig = {
  slug: 'tools',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'agency_id', 'updatedAt'],
    group: 'Tools',
  },
  access: {
    read: collectionAccess,
    create: collectionAccess,
    update: collectionAccess,
    delete: deleteAccess,
  },
  versions: {
    maxPerDoc: 20,
  },
  hooks: {
    beforeOperation: [validateWordCount],
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
    {
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
    },
    {
      name: 'publish_at',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'content',
      type: 'richText',
    },
    {
      name: 'benchmark_data',
      type: 'json',
      admin: {
        description: 'Tool benchmark data. All numbers must be cited from real sources (CLAUDE.md §6).',
      },
    },
    {
      name: 'benchmark_expires_at',
      type: 'date',
      admin: {
        position: 'sidebar',
        description: 'When benchmark data becomes stale and requires review.',
      },
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
  ],
}
