/**
 * apps/web-main/src/jobs/stripe-webhook-worker.ts
 *
 * Consumes the `stripe-events` queue produced by the Stripe webhook route
 * (apps/web-main/src/app/api/stripe/webhook/route.ts).
 *
 * Why this exists
 * ───────────────
 * The webhook route enqueues a minimal envelope `{ eventType, eventId, agencyId }`
 * and returns 200 immediately so Stripe's 5-second retry budget isn't burned on
 * downstream processing. This worker drains that queue and dispatches to the
 * right downstream handler.
 *
 * Routing decisions
 * ─────────────────
 * For invoice / dispute events that already have a dedicated handler in
 * `packages/invoices/src/workers/invoice-worker.ts` (which subscribes to a
 * different queue, `stripe-invoice-event`), this worker fetches the full
 * Stripe event via `stripe.events.retrieve()` and re-enqueues onto that queue
 * with the shape that worker expects. This preserves the existing handler
 * code unchanged while restoring the broken webhook → handler wire.
 *
 * For events without a dedicated handler yet (subscription lifecycle, customer
 * lifecycle, payment_failed) we log a structured INFO line and exit. Each case
 * is an explicit extension point — adding a real handler is a one-line edit.
 *
 * Agency isolation (CLAUDE.md §8)
 * ────────────────────────────────
 * The webhook route uses `keyPrefix: REDIS_KEY.bullPrefix(agencyId)` so each
 * agency's `stripe-events` queue lives under its own Redis key prefix. We
 * mirror that here: `registerStripeWebhookWorkers()` spins up ONE Worker per
 * agency, each scoped to that agency's prefix. Cross-tenant leakage is
 * structurally impossible because Worker instances cannot read keys outside
 * their configured prefix.
 *
 * The downstream re-enqueue to `stripe-invoice-event` uses the platform
 * prefix (`bullPrefix('platform')`) to match the invoice worker's
 * subscription, with `agencyId` carried in the payload for in-handler scoping.
 *
 * Errors propagate to BullMQ so the default retry policy (3 attempts with
 * exponential backoff) runs — matching the pattern in invoice-worker.ts and
 * dunning-worker.ts.
 */

import type { Worker, Job } from 'bullmq'
import type Stripe from 'stripe'
import { createEncryptedQueue, createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'

// ── Types ───────────────────────────────────────────────────────────────────

/** Wire shape produced by the webhook route. */
export interface StripeEventJobData {
  eventType: string
  eventId:   string
  agencyId:  string
}

/**
 * Dependencies of the pure event router. Extracted so unit tests can drive it
 * without spinning up Redis, Stripe, or BullMQ.
 */
export interface StripeEventDeps {
  fetchEvent:          (eventId: string) => Promise<Stripe.Event>
  enqueueInvoiceEvent: (event: Stripe.Event, agencyId: string) => Promise<void>
  log:                 (msg: string, fields?: Record<string, unknown>) => void
}

// ── Constants ───────────────────────────────────────────────────────────────

const REDIS_HOST = process.env['REDIS_HOST'] ?? 'localhost'
const REDIS_PORT = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)

/**
 * The 12 agencies whose webhook routes can produce Stripe events.
 * Held local here so this file is self-contained; if the deployed agency
 * list ever moves to a shared config, replace this constant with that import.
 */
const AGENCY_IDS = [
  'ai', 'branding', 'ecommerce', 'engineering', 'finance', 'graphic',
  'growth', 'main', 'product', 'strategy', 'video', 'webdev',
] as const

/**
 * Event types that the existing `packages/invoices` invoice-worker.ts already
 * handles end-to-end (invoice status updates, Meta CAPI Purchase enqueue,
 * chargeback-evidence compilation). For these we re-enqueue with the full
 * event body so that worker can keep using its current shape.
 */
const INVOICE_EVENT_TYPES = new Set<string>([
  'checkout.session.completed',
  'charge.dispute.created',
  'invoice.paid',
])

// ── Pure router (testable without BullMQ / Redis / Stripe) ─────────────────

/**
 * Route a single Stripe-event envelope to its handler. Pure function over
 * `data` and `deps` — exported for `__tests__/stripe-webhook-worker.test.ts`.
 *
 * Errors thrown by `deps.fetchEvent` or `deps.enqueueInvoiceEvent` propagate
 * to the caller so BullMQ's retry policy runs. The non-handler cases never
 * throw — they only log.
 */
export async function processStripeEvent(
  data: StripeEventJobData,
  deps: StripeEventDeps,
): Promise<void> {
  const { eventType, eventId, agencyId } = data

  if (INVOICE_EVENT_TYPES.has(eventType)) {
    const event = await deps.fetchEvent(eventId)
    await deps.enqueueInvoiceEvent(event, agencyId)
    deps.log('routed_to_invoice_worker', { eventType, eventId, agencyId })
    return
  }

  // Extension points — each case explicitly enumerated so a future commit
  // adding a handler shows up clearly in the diff. The default case catches
  // anything new from Stripe so unhandled events aren't silently dropped.
  switch (eventType) {
    case 'invoice.payment_failed':
      // Future: enqueue early-dunning email (the existing dunning-worker runs
      // a daily cron; an event-driven trigger would shorten the recovery loop).
      deps.log('unhandled_payment_failed', { eventType, eventId, agencyId })
      return

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.trial_will_end':
      // Future: subscription state on CRM deal / contact.
      deps.log('unhandled_subscription_event', { eventType, eventId, agencyId })
      return

    case 'customer.created':
    case 'customer.updated':
      // Future: upsert CRM contact (requires `stripe_customer_id` field on
      // contacts collection — schema change deferred to next phase).
      deps.log('unhandled_customer_event', { eventType, eventId, agencyId })
      return

    default:
      // Brand-new event types we've never seen. Log and move on — Stripe's
      // event catalog grows; an unknown type is normal, not an error.
      deps.log('unrecognised_stripe_event', { eventType, eventId, agencyId })
      return
  }
}

// ── Worker bootstrap (one per agency) ──────────────────────────────────────

/**
 * Lazy-loaded Stripe client — created on first call instead of at import time
 * so unit tests can run without `STRIPE_SECRET_KEY` set.
 */
let _stripeClient: Stripe | null = null
async function getStripeClient(): Promise<Stripe> {
  if (_stripeClient) return _stripeClient
  const StripeMod = await import('stripe')
  const StripeCtor = StripeMod.default
  _stripeClient = new StripeCtor(process.env['STRIPE_SECRET_KEY'] ?? '', {
    // Match the SDK pin used by packages/invoices/src/workers/invoice-worker.ts
    apiVersion: '2024-10-28.acacia',
  })
  return _stripeClient
}

/**
 * Start a Stripe-events worker for ONE agency. Subscribes to that agency's
 * Redis prefix so it cannot accidentally drain another agency's queue.
 */
export function startStripeWebhookWorker(agencyId: string): Worker {
  const log = createLogger({ service: 'mjagency-stripe-events-worker', agencyId })

  const deps: StripeEventDeps = {
    fetchEvent: async (eventId) => {
      const stripe = await getStripeClient()
      return stripe.events.retrieve(eventId)
    },

    enqueueInvoiceEvent: async (event, eventAgencyId) => {
      // The invoice-worker subscribes to `stripe-invoice-event` under the
      // platform prefix, with agencyId in the payload for handler-side scope.
      const queue = createEncryptedQueue<{ event: Stripe.Event; agencyId: string }>(
        'stripe-invoice-event',
        {
          host:      REDIS_HOST,
          port:      REDIS_PORT,
          keyPrefix: REDIS_KEY.bullPrefix('platform'),
        },
      )
      // sensitiveData:true — the event body can carry email, billing address,
      // last4, etc. Redis MONITOR or RDB snapshots must not see plaintext.
      await (queue as unknown as {
        add: (n: string, d: unknown, o: object) => Promise<void>
      }).add(
        'stripe-invoice-event',
        { event, agencyId: eventAgencyId },
        { sensitiveData: true },
      )
    },

    log: (msg, fields) => log.info(fields ?? {}, msg),
  }

  return createEncryptedWorker<StripeEventJobData>(
    'stripe-events',
    async (job: Job<StripeEventJobData>) => {
      // Defence-in-depth: confirm payload's agencyId matches the worker's
      // agency (a mismatch would mean the prefix isolation broke). Drop the
      // event rather than processing it for the wrong tenant.
      if (job.data.agencyId !== agencyId) {
        log.warn(
          {
            jobAgency:    job.data.agencyId,
            workerAgency: agencyId,
            eventId:      job.data.eventId,
          },
          'cross_tenant_job_dropped',
        )
        return
      }
      await processStripeEvent(job.data, deps)
    },
    {
      host:      REDIS_HOST,
      port:      REDIS_PORT,
      keyPrefix: REDIS_KEY.bullPrefix(agencyId),
    },
  )
}

/**
 * Register one worker per agency. Call from `instrumentation.node.ts` at
 * server startup. Returns the array of created Workers so callers (e.g.
 * test harnesses, graceful-shutdown handlers) can close them.
 */
export function registerStripeWebhookWorkers(): Worker[] {
  return AGENCY_IDS.map((id) => startStripeWebhookWorker(id))
}
