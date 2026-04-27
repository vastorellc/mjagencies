/**
 * packages/crm/src/collections/activities.ts
 * REQ-103: activities collection with agency isolation + activity types.
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

export const activitiesCollection: CollectionConfig = {
  slug: 'activities',
  admin: {
    useAsTitle: 'type',
    defaultColumns: ['type', 'contact_id', 'deal_id', 'agency_id', 'createdAt'],
    group: 'CRM',
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
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Email Sent', value: 'email_sent' },
        { label: 'Call', value: 'call' },
        { label: 'Meeting', value: 'meeting' },
        { label: 'Note', value: 'note' },
      ],
    },
    { name: 'contact_id', type: 'relationship', relationTo: 'contacts' },
    { name: 'deal_id', type: 'relationship', relationTo: 'deals' },
    { name: 'logged_by', type: 'relationship', relationTo: 'users' },
    { name: 'body', type: 'textarea' },
  ],
}
