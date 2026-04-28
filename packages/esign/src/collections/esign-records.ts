/**
 * packages/esign/src/collections/esign-records.ts
 * REQ-126: ESIGN Act compliant audit trail collection.
 * REQ-133: stores R2 storage key + PDF hash for chargeback package.
 *
 * IMMUTABILITY: delete access = () => false — legal record, no agency admin can delete.
 * AGENCY ISOLATION: agency_id field access.update = fieldImmutable (CLAUDE.md §8).
 */
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id', type: 'text', required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

export const esignRecordsCollection: CollectionConfig = {
  slug: 'esign_records',
  admin: {
    useAsTitle: 'proposal_id',
    defaultColumns: ['proposal_id', 'signer_name', 'signed_at', 'r2_key', 'agency_id'],
    group: 'E-Sign',
  },
  access: {
    read: collectionAccess,
    create: () => true, // written by esign worker (server-side)
    update: deleteAccess,
    delete: () => false, // immutable — legal record, no agency admin can delete
  },
  fields: [
    AGENCY_ID_FIELD,
    { name: 'proposal_id', type: 'relationship', relationTo: 'proposals', required: true },
    { name: 'pdf_hash', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'r2_key', type: 'text', required: true, admin: { readOnly: true, description: 'R2 storage key: agency:{agencyId}/esign/{id}.pdf' } },
    { name: 'signer_ip_hash', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'signer_user_agent', type: 'text', admin: { readOnly: true } },
    { name: 'signer_name', type: 'text', required: true, admin: { readOnly: true } },
    {
      name: 'disclosure_text',
      type: 'textarea',
      required: true,
      admin: {
        readOnly: true,
        description: 'ESIGN Act disclosure text shown to signer — stored verbatim for legal record',
      },
    },
    {
      name: 'signed_at',
      type: 'date',
      required: true,
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'prev_hash', type: 'text', admin: { readOnly: true } },
    { name: 'record_hash', type: 'text', required: true, admin: { readOnly: true } },
  ],
}
