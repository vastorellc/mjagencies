/**
 * packages/proposals/src/collections/proposals.ts
 * REQ-125: proposal collection with status state machine.
 * Status values: active | viewed | signed | declined | expired | grace | nurture
 */
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id', type: 'text', required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

export const proposalsCollection: CollectionConfig = {
  slug: 'proposals',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'contact_id', 'expires_at', 'agency_id', 'updatedAt'],
    group: 'Proposals',
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
      name: 'token',
      type: 'text',
      required: true,
      admin: { readOnly: true, description: 'Cryptographically random 32-byte hex — auto-generated on create. Used in public URL.' },
      access: { update: () => false },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active — Awaiting Signature', value: 'active' },
        { label: 'Viewed', value: 'viewed' },
        { label: 'Signed', value: 'signed' },
        { label: 'Declined', value: 'declined' },
        { label: 'Expired', value: 'expired' },
        { label: 'Grace Period', value: 'grace' },
        { label: 'Nurture', value: 'nurture' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'body_json', type: 'json', required: true, admin: { description: 'Proposal content as structured JSON' } },
    { name: 'contact_id', type: 'relationship', relationTo: 'contacts', admin: { position: 'sidebar' } },
    { name: 'deal_id', type: 'relationship', relationTo: 'deals', admin: { position: 'sidebar' } },
    { name: 'sent_at', type: 'date', admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'expires_at', type: 'date', admin: { readOnly: true, position: 'sidebar', description: '14 days after sent_at (REQ-405)', date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'grace_ends_at', type: 'date', admin: { readOnly: true, position: 'sidebar', description: '7 days after expires_at (REQ-405)', date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'signed_at', type: 'date', admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'declined_at', type: 'date', admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } } },
  ],
}
