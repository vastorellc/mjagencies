/**
 * apps/web-main/src/jobs/__tests__/register-all-workers.test.ts
 *
 * Unit tests for the unified worker bootstrap (`register-all-workers.ts`).
 *
 * The bootstrap policy is "best-effort" — every worker that can come up does;
 * the ones that throw at startup don't take the rest down. We verify three
 * properties of that contract:
 *
 *   1. Every per-agency worker is invoked once per agency (12 agencies × 7
 *      worker types = 84 register() calls).
 *   2. Every platform worker is invoked exactly once (no per-agency loop).
 *   3. A throw from any one register() call does NOT prevent the others
 *      from running, and the failure surfaces in the returned `failed` list.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks for the 9 worker registration functions ─────────────────
const mocks = vi.hoisted(() => ({
  createEmailWorker:       vi.fn(),
  createFormWorker:        vi.fn(),
  createBookingWorker:     vi.fn(),
  createCrmWorker:         vi.fn(),
  createSmsWorker:         vi.fn(),
  startCapiWorker:         vi.fn(),
  startOptOutFanoutWorker: vi.fn(),
  startEsignWorker:        vi.fn(),
  startExpiryWorker:       vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@mjagency/email',      () => ({ createEmailWorker:       mocks.createEmailWorker }))
vi.mock('@mjagency/forms',      () => ({ createFormWorker:        mocks.createFormWorker }))
vi.mock('@mjagency/booking',    () => ({ createBookingWorker:     mocks.createBookingWorker }))
vi.mock('@mjagency/crm',        () => ({ createCrmWorker:         mocks.createCrmWorker }))
vi.mock('@mjagency/sms',        () => ({ createSmsWorker:         mocks.createSmsWorker }))
vi.mock('@mjagency/meta-capi',  () => ({ startCapiWorker:         mocks.startCapiWorker }))
vi.mock('@mjagency/compliance', () => ({ startOptOutFanoutWorker: mocks.startOptOutFanoutWorker }))
vi.mock('@mjagency/esign',      () => ({ startEsignWorker:        mocks.startEsignWorker }))
vi.mock('@mjagency/proposals',  () => ({ startExpiryWorker:       mocks.startExpiryWorker }))
vi.mock('@mjagency/config',     () => ({ createLogger: () => mocks.log }))

const { registerAllWorkers, AGENCY_IDS } = await import('../register-all-workers.js')

// ── Tests ──────────────────────────────────────────────────────────────────

describe('registerAllWorkers — happy path', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => {
      if (typeof m === 'function' && 'mockReset' in m) m.mockReset()
    })
    mocks.log.info.mockClear()
    mocks.log.warn.mockClear()
  })

  it('Test 1: invokes each per-agency worker once per agency (12 agencies)', () => {
    registerAllWorkers()

    expect(mocks.createEmailWorker).toHaveBeenCalledTimes(12)
    expect(mocks.createFormWorker).toHaveBeenCalledTimes(12)
    expect(mocks.createBookingWorker).toHaveBeenCalledTimes(12)
    expect(mocks.createCrmWorker).toHaveBeenCalledTimes(12)
    expect(mocks.createSmsWorker).toHaveBeenCalledTimes(12)
    expect(mocks.startCapiWorker).toHaveBeenCalledTimes(12)
    expect(mocks.startOptOutFanoutWorker).toHaveBeenCalledTimes(12)
  })

  it('Test 2: passes the agencyId positionally to each per-agency register call', () => {
    registerAllWorkers()

    // Spot-check: every agency in the canonical list must receive its own
    // createEmailWorker invocation. If any agency is missed, that agency's
    // queue would never drain.
    const calledAgencies = mocks.createEmailWorker.mock.calls.map((c) => c[0])
    for (const id of AGENCY_IDS) {
      expect(calledAgencies).toContain(id)
    }
  })

  it('Test 3: invokes each platform worker exactly once (no per-agency loop)', () => {
    registerAllWorkers()
    expect(mocks.startEsignWorker).toHaveBeenCalledTimes(1)
    expect(mocks.startExpiryWorker).toHaveBeenCalledTimes(1)
  })

  it('Test 4: returns a structured registry with every successful registration named', () => {
    const result = registerAllWorkers()

    // 7 per-agency × 12 agencies + 2 platform = 86 entries
    expect(result.registered).toHaveLength(86)
    expect(result.failed).toEqual([])
    expect(result.registered).toContain('email:ai')
    expect(result.registered).toContain('opt-out-fanout:webdev')
    expect(result.registered).toContain('esign')
    expect(result.registered).toContain('proposal-expiry')
  })
})

describe('registerAllWorkers — partial failure isolation', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => {
      if (typeof m === 'function' && 'mockReset' in m) m.mockReset()
    })
    mocks.log.info.mockClear()
    mocks.log.warn.mockClear()
  })

  it('Test 5: a per-agency register throw does NOT abort remaining registrations', () => {
    mocks.createBookingWorker.mockImplementation((agencyId: string) => {
      if (agencyId === 'finance') throw new Error('CALCOM_API_KEY missing')
    })

    const result = registerAllWorkers()

    // The other 11 agencies should still have had their booking worker registered
    expect(mocks.createBookingWorker).toHaveBeenCalledTimes(12)
    // And every OTHER worker type still ran for finance
    expect(
      mocks.createEmailWorker.mock.calls.some((c) => c[0] === 'finance'),
    ).toBe(true)

    // The failure surfaces in the returned list with worker name + agency
    expect(result.failed).toContainEqual({
      name:     'booking',
      agencyId: 'finance',
      error:    'CALCOM_API_KEY missing',
    })
    expect(result.registered).not.toContain('booking:finance')
  })

  it('Test 6: a platform-worker throw is captured without blocking the other platform worker', () => {
    mocks.startEsignWorker.mockImplementation(() => {
      throw new Error('DOCUSEAL_URL missing')
    })

    const result = registerAllWorkers()

    expect(mocks.startExpiryWorker).toHaveBeenCalledTimes(1)
    expect(result.failed).toContainEqual({
      name:  'esign',
      error: 'DOCUSEAL_URL missing',
    })
    expect(result.registered).toContain('proposal-expiry')
  })

  it('Test 7: every failure is logged at warn level with worker + agencyId fields', () => {
    mocks.createCrmWorker.mockImplementation((agencyId: string) => {
      if (agencyId === 'main') throw new Error('boom')
    })

    registerAllWorkers()

    expect(mocks.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        worker:   'crm',
        agencyId: 'main',
        err:      'boom',
      }),
      'worker_register_failed',
    )
  })
})
