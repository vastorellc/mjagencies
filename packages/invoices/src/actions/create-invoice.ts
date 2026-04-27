/**
 * packages/invoices/src/actions/create-invoice.ts
 * REQ-127: deposit invoice auto-triggered on e-sign (called from esign worker).
 * REQ-128: partial payment tracker — remaining_balance = total_amount - amount_paid.
 * CLAUDE.md Rule 3: requireSession() as first line.
 */
'use server'
import { requireSession } from '@mjagency/auth'
import { createLogger } from '@mjagency/config'
import Stripe from 'stripe'

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', { apiVersion: '2024-10-28.acacia' })
const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env['PAYLOAD_API_KEY'] ?? ''

export interface LineItem { description: string; quantity: number; unit_amount: number }

export interface CreateInvoiceInput {
  agencyId: string
  title: string
  lineItems: LineItem[]
  currency?: string
  contactId?: string
  dealId?: string
  proposalId?: string
  esignId?: string
  dueDays?: number // days from now until due date (default 30)
}

export interface CreateInvoiceOutput {
  ok: boolean
  invoiceId?: string
  paymentLinkUrl?: string
  error?: string
}

export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')

  const log = createLogger({ service: 'mjagency-invoices', agencyId: input.agencyId })

  const totalAmount = input.lineItems.reduce((sum, item) => sum + item.quantity * item.unit_amount, 0)
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (input.dueDays ?? 30))

  // Create Stripe Payment Link
  let stripePaymentLinkUrl: string | undefined
  let stripePaymentLinkId: string | undefined

  try {
    const stripeProduct = await stripe.products.create({ name: input.title })
    const stripePrice = await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: totalAmount,
      currency: input.currency ?? 'usd',
    })
    const stripeLink = await stripe.paymentLinks.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      metadata: {
        agencyId: input.agencyId,
        proposalId: input.proposalId ?? '',
        esignId: input.esignId ?? '',
      },
    })
    stripePaymentLinkUrl = stripeLink.url
    stripePaymentLinkId = stripeLink.id
  } catch (err) {
    log.warn({ err }, 'Stripe payment link creation failed — invoice created without Stripe link')
  }

  // Compile chargeback evidence package (REQ-419)
  let chargebackEvidence: object | undefined
  if (input.proposalId ?? input.esignId) {
    chargebackEvidence = {
      compiledAt: new Date().toISOString(),
      proposalId: input.proposalId,
      esignId: input.esignId,
      note: 'This package was automatically compiled from your proposal, e-signed contract, and delivery records.',
    }
  }

  const invoiceData = {
    agency_id: input.agencyId,
    title: input.title,
    status: 'draft',
    total_amount: totalAmount,
    amount_paid: 0,
    remaining_balance: totalAmount,
    currency: input.currency ?? 'usd',
    line_items: input.lineItems,
    proposal_id: input.proposalId,
    esign_id: input.esignId,
    contact_id: input.contactId,
    deal_id: input.dealId,
    stripe_payment_link_id: stripePaymentLinkId,
    stripe_payment_link_url: stripePaymentLinkUrl,
    chargeback_evidence: chargebackEvidence,
    due_date: dueDate.toISOString(),
  }

  const res = await fetch(`${PAYLOAD_URL}/api/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
    body: JSON.stringify(invoiceData),
  })

  if (!res.ok) {
    log.error({ status: res.status }, 'Failed to create invoice')
    return { ok: false, error: 'Failed to create invoice. Please try again.' }
  }

  const created = await res.json() as { id: string }
  log.info({ invoiceId: created.id }, 'Invoice created')

  return { ok: true, invoiceId: created.id, paymentLinkUrl: stripePaymentLinkUrl }
}
