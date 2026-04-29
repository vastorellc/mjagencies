/**
 * packages/booking/src/__tests__/booking-worker.test.ts
 *
 * Unit tests for the Cal.com booking-sync worker (REQ-114, REQ-420).
 *
 * Three trigger events arrive on the cal-booking-sync queue from the Cal.com
 * webhook: BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED.
 * Phase 9 only acts on BOOKING_CREATED — the other two log for observability.
 *
 * What we lock in:
 *   - BOOKING_CREATED: contact lookup → activity insert → task insert
 *     in that order; activity body / task fields match the wire format
 *     CRM expects.
 *   - Failed activity / task POST throws so BullMQ retries.
 *   - BOOKING_CANCELLED + BOOKING_RESCHEDULED do NOT touch any CRM endpoint.
 *   - Contact match by attendee email is agency-scoped (no cross-tenant
 *     leak — wrong agency would attach a Cal.com booking to another
 *     agency's contact).
 *   - Task due_date is exactly 24 hours after now (REQ-420).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  createEncryptedWorker: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  capturedProcessor: null as null | ((job: { data: unknown }) => Promise<void>),
}))

mocks.createEncryptedWorker.mockImplementation((_name, processor) => {
  mocks.capturedProcessor = processor as (job: { data: unknown }) => Promise<void>
  return { close: vi.fn() }
})

vi.mock('@mjagency/queue', () => ({
  createEncryptedWorker: mocks.createEncryptedWorker,
}))

vi.mock('@mjagency/config', () => ({
  REDIS_KEY:    { bullPrefix: (a: string) => `agency:${a}:bull` },
  createLogger: () => mocks.log,
}))

const { createBookingWorker } = await import('../workers/booking-worker.js')

// ── Helpers ───────────────────────────────────────────────────────────────

function startWorker(agencyId = 'finance'): void {
  mocks.createEncryptedWorker.mockClear()
  mocks.capturedProcessor = null
  createBookingWorker(agencyId)
  if (!mocks.capturedProcessor) throw new Error('processor not captured')
}

const VALID_JOB = (overrides: Record<string, unknown> = {}) => ({
  data: {
    uid:          'cal-booking-uid-1',
    triggerEvent: 'BOOKING_CREATED' as const,
    agencyId:     'finance',
    attendee:     { name: 'Alice Walker', email: 'alice@example.com', timeZone: 'America/New_York' },
    organizer:    { name: 'Bob Agent',    email: 'bob@finance.com' },
    startTime:    '2026-05-01T15:00:00Z',
    endTime:      '2026-05-01T15:30:00Z',
    ...overrides,
  },
})

interface FetchCall { url: string; init: RequestInit }

function makeFetchSequence(responses: Array<{ status?: number; body: unknown }>): FetchCall[] {
  const calls: FetchCall[] = []
  let i = 0
  global.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const r = responses[i++] ?? { status: 500, body: 'no more responses' }
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), {
      status:  r.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  return calls
}

beforeEach(() => {
  mocks.log.info.mockReset()
  mocks.log.error.mockReset()
  process.env['PAYLOAD_SERVER_URL'] = 'http://payload.test'
  process.env['PAYLOAD_API_KEY']    = 'test-key'
})

// ── BOOKING_CREATED happy path ────────────────────────────────────────────

describe('booking-worker — BOOKING_CREATED', () => {
  it('Test 1: looks up contact by attendee email scoped to the agency', async () => {
    const calls = makeFetchSequence([
      { body: { docs: [{ id: 'contact-1' }] } },
      { body: { id: 'activity-1' } },
      { body: { id: 'task-1' } },
    ])
    startWorker('finance')
    await mocks.capturedProcessor!(VALID_JOB())

    const lookupUrl = calls[0]!.url
    expect(lookupUrl).toContain('/api/contacts')
    expect(lookupUrl).toContain('where[email][equals]=alice%40example.com')
    expect(lookupUrl).toContain('where[agency_id][equals]=finance')
    expect(lookupUrl).toContain('limit=1')
  })

  it('Test 2: cross-tenant safety — wrong agency in the job goes to that agency, not finance', async () => {
    const calls = makeFetchSequence([
      { body: { docs: [{ id: 'c-other' }] } },
      { body: {} },
      { body: {} },
    ])
    startWorker('finance')
    await mocks.capturedProcessor!(VALID_JOB({ agencyId: 'web-ecommerce' }))

    expect(calls[0]!.url).toContain('where[agency_id][equals]=web-ecommerce')
    const activityBody = JSON.parse(calls[1]!.init.body as string) as Record<string, unknown>
    expect(activityBody.agency_id).toBe('web-ecommerce')
  })

  it('Test 3: creates a meeting activity with attendee + uid + startTime in the body', async () => {
    const calls = makeFetchSequence([
      { body: { docs: [{ id: 'contact-1' }] } },
      { body: {} },
      { body: {} },
    ])
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB({ uid: 'BK-2025-99' }))

    const activityBody = JSON.parse(calls[1]!.init.body as string) as Record<string, unknown>
    expect(activityBody.type).toBe('meeting')
    expect(activityBody.contact_id).toBe('contact-1')
    expect(activityBody.status).toBe('logged')
    expect(activityBody.body).toContain('Cal.com booking: BK-2025-99')
    expect(activityBody.body).toContain('alice@example.com')
  })

  it('Test 4: contact_id is null when no matching contact exists (cold lead)', async () => {
    const calls = makeFetchSequence([
      { body: { docs: [] } }, // no match
      { body: {} },
      { body: {} },
    ])
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB())

    const activityBody = JSON.parse(calls[1]!.init.body as string) as Record<string, unknown>
    expect(activityBody.contact_id).toBeNull()
  })

  it('Test 5: creates a follow-up task with due_date 24 hours from now', async () => {
    const before = Date.now()
    const calls = makeFetchSequence([
      { body: { docs: [{ id: 'c1' }] } },
      { body: {} },
      { body: {} },
    ])
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB({ attendee: {
      name: 'Alice Walker', email: 'alice@example.com', timeZone: 'UTC',
    } }))
    const after = Date.now()

    const taskBody = JSON.parse(calls[2]!.init.body as string) as Record<string, unknown>
    expect(taskBody.title).toBe('Follow up with Alice Walker after booking')
    expect(taskBody.contact_id).toBe('c1')
    expect(taskBody.status).toBe('open')

    const due = Date.parse(taskBody.due_date as string)
    expect(due).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000)
    expect(due).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 100)
  })

  it('Test 6: failed activity POST throws so BullMQ retries (no half-state)', async () => {
    makeFetchSequence([
      { body: { docs: [{ id: 'c1' }] } },
      { status: 500, body: 'db down' },
    ])
    startWorker()
    await expect(mocks.capturedProcessor!(VALID_JOB())).rejects.toThrow(/CRM activity.*500/)
  })

  it('Test 7: failed task POST also throws (after activity succeeds)', async () => {
    makeFetchSequence([
      { body: { docs: [{ id: 'c1' }] } },
      { body: { id: 'a1' } },
      { status: 500, body: 'db down' },
    ])
    startWorker()
    await expect(mocks.capturedProcessor!(VALID_JOB())).rejects.toThrow(/CRM task.*500/)
  })

  it('Test 8: Authorization header uses Payload API-Key format on every request', async () => {
    const calls = makeFetchSequence([
      { body: { docs: [{ id: 'c1' }] } },
      { body: {} },
      { body: {} },
    ])
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB())

    for (const call of calls) {
      const headers = call.init.headers as Record<string, string>
      expect(headers.Authorization).toBe('users API-Key test-key')
    }
  })
})

// ── BOOKING_CANCELLED + BOOKING_RESCHEDULED ───────────────────────────────

describe('booking-worker — non-create triggers do NOT touch CRM', () => {
  it('Test 9: BOOKING_CANCELLED does not call any Payload endpoint', async () => {
    const calls = makeFetchSequence([])
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB({ triggerEvent: 'BOOKING_CANCELLED' }))

    expect(calls).toHaveLength(0)
    // It DOES log for observability
    expect(mocks.log.info).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'cal-booking-uid-1' }),
      expect.stringMatching(/cancelled/i),
    )
  })

  it('Test 10: BOOKING_RESCHEDULED is a no-op (Phase 9)', async () => {
    const calls = makeFetchSequence([])
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB({ triggerEvent: 'BOOKING_RESCHEDULED' }))

    expect(calls).toHaveLength(0)
    expect(mocks.log.info).toHaveBeenCalledWith(
      expect.objectContaining({ triggerEvent: 'BOOKING_RESCHEDULED' }),
      expect.stringMatching(/no action/i),
    )
  })
})
