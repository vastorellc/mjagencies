/**
 * packages/invoices/src/collections/invoices.ts
 * REQ-418: invoice 7-state machine (draft→sent→viewed→paid→partial→refunded→disputed).
 * REQ-128: partial payment tracker.
 * REQ-419: chargeback evidence.
 */
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id', type: 'text', required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

export const invoicesCollection: CollectionConfig = {
  slug: 'invoices',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'total_amount', 'amount_paid', 'remaining_balance', 'due_date', 'agency_id'],
    group: 'Invoicing',
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
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Sent — Awaiting Payment', value: 'sent' },
        { label: 'Viewed by Client', value: 'viewed' },
        { label: 'Paid in Full', value: 'paid' },
        { label: 'Partially Paid — Balance Due', value: 'partial' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Payment Disputed', value: 'disputed' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'total_amount',
      type: 'number',
      required: true,
      min: 0,
      admin: { description: 'Total invoice amount in base currency unit (USD cents if currency=usd)' },
    },
    {
      name: 'amount_paid',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Sum of all payments received',
      },
    },
    {
      name: 'remaining_balance',
      type: 'number',
      min: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'total_amount - amount_paid',
      },
    },
    { name: 'currency', type: 'text', defaultValue: 'usd', admin: { position: 'sidebar' } },
    {
      name: 'line_items',
      type: 'array',
      fields: [
        { name: 'description', type: 'text', required: true },
        { name: 'quantity', type: 'number', required: true, min: 1 },
        { name: 'unit_amount', type: 'number', required: true, min: 0 },
      ],
    },
    {
      name: 'proposal_id',
      type: 'relationship',
      relationTo: 'proposals',
      admin: {
        position: 'sidebar',
        description: 'Source proposal (from e-sign)',
      },
    },
    {
      name: 'esign_id',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'E-sign record ID for chargeback evidence',
      },
    },
    { name: 'contact_id', type: 'relationship', relationTo: 'contacts', admin: { position: 'sidebar' } },
    { name: 'deal_id', type: 'relationship', relationTo: 'deals', admin: { position: 'sidebar' } },
    { name: 'stripe_payment_link_url', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'paypal_checkout_url', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'chargeback_evidence',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'Auto-compiled chargeback evidence package (REQ-419)',
      },
    },
    {
      name: 'due_date',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayOnly' },
      },
    },
    {
      name: 'sent_at',
      type: 'date',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'paid_at',
      type: 'date',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'refunded_at',
      type: 'date',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
  ],
}
