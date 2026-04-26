/**
 * packages/db/src/schema/audit-log.ts
 *
 * audit_log table — append-only, hash-chained.
 *
 * NO RLS on this table (pitfall 8.8 — circular dependency):
 * If RLS were enabled, the audit trigger (SECURITY INVOKER) would run under
 * the app role's RLS context, making it impossible to insert audit rows for
 * other agencies' operations. Plan 02-06 will use a SECURITY DEFINER trigger.
 *
 * Tenant isolation is enforced via:
 *   1. `agency_id` column — app code always passes the correct agency_id
 *   2. REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC (migration 002_force_rls_and_app_role.sql)
 *
 * Hash-chain trigger (prev_hash, row_hash) is implemented by Plan 02-06.
 * This plan defines the table structure only.
 *
 * op CHECK constraint (INSERT | UPDATE | DELETE) is enforced via the
 * database-level CHECK in the custom migration since Drizzle 0.45.2 does
 * not have a pgCheck() helper for inline column constraints.
 */

import { pgTable, bigserial, uuid, text, timestamp, jsonb, bigint, customType } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
})

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  tableName: text('table_name').notNull(),
  op: text('op').notNull(), // INSERT | UPDATE | DELETE — CHECK enforced in migration
  rowPk: text('row_pk').notNull(),
  actorId: uuid('actor_id'),
  agencyId: uuid('agency_id').notNull(),
  dbUser: text('db_user').notNull().default(sql`CURRENT_USER`),
  txid: bigint('txid', { mode: 'bigint' })
    .notNull()
    .default(sql`txid_current()`),
  correlationId: text('correlation_id'),
  oldRow: jsonb('old_row'),
  newRow: jsonb('new_row'),
  prevHash: bytea('prev_hash'),
  rowHash: bytea('row_hash').notNull(),
})
