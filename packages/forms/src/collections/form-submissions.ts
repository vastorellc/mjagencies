import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id', type: 'text', required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

export const formSubmissionsCollection: CollectionConfig = {
  slug: 'form_submissions',
  admin: { useAsTitle: 'id', defaultColumns: ['form_id', 'status', 'agency_id', 'createdAt'], group: 'Forms' },
  access: {
    read: collectionAccess,
    create: collectionAccess,
    update: deleteAccess,
    delete: deleteAccess,
  },
  fields: [
    AGENCY_ID_FIELD,
    { name: 'form_id', type: 'relationship', relationTo: 'forms' },
    { name: 'data', type: 'json' },
    { name: 'ip_hash', type: 'text', admin: { readOnly: true } },
    { name: 'honeypot_passed', type: 'checkbox', defaultValue: false, admin: { readOnly: true } },
    { name: 'spam_score', type: 'number', min: 0, max: 1, defaultValue: 0, admin: { readOnly: true } },
    { name: 'utm_source', type: 'text' },
    { name: 'utm_medium', type: 'text' },
    { name: 'utm_campaign', type: 'text' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processed', value: 'processed' },
        { label: 'Spam', value: 'spam' },
      ],
      admin: { position: 'sidebar' },
    },
  ],
}
