/**
 * packages/db/src/schema/invoices.ts
 * REQ-418: 7-state machine (draft→sent→viewed→paid→partial→refunded→disputed).
 * REQ-128: partial payment columns (amount_paid, remaining_balance).
 * REQ-419: chargeback evidence links.
 */
import { pgTable, uuid, text, timestamp, numeric, jsonb, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    agencyId: uuid('agency_id').notNull(),
    proposalId: uuid('proposal_id'),
    esignId: text('esign_id'),
    contactId: uuid('contact_id'),
    dealId: uuid('deal_id'),
    title: text('title').notNull(),
    lineItems: jsonb('line_items').notNull().default('[]'),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).notNull().default('0'),
    remainingBalance: numeric('remaining_balance', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('usd'),
    /** Status values: draft | sent | viewed | paid | partial | refunded | disputed */
    status: text('status').notNull().default('draft'),
    stripePaymentLinkId: text('stripe_payment_link_id'),
    stripePaymentLinkUrl: text('stripe_payment_link_url'),
    paypalOrderId: text('paypal_order_id'),
    paypalCheckoutUrl: text('paypal_checkout_url'),
    /** Chargeback evidence: auto-compiled JSON with proposal + esign + email log keys */
    chargebackEvidence: jsonb('chargeback_evidence'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    disputedAt: timestamp('disputed_at', { withTimezone: true }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('invoices_agency_idx').on(t.agencyId),
    index('invoices_status_agency_idx').on(t.status, t.agencyId),
    index('invoices_proposal_idx').on(t.proposalId),
  ],
)

export const invoicesRlsSql = `
  ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
  CREATE POLICY invoices_agency_iso ON invoices
    USING (agency_id = (current_setting('app.agency_id', true))::uuid);
`
