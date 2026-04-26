/**
 * packages/cms/src/collections/global-blocks.ts
 *
 * Payload 3.82.1 CollectionConfig for the `global_blocks` collection.
 * Global blocks — edit once, propagate everywhere. (REQ-059)
 *
 * A global block stores a block's configuration JSON. Any page that references
 * this global block by ID renders the shared block data. When the global block
 * is updated, all referencing pages receive the change on their next render.
 *
 * REQ-059: global block references
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

export const globalBlocksCollection: CollectionConfig = {
  slug: 'global_blocks',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'block_type', 'last_propagated_at', 'agency_id'],
    group: 'Content',
    description:
      'Edit once, propagate everywhere. Changes to a global block apply to all pages referencing it.',
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
      admin: {
        description: 'Human-readable name for this global block (e.g. "Main CTA Banner").',
      },
    },
    {
      name: 'block_type',
      type: 'text',
      admin: {
        description:
          'Block slug matching the block library (e.g. "cta-full", "testimonials-grid"). Used to look up the correct React component.',
      },
    },
    {
      name: 'block_data',
      type: 'json',
      admin: {
        description: 'Block configuration JSON — same format as the block library (Plan 05-03).',
      },
    },
    {
      name: 'last_propagated_at',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Timestamp of the last ISR cache purge triggered by an update to this block.',
      },
    },
  ],
}
