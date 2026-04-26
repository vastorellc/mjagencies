/**
 * packages/cms/src/collections/forms.ts
 *
 * Payload 3.82.1 CollectionConfig for the `forms` collection.
 * Form definitions — contact, newsletter, booking, lead-gen.
 *
 * REQ-052: forms collection
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

export const formsCollection: CollectionConfig = {
  slug: 'forms',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'form_type', 'agency_id', 'updatedAt'],
    group: 'Forms',
  },
  access: {
    read: collectionAccess,
    create: collectionAccess,
    update: collectionAccess,
    delete: deleteAccess,
  },
  fields: [
    AGENCY_ID_FIELD,
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'form_type',
      type: 'select',
      options: [
        { label: 'Contact', value: 'contact' },
        { label: 'Newsletter', value: 'newsletter' },
        { label: 'Booking', value: 'booking' },
        { label: 'Lead Gen', value: 'lead-gen' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'fields_config',
      type: 'json',
      admin: {
        description: 'JSON definition of form fields (type, label, validation rules, etc.).',
      },
    },
    {
      name: 'confirmation_message',
      type: 'richText',
    },
    {
      name: 'redirect_url',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    {
      name: 'spam_protection',
      type: 'select',
      defaultValue: 'honeypot',
      options: [
        { label: 'Honeypot', value: 'honeypot' },
        { label: 'reCAPTCHA v3', value: 'recaptcha' },
        { label: 'Cloudflare Turnstile', value: 'turnstile' },
      ],
      admin: { position: 'sidebar' },
    },
  ],
}
