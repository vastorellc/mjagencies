/**
 * packages/crm/src/collections/deals.ts
 * REQ-102: deals collection with agency isolation + pipeline stages.
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

export const dealsCollection: CollectionConfig = {
  slug: 'deals',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'stage', 'value', 'agency_id'],
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
    { name: 'title', type: 'text', required: true },
    { name: 'value', type: 'number', min: 0, defaultValue: 0 },
    {
      name: 'stage',
      type: 'select',
      defaultValue: 'lead',
      options: [
        { label: 'Lead', value: 'lead' },
        { label: 'Proposal', value: 'proposal' },
        { label: 'Negotiation', value: 'negotiation' },
        { label: 'Won', value: 'won' },
        { label: 'Lost', value: 'lost' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'account_id', type: 'relationship', relationTo: 'accounts' },
    { name: 'contacts', type: 'relationship', relationTo: 'contacts', hasMany: true },
    {
      name: 'expected_close_date',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
  ],
}
