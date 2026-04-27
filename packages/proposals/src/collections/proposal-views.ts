/**
 * packages/proposals/src/collections/proposal-views.ts
 * REQ-125: proposal view tracking collection.
 * Stores SHA-256 hashed IP, geo city/state, user-agent per visit.
 * Raw IP is never stored.
 */
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id', type: 'text', required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

export const proposalViewsCollection: CollectionConfig = {
  slug: 'proposal_views',
  admin: {
    useAsTitle: 'proposal_id',
    defaultColumns: ['proposal_id', 'geo_city', 'geo_state', 'viewed_at', 'agency_id'],
    group: 'Proposals',
  },
  access: {
    read: collectionAccess,
    create: () => true, // public — view tracking from public proposal route
    update: deleteAccess,
    delete: deleteAccess,
  },
  fields: [
    AGENCY_ID_FIELD,
    { name: 'proposal_id', type: 'relationship', relationTo: 'proposals', required: true },
    { name: 'ip_hash', type: 'text', required: true, admin: { description: 'SHA-256 hash of visitor IP — raw IP never stored' } },
    { name: 'user_agent', type: 'text' },
    { name: 'geo_city', type: 'text', admin: { position: 'sidebar' } },
    { name: 'geo_state', type: 'text', admin: { position: 'sidebar' } },
    { name: 'viewed_at', type: 'date', required: true, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
  ],
}
