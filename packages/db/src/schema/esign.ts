/**
 * packages/db/src/schema/esign.ts
 * REQ-126: e-sign audit trail. REQ-133: PDF R2 storage.
 * Hash-chained audit trail (Phase 2 pattern).
 */
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const esignRecords = pgTable(
  'esign_records',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    agencyId: uuid('agency_id').notNull(),
    proposalId: uuid('proposal_id').notNull(),
    /** SHA-256 of the PDF bytes — proof of integrity */
    pdfHash: text('pdf_hash').notNull(),
    /** R2 storage key: agency:{agencyId}/esign/{id}.pdf */
    r2Key: text('r2_key').notNull(),
    /** SHA-256 hash of signer's IP — raw IP never stored */
    signerIpHash: text('signer_ip_hash').notNull(),
    signerUserAgent: text('signer_user_agent'),
    /** Name or identifier entered by signer */
    signerName: text('signer_name').notNull(),
    /** ESIGN Act disclosure text shown — stored verbatim for legal record */
    disclosureText: text('disclosure_text').notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true }).notNull(),
    /** Hash-chain: SHA-256(prev_hash + this record's fields) — Phase 2 audit log pattern */
    prevHash: text('prev_hash'),
    recordHash: text('record_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('esign_records_agency_idx').on(t.agencyId),
    index('esign_records_proposal_idx').on(t.proposalId),
  ],
)

export const esignRlsSql = `
  ALTER TABLE esign_records ENABLE ROW LEVEL SECURITY;
  CREATE POLICY esign_records_agency_iso ON esign_records
    USING (agency_id = (current_setting('app.agency_id', true))::uuid);
`
