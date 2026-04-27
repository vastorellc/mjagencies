/**
 * packages/email/src/collections/email-templates.ts
 * REQ-111: reusable email templates managed in Payload admin.
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

export const emailTemplatesCollection: CollectionConfig = {
  slug: 'email_templates',
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'category', 'agency_id'],
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
    { name: 'subject', type: 'text', required: true },
    { name: 'html_body', type: 'richText' },
    { name: 'text_body', type: 'textarea' },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Welcome', value: 'welcome' },
        { label: 'Follow-up', value: 'follow_up' },
        { label: 'Proposal Sent', value: 'proposal_sent' },
        { label: 'Deal Won', value: 'won' },
        { label: 'Deal Lost', value: 'lost' },
        { label: 'Newsletter', value: 'newsletter' },
        { label: 'Transactional', value: 'transactional' },
      ],
      admin: { position: 'sidebar' },
    },
  ],
}
