/**
 * packages/email/src/__tests__/warmup.test.ts
 *
 * Unit tests for the 35-day email warm-up reputation gate (REQ-113, REQ-134).
 *
 * The warm-up gate protects sender reputation — sending bulk email before a
 * domain has been ramped up triggers spam-filter classification that can
 * persist for months. The 35-day threshold matches the mailbox-provider
 * warmup curves (Postmark / Mailgun / SendGrid all converge there).
 *
 * Two callers depend on this module:
 *   1. createEmailWorker (every send): rejectSendIfWarmupIncomplete throws
 *      so the worker fails the job and BullMQ retries later.
 *   2. handleProposalAction (notification gating): isEmailWarmupComplete
 *      returns a boolean so the caller can branch.
 *
 * A regression here means either (a) emails leak before warm-up (reputation
 * damage) or (b) emails never send after warm-up completes (revenue loss).
 *
 * Tests mock ioredis at the module level so we never touch a real Redis
 * during unit tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mock for ioredis ──────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  get:  vi.fn(),
  incr: vi.fn(),
  quit: vi.fn(),
}))

vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    get:  mocks.get,
    incr: mocks.incr,
    quit: mocks.quit,
  })),
}))

const {
  rejectSendIfWarmupIncomplete,
  incrementWarmupDay,
  getWarmupDay,
  isEmailWarmupComplete,
  EmailWarmupIncompleteError,
} = await import('../warmup.js')

beforeEach(() => {
  mocks.get.mockReset()
  mocks.incr.mockReset()
  mocks.quit.mockReset().mockResolvedValue('OK')
})

// ── getWarmupDay ─────────────────────────────────────────────────────────

describe('getWarmupDay', () => {
  it('Test 1: returns 0 when the Redis key is absent (cold start)', async () => {
    mocks.get.mockResolvedValueOnce(null)
    expect(await getWarmupDay('finance')).toBe(0)
  })

  it('Test 2: parses the stored count to an integer', async () => {
    mocks.get.mockResolvedValueOnce('17')
    expect(await getWarmupDay('finance')).toBe(17)
  })

  it('Test 3: queries the canonical agency-scoped key (agency:<id>:email:warmup-day)', async () => {
    mocks.get.mockResolvedValueOnce('5')
    await getWarmupDay('finance')
    expect(mocks.get).toHaveBeenCalledWith('agency:finance:email:warmup-day')
  })

  it('Test 4: closes the Redis connection in a finally block (no leak on success)', async () => {
    mocks.get.mockResolvedValueOnce('5')
    await getWarmupDay('finance')
    expect(mocks.quit).toHaveBeenCalledTimes(1)
  })

  it('Test 5: closes the Redis connection in a finally block (no leak on error)', async () => {
    mocks.get.mockRejectedValueOnce(new Error('redis down'))
    await expect(getWarmupDay('finance')).rejects.toThrow('redis down')
    expect(mocks.quit).toHaveBeenCalledTimes(1)
  })
})

// ── incrementWarmupDay ───────────────────────────────────────────────────

describe('incrementWarmupDay', () => {
  it('Test 6: calls INCR on the agency-scoped key and returns the new value', async () => {
    mocks.incr.mockResolvedValueOnce(8)
    const result = await incrementWarmupDay('finance')
    expect(result).toBe(8)
    expect(mocks.incr).toHaveBeenCalledWith('agency:finance:email:warmup-day')
  })

  it('Test 7: closes the Redis connection on success', async () => {
    mocks.incr.mockResolvedValueOnce(1)
    await incrementWarmupDay('finance')
    expect(mocks.quit).toHaveBeenCalledTimes(1)
  })

  it('Test 8: closes the Redis connection on error', async () => {
    mocks.incr.mockRejectedValueOnce(new Error('redis blip'))
    await expect(incrementWarmupDay('finance')).rejects.toThrow('redis blip')
    expect(mocks.quit).toHaveBeenCalledTimes(1)
  })
})

// ── rejectSendIfWarmupIncomplete ─────────────────────────────────────────

describe('rejectSendIfWarmupIncomplete (35-day gate)', () => {
  it('Test 9: day 0 (cold start) throws EmailWarmupIncompleteError', async () => {
    mocks.get.mockResolvedValueOnce(null)
    await expect(
      rejectSendIfWarmupIncomplete('finance'),
    ).rejects.toBeInstanceOf(EmailWarmupIncompleteError)
  })

  it('Test 10: day 34 (one short of threshold) throws — strictly less-than check', async () => {
    mocks.get.mockResolvedValueOnce('34')
    await expect(rejectSendIfWarmupIncomplete('finance')).rejects.toThrow(/34\/35/)
  })

  it('Test 11: day 35 (exactly threshold) does NOT throw — >= comparison', async () => {
    mocks.get.mockResolvedValueOnce('35')
    await expect(rejectSendIfWarmupIncomplete('finance')).resolves.toBeUndefined()
  })

  it('Test 12: day 100 (well past threshold) does NOT throw', async () => {
    mocks.get.mockResolvedValueOnce('100')
    await expect(rejectSendIfWarmupIncomplete('finance')).resolves.toBeUndefined()
  })

  it('Test 13: error message includes the agency id and current/required day count', async () => {
    mocks.get.mockResolvedValueOnce('10')
    try {
      await rejectSendIfWarmupIncomplete('finance')
      // If we reach here the test failed — throw to be sure
      throw new Error('expected to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(EmailWarmupIncompleteError)
      expect((err as Error).message).toContain('finance')
      expect((err as Error).message).toContain('10/35')
    }
  })

  it('Test 14: closes the Redis connection on the throw path (no leak when blocking)', async () => {
    mocks.get.mockResolvedValueOnce('10')
    await expect(rejectSendIfWarmupIncomplete('finance')).rejects.toBeDefined()
    expect(mocks.quit).toHaveBeenCalledTimes(1)
  })
})

// ── isEmailWarmupComplete (added in audit fix 0976a34) ────────────────────

describe('isEmailWarmupComplete', () => {
  it('Test 15: returns false at day 0', async () => {
    mocks.get.mockResolvedValueOnce(null)
    expect(await isEmailWarmupComplete('finance')).toBe(false)
  })

  it('Test 16: returns false at day 34 (one short)', async () => {
    mocks.get.mockResolvedValueOnce('34')
    expect(await isEmailWarmupComplete('finance')).toBe(false)
  })

  it('Test 17: returns true at exactly day 35 — same threshold as the throwing variant', async () => {
    mocks.get.mockResolvedValueOnce('35')
    expect(await isEmailWarmupComplete('finance')).toBe(true)
  })

  it('Test 18: returns true at day 100', async () => {
    mocks.get.mockResolvedValueOnce('100')
    expect(await isEmailWarmupComplete('finance')).toBe(true)
  })

  it('Test 19: returns false on any Redis error (safety bias — when in doubt, do not send)', async () => {
    // The proposal action and any other caller must default to "do not send"
    // when warm-up status cannot be determined. A regression that returned
    // true on a Redis blip would silently bypass the gate.
    mocks.get.mockRejectedValueOnce(new Error('connection refused'))
    expect(await isEmailWarmupComplete('finance')).toBe(false)
  })
})

// ── Cross-cutting: agency isolation ───────────────────────────────────────

describe('agency isolation in warm-up keys', () => {
  it('Test 20: different agencies use different Redis keys (no cross-tenant pollution)', async () => {
    mocks.get
      .mockResolvedValueOnce('40') // finance — past threshold
      .mockResolvedValueOnce('5')  // ecommerce — pre-threshold

    expect(await isEmailWarmupComplete('finance')).toBe(true)
    expect(await isEmailWarmupComplete('ecommerce')).toBe(false)

    expect(mocks.get).toHaveBeenNthCalledWith(1, 'agency:finance:email:warmup-day')
    expect(mocks.get).toHaveBeenNthCalledWith(2, 'agency:ecommerce:email:warmup-day')
  })
})
