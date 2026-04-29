/**
 * apps/web-main/src/jobs/__tests__/stripe-webhook-worker.test.ts
 *
 * Unit tests for the Stripe events router (P1 launch-blocker fix).
 *
 * The worker's BullMQ / Redis / Stripe integration is intentionally NOT
 * exercised here — those are integration concerns. Instead we test the pure
 * dispatcher `processStripeEvent(data, deps)` which receives the wire payload
 * and three injected dependencies (`fetchEvent`, `enqueueInvoiceEvent`, `log`).
 *
 * Coverage matrix:
 *   - 3 invoice events (checkout.session.completed, charge.dispute.created,
 *     invoice.paid) MUST fetch the full event AND re-enqueue with that event
 *     onto the invoice worker's queue.
 *   - Subscription, customer, payment-failed, and unknown event types MUST
 *     log and return WITHOUT touching fetchEvent or enqueueInvoiceEvent.
 *   - agencyId in the wire payload MUST round-trip into the re-enqueued
 *     payload (cross-tenant isolation).
 *   - Errors from fetchEvent or enqueueInvoiceEvent MUST propagate so
 *     BullMQ's retry policy fires.
 *   - Unknown / brand-new event types MUST NOT throw (Stripe's catalog grows
 *     over time; we want forward compatibility, not crashes).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'
import {
  processStripeEvent,
  type StripeEventJobData,
  type StripeEventDeps,
} from '../stripe-webhook-worker.js'

// ── Helpers ───────────────────────────────────────────────────────────────

/** Build a fake Stripe.Event whose only property the test cares about is `id`. */
function fakeEvent(id: string, type: string): Stripe.Event {
  return { id, type, object: 'event' } as unknown as Stripe.Event
}

/** Standard mock-deps factory. Each test can override entries individually. */
function makeDeps(overrides: Partial<StripeEventDeps> = {}): {
  deps: StripeEventDeps
  fetchEvent: ReturnType<typeof vi.fn>
  enqueueInvoiceEvent: ReturnType<typeof vi.fn>
  log: ReturnType<typeof vi.fn>
} {
  const fetchEvent = vi.fn(async (id: string) => fakeEvent(id, 'noop'))
  const enqueueInvoiceEvent = vi.fn(async () => undefined)
  const log = vi.fn()
  return {
    deps: { fetchEvent, enqueueInvoiceEvent, log, ...overrides },
    fetchEvent,
    enqueueInvoiceEvent,
    log,
  }
}

const JOB = (overrides: Partial<StripeEventJobData> = {}): StripeEventJobData => ({
  eventType: 'invoice.paid',
  eventId:   'evt_default',
  agencyId:  'agency-A',
  ...overrides,
})

// ── Tests ─────────────────────────────────────────────────────────────────

describe('processStripeEvent — invoice events route to invoice worker', () => {
  beforeEach(() => vi.clearAllMocks())

  for (const eventType of [
    'checkout.session.completed',
    'charge.dispute.created',
    'invoice.paid',
  ] as const) {
    it(`Test: ${eventType} → fetchEvent + enqueueInvoiceEvent (with full event body)`, async () => {
      const { deps, fetchEvent, enqueueInvoiceEvent, log } = makeDeps()
      fetchEvent.mockResolvedValueOnce(fakeEvent('evt_xyz', eventType))

      await processStripeEvent(
        JOB({ eventType, eventId: 'evt_xyz', agencyId: 'agency-7' }),
        deps,
      )

      expect(fetchEvent).toHaveBeenCalledTimes(1)
      expect(fetchEvent).toHaveBeenCalledWith('evt_xyz')
      expect(enqueueInvoiceEvent).toHaveBeenCalledTimes(1)
      const [forwardedEvent, forwardedAgencyId] = enqueueInvoiceEvent.mock.calls[0]!
      expect((forwardedEvent as Stripe.Event).id).toBe('evt_xyz')
      expect((forwardedEvent as Stripe.Event).type).toBe(eventType)
      expect(forwardedAgencyId).toBe('agency-7')
      expect(log).toHaveBeenCalledWith(
        'routed_to_invoice_worker',
        expect.objectContaining({ eventType, eventId: 'evt_xyz', agencyId: 'agency-7' }),
      )
    })
  }

  it('Test: agencyId from job payload round-trips into the re-enqueued message (cross-tenant isolation)', async () => {
    const { deps, enqueueInvoiceEvent } = makeDeps()
    await processStripeEvent(JOB({ agencyId: 'agency-finance' }), deps)
    const [, forwardedAgencyId] = enqueueInvoiceEvent.mock.calls[0]!
    expect(forwardedAgencyId).toBe('agency-finance')
    expect(forwardedAgencyId).not.toBe('agency-A')
  })
})

describe('processStripeEvent — events without a handler log and exit', () => {
  beforeEach(() => vi.clearAllMocks())

  const passthroughCases: Array<{ eventType: string; expectedTag: string }> = [
    { eventType: 'invoice.payment_failed',                  expectedTag: 'unhandled_payment_failed' },
    { eventType: 'customer.subscription.created',           expectedTag: 'unhandled_subscription_event' },
    { eventType: 'customer.subscription.updated',           expectedTag: 'unhandled_subscription_event' },
    { eventType: 'customer.subscription.deleted',           expectedTag: 'unhandled_subscription_event' },
    { eventType: 'customer.subscription.trial_will_end',    expectedTag: 'unhandled_subscription_event' },
    { eventType: 'customer.created',                        expectedTag: 'unhandled_customer_event' },
    { eventType: 'customer.updated',                        expectedTag: 'unhandled_customer_event' },
  ]

  for (const { eventType, expectedTag } of passthroughCases) {
    it(`Test: ${eventType} → logs ${expectedTag}, no fetch, no enqueue`, async () => {
      const { deps, fetchEvent, enqueueInvoiceEvent, log } = makeDeps()

      await processStripeEvent(
        JOB({ eventType, eventId: 'evt_pt', agencyId: 'agency-Z' }),
        deps,
      )

      expect(fetchEvent).not.toHaveBeenCalled()
      expect(enqueueInvoiceEvent).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalledWith(
        expectedTag,
        expect.objectContaining({ eventType, eventId: 'evt_pt', agencyId: 'agency-Z' }),
      )
    })
  }
})

describe('processStripeEvent — forward compatibility', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Test: brand-new event type from a future Stripe API version logs and exits cleanly', async () => {
    const { deps, fetchEvent, enqueueInvoiceEvent, log } = makeDeps()

    await expect(
      processStripeEvent(
        JOB({ eventType: 'identity.verification_session.verified', eventId: 'evt_future' }),
        deps,
      ),
    ).resolves.toBeUndefined()

    expect(fetchEvent).not.toHaveBeenCalled()
    expect(enqueueInvoiceEvent).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(
      'unrecognised_stripe_event',
      expect.objectContaining({ eventType: 'identity.verification_session.verified' }),
    )
  })
})

describe('processStripeEvent — error propagation triggers BullMQ retry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Test: fetchEvent rejection propagates (no swallow)', async () => {
    const { deps, enqueueInvoiceEvent } = makeDeps({
      fetchEvent: vi.fn(async () => {
        throw new Error('Stripe API timeout')
      }),
    })

    await expect(
      processStripeEvent(JOB({ eventType: 'invoice.paid' }), deps),
    ).rejects.toThrow('Stripe API timeout')

    // Importantly: the bug we're guarding against is "swallow the error and
    // call enqueue with a half-built object". Verify enqueue was never reached.
    expect(enqueueInvoiceEvent).not.toHaveBeenCalled()
  })

  it('Test: enqueueInvoiceEvent rejection propagates (no swallow)', async () => {
    const { deps } = makeDeps({
      enqueueInvoiceEvent: vi.fn(async () => {
        throw new Error('redis unavailable')
      }),
    })

    await expect(
      processStripeEvent(JOB({ eventType: 'checkout.session.completed' }), deps),
    ).rejects.toThrow('redis unavailable')
  })

  it('Test: log call failures DO NOT mask processing errors (log throw bubbles up)', async () => {
    // If the logger throws (e.g. structured-log serializer crash), we want to
    // know about it. We do NOT silently swallow logger errors.
    const { deps } = makeDeps({
      log: vi.fn(() => {
        throw new Error('logger bug')
      }),
    })

    await expect(
      processStripeEvent(JOB({ eventType: 'customer.created' }), deps),
    ).rejects.toThrow('logger bug')
  })
})
