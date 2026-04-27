/**
 * packages/crm/src/collections/contacts.ts
 * REQ-100: contacts collection with agency isolation + lead routing hook.
 */
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'
// leadRoutingHook wired in 09-02 — import will be uncommented when hook is created
// import { leadRoutingHook } from '../hooks/lead-routing-hook.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id',
  type: 'text',
  required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

export const contactsCollection: CollectionConfig = {
  slug: 'contacts',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'first_name', 'last_name', 'status', 'score', 'agency_id', 'updatedAt'],
    group: 'CRM',
  },
  access: {
    read: collectionAccess,
    create: collectionAccess,
    update: collectionAccess,
    delete: deleteAccess,
  },
  hooks: {
    // afterChange: [leadRoutingHook], // uncomment after 09-02 creates the hook
  },
  fields: [
    AGENCY_ID_FIELD,
    { name: 'email', type: 'email', required: true },
    { name: 'first_name', type: 'text', required: true },
    { name: 'last_name', type: 'text', required: true },
    { name: 'phone', type: 'text' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Qualified', value: 'qualified' },
        { label: 'Closed Won', value: 'closed_won' },
        { label: 'Closed Lost', value: 'closed_lost' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'source', type: 'text', admin: { position: 'sidebar' } },
    {
      name: 'score',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Lead score 0-1, computed by scoring engine (09-02).',
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: { position: 'sidebar' },
    },
  ],
}
