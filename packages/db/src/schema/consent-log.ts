/**
 * packages/db/src/schema/consent-log.ts
 * Plan 11-05 / REQ-144 D-03: append-only audit of consent state changes.
 * Per-agency, RLS. Captures (email_hash, clarity_user_id, ga_client_id, ip_hash, action) per
 * opt-out / opt-in / erasure event.
 *
 * PII discipline (T-11-05-05): email and IP are SHA-256 hashed before insert; raw values are NEVER
 * persisted. clarityUserId and gaClientId are anonymous third-party identifiers (already pseudonymous).
 */
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const consentLog = pgTable(
  'consent_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    agencyId: uuid('agency_id').notNull(),
    /** SHA-256 of email — never raw */
    emailHash: text('email_hash'),
    /** Clarity internal user ID — captured via Clarity.identify() at session start */
    clarityUserId: text('clarity_user_id'),
    /** GA4 client_id (anonymous cookie) */
    gaClientId: text('ga_client_id'),
    /** SHA-256 of IP — for rate-limit forensics; raw IP never stored */
    ipHash: text('ip_hash').notNull(),
    userAgent: text('user_agent'),
    /** 'opt_out' | 'opt_in' | 'erasure_requested' | 'erasure_confirmed' | 'erasure_completed' */
    action: text('action').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('consent_log_agency_action_time_idx').on(t.agencyId, t.action, t.occurredAt),
    index('consent_log_email_hash_idx').on(t.emailHash),
  ],
)

export const consentLogRlsSql = `
  ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;
  CREATE POLICY consent_log_agency_iso ON consent_log
    USING (agency_id = (current_setting('app.agency_id', true))::uuid);
`
