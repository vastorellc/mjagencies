/**
 * apps/web-main/src/app/api/stripe/webhook/__tests__/route.test.ts
 *
 * Tier 1 unit tests for the Stripe webhook handler (REQ-303).
 *
 * Covers all branches of the POST handler:
 *  1. Missing stripe-signature header → 400 + no Redis/queue calls
 *  2. constructEvent throws (bad signature) → 400 + no Redis/queue calls
 *  3. Idempotency hit (Redis already has event) → 200 + no enqueue + redis.quit() called
 *  4. First-occurrence event → Redis SET with 86400s TTL + enqueue + 200
 *  5. Queue payload shape — { eventType, eventId, agencyId } as expected by the worker
 *  6. Agency isolation — x-agency-id header drives queue keyPrefix
 *  7. Default 'main' agency when x-agency-id header is absent
 *  8. redis.quit() runs in finally even when redis.set rejects
 *
 * Mocks: stripe (constructor + webhooks.constructEvent), ioredis (constructor),
 *        @mjagency/queue (createEncryptedQueue), @mjagency/config (REDIS_KEY,
 *        createLogger). All mocks are declared via vi.hoisted so they exist
 *        before vi.mock() factories execute.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Hoisted mock state — accessible inside vi.mock() factories ─────────────
const mocks = vi.hoisted(() => ({
  redisGet:             vi.fn(),
  redisSet:             vi.fn(),
  redisQuit:            vi.fn(),
  constructEvent:       vi.fn(),
  queueAdd:             vi.fn(),
  createEncryptedQueue: vi.fn(),
}))

// ── ioredis: stub the default-export class so `new Redis(...)` returns our mock ──
vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    get:  mocks.redisGet,
    set:  mocks.redisSet,
    quit: mocks.redisQuit,
  })),
}))

// ── stripe: stub the default-export class; only webhooks.constructEvent is used
vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    webhooks: { constructEvent: mocks.constructEvent },
  })),
}))

// ── @mjagency/queue: createEncryptedQueue returns a fake queue with .add()
vi.mock('@mjagency/queue', () => ({
  createEncryptedQueue: mocks.createEncryptedQueue,
}))

// ── @mjagency/config: deterministic key generator + noop logger
vi.mock('@mjagency/config', () => ({
  REDIS_KEY: {
    bullPrefix: (agencyId: string) => `agency:${agencyId}:bull`,
  },
  createLogger: () => ({
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// Wire createEncryptedQueue → returns object with our spied .add()
mocks.createEncryptedQueue.mockImplementation(() => ({ add: mocks.queueAdd }))

// Import AFTER all mocks are registered
const { POST } = await import('../route.js')

// ── Helpers ────────────────────────────────────────────────────────────────

interface RequestOpts {
  body?:      string
  signature?: string | null   // null = omit header; undefined = use default
  agencyId?:  string | null   // null = omit header; undefined = use default 'main' fallback
}

function makeRequest(opts: RequestOpts = {}): Request {
  const headers = new Headers()
  if (opts.signature !== null) {
    headers.set('stripe-signature', opts.signature ?? 't=1234,v1=abc')
  }
  if (opts.agencyId !== null && opts.agencyId !== undefined) {
    headers.set('x-agency-id', opts.agencyId)
  }
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers,
    body:   opts.body ?? '{"id":"evt_test","type":"test.event"}',
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    mocks.redisGet.mockReset()
    mocks.redisSet.mockReset()
    mocks.redisQuit.mockReset().mockResolvedValue('OK')
    mocks.constructEvent.mockReset()
    mocks.queueAdd.mockReset().mockResolvedValue(undefined)
    mocks.createEncryptedQueue.mockClear()
    // Restore default impl after .mockClear() (which wipes implementations)
    mocks.createEncryptedQueue.mockImplementation(() => ({ add: mocks.queueAdd }))
  })

  // ────────────────────────────────────────────────────────────────────
  // signature validation
  // ────────────────────────────────────────────────────────────────────

  describe('signature validation', () => {
    it('Test 1: returns 400 when stripe-signature header is missing', async () => {
      const req = new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body:   '{}',
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('Missing stripe-signature')
      // Short-circuited before Stripe SDK or Redis touched
      expect(mocks.constructEvent).not.toHaveBeenCalled()
      expect(mocks.redisGet).not.toHaveBeenCalled()
      expect(mocks.queueAdd).not.toHaveBeenCalled()
    })

    it('Test 2: returns 400 when constructEvent throws (invalid signature)', async () => {
      mocks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload')
      })

      const res = await POST(makeRequest({ signature: 'tampered' }))

      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('Invalid signature')
      // Bad sig must NOT touch Redis or the queue
      expect(mocks.redisGet).not.toHaveBeenCalled()
      expect(mocks.redisSet).not.toHaveBeenCalled()
      expect(mocks.queueAdd).not.toHaveBeenCalled()
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // idempotency
  // ────────────────────────────────────────────────────────────────────

  describe('idempotency', () => {
    it('Test 3: returns 200 without enqueueing when event ID is already in Redis', async () => {
      mocks.constructEvent.mockReturnValue({ id: 'evt_dup', type: 'invoice.paid' })
      mocks.redisGet.mockResolvedValue('1') // duplicate marker present

      const res = await POST(makeRequest())

      expect(res.status).toBe(200)
      const body = (await res.json()) as { ok: boolean }
      expect(body.ok).toBe(true)
      expect(mocks.redisGet).toHaveBeenCalledWith('stripe:event:evt_dup')
      expect(mocks.redisSet).not.toHaveBeenCalled()
      expect(mocks.queueAdd).not.toHaveBeenCalled()
      // Redis client must still be cleaned up
      expect(mocks.redisQuit).toHaveBeenCalled()
    })

    it('Test 4: writes Redis idempotency marker with 86400s (24h) TTL on first occurrence', async () => {
      mocks.constructEvent.mockReturnValue({ id: 'evt_first', type: 'customer.created' })
      mocks.redisGet.mockResolvedValue(null)

      await POST(makeRequest())

      expect(mocks.redisSet).toHaveBeenCalledWith(
        'stripe:event:evt_first',
        '1',
        'EX',
        86400,
      )
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // queue dispatch
  // ────────────────────────────────────────────────────────────────────

  describe('queue dispatch', () => {
    it('Test 5: enqueues stripe-event with correct payload shape on first occurrence', async () => {
      mocks.constructEvent.mockReturnValue({ id: 'evt_new', type: 'payment_intent.succeeded' })
      mocks.redisGet.mockResolvedValue(null)

      const res = await POST(makeRequest({ agencyId: 'web-ai' }))

      expect(res.status).toBe(200)
      expect(mocks.queueAdd).toHaveBeenCalledTimes(1)
      expect(mocks.queueAdd).toHaveBeenCalledWith(
        'stripe-event',
        {
          eventType: 'payment_intent.succeeded',
          eventId:   'evt_new',
          agencyId:  'web-ai',
        },
        {},
      )
    })

    it('Test 6: passes x-agency-id to BullMQ keyPrefix for agency isolation', async () => {
      mocks.constructEvent.mockReturnValue({ id: 'evt_a', type: 'a' })
      mocks.redisGet.mockResolvedValue(null)

      await POST(makeRequest({ agencyId: 'web-ecommerce' }))

      expect(mocks.createEncryptedQueue).toHaveBeenCalledWith(
        'stripe-events',
        expect.objectContaining({ keyPrefix: 'agency:web-ecommerce:bull' }),
      )
    })

    it("Test 7: defaults agencyId to 'main' when x-agency-id header is absent", async () => {
      mocks.constructEvent.mockReturnValue({ id: 'evt_b', type: 'b' })
      mocks.redisGet.mockResolvedValue(null)

      await POST(makeRequest({ agencyId: null }))

      // Both the queue payload AND the queue prefix must reflect the default
      expect(mocks.queueAdd).toHaveBeenCalledWith(
        'stripe-event',
        expect.objectContaining({ agencyId: 'main' }),
        {},
      )
      expect(mocks.createEncryptedQueue).toHaveBeenCalledWith(
        'stripe-events',
        expect.objectContaining({ keyPrefix: 'agency:main:bull' }),
      )
    })

    it('Test 8: cross-tenant guard — request from agency A never enqueues onto agency B prefix', async () => {
      mocks.constructEvent.mockReturnValue({ id: 'evt_iso', type: 'iso' })
      mocks.redisGet.mockResolvedValue(null)

      await POST(makeRequest({ agencyId: 'web-finance' }))

      // The keyPrefix used MUST contain the request's agency, not any other one.
      const calls = mocks.createEncryptedQueue.mock.calls
      expect(calls).toHaveLength(1)
      const [, opts] = calls[0]!
      expect((opts as { keyPrefix: string }).keyPrefix).toBe('agency:web-finance:bull')
      expect((opts as { keyPrefix: string }).keyPrefix).not.toContain('web-ai')
      expect((opts as { keyPrefix: string }).keyPrefix).not.toContain('web-main')
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // cleanup
  // ────────────────────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('Test 9: redis.quit() runs in finally even when redis.set rejects', async () => {
      mocks.constructEvent.mockReturnValue({ id: 'evt_x', type: 'x' })
      mocks.redisGet.mockResolvedValue(null)
      mocks.redisSet.mockRejectedValueOnce(new Error('ECONNRESET'))

      await expect(POST(makeRequest())).rejects.toThrow('ECONNRESET')

      expect(mocks.redisQuit).toHaveBeenCalledTimes(1)
      expect(mocks.queueAdd).not.toHaveBeenCalled() // never reached
    })

    it('Test 10: redis.quit() runs after successful processing', async () => {
      mocks.constructEvent.mockReturnValue({ id: 'evt_ok', type: 'ok' })
      mocks.redisGet.mockResolvedValue(null)

      await POST(makeRequest())

      expect(mocks.redisQuit).toHaveBeenCalledTimes(1)
    })
  })
})
