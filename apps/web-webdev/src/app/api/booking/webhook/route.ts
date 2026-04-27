/**
 * apps/web-ecommerce/src/app/api/booking/webhook/route.ts
 *
 * Cal.com webhook receiver.
 *
 * Security (CLAUDE.md §7):
 *   - Raw body via req.text() for HMAC verification — NEVER req.json() first
 *   - HMAC-SHA256 verified with timingSafeEqual before any processing
 *   - Redis idempotency prevents duplicate job processing
 *   - Dispatches to BullMQ immediately; returns 200 fast
 *
 * REQ-114 (Cal.com CRM sync), REQ-417 (booking webhook)
 */
export const runtime = 'nodejs'

import { createHmac, timingSafeEqual } from 'crypto'
import Redis from 'ioredis'
import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'

const log = createLogger({ service: 'mjagency-booking-webhook' })

interface CalWebhookEvent {
  uid: string
  triggerEvent: 'BOOKING_CREATED' | 'BOOKING_CANCELLED' | 'BOOKING_RESCHEDULED'
  agencyId?: string
  attendee: { name: string; email: string; timeZone: string }
  organizer: { name: string; email: string }
  startTime: string
  endTime: string
}

export async function POST(req: Request): Promise<Response> {
  // 1. Raw body — MUST come before any JSON parse (CLAUDE.md §7)
  const body = await req.text()

  // 2. HMAC verification
  const sig = req.headers.get('x-cal-signature-256') ?? ''
  const secret = process.env['CAL_WEBHOOK_SECRET'] ?? ''

  if (!secret) {
    log.error({}, 'CAL_WEBHOOK_SECRET is not set')
    return Response.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const hmac = createHmac('sha256', secret)
  hmac.update(body)
  const expected = hmac.digest('hex')

  let sigValid = false
  try {
    sigValid = timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    sigValid = false
  }

  if (!sigValid) {
    log.warn({ sig: sig.slice(0, 8) }, 'Cal.com webhook HMAC verification failed')
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // 3. Parse event
  let event: CalWebhookEvent
  try {
    event = JSON.parse(body) as CalWebhookEvent
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Agency resolution: prefer custom agencyId field in payload, fall back to header
  const agencyId = event.agencyId ?? req.headers.get('x-agency-id') ?? ''
  if (!agencyId) {
    return Response.json({ error: 'Missing agencyId' }, { status: 400 })
  }

  // 4. Redis idempotency check
  const redis = new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    lazyConnect: false,
  })
  const idempotencyKey = `agency:${agencyId}:cal:${event.uid}`

  try {
    const exists = await redis.get(idempotencyKey)
    if (exists) {
      log.info({ uid: event.uid, agencyId }, 'Cal.com webhook duplicate — idempotency key hit')
      return Response.json({ ok: true })
    }
    await redis.set(idempotencyKey, '1', 'EX', 86400)
  } finally {
    await redis.quit()
  }

  // 5. Enqueue to BullMQ — return 200 immediately (CLAUDE.md webhook pattern)
  const queue = createEncryptedQueue<CalWebhookEvent & { agencyId: string }>(
    'cal-booking-sync',
    {
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
      keyPrefix: REDIS_KEY.bullPrefix(agencyId),
    }
  )

  await (queue as unknown as {
    add: (name: string, data: object, opts: object) => Promise<void>
  }).add('sync-booking', { ...event, agencyId }, { sensitiveData: true })

  log.info({ uid: event.uid, agencyId, trigger: event.triggerEvent }, 'Cal.com booking event enqueued')
  return Response.json({ ok: true })
}
