/**
 * packages/invoices/src/webhooks/stripe-webhook.ts
 * CLAUDE.md §7: raw body, HMAC verify, Redis idempotency, BullMQ dispatch.
 * Copy into apps/web-{agency}/src/app/api/stripe/invoice-webhook/route.ts per agency.
 */
import Stripe from 'stripe'
import Redis from 'ioredis'
import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', { apiVersion: '2024-10-28.acacia' })

interface StripeInvoiceWebhookJobData { event: Stripe.Event; agencyId: string }

export async function handleStripeInvoiceWebhook(req: Request, agencyId: string): Promise<Response> {
  const body = await req.text() // raw body — NEVER req.json() first (CLAUDE.md §7)
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env['STRIPE_INVOICE_WEBHOOK_SECRET'] ?? '')
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Redis idempotency (CLAUDE.md §7 webhook pattern)
  const redis = new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  })
  try {
    const exists = await redis.get(`stripe:invoice-event:${event.id}`)
    if (exists) return Response.json({ ok: true })
    await redis.set(`stripe:invoice-event:${event.id}`, '1', 'EX', 86400)
  } finally {
    await redis.quit()
  }

  const queue = createEncryptedQueue<StripeInvoiceWebhookJobData>('stripe-invoice-event', {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    keyPrefix: REDIS_KEY.bullPrefix(agencyId),
  })
  await queue.add('process', { event, agencyId })

  return Response.json({ ok: true })
}
