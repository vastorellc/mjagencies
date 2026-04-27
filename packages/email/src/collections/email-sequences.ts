/**
 * packages/email/src/collections/email-sequences.ts
 * REQ-112: email drip sequences managed in Payload admin.
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

export const emailSequencesCollection: CollectionConfig = {
  slug: 'email_sequences',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'agency_id', 'updatedAt'],
    group: 'Email',
  },
  access: {
    read: collectionAccess,
    create: collectionAccess,
    update: collectionAccess,
    delete: deleteAccess,
  },
  fields: [
    AGENCY_ID_FIELD,
    { name: 'name', type: 'text', required: true },
    {
      name: 'steps',
      type: 'array',
      fields: [
        { name: 'template_id', type: 'relationship', relationTo: 'email_templates' },
        {
          name: 'delay_hours',
          type: 'number',
          required: true,
          min: 0,
          admin: { description: 'Hours after enrollment (cumulative from step 1)' },
        },
        { name: 'subject', type: 'text', required: true },
        {
          name: 'html_template',
          type: 'textarea',
          admin: {
            description:
              'Override template HTML for this step (optional — if empty uses template_id)',
          },
        },
      ],
    },
    { name: 'description', type: 'textarea' },
  ],
}
