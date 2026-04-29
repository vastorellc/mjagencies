/**
 * packages/invoices/src/__tests__/actions.test.ts
 *
 * Unit tests for createInvoice + refundInvoice (REQ-127, REQ-128, REQ-129).
 *
 * These two server actions are the financial flow. Bugs here look like:
 *   - Charging the wrong amount (totalAmount math wrong)
 *   - Refunding without auth (security)
 *   - Marking an invoice paid when Stripe failed (state corruption)
 *   - Cross-tenant invoice access (privacy)
 *
 * Both actions begin with `requireSession()` + agency-id check (CLAUDE.md
 * Rule 3 + Rule 8). The auth gate is tested via mismatch throwing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  requireSession:        vi.fn(),
  productsCreate:        vi.fn(),
  pricesCreate:          vi.fn(),
  paymentLinksCreate:    vi.fn(),
  checkoutSessionsList:  vi.fn(),
  refundsCreate:         vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@mjagency/auth', () => ({
  requireSession: mocks.requireSession,
}))

vi.mock('@mjagency/config', () => ({
  createLogger: () => mocks.log,
}))

// Stripe is `import Stripe from 'stripe'`; new Stripe(...) returns our fake.
vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    products:      { create: mocks.productsCreate },
    prices:        { create: mocks.pricesCreate },
    paymentLinks:  { create: mocks.paymentLinksCreate },
    checkout:      { sessions: { list: mocks.checkoutSessionsList } },
    refunds:       { create: mocks.refundsCreate },
  })),
}))

const { createInvoice }  = await import('../actions/create-invoice.js')
const { refundInvoice }  = await import('../actions/refund-invoice.js')

// ── Helpers ───────────────────────────────────────────────────────────────

const SESSION = (agencyId: string) => ({
  sub:      'user-1',
  agencyId,
  role:     'admin' as const,
  jti:      'jti',
  familyId: 'fam',
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
  mocks.requireSession.mockReset()
  mocks.productsCreate.mockReset()
  mocks.pricesCreate.mockReset()
  mocks.paymentLinksCreate.mockReset()
  mocks.checkoutSessionsList.mockReset()
  mocks.refundsCreate.mockReset()
  mocks.log.info.mockReset()
  mocks.log.warn.mockReset()
  mocks.log.error.mockReset()
  process.env['PAYLOAD_URL']     = 'http://payload.test'
  process.env['PAYLOAD_API_KEY'] = 'test-key'
})

// ── createInvoice ────────────────────────────────────────────────────────

describe('createInvoice — auth + agency isolation', () => {
  it('Test 1: throws Forbidden when session.agencyId !== input.agencyId', async () => {
    mocks.requireSession.mockResolvedValueOnce(SESSION('agency-A'))

    await expect(
      createInvoice({
        agencyId:  'agency-B',
        title:     'Q4 Engagement',
        lineItems: [{ description: 'work', quantity: 1, unit_amount: 1000 }],
      }),
    ).rejects.toThrow('Forbidden')

    // No Stripe / Payload calls when auth fails
    expect(mocks.productsCreate).not.toHaveBeenCalled()
  })
})

describe('createInvoice — totalAmount math', () => {
  beforeEach(() => {
    mocks.requireSession.mockResolvedValue(SESSION('finance'))
    mocks.productsCreate.mockResolvedValue({ id: 'prod_1' })
    mocks.pricesCreate.mockResolvedValue({ id: 'price_1' })
    mocks.paymentLinksCreate.mockResolvedValue({ id: 'plink_1', url: 'https://buy.stripe.com/x' })
  })

  it('Test 2: total = sum of (quantity * unit_amount) across line items', async () => {
    const calls = makeFetchSequence([{ body: { id: 'inv-1' } }])

    await createInvoice({
      agencyId:  'finance',
      title:     'Multi-line',
      lineItems: [
        { description: 'item A', quantity: 3, unit_amount: 1000 },  // 3000
        { description: 'item B', quantity: 2, unit_amount: 4500 },  //  9000
        { description: 'item C', quantity: 1, unit_amount:  500 },  //   500
      ],
    })

    // Stripe price uses the SAME total
    expect(mocks.pricesCreate).toHaveBeenCalledWith(expect.objectContaining({
      unit_amount: 12500, // 3000 + 9000 + 500
    }))

    // And the Payload invoice body matches
    const body = JSON.parse(calls[0]!.init.body as string) as Record<string, unknown>
    expect(body.total_amount).toBe(12500)
    expect(body.amount_paid).toBe(0)
    expect(body.remaining_balance).toBe(12500)
  })

  it('Test 3: empty lineItems → total = 0 (no crash, no charge)', async () => {
    const calls = makeFetchSequence([{ body: { id: 'inv-2' } }])

    await createInvoice({
      agencyId:  'finance',
      title:     'Empty',
      lineItems: [],
    })

    const body = JSON.parse(calls[0]!.init.body as string) as Record<string, unknown>
    expect(body.total_amount).toBe(0)
  })
})

describe('createInvoice — defaults & due date', () => {
  beforeEach(() => {
    mocks.requireSession.mockResolvedValue(SESSION('finance'))
    mocks.productsCreate.mockResolvedValue({ id: 'prod_1' })
    mocks.pricesCreate.mockResolvedValue({ id: 'price_1' })
    mocks.paymentLinksCreate.mockResolvedValue({ id: 'plink_1', url: 'https://buy.stripe.com/x' })
  })

  it('Test 4: currency defaults to "usd" when omitted', async () => {
    const calls = makeFetchSequence([{ body: { id: 'inv-3' } }])

    await createInvoice({
      agencyId:  'finance',
      title:     'Default',
      lineItems: [{ description: 'x', quantity: 1, unit_amount: 1000 }],
    })

    expect(mocks.pricesCreate).toHaveBeenCalledWith(expect.objectContaining({ currency: 'usd' }))
    const body = JSON.parse(calls[0]!.init.body as string) as Record<string, unknown>
    expect(body.currency).toBe('usd')
  })

  it('Test 5: explicit currency is forwarded to Stripe + Payload', async () => {
    const calls = makeFetchSequence([{ body: { id: 'inv-4' } }])

    await createInvoice({
      agencyId:  'finance',
      title:     'EUR',
      lineItems: [{ description: 'x', quantity: 1, unit_amount: 1000 }],
      currency:  'eur',
    })

    expect(mocks.pricesCreate).toHaveBeenCalledWith(expect.objectContaining({ currency: 'eur' }))
    const body = JSON.parse(calls[0]!.init.body as string) as Record<string, unknown>
    expect(body.currency).toBe('eur')
  })

  it('Test 6: due_date defaults to 30 days from now', async () => {
    const before = Date.now()
    const calls = makeFetchSequence([{ body: { id: 'inv-5' } }])

    await createInvoice({
      agencyId:  'finance',
      title:     'Default due',
      lineItems: [{ description: 'x', quantity: 1, unit_amount: 1000 }],
    })
    const after = Date.now()

    const body = JSON.parse(calls[0]!.init.body as string) as Record<string, unknown>
    const due = Date.parse(body.due_date as string)
    const expectedMin = before + 30 * 24 * 60 * 60 * 1000 - 5000
    const expectedMax = after  + 30 * 24 * 60 * 60 * 1000 + 5000
    expect(due).toBeGreaterThanOrEqual(expectedMin)
    expect(due).toBeLessThanOrEqual(expectedMax)
  })

  it('Test 7: dueDays override sets the due_date relative to now', async () => {
    const before = Date.now()
    const calls = makeFetchSequence([{ body: { id: 'inv-6' } }])

    await createInvoice({
      agencyId:  'finance',
      title:     'Custom due',
      lineItems: [{ description: 'x', quantity: 1, unit_amount: 1000 }],
      dueDays:   7,
    })

    const body = JSON.parse(calls[0]!.init.body as string) as Record<string, unknown>
    const due = Date.parse(body.due_date as string)
    expect(due).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000 - 5000)
  })
})

describe('createInvoice — Stripe + Payload integration', () => {
  beforeEach(() => {
    mocks.requireSession.mockResolvedValue(SESSION('finance'))
  })

  it('Test 8: Stripe metadata carries agencyId / proposalId / esignId', async () => {
    mocks.productsCreate.mockResolvedValue({ id: 'prod_1' })
    mocks.pricesCreate.mockResolvedValue({ id: 'price_1' })
    mocks.paymentLinksCreate.mockResolvedValue({ id: 'plink_1', url: 'https://buy.stripe.com/x' })
    makeFetchSequence([{ body: { id: 'inv-7' } }])

    await createInvoice({
      agencyId:   'finance',
      title:      'Linked',
      lineItems:  [{ description: 'x', quantity: 1, unit_amount: 1000 }],
      proposalId: 'p-123',
      esignId:    'e-456',
    })

    expect(mocks.paymentLinksCreate).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { agencyId: 'finance', proposalId: 'p-123', esignId: 'e-456' },
    }))
  })

  it('Test 9: Stripe failure → invoice STILL created in Payload, paymentLinkUrl undefined', async () => {
    mocks.productsCreate.mockRejectedValueOnce(new Error('Stripe API down'))
    const calls = makeFetchSequence([{ body: { id: 'inv-8' } }])

    const result = await createInvoice({
      agencyId:  'finance',
      title:     'No Stripe',
      lineItems: [{ description: 'x', quantity: 1, unit_amount: 1000 }],
    })

    expect(result.ok).toBe(true)
    expect(result.invoiceId).toBe('inv-8')
    expect(result.paymentLinkUrl).toBeUndefined()
    // Payload body has stripe_payment_link_id/url unset
    const body = JSON.parse(calls[0]!.init.body as string) as Record<string, unknown>
    expect(body.stripe_payment_link_id).toBeUndefined()
    expect(body.stripe_payment_link_url).toBeUndefined()
  })

  it('Test 10: chargeback_evidence is compiled when proposalId or esignId is present (REQ-419)', async () => {
    mocks.productsCreate.mockResolvedValue({ id: 'prod_1' })
    mocks.pricesCreate.mockResolvedValue({ id: 'price_1' })
    mocks.paymentLinksCreate.mockResolvedValue({ id: 'plink_1', url: 'https://buy.stripe.com/x' })
    const calls = makeFetchSequence([{ body: { id: 'inv-9' } }])

    await createInvoice({
      agencyId:   'finance',
      title:      'With evidence',
      lineItems:  [{ description: 'x', quantity: 1, unit_amount: 1000 }],
      proposalId: 'p-999',
      esignId:    'e-999',
    })

    const body = JSON.parse(calls[0]!.init.body as string) as Record<string, unknown>
    const evidence = body.chargeback_evidence as Record<string, unknown>
    expect(evidence).toBeTruthy()
    expect(evidence.proposalId).toBe('p-999')
    expect(evidence.esignId).toBe('e-999')
    expect(evidence.compiledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('Test 11: failed Payload POST returns ok:false with user-facing error', async () => {
    mocks.productsCreate.mockResolvedValue({ id: 'prod_1' })
    mocks.pricesCreate.mockResolvedValue({ id: 'price_1' })
    mocks.paymentLinksCreate.mockResolvedValue({ id: 'plink_1', url: 'https://buy.stripe.com/x' })
    makeFetchSequence([{ status: 500, body: 'db down' }])

    const result = await createInvoice({
      agencyId:  'finance',
      title:     'Will fail',
      lineItems: [{ description: 'x', quantity: 1, unit_amount: 1000 }],
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/try again/i)
  })

  it('Test 12: status defaults to "draft" on creation', async () => {
    mocks.productsCreate.mockResolvedValue({ id: 'prod_1' })
    mocks.pricesCreate.mockResolvedValue({ id: 'price_1' })
    mocks.paymentLinksCreate.mockResolvedValue({ id: 'plink_1', url: 'https://buy.stripe.com/x' })
    const calls = makeFetchSequence([{ body: { id: 'inv-10' } }])

    await createInvoice({
      agencyId:  'finance',
      title:     'Draft',
      lineItems: [{ description: 'x', quantity: 1, unit_amount: 1000 }],
    })

    const body = JSON.parse(calls[0]!.init.body as string) as Record<string, unknown>
    expect(body.status).toBe('draft')
  })
})

// ── refundInvoice ────────────────────────────────────────────────────────

describe('refundInvoice — auth + agency isolation', () => {
  it('Test 13: session mismatch with input.agencyId throws Forbidden', async () => {
    mocks.requireSession.mockResolvedValueOnce(SESSION('agency-A'))

    await expect(
      refundInvoice({ agencyId: 'agency-B', invoiceId: 'inv-1' }),
    ).rejects.toThrow('Forbidden')
  })

  it('Test 14: invoice belonging to a DIFFERENT agency throws Forbidden (defence-in-depth)', async () => {
    // Session matches input.agencyId, but the invoice's agency_id doesn't.
    // This is the second-line check after the input-level guard — protects
    // against a forged invoiceId belonging to another tenant.
    mocks.requireSession.mockResolvedValueOnce(SESSION('agency-A'))
    makeFetchSequence([
      { body: { id: 'inv-1', status: 'paid', agency_id: 'agency-B', total_amount: 1000, amount_paid: 1000 } },
    ])

    await expect(
      refundInvoice({ agencyId: 'agency-A', invoiceId: 'inv-1' }),
    ).rejects.toThrow('Forbidden')
  })
})

describe('refundInvoice — status guard', () => {
  beforeEach(() => {
    mocks.requireSession.mockResolvedValue(SESSION('finance'))
  })

  for (const blockedStatus of ['draft', 'sent', 'viewed', 'refunded', 'disputed']) {
    it(`Test: refund blocked when status='${blockedStatus}'`, async () => {
      makeFetchSequence([
        { body: { id: 'inv-1', status: blockedStatus, agency_id: 'finance', total_amount: 1000, amount_paid: 0 } },
      ])

      const result = await refundInvoice({ agencyId: 'finance', invoiceId: 'inv-1' })
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/paid or partially paid/i)
      // No Stripe refund call
      expect(mocks.refundsCreate).not.toHaveBeenCalled()
    })
  }

  it('Test 20: refund allowed when status="paid"', async () => {
    mocks.checkoutSessionsList.mockResolvedValue({ data: [] })
    makeFetchSequence([
      { body: { id: 'inv-1', status: 'paid', agency_id: 'finance', total_amount: 1000, amount_paid: 1000 } },
      { body: {} }, // PATCH
    ])

    const result = await refundInvoice({ agencyId: 'finance', invoiceId: 'inv-1' })
    expect(result.ok).toBe(true)
  })
})

describe('refundInvoice — Stripe refund flow', () => {
  beforeEach(() => {
    mocks.requireSession.mockResolvedValue(SESSION('finance'))
  })

  it('Test 21: full refund (no refundAmountCents) calls stripe.refunds.create with amount: undefined', async () => {
    mocks.checkoutSessionsList.mockResolvedValueOnce({
      data: [{ payment_intent: 'pi_abc' }],
    })
    mocks.refundsCreate.mockResolvedValueOnce({ id: 'rf_1' })
    makeFetchSequence([
      { body: { id: 'inv-1', status: 'paid', agency_id: 'finance', stripe_payment_link_id: 'plink_1', total_amount: 5000, amount_paid: 5000 } },
      { body: {} },
    ])

    await refundInvoice({ agencyId: 'finance', invoiceId: 'inv-1' })

    expect(mocks.refundsCreate).toHaveBeenCalledWith({
      payment_intent: 'pi_abc',
      amount:         undefined,
    })
  })

  it('Test 22: partial refund passes refundAmountCents to Stripe', async () => {
    mocks.checkoutSessionsList.mockResolvedValueOnce({
      data: [{ payment_intent: 'pi_abc' }],
    })
    mocks.refundsCreate.mockResolvedValueOnce({ id: 'rf_2' })
    makeFetchSequence([
      { body: { id: 'inv-1', status: 'paid', agency_id: 'finance', stripe_payment_link_id: 'plink_1', total_amount: 5000, amount_paid: 5000 } },
      { body: {} },
    ])

    await refundInvoice({ agencyId: 'finance', invoiceId: 'inv-1', refundAmountCents: 1500 })

    expect(mocks.refundsCreate).toHaveBeenCalledWith({
      payment_intent: 'pi_abc',
      amount:         1500,
    })
  })

  it('Test 23: Stripe refund failure → ok:false WITHOUT marking invoice refunded', async () => {
    mocks.checkoutSessionsList.mockResolvedValueOnce({
      data: [{ payment_intent: 'pi_abc' }],
    })
    mocks.refundsCreate.mockRejectedValueOnce(new Error('Stripe declined'))
    const calls = makeFetchSequence([
      { body: { id: 'inv-1', status: 'paid', agency_id: 'finance', stripe_payment_link_id: 'plink_1', total_amount: 5000, amount_paid: 5000 } },
    ])

    const result = await refundInvoice({ agencyId: 'finance', invoiceId: 'inv-1' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Stripe.*manually/i)
    // The PATCH must NOT have happened — invoice stays in 'paid' state
    const patchCall = calls.find((c) => c.init.method === 'PATCH')
    expect(patchCall).toBeUndefined()
  })

  it('Test 24: invoice with NO stripe_payment_link_id skips Stripe + still marks refunded', async () => {
    // Manual / external invoice — no Stripe link to refund. Worker still
    // updates Payload status so the dashboard reflects reality.
    const calls = makeFetchSequence([
      { body: { id: 'inv-1', status: 'paid', agency_id: 'finance', total_amount: 5000, amount_paid: 5000 } },
      { body: {} },
    ])

    const result = await refundInvoice({ agencyId: 'finance', invoiceId: 'inv-1' })
    expect(result.ok).toBe(true)
    expect(mocks.refundsCreate).not.toHaveBeenCalled()

    // PATCH still ran with status:refunded
    const patchCall = calls.find((c) => c.init.method === 'PATCH')!
    const patchBody = JSON.parse(patchCall.init.body as string) as Record<string, unknown>
    expect(patchBody.status).toBe('refunded')
  })

  it('Test 25: successful refund PATCHes status:refunded + amount_paid:0 + restores remaining_balance', async () => {
    mocks.checkoutSessionsList.mockResolvedValueOnce({
      data: [{ payment_intent: 'pi_abc' }],
    })
    mocks.refundsCreate.mockResolvedValueOnce({ id: 'rf_3' })
    const calls = makeFetchSequence([
      { body: { id: 'inv-1', status: 'paid', agency_id: 'finance', stripe_payment_link_id: 'plink_1', total_amount: 5000, amount_paid: 5000 } },
      { body: {} },
    ])

    await refundInvoice({ agencyId: 'finance', invoiceId: 'inv-1' })

    const patchCall = calls.find((c) => c.init.method === 'PATCH')!
    const body = JSON.parse(patchCall.init.body as string) as Record<string, unknown>
    expect(body.status).toBe('refunded')
    expect(body.amount_paid).toBe(0)
    expect(body.remaining_balance).toBe(5000)
    expect(body.refunded_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
