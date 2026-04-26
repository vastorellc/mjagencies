/**
 * packages/db/src/schema/seed-state.ts
 *
 * _seed_state table — resumability bookkeeping for the seed framework.
 *
 * One row per seed step per agency DB. Plan 02-04 (seed framework) consumes
 * this table to implement resumable seeds: steps in 'completed' status are
 * skipped on re-run; 'failed' steps are retried from where they left off.
 *
 * NO RLS — single-row-per-step bookkeeping inside an already-tenant-isolated DB.
 * The table is not agency-scoped (no agency_id column) because it lives inside
 * the per-agency database which is already isolated at the connection level.
 *
 * status values: pending | running | completed | failed
 * CHECK constraint on status is added by Plan 02-04's migration (not here, to
 * avoid ordering dependency between Drizzle-generated and custom migrations).
 */

import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const seedState = pgTable('_seed_state', {
  stepName: text('step_name').primaryKey(),
  status: text('status').notNull(), // pending | running | completed | failed
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorText: text('error_text'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
})
