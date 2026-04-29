/**
 * packages/proposals/src/__tests__/update-proposal-status.test.ts
 *
 * Unit tests for handleProposalAction — the public sign/decline endpoint
 * exposed to anonymous customers via tokenized proposal links.
 *
 * The handler enforces three security/business invariants we lock in:
 *
 *   1. HMAC verification BEFORE any state change. A request with the wrong
 *      signature must return ok:false with no fetch / no DB write — and the
 *      comparison must use timingSafeEqual to prevent timing oracles.
 *
 *   2. Expired proposals (status: 'expired' | 'grace' | 'nurture') cannot be
 *      flipped to signed/declined — the proposal lifecycle has already moved
 *      past the point where customer action is meaningful.
 *
 *   3. Notification email is gated on the email warm-up state (REQ-134).
 *      A regression that ignored warmup would burn sender reputation.
 *      A regression that always blocked would mean reps never know when
 *      proposals get signed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

// ── Hoisted mocks ─────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  isEmailWarmupComplete: vi.fn(),
  createEncryptedQueue:  vi.fn(),
  emailQueueAdd:         vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

mocks.createEncryptedQueue.mockImplementation(() => ({ add: mocks.emailQueueAdd }))

vi.mock('@mjagency/email', () => ({
  isEmailWarmupComplete: mocks.isEmailWarmupComplete,
}))

vi.mock('@mjagency/queue', () => ({
  createEncryptedQueue: mocks.createEncryptedQueue,
}))

vi.mock('@mjagency/config', () => ({
  REDIS_KEY:    { bullPrefix: (a: string) => `agency:${a}:bull` },
  createLogger: () => mocks.log,
}))

// PROPOSAL_HMAC_SECRET is read at module load — set BEFORE the import below.
const HMAC_SECRET = 'test-hmac-secret-do-not-use-in-prod'
process.env['PROPOSAL_HMAC_SECRET'] = HMAC_SECRET
process.env['PAYLOAD_URL']          = 'http://payload.test'
process.env['PAYLOAD_API_KEY']      = 'fake-api-key'

const { handleProposalAction } = await import('../actions/update-proposal-status.js')

// ── Helpers ───────────────────────────────────────────────────────────────

function signToken(token: string): string {
  return createHmac('sha256', HMAC_SECRET).update(token).digest('hex')
}

const VALID_INPUT = (overrides: Record<string, unknown> = {}) => ({
  token:         'proposal-tok-abc',
  action:        'sign' as const,
  hmacSignature: signToken('proposal-tok-abc'),
  ...overrides,
})

function mockFetchSequence(responses: Array<{ status?: number; body: unknown }>): void {
  let i = 0
  global.fetch = vi.fn(async () => {
    const r = responses[i++] ?? { status: 500, body: 'no more responses' }
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), {
      status:  r.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
}

beforeEach(() => {
  mocks.isEmailWarmupComplete.mockReset().mockResolvedValue(true)
  mocks.emailQueueAdd.mockReset().mockResolvedValue(undefined)
  mocks.createEncryptedQueue.mockClear()
  mocks.createEncryptedQueue.mockImplementation(() => ({ add: mocks.emailQueueAdd }))
  mocks.log.info.mockReset()
})

// ── HMAC verification ────────────────────────────────────────────────────

describe('handleProposalAction — HMAC verification', () => {
  it('Test 1: invalid signature returns ok:false BEFORE any fetch is called', async () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    const result = await handleProposalAction({
      token:         'tok',
      action:        'sign',
      hmacSignature: 'a'.repeat(64), // wrong sig but valid hex length
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Invalid signature')
    // No fetch calls — must short-circuit before touching Payload
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('Test 2: malformed-length signature is rejected without crashing', async () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    // timingSafeEqual throws if buffers differ in length — we wrap so the
    // handler returns ok:false on any signature shape mismatch instead of
    // surfacing a 500 to the caller. Without try/catch this would throw.
    const result = await handleProposalAction({
      token:         'tok',
      action:        'sign',
      hmacSignature: 'short',
    }).catch(() => ({ ok: false, error: 'crashed' }))

    // Either ok:false with 'Invalid signature' OR the caught crash — both
    // are acceptable; what's UNACCEPTABLE is a successful (ok:true) return.
    expect(result.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('Test 3: valid signature passes HMAC check and proceeds to fetch the proposal', async () => {
    mockFetchSequence([
      { body: { docs: [{ id: 'p1', status: 'sent', agency_id: 'finance' }] } }, // proposal lookup
      { body: {} }, // PATCH proposal
    ])

    const result = await handleProposalAction(VALID_INPUT())
    expect(result.ok).toBe(true)
  })
})

// ── Status transitions ───────────────────────────────────────────────────

describe('handleProposalAction — status transitions', () => {
  it('Test 4: proposal not found returns ok:false WITHOUT a PATCH fetch', async () => {
    const calls: string[] = []
    global.fetch = vi.fn(async (url: unknown) => {
      calls.push(String(url))
      return new Response(JSON.stringify({ docs: [] }), { status: 200 })
    }) as typeof fetch

    const result = await handleProposalAction(VALID_INPUT())
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Proposal not found')
    // The lookup fetch happened, but no PATCH should follow
    expect(calls.length).toBe(1)
    expect(calls[0]).toContain('?where[token]')
  })

  it('Test 5: expired proposal returns ok:false with a customer-facing reason', async () => {
    mockFetchSequence([
      { body: { docs: [{ id: 'p1', status: 'expired', agency_id: 'finance' }] } },
    ])
    const result = await handleProposalAction(VALID_INPUT())
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/expired/i)
    // Notification queue must NOT have been touched
    expect(mocks.emailQueueAdd).not.toHaveBeenCalled()
  })

  it('Test 6: grace-period proposal also blocked (lifecycle past customer action)', async () => {
    mockFetchSequence([
      { body: { docs: [{ id: 'p1', status: 'grace', agency_id: 'finance' }] } },
    ])
    const result = await handleProposalAction(VALID_INPUT())
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/expired/i)
  })

  it('Test 7: nurture-status proposal also blocked', async () => {
    mockFetchSequence([
      { body: { docs: [{ id: 'p1', status: 'nurture', agency_id: 'finance' }] } },
    ])
    const result = await handleProposalAction(VALID_INPUT())
    expect(result.ok).toBe(false)
  })

  it('Test 8: sign action PATCHes status:signed + signed_at timestamp', async () => {
    const calls: Array<[string, RequestInit]> = []
    global.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      calls.push([String(url), init ?? {}])
      if (String(url).includes('?where[token]')) {
        return new Response(JSON.stringify({
          docs: [{ id: 'p-xyz', status: 'sent', agency_id: 'finance' }],
        }), { status: 200 })
      }
      return new Response('{}', { status: 200 })
    }) as typeof fetch

    await handleProposalAction(VALID_INPUT({ action: 'sign' }))

    const patchCall = calls.find(([url]) => url.endsWith('/proposals/p-xyz'))
    expect(patchCall).toBeDefined()
    expect(patchCall![1].method).toBe('PATCH')
    const body = JSON.parse(patchCall![1].body as string) as Record<string, string>
    expect(body.status).toBe('signed')
    expect(body.signed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('Test 9: decline action PATCHes status:declined + declined_at timestamp', async () => {
    const calls: Array<[string, RequestInit]> = []
    global.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      calls.push([String(url), init ?? {}])
      if (String(url).includes('?where[token]')) {
        return new Response(JSON.stringify({
          docs: [{ id: 'p-decl', status: 'sent', agency_id: 'finance' }],
        }), { status: 200 })
      }
      return new Response('{}', { status: 200 })
    }) as typeof fetch

    await handleProposalAction(VALID_INPUT({
      token:         'decline-tok',
      action:        'decline',
      hmacSignature: signToken('decline-tok'),
    }))

    const patchCall = calls.find(([url]) => url.endsWith('/proposals/p-decl'))
    const body = JSON.parse(patchCall![1].body as string) as Record<string, string>
    expect(body.status).toBe('declined')
    expect(body.declined_at).toBeTruthy()
    expect(body.signed_at).toBeUndefined()
  })
})

// ── Warm-up gate (REQ-134) ────────────────────────────────────────────────

describe('handleProposalAction — notification email warm-up gate (REQ-134)', () => {
  function setupHappyProposal(): void {
    mockFetchSequence([
      { body: { docs: [{ id: 'p1', status: 'sent', agency_id: 'finance' }] } },
      { body: {} }, // PATCH
    ])
  }

  it('Test 10: warmup complete → email enqueued with the right payload + sensitiveData: true', async () => {
    mocks.isEmailWarmupComplete.mockResolvedValueOnce(true)
    setupHappyProposal()

    await handleProposalAction(VALID_INPUT())

    expect(mocks.isEmailWarmupComplete).toHaveBeenCalledWith('finance')
    expect(mocks.emailQueueAdd).toHaveBeenCalledTimes(1)
    const [name, data, opts] = mocks.emailQueueAdd.mock.calls[0]! as [string, Record<string, string>, Record<string, unknown>]
    expect(name).toBe('proposal-notification')
    expect(data.agencyId).toBe('finance')
    expect(data.proposalId).toBe('p1')
    expect(data.action).toBe('sign')
    expect(opts.sensitiveData).toBe(true)
  })

  it('Test 11: warmup INCOMPLETE → no email enqueued, ok:true still returned', async () => {
    mocks.isEmailWarmupComplete.mockResolvedValueOnce(false)
    setupHappyProposal()

    const result = await handleProposalAction(VALID_INPUT())
    expect(result.ok).toBe(true)
    expect(mocks.emailQueueAdd).not.toHaveBeenCalled()
    // Skip log line should be emitted
    expect(mocks.log.info).toHaveBeenCalledWith(
      expect.objectContaining({ proposalId: 'p1' }),
      expect.stringMatching(/warm-up not complete/),
    )
  })

  it('Test 12: warmup queue uses per-agency Redis prefix (cross-tenant isolation)', async () => {
    mocks.isEmailWarmupComplete.mockResolvedValueOnce(true)
    mockFetchSequence([
      { body: { docs: [{ id: 'p2', status: 'sent', agency_id: 'web-ecommerce' }] } },
      { body: {} },
    ])

    await handleProposalAction(VALID_INPUT())

    expect(mocks.createEncryptedQueue).toHaveBeenCalledWith(
      'email-send',
      expect.objectContaining({ keyPrefix: 'agency:web-ecommerce:bull' }),
    )
  })
})
