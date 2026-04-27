/**
 * packages/booking/src/collections/booking-configs.ts
 * REQ-114: per-agency Cal.com configuration.
 *
 * Stores Cal.com booking configuration per agency:
 *   cal_link       — Cal.com username/event slug (e.g. agency-ecommerce/30min)
 *   meeting_types  — list of meeting types with slug + duration
 *   agency_id      — immutable, set at creation (CLAUDE.md §8)
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

export const bookingConfigsCollection: CollectionConfig = {
  slug: 'booking_configs',
  admin: {
    useAsTitle: 'cal_link',
    defaultColumns: ['cal_link', 'agency_id'],
    group: 'Booking',
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
      name: 'cal_link',
      type: 'text',
      required: true,
      admin: {
        description: 'Cal.com username/event slug, e.g. agency-ecommerce/30min',
      },
    },
    {
      name: 'meeting_types',
      type: 'array',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true },
        { name: 'duration_minutes', type: 'number', min: 15, defaultValue: 30 },
      ],
    },
  ],
}
