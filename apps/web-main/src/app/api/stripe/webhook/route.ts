// REQ-303: Stripe webhook HMAC verification + idempotency + BullMQ dispatch.
// raw body via req.text() — NEVER req.json() first (CLAUDE.md §7).
export const runtime = 'nodejs'

import Stripe from 'stripe'
import Redis from 'ioredis'
import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'
import { createLogger } from '@mjagency/config'

const log = createLogger({ service: 'mjagency-stripe-webhook' })

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return Response.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '')
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env['STRIPE_WEBHOOK_SECRET'] ?? '')
  } catch {
    log.warn({}, 'Stripe webhook signature verification failed')
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const redis = new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  })
  try {
    const key = `stripe:event:${event.id}`
    const exists = await redis.get(key)
    if (exists) return Response.json({ ok: true })
    await redis.set(key, '1', 'EX', 86400)
  } finally {
    await redis.quit()
  }

  const agencyId = req.headers.get('x-agency-id') ?? 'main'
  const queue = createEncryptedQueue<{ eventType: string; eventId: string; agencyId: string }>(
    'stripe-events',
    {
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
      keyPrefix: REDIS_KEY.bullPrefix(agencyId),
    }
  )
  await (queue as unknown as { add: (n: string, d: object, o: object) => Promise<void> }).add(
    'stripe-event',
    { eventType: event.type, eventId: event.id, agencyId },
    {}
  )

  log.info({ agencyId, eventType: event.type, eventId: event.id }, 'Stripe event enqueued')
  return Response.json({ ok: true })
}
