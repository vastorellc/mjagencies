/**
 * packages/crm/src/collections/tasks.ts
 * REQ-103: tasks collection with agency isolation + SLA deadline field.
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

export const tasksCollection: CollectionConfig = {
  slug: 'tasks',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'due_date', 'sla_deadline', 'agency_id'],
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
    {
      name: 'due_date',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'sla_deadline',
      type: 'date',
      admin: {
        readOnly: true,
        description:
          'Auto-set to now + 4 business hours on lead creation (REQ-104). Written by CRM queue worker in 09-02.',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    { name: 'assigned_to', type: 'relationship', relationTo: 'users' },
    { name: 'contact_id', type: 'relationship', relationTo: 'contacts' },
    { name: 'deal_id', type: 'relationship', relationTo: 'deals' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Done', value: 'done' },
      ],
      admin: { position: 'sidebar' },
    },
  ],
}
