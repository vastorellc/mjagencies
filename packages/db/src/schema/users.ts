/**
 * packages/db/src/schema/users.ts
 *
 * Users table — agency-scoped, RLS enabled.
 *
 * role is text at this plan. Phase 3 will add a CHECK constraint via
 * custom migration to enforce the enum: super_admin | admin | editor.
 *
 * RLS policy: users_agency_isolation
 *   - USING: agency_id = current_setting('app.agency_id', true)::uuid
 *   - WITH CHECK: same — prevents inserting rows for a different agency
 *
 * FORCE ROW LEVEL SECURITY is applied via custom migration 002_force_rls_and_app_role.sql
 * so the table owner (migrations_runner) cannot bypass RLS during integration tests.
 */

import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { pgPolicy } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { agencyBaseColumns } from './base.js'

export const users = pgTable(
  'users',
  {
    ...agencyBaseColumns,
    email: text('email').notNull(),
    role: text('role').notNull(), // super_admin | admin | editor — Phase 3 enforces CHECK
  },
  (t) => [
    uniqueIndex('users_agency_email_idx').on(t.agencyId, t.email),
    pgPolicy('users_agency_isolation', {
      as: 'permissive',
      for: 'all',
      to: sql`CURRENT_USER`,
      using: sql`agency_id = current_setting('app.agency_id', true)::uuid`,
      withCheck: sql`agency_id = current_setting('app.agency_id', true)::uuid`,
    }),
  ]
).enableRLS()
