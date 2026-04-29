/**
 * packages/tools/src/__tests__/handlers.test.ts
 *
 * Unit tests for handleEmailGate + handleResendPdf — the public-form
 * business logic that the per-app /api/tools/* routes wrap.
 *
 * The route wrappers are already tested in apps/web-main; here we lock in
 * the behaviour that they delegate to:
 *
 *   - Honeypot detection (T-10-02-04): _hp:true silently returns ok:true
 *     without doing anything (don't tell the bot it tripped a trap).
 *   - Email format validation (basic regex; rejects malformed addresses).
 *   - Required-field validation (empty toolSlug or agencySlug → ok:false).
 *   - Queue add called with sensitiveData:true (PII encryption at rest).
 *   - The queue keyPrefix uses the per-agency Redis prefix
 *     (REDIS_KEY.bullPrefix(agencySlug)) — cross-tenant isolation.
 *   - Both handlers enqueue to the SAME queue ('tool-pdf-email') so the
 *     bridging worker drains both producer paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  createEncryptedQueue: vi.fn(),
  queueAdd:             vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

mocks.createEncryptedQueue.mockImplementation(() => ({ add: mocks.queueAdd }))

vi.mock('@mjagency/queue', () => ({
  createEncryptedQueue: mocks.createEncryptedQueue,
}))

vi.mock('@mjagency/config', () => ({
  REDIS_KEY:    { bullPrefix: (a: string) => `agency:${a}:bull` },
  createLogger: () => mocks.log,
}))

const { handleEmailGate } = await import('../actions/email-gate.js')
const { handleResendPdf } = await import('../actions/resend-pdf.js')

beforeEach(() => {
  mocks.queueAdd.mockReset().mockResolvedValue(undefined)
  mocks.createEncryptedQueue.mockClear()
  mocks.createEncryptedQueue.mockImplementation(() => ({ add: mocks.queueAdd }))
  mocks.log.info.mockReset()
})

const VALID_EMAIL_GATE = (overrides: Record<string, unknown> = {}) => ({
  email:          'visitor@example.com',
  toolSlug:       'roi-calculator',
  toolResultJson: '{"score":42}',
  agencySlug:     'finance',
  ...overrides,
})

const VALID_RESEND = (overrides: Record<string, unknown> = {}) => ({
  email:          'visitor@example.com',
  toolSlug:       'roi-calculator',
  toolResultJson: '{"score":42}',
  agencySlug:     'finance',
  ...overrides,
})

// ── handleEmailGate ──────────────────────────────────────────────────────

describe('handleEmailGate — honeypot (T-10-02-04)', () => {
  it('Test 1: _hp:non-empty → ok:true returned but NO queue add (silent discard)', async () => {
    const result = await handleEmailGate(VALID_EMAIL_GATE({ _hp: 'spam-bot' }))

    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
    expect(mocks.queueAdd).not.toHaveBeenCalled()
  })

  it('Test 2: _hp:"" (empty string) is treated as no-hit and proceeds normally', async () => {
    await handleEmailGate(VALID_EMAIL_GATE({ _hp: '' }))
    expect(mocks.queueAdd).toHaveBeenCalledTimes(1)
  })

  it('Test 3: _hp:undefined is treated as no-hit', async () => {
    await handleEmailGate(VALID_EMAIL_GATE())
    expect(mocks.queueAdd).toHaveBeenCalledTimes(1)
  })
})

describe('handleEmailGate — input validation', () => {
  it('Test 4: malformed email → ok:false with user-facing error, no enqueue', async () => {
    const result = await handleEmailGate(VALID_EMAIL_GATE({ email: 'not-an-email' }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/could not send/i)
    expect(mocks.queueAdd).not.toHaveBeenCalled()
  })

  it('Test 5: empty email → ok:false', async () => {
    const result = await handleEmailGate(VALID_EMAIL_GATE({ email: '' }))
    expect(result.ok).toBe(false)
    expect(mocks.queueAdd).not.toHaveBeenCalled()
  })

  it('Test 6: missing toolSlug → ok:false (cannot generate PDF without a tool)', async () => {
    const result = await handleEmailGate(VALID_EMAIL_GATE({ toolSlug: '' }))
    expect(result.ok).toBe(false)
    expect(mocks.queueAdd).not.toHaveBeenCalled()
  })

  it('Test 7: missing agencySlug → ok:false (cannot route without an agency)', async () => {
    const result = await handleEmailGate(VALID_EMAIL_GATE({ agencySlug: '' }))
    expect(result.ok).toBe(false)
    expect(mocks.queueAdd).not.toHaveBeenCalled()
  })

  it('Test 8: a series of plausible-looking-but-malformed emails are rejected', async () => {
    for (const bad of ['no-at-sign', 'spaces in@email.com', '@no-local-part.com', 'no-tld@host', 'a@', '@b']) {
      mocks.queueAdd.mockClear()
      const result = await handleEmailGate(VALID_EMAIL_GATE({ email: bad }))
      expect(result.ok, `expected ${bad} to be rejected`).toBe(false)
      expect(mocks.queueAdd).not.toHaveBeenCalled()
    }
  })
})

describe('handleEmailGate — queue dispatch', () => {
  it('Test 9: enqueues to "tool-pdf-email" with sensitiveData: true', async () => {
    await handleEmailGate(VALID_EMAIL_GATE())

    expect(mocks.createEncryptedQueue).toHaveBeenCalledWith(
      'tool-pdf-email',
      expect.objectContaining({ keyPrefix: 'agency:finance:bull' }),
    )
    const [, , opts] = mocks.queueAdd.mock.calls[0]! as [string, unknown, Record<string, unknown>]
    expect(opts.sensitiveData).toBe(true)
  })

  it('Test 10: payload carries email, toolSlug, toolResultJson, agencySlug — no _hp leak', async () => {
    await handleEmailGate(VALID_EMAIL_GATE({
      email:          'a@b.com',
      toolSlug:       'savings',
      toolResultJson: '{"x":1}',
      agencySlug:     'web-product',
      _hp:            '', // empty, not a hit
    }))

    const [, payload] = mocks.queueAdd.mock.calls[0]! as [string, Record<string, unknown>, unknown]
    expect(payload).toEqual({
      email:          'a@b.com',
      toolSlug:       'savings',
      toolResultJson: '{"x":1}',
      agencySlug:     'web-product',
    })
    // _hp is NOT in the payload — internal-only field
    expect(payload._hp).toBeUndefined()
  })

  it('Test 11: agencySlug round-trips into the queue keyPrefix (cross-tenant isolation)', async () => {
    await handleEmailGate(VALID_EMAIL_GATE({ agencySlug: 'web-ecommerce' }))

    expect(mocks.createEncryptedQueue).toHaveBeenCalledWith(
      'tool-pdf-email',
      expect.objectContaining({ keyPrefix: 'agency:web-ecommerce:bull' }),
    )
  })
})

// ── handleResendPdf ──────────────────────────────────────────────────────

describe('handleResendPdf — mirrors email-gate contract', () => {
  it('Test 12: honeypot _hp:true → ok:true, no enqueue', async () => {
    const result = await handleResendPdf(VALID_RESEND({ _hp: 'bot' }))
    expect(result.ok).toBe(true)
    expect(mocks.queueAdd).not.toHaveBeenCalled()
  })

  it('Test 13: malformed email → ok:false, distinct error wording from email-gate', async () => {
    const result = await handleResendPdf(VALID_RESEND({ email: 'broken' }))
    expect(result.ok).toBe(false)
    // The error wording differentiates the two flows in the UI
    expect(result.error).toMatch(/could not re-send/i)
    expect(mocks.queueAdd).not.toHaveBeenCalled()
  })

  it('Test 14: enqueues onto the SAME tool-pdf-email queue as email-gate (single bridge target)', async () => {
    await handleResendPdf(VALID_RESEND({ agencySlug: 'finance' }))

    expect(mocks.createEncryptedQueue).toHaveBeenCalledWith(
      'tool-pdf-email',
      expect.objectContaining({ keyPrefix: 'agency:finance:bull' }),
    )
    const [, , opts] = mocks.queueAdd.mock.calls[0]! as [string, unknown, Record<string, unknown>]
    expect(opts.sensitiveData).toBe(true)
  })

  it('Test 15: missing toolSlug or agencySlug rejected (parity with email-gate)', async () => {
    expect((await handleResendPdf(VALID_RESEND({ toolSlug: '' }))).ok).toBe(false)
    expect((await handleResendPdf(VALID_RESEND({ agencySlug: '' }))).ok).toBe(false)
  })
})
