/**
 * packages/db/src/schema/agencies.ts
 *
 * Top-level agencies table.
 * NOT agency-scoped — it IS the agency record.
 * Each row's `id` is referenced as `agency_id` by every other tenant table.
 *
 * No RLS on this table — agency listings are super_admin-only functionality
 * enforced at the app layer (M001-M002 milestone). Phase 3 will add
 * fine-grained access control here.
 */

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

export const agencies = pgTable('agencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(), // brand, ecommerce, growth, ...
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
