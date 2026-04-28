/**
 * packages/compliance/src/collections/ccpa-erasure-records.ts
 * Plan 11-05 / REQ-144 D-07: Payload collection definition for the hash-chained
 * CCPA erasure audit trail.
 *
 * D-07 immutability contract:
 *   - update: () => false  — collection-level
 *   - delete: () => false  — collection-level
 *   - Every field declares { access: { update: () => false } } so no field can mutate.
 *
 * Worker writes via payload.create(... { overrideAccess: true }) — see
 * packages/compliance/src/erasure/audit.ts.
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

export const ccpaErasureRecordsCollection: CollectionConfig = {
  slug: 'ccpa_erasure_records',
  admin: {
    useAsTitle: 'request_id',
    group: 'Privacy',
    defaultColumns: ['request_id', 'system', 'occurred_at', 'agency_id'],
  },
  access: {
    read: collectionAccess,
    create: collectionAccess,
    // D-07 — append-only hash chain. Mutations would break chain integrity.
    update: () => false,
    delete: () => false,
  },
  fields: [
    AGENCY_ID_FIELD,
    {
      name: 'request_id',
      type: 'text',
      required: true,
      access: { update: () => false },
    },
    {
      name: 'system',
      type: 'select',
      required: true,
      options: [
        { label: 'Postgres', value: 'postgres' },
        { label: 'Redis', value: 'redis' },
        { label: 'R2', value: 'r2' },
        { label: 'GA4', value: 'ga4' },
        { label: 'Meta CAPI', value: 'meta_capi' },
        { label: 'Microsoft Clarity', value: 'clarity' },
        { label: 'LiteLLM', value: 'litellm' },
      ],
      access: { update: () => false },
    },
    {
      name: 'result',
      type: 'json',
      access: { update: () => false },
    },
    {
      name: 'occurred_at',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
      access: { update: () => false },
    },
    {
      name: 'prev_hash',
      type: 'text',
      access: { update: () => false },
      admin: { description: 'NULL for genesis row of a request; otherwise previous row record_hash.' },
    },
    {
      name: 'record_hash',
      type: 'text',
      required: true,
      access: { update: () => false },
      admin: { description: 'sha256(prev_hash + request_id + system + occurred_at + JSON.result)' },
    },
  ],
}
