/**
 * apps/web-main/src/app/api/tools/__tests__/resend-pdf.test.ts
 *
 * Unit tests for POST /api/tools/resend-pdf — mirrors email-gate but uses the
 * separate handleResendPdf handler. Smaller suite because the email-gate
 * tests already cover the shared wrapper contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  handleResendPdf: vi.fn(),
}))

vi.mock('@mjagency/tools', () => ({
  handleResendPdf: mocks.handleResendPdf,
}))

const { POST } = await import('../resend-pdf/route.js')

function makeRequest(body: unknown, opts: { invalidJson?: boolean } = {}): Request {
  return new Request('http://localhost/api/tools/resend-pdf', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    opts.invalidJson ? '{bad' : JSON.stringify(body),
  })
}

describe('POST /api/tools/resend-pdf', () => {
  beforeEach(() => {
    mocks.handleResendPdf.mockReset()
  })

  it('Test 1: forwards body verbatim (with _hp) to handleResendPdf', async () => {
    mocks.handleResendPdf.mockResolvedValue({ ok: true })
    const body = {
      email:          'visitor@example.com',
      toolSlug:       'savings-calc',
      toolResultJson: '{"x":1}',
      agencySlug:     'web-product',
      _hp:            '',
    }

    await POST(makeRequest(body))

    expect(mocks.handleResendPdf).toHaveBeenCalledTimes(1)
    expect(mocks.handleResendPdf).toHaveBeenCalledWith(body)
  })

  it('Test 2: handler ok:true echoes through as 200 JSON', async () => {
    mocks.handleResendPdf.mockResolvedValue({ ok: true })
    const res = await POST(makeRequest({
      email: 'a@b.com', toolSlug: 't', toolResultJson: '{}', agencySlug: 's',
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('Test 3: handler ok:false echoes through with 200 (no bot-signal leak)', async () => {
    mocks.handleResendPdf.mockResolvedValue({ ok: false, error: 'rate limited' })
    const res = await POST(makeRequest({
      email: 'a@b.com', toolSlug: 't', toolResultJson: '{}', agencySlug: 's',
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: false, error: 'rate limited' })
  })

  it('Test 4: invalid JSON returns 400 without invoking the handler', async () => {
    const res = await POST(makeRequest({}, { invalidJson: true }))
    expect(res.status).toBe(400)
    expect(mocks.handleResendPdf).not.toHaveBeenCalled()
  })
})
