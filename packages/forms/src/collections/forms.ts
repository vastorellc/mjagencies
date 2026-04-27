import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id', type: 'text', required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

export const formsCollection: CollectionConfig = {
  slug: 'forms',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'agency_id', 'updatedAt'], group: 'Forms' },
  access: { read: collectionAccess, create: collectionAccess, update: collectionAccess, delete: deleteAccess },
  fields: [
    AGENCY_ID_FIELD,
    { name: 'name', type: 'text', required: true },
    {
      name: 'fields',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        {
          name: 'field_type',
          type: 'select',
          required: true,
          options: [
            { label: 'Text', value: 'text' },
            { label: 'Email', value: 'email' },
            { label: 'Phone', value: 'phone' },
            { label: 'Textarea', value: 'textarea' },
            { label: 'Select', value: 'select' },
            { label: 'Checkbox', value: 'checkbox' },
          ],
        },
        { name: 'required', type: 'checkbox', defaultValue: false },
        { name: 'options', type: 'array', fields: [{ name: 'label', type: 'text' }, { name: 'value', type: 'text' }] },
      ],
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
    { name: 'redirect_url', type: 'text', admin: { position: 'sidebar' } },
    {
      name: 'email_notification',
      type: 'group',
      fields: [
        { name: 'to', type: 'email' },
        { name: 'subject', type: 'text' },
        { name: 'template', type: 'text', admin: { description: 'Template ID from email_templates collection' } },
      ],
    },
  ],
}
