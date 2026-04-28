/**
 * packages/compliance/src/collections/consent-log.ts
 * Plan 11-05 / REQ-144 D-03: Payload collection for per-agency consent state log.
 *
 * Append-only — update/delete denied. PII discipline: emails and IPs SHA-256 hashed
 * BEFORE insert at the call site (route handler), never raw values.
 */
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, fieldImmutable } from '../access/collection-access.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id',
  type: 'text',
  required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

export const consentLogCollection: CollectionConfig = {
  slug: 'consent_log',
  admin: {
    useAsTitle: 'action',
    group: 'Privacy',
    defaultColumns: ['action', 'occurred_at', 'agency_id'],
  },
  access: {
    read: collectionAccess,
    create: collectionAccess,
    update: () => false,
    delete: () => false,
  },
  fields: [
    AGENCY_ID_FIELD,
    {
      name: 'email_hash',
      type: 'text',
      access: { update: () => false },
      admin: { description: 'SHA-256(email) — raw email NEVER stored' },
    },
    {
      name: 'clarity_user_id',
      type: 'text',
      access: { update: () => false },
    },
    {
      name: 'ga_client_id',
      type: 'text',
      access: { update: () => false },
    },
    {
      name: 'ip_hash',
      type: 'text',
      required: true,
      access: { update: () => false },
      admin: { description: 'SHA-256(ip) — raw IP NEVER stored' },
    },
    {
      name: 'user_agent',
      type: 'text',
      access: { update: () => false },
    },
    {
      name: 'action',
      type: 'select',
      required: true,
      options: [
        { label: 'Opt-Out', value: 'opt_out' },
        { label: 'Opt-In', value: 'opt_in' },
        { label: 'Erasure Requested', value: 'erasure_requested' },
        { label: 'Erasure Confirmed', value: 'erasure_confirmed' },
        { label: 'Erasure Completed', value: 'erasure_completed' },
      ],
      access: { update: () => false },
    },
    {
      name: 'occurred_at',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
      access: { update: () => false },
    },
  ],
}
