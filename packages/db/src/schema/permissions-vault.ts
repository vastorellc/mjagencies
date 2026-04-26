/**
 * packages/db/src/schema/permissions-vault.ts
 *
 * permissions_vault table — agency-scoped, RLS enabled.
 *
 * Stores AES-GCM-256 encrypted permission values.
 * Format: encrypted_value = IV(12 bytes) || authTag(16 bytes) || ciphertext
 *
 * Plan 02-06 implements the full encrypt/decrypt helpers.
 * This plan defines the table structure and RLS policy.
 *
 * UNIQUE constraint on (agency_id, permission_key) — Plan 02-06's
 * encrypt/decrypt helpers rely on this for deterministic lookup.
 *
 * FORCE ROW LEVEL SECURITY applied via custom migration 002_force_rls_and_app_role.sql.
 */

import { pgTable, text, timestamp, integer, uniqueIndex, customType } from 'drizzle-orm/pg-core'
import { pgPolicy } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { agencyBaseColumns } from './base.js'

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
})

export const permissionsVault = pgTable(
  'permissions_vault',
  {
    ...agencyBaseColumns,
    permissionKey: text('permission_key').notNull(),
    encryptedValue: bytea('encrypted_value').notNull(), // IV(12) || authTag(16) || ciphertext
    keyVersion: integer('key_version').notNull().default(1),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('permissions_vault_agency_key_idx').on(t.agencyId, t.permissionKey),
    pgPolicy('permissions_vault_agency_isolation', {
      as: 'permissive',
      for: 'all',
      to: sql`CURRENT_USER`,
      using: sql`agency_id = current_setting('app.agency_id', true)::uuid`,
      withCheck: sql`agency_id = current_setting('app.agency_id', true)::uuid`,
    }),
  ]
).enableRLS()
