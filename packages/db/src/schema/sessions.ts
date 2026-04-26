/**
 * packages/db/src/schema/sessions.ts
 *
 * Sessions table — agency-scoped, RLS enabled.
 *
 * Phase 3 wires the JWT token-family revocation logic (revokedAt + tokenFamilyId).
 * This plan defines the table structure only.
 *
 * tokenFamilyId supports family revocation on replay: when a refresh token is
 * replayed, ALL sessions in the same family are revoked (Phase 3 implementation).
 *
 * FORCE ROW LEVEL SECURITY applied via custom migration 002_force_rls_and_app_role.sql.
 */

import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core'
import { pgPolicy } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { agencyBaseColumns } from './base.js'

export const sessions = pgTable(
  'sessions',
  {
    ...agencyBaseColumns,
    userId: uuid('user_id').notNull(),
    tokenFamilyId: uuid('token_family_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    pgPolicy('sessions_agency_isolation', {
      as: 'permissive',
      for: 'all',
      to: sql`CURRENT_USER`,
      using: sql`agency_id = current_setting('app.agency_id', true)::uuid`,
      withCheck: sql`agency_id = current_setting('app.agency_id', true)::uuid`,
    }),
  ]
).enableRLS()
