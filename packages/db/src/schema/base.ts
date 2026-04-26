/**
 * packages/db/src/schema/base.ts
 *
 * Agency-scoped base columns — spread into every tenant table via:
 *   export const myTable = pgTable('my_table', { ...agencyBaseColumns, ... })
 *
 * agency_id is immutable after insert, enforced by the database-level trigger
 * defined in custom migration 001_agency_id_immutable.sql.
 *
 * createdAt / updatedAt are managed by the application layer (not DB triggers)
 * at this plan; Plan 02-06 may add a DB-side updatedAt trigger.
 */

import { uuid, timestamp } from 'drizzle-orm/pg-core'

export const agencyBaseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  agencyId: uuid('agency_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}
