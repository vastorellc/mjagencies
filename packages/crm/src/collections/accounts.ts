/**
 * packages/crm/src/collections/accounts.ts
 * REQ-101: accounts collection with agency isolation.
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

export const accountsCollection: CollectionConfig = {
  slug: 'accounts',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'domain', 'industry', 'agency_id'],
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
    { name: 'name', type: 'text', required: true },
    { name: 'domain', type: 'text' },
    { name: 'industry', type: 'text' },
    { name: 'contacts', type: 'relationship', relationTo: 'contacts', hasMany: true },
  ],
}
