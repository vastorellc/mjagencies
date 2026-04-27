/**
 * packages/db/src/schema/proposals.ts
 * Drizzle schema for proposals + proposal_views.
 * REQ-125: hosted page, view tracking, 14-day expiry.
 * REQ-405: 14d → expired → 7d grace → nurture.
 */
import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/** proposal_status values match UI-SPEC Surface 3 badge states */
// active | viewed | signed | declined | expired | grace | nurture

export const proposals = pgTable(
  'proposals',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    agencyId: uuid('agency_id').notNull(),
    /** 32-byte hex random token — used in public URL */
    token: text('token').notNull().unique(),
    contactId: uuid('contact_id'),
    dealId: uuid('deal_id'),
    title: text('title').notNull(),
    bodyJson: jsonb('body_json').notNull(),
    status: text('status').notNull().default('active'),
    /** ISO 8601 — proposal expires 14 days after sent_at */
    sentAt: timestamp('sent_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** Grace period ends 7 days after expiresAt */
    graceEndsAt: timestamp('grace_ends_at', { withTimezone: true }),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    declinedAt: timestamp('declined_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('proposals_agency_idx').on(t.agencyId),
    index('proposals_token_idx').on(t.token),
    index('proposals_status_expires_idx').on(t.status, t.expiresAt),
  ],
)

export const proposalViews = pgTable(
  'proposal_views',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    proposalId: uuid('proposal_id').notNull(),
    agencyId: uuid('agency_id').notNull(),
    ipHash: text('ip_hash').notNull(),
    userAgent: text('user_agent'),
    geoCity: text('geo_city'),
    geoState: text('geo_state'),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('proposal_views_proposal_idx').on(t.proposalId),
    index('proposal_views_agency_idx').on(t.agencyId),
  ],
)

export const proposalsRlsSql = `
  ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
  CREATE POLICY proposals_agency_iso ON proposals
    USING (agency_id = (current_setting('app.agency_id', true))::uuid);

  ALTER TABLE proposal_views ENABLE ROW LEVEL SECURITY;
  CREATE POLICY proposal_views_agency_iso ON proposal_views
    USING (agency_id = (current_setting('app.agency_id', true))::uuid);
`
