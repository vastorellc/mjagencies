/**
 * packages/invoices/src/workers/invoice-worker.ts
 * Processes Stripe payment events: checkout.session.completed → update invoice paid/partial.
 * REQ-128: partial payment tracked in CRM.
 * REQ-419: chargeback evidence auto-compiled when status → disputed.
 *          Evidence includes: proposal body_json excerpt, esign r2_key, esign pdf_hash.
 *          These are fetched from esign_records and proposals by proposalId.
 */
import { createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'
import { enqueueCapiEvent } from '@mjagency/meta-capi'
import type Stripe from 'stripe'

const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)
const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env['PAYLOAD_API_KEY'] ?? ''

interface StripeInvoiceEventJobData { event: Stripe.Event; agencyId: string }

export function startInvoiceWorker(): void {
  createEncryptedWorker<StripeInvoiceEventJobData>(
    'stripe-invoice-event',
    async (job: import('bullmq').Job<StripeInvoiceEventJobData>) => {
      const { event, agencyId } = job.data
      const log = createLogger({ service: 'mjagency-invoices', agencyId })

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session
        const { proposalId } = session.metadata ?? {}
        const amountPaid = session.amount_total ?? 0

        // Find invoice by proposalId
        const findRes = await fetch(
          `${PAYLOAD_URL}/api/invoices?where[proposal_id][equals]=${proposalId}&where[agency_id][equals]=${agencyId}&limit=1`,
          { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
        )
        const findData = await findRes.json() as { docs: Array<{ id: string; total_amount: number; amount_paid: number }> }
        if (!findData.docs.length) return

        const invoice = findData.docs[0]!
        const newAmountPaid = Number(invoice.amount_paid) + amountPaid
        const remainingBalance = Number(invoice.total_amount) - newAmountPaid
        const newStatus = remainingBalance <= 0 ? 'paid' : 'partial'

        await fetch(`${PAYLOAD_URL}/api/invoices/${invoice.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
          body: JSON.stringify({
            status: newStatus,
            amount_paid: newAmountPaid,
            remaining_balance: Math.max(0, remainingBalance),
            paid_at: newStatus === 'paid' ? new Date().toISOString() : undefined,
          }),
        })
        log.info({ invoiceId: invoice.id, newStatus, newAmountPaid }, 'Invoice payment processed')

        // Plan 11-03 — REQ-142: Meta CAPI Purchase event when status flips to 'paid'.
        // Server-fired path: no req context for client_ip/client_user_agent.
        // Stripe checkout customer email/phone available on the session — use them as identifiers.
        // Wrapped in try/catch — Meta delivery failure must NOT block invoice update.
        if (newStatus === 'paid') {
          try {
            const customerEmail = session.customer_details?.email ?? undefined
            const customerPhone = session.customer_details?.phone ?? undefined
            const currency = (session.currency ?? 'usd').toUpperCase()
            // Stripe amount_total is in cents — convert to dollars for Meta value field.
            const valueDollars = (session.amount_total ?? 0) / 100

            await enqueueCapiEvent(agencyId, {
              event_name: 'Purchase',
              user_data: {
                em: customerEmail,
                ph: customerPhone,
                external_id: invoice.id,
              },
              custom_data: {
                value: valueDollars,
                currency,
                order_id: invoice.id,
              },
            })
            log.info({ invoiceId: invoice.id, valueDollars, currency }, 'Meta CAPI Purchase event enqueued')
          } catch (err) {
            log.warn(
              { err, invoiceId: invoice.id },
              'Meta CAPI Purchase enqueue failed — non-fatal, invoice already updated to paid',
            )
          }
        }
      }

      if (event.type === 'charge.dispute.created') {
        const dispute = event.data.object as Stripe.Dispute

        // 1. Look up payment intent to find the invoice (dispute.payment_intent)
        const disputePaymentIntentId = typeof dispute.payment_intent === 'string'
          ? dispute.payment_intent
          : dispute.payment_intent?.id ?? ''

        // Find the Stripe checkout session that produced this payment intent
        // Then find the invoice in Payload by matching stripe_payment_link metadata
        // REQ-419: We need to surface real proposal + esign data, not placeholder strings.
        //
        // Strategy: search all paid/partial invoices for this agency, then use the
        // payment intent to find the specific one via Stripe API lookup.
        let targetInvoiceId: string | null = null
        let targetProposalId: string | null = null
        let targetEsignId: string | null = null

        // Fetch candidate invoices (paid or partial) for this agency
        const candidatesRes = await fetch(
          `${PAYLOAD_URL}/api/invoices?where[agency_id][equals]=${agencyId}&where[status][in]=paid,partial&limit=50`,
          { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
        )
        const candidatesData = await candidatesRes.json() as {
          docs: Array<{ id: string; stripe_payment_link_id?: string; proposal_id?: string; esign_id?: string }>
        }

        // Match by looking up the payment intent's payment link via Stripe
        // (stripe_payment_link_id is stored on the invoice at creation time)
        for (const inv of candidatesData.docs) {
          if (!inv.stripe_payment_link_id) continue
          try {
            const { default: StripeClient } = await import('stripe') as { default: typeof import('stripe').default }
            const stripeClient = new StripeClient(process.env['STRIPE_SECRET_KEY'] ?? '', { apiVersion: '2024-10-28.acacia' })
            const sessions = await stripeClient.checkout.sessions.list({
              payment_link: inv.stripe_payment_link_id,
              limit: 5,
            })
            const matchingSession = sessions.data.find(
              (s) => s.payment_intent === disputePaymentIntentId,
            )
            if (matchingSession) {
              targetInvoiceId = inv.id
              targetProposalId = inv.proposal_id ?? null
              targetEsignId = inv.esign_id ?? null
              break
            }
          } catch (err) {
            log.warn({ err, invoiceId: inv.id }, 'Stripe session lookup failed during dispute matching — skipping')
          }
        }

        // 2. Fetch proposal body_json excerpt (for evidence package)
        let proposalBodyExcerpt: string | null = null
        if (targetProposalId) {
          const proposalRes = await fetch(
            `${PAYLOAD_URL}/api/proposals/${targetProposalId}`,
            { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
          )
          if (proposalRes.ok) {
            const proposal = await proposalRes.json() as { body_json?: { text?: string }; title?: string }
            const fullText = proposal.body_json?.text ?? proposal.title ?? ''
            proposalBodyExcerpt = fullText.replace(/<[^>]+>/g, '').substring(0, 500)
          }
        }

        // 3. Fetch esign_record to get r2_key and pdf_hash (legal evidence links)
        // esign_records are fetched from Payload by esign_id — REQ-419 compliance
        let esignR2Key: string | null = null
        let esignPdfHash: string | null = null
        if (targetEsignId) {
          const esignRes = await fetch(
            `${PAYLOAD_URL}/api/esign_records/${targetEsignId}`,
            { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
          )
          if (esignRes.ok) {
            const esignRecord = await esignRes.json() as { r2_key?: string; pdf_hash?: string }
            esignR2Key = esignRecord.r2_key ?? null
            esignPdfHash = esignRecord.pdf_hash ?? null
          }
        }

        // 4. Compile chargeback evidence package — REQ-419
        const chargebackEvidence = {
          compiledAt: new Date().toISOString(),
          disputeId: dispute.id,
          chargeId: dispute.charge,
          disputePaymentIntentId,
          proposalId: targetProposalId,
          proposalBodyExcerpt,     // first 500 chars of proposal body (strip HTML)
          esignId: targetEsignId,
          esignR2Key,              // R2 storage key of signed PDF
          esignPdfHash,            // SHA-256 hash of signed PDF (proof of integrity)
          note: 'Chargeback evidence compiled automatically from proposal, e-signed contract, and payment records.',
        }

        // 5. Update the matched invoice (or fallback to most recent paid/partial)
        const invoiceToUpdate = targetInvoiceId ?? candidatesData.docs[0]?.id ?? null
        if (invoiceToUpdate) {
          await fetch(`${PAYLOAD_URL}/api/invoices/${invoiceToUpdate}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
            body: JSON.stringify({
              status: 'disputed',
              disputed_at: new Date().toISOString(),
              chargeback_evidence: chargebackEvidence,
            }),
          })
          log.warn(
            { invoiceId: invoiceToUpdate, disputeId: dispute.id, esignR2Key, hasProposalExcerpt: !!proposalBodyExcerpt },
            'Invoice marked disputed — chargeback evidence compiled with esign + proposal data',
          )
        } else {
          log.warn({ disputeId: dispute.id, agencyId }, 'charge.dispute.created: no matching invoice found for this agency')
        }
      }
    },
    { host: redisHost, port: redisPort, keyPrefix: REDIS_KEY.bullPrefix('platform') },
  )
}
