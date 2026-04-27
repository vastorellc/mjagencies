/**
 * packages/invoices/src/actions/refund-invoice.ts
 * REQ-129: owner-initiated refund, chargeback evidence auto-compiled.
 * Two-step: UI shows confirmation, then this action is called on confirm.
 * CLAUDE.md Rule 3: requireSession() as first line.
 */
'use server'
import { requireSession } from '@mjagency/auth'
import { createLogger } from '@mjagency/config'
import Stripe from 'stripe'

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', { apiVersion: '2024-10-28.acacia' })
const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env['PAYLOAD_API_KEY'] ?? ''

export interface RefundInvoiceInput {
  agencyId: string
  invoiceId: string
  refundAmountCents?: number // partial refund; omit for full refund
}

export interface RefundInvoiceOutput {
  ok: boolean
  error?: string
}

export async function refundInvoice(input: RefundInvoiceInput): Promise<RefundInvoiceOutput> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')

  const log = createLogger({ service: 'mjagency-invoices', agencyId: input.agencyId })

  // Fetch invoice
  const invoiceRes = await fetch(`${PAYLOAD_URL}/api/invoices/${input.invoiceId}`, {
    headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` },
  })
  const invoice = await invoiceRes.json() as {
    id: string; status: string; agency_id: string;
    stripe_payment_link_id?: string; total_amount: number; amount_paid: number
  }

  if (invoice.agency_id !== input.agencyId) throw new Error('Forbidden')
  if (!['paid', 'partial'].includes(invoice.status)) {
    return { ok: false, error: 'Only paid or partially paid invoices can be refunded.' }
  }

  // Stripe refund via Payment Intent (looked up from payment link)
  if (invoice.stripe_payment_link_id) {
    try {
      const sessions = await stripe.checkout.sessions.list({ payment_link: invoice.stripe_payment_link_id, limit: 1 })
      const checkoutSession = sessions.data[0]
      if (checkoutSession?.payment_intent && typeof checkoutSession.payment_intent === 'string') {
        await stripe.refunds.create({
          payment_intent: checkoutSession.payment_intent,
          amount: input.refundAmountCents,
        })
      }
    } catch (err) {
      log.error({ err, invoiceId: input.invoiceId }, 'Stripe refund failed')
      return { ok: false, error: 'Refund could not be processed via Stripe. Please process manually and update invoice status.' }
    }
  }

  // Update invoice status → refunded
  await fetch(`${PAYLOAD_URL}/api/invoices/${input.invoiceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
    body: JSON.stringify({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      amount_paid: 0,
      remaining_balance: invoice.total_amount,
    }),
  })

  log.info({ invoiceId: input.invoiceId }, 'Invoice refunded')
  return { ok: true }
}
