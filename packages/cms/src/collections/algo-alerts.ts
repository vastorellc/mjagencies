/**
 * packages/cms/src/collections/algo-alerts.ts
 * Payload 3.82.1 CollectionConfig for the `algo_alerts` collection.
 * Global collection — super_admin only. No agency_id.
 *
 * Populated by algorithm watcher BullMQ job (REQ-074, D-12).
 * RSS items matching keyword list create records here.
 * Admins dismiss/archive by setting status = 'reviewed'.
 *
 * Security: superAdminOnly on ALL operations (Pitfall 6 in RESEARCH.md).
 * Rationale: algo intelligence must not leak to agency editors.
 */
import type { CollectionConfig } from 'payload'
import { superAdminOnly } from '../access/collection-access.js'

export const algoAlertsCollection: CollectionConfig = {
  slug: 'algo_alerts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'source', 'matched_keywords', 'status', 'createdAt'],
    group: 'SEO',
  },
  access: {
    read: superAdminOnly,
    create: superAdminOnly,
    update: superAdminOnly,
    delete: superAdminOnly,
  },
  fields: [
    // NO agency_id — global collection (D-12)
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'source',
      type: 'select',
      options: [
        { label: 'Google Search Central', value: 'google_search_central' },
        { label: 'Configurable Feed', value: 'configurable_feed' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'link',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Original post URL from RSS item.',
      },
    },
    {
      name: 'matched_keywords',
      type: 'json',
      admin: {
        description: 'Array of keywords from the watch list that matched this item.',
      },
    },
    {
      name: 'snippet',
      type: 'textarea',
      admin: {
        description: 'RSS item contentSnippet (excerpt).',
      },
    },
    {
      name: 'pub_date',
      type: 'date',
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Reviewed', value: 'reviewed' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'guid',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'RSS item GUID used for deduplication (D-13).',
      },
    },
  ],
}
