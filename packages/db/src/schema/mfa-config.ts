/**
 * packages/db/src/schema/mfa-config.ts
 *
 * MFA configuration per (agencyId, userId).
 * RLS-enforced like users/sessions/permissions_vault. agency_id immutable
 * (custom migration 005 adds the trigger AND audit + FORCE RLS).
 *
 * TOTP secret is NOT stored here — it lives in permissions_vault under
 * key 'mfa.totp_secret.<userId>' (Phase 2 vault helpers, AES-GCM-256).
 *
 * recovery_hashes: text[8] of bcrypt hashes (cost 12). Empty string = used slot.
 * Once all slots are empty, MFA reset workflow regenerates a new batch.
 *
 * RLS policy: mfa_config_agency_isolation
 *   - USING: agency_id = current_setting('app.agency_id', true)::uuid
 *   - WITH CHECK: same — prevents inserting rows for a different agency
 *
 * FORCE ROW LEVEL SECURITY applied via custom migration 005_audit_mfa_config.sql
 * (same pattern as users/sessions/permissions_vault — migration 002).
 *
 * T-03-009: Cross-agency MFA config read/write is mitigated by RLS + FORCE RLS
 * enforced via withAgencyContext wrapper on all DB query paths.
 *
 * Plan: 03-02
 * REQ-024: MFA mandatory for super_admin + admin (Plan 03-05 enforces via requireSession)
 * REQ-025: TOTP + 8 one-time recovery codes
 * REQ-309: 8 single-use bcrypt-stored codes
 */

import { pgTable, uuid, text, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core'
import { pgPolicy } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { agencyBaseColumns } from './base.js'

/**
 * MFA configuration per (agencyId, userId) — agency-scoped, RLS enabled.
 *
 * Columns:
 * - userId: uuid — references users.id (not enforced by FK here; RLS ensures agency isolation)
 * - recoveryHashes: text[] — 8 bcrypt hashes (cost 12), empty string = used slot
 * - mfaEnabledAt: when TOTP was first activated for this user
 * - lastVerifiedAt: last successful TOTP or recovery-code verification timestamp
 * - failedAttempts: in-DB counter (informational; authoritative lockout is in Redis)
 * - lockoutUntil: DB-side lockout timestamp (informational; Redis lockout is authoritative)
 */
export const mfaConfig = pgTable(
  'mfa_config',
  {
    ...agencyBaseColumns,
    userId: uuid('user_id').notNull().unique(),
    recoveryHashes: text('recovery_hashes').array().notNull(),
    mfaEnabledAt: timestamp('mfa_enabled_at', { withTimezone: true }),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockoutUntil: timestamp('lockout_until', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('mfa_config_agency_user_idx').on(t.agencyId, t.userId),
    pgPolicy('mfa_config_agency_isolation', {
      as: 'permissive',
      for: 'all',
      to: sql`CURRENT_USER`,
      using: sql`agency_id = current_setting('app.agency_id', true)::uuid`,
      withCheck: sql`agency_id = current_setting('app.agency_id', true)::uuid`,
    }),
  ],
).enableRLS()
