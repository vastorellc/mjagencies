/**
 * packages/cms/src/collections/templates.ts
 *
 * Payload 3.82.1 CollectionConfig for the `templates` collection.
 * Content templates library — page, post, email, form templates.
 *
 * REQ-052: templates collection
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

export const templatesCollection: CollectionConfig = {
  slug: 'templates',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'template_type', 'agency_id', 'updatedAt'],
    group: 'Content',
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
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'template_type',
      type: 'select',
      options: [
        { label: 'Page', value: 'page' },
        { label: 'Post', value: 'post' },
        { label: 'Email', value: 'email' },
        { label: 'Form', value: 'form' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'blocks_json',
      type: 'json',
      admin: {
        description: 'Block configuration JSON — format matches Puck block output from Plan 05-04.',
      },
    },
    {
      name: 'tags',
      type: 'array',
      fields: [
        {
          name: 'tag',
          type: 'text',
        },
      ],
    },
  ],
}
