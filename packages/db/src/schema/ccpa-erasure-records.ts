/**
 * packages/db/src/schema/ccpa-erasure-records.ts
 * Plan 11-05 / REQ-144 D-07: hash-chained audit trail of CCPA erasure operations.
 *
 * Per-agency, RLS, immutable (no UPDATE/DELETE — hash chain integrity).
 * Pattern reused from Phase 2 audit_log + Phase 10 esign_records.
 *
 * Hash composition (D-07):
 *   record_hash = SHA-256(prev_hash + request_id + system + occurred_at + JSON(result))
 *
 * Quarterly CI verification: walk the chain by request_id, recompute each row's hash,
 * fail if any computed hash diverges from stored value.
 */
import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const ccpaErasureRecords = pgTable(
  'ccpa_erasure_records',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    agencyId: uuid('agency_id').notNull(),
    /** Erasure request UUID — groups all 7 system rows that comprise a single request */
    requestId: text('request_id').notNull(),
    /** Which downstream system this row records: postgres | redis | r2 | ga4 | meta_capi | clarity | litellm */
    system: text('system').notNull(),
    /** Per-system result payload — { deleted: number, skipped: number, reason?: string } or system-specific shape */
    result: jsonb('result').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    /** Previous row's record_hash in the chain (NULL for the first/genesis row of a request) */
    prevHash: text('prev_hash'),
    /** SHA-256(prev_hash + request_id + system + occurred_at + JSON.result) — NEVER mutable (D-07) */
    recordHash: text('record_hash').notNull(),
  },
  (t) => [
    index('ccpa_erasure_agency_request_idx').on(t.agencyId, t.requestId),
    index('ccpa_erasure_request_idx').on(t.requestId),
    index('ccpa_erasure_occurred_idx').on(t.occurredAt),
  ],
)

export const ccpaErasureRecordsRlsSql = `
  ALTER TABLE ccpa_erasure_records ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ccpa_erasure_records_agency_iso ON ccpa_erasure_records
    USING (agency_id = (current_setting('app.agency_id', true))::uuid);
  -- Append-only — no DELETE policy, no UPDATE policy.
`
