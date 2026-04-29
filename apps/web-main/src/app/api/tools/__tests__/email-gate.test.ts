/**
 * apps/web-main/src/app/api/tools/__tests__/email-gate.test.ts
 *
 * Unit tests for the public POST /api/tools/email-gate route.
 *
 * The route is a thin wrapper over @mjagency/tools' handleEmailGate. We mock
 * that handler and verify the route:
 *   1. Parses JSON correctly and forwards every field (including the _hp
 *      honeypot) verbatim to the handler.
 *   2. Returns ok:false with a 400 on malformed JSON (instead of crashing).
 *   3. Echoes the handler's result as the JSON response body.
 *   4. Always returns HTTP 200 even when the handler reports ok:false — this
 *      is the documented contract that prevents leaking bot detection signal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  handleEmailGate: vi.fn(),
}))

vi.mock('@mjagency/tools', () => ({
  handleEmailGate: mocks.handleEmailGate,
}))

const { POST } = await import('../email-gate/route.js')

function makeRequest(body: unknown, opts: { invalidJson?: boolean } = {}): Request {
  return new Request('http://localhost/api/tools/email-gate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    opts.invalidJson ? '{not valid json' : JSON.stringify(body),
  })
}

describe('POST /api/tools/email-gate', () => {
  beforeEach(() => {
    mocks.handleEmailGate.mockReset()
  })

  it('Test 1: forwards every body field (including _hp) verbatim to handleEmailGate', async () => {
    mocks.handleEmailGate.mockResolvedValue({ ok: true })
    const body = {
      email:          'visitor@example.com',
      toolSlug:       'roi-calculator',
      toolResultJson: '{"score":42}',
      agencySlug:     'web-finance',
      _hp:            '',
    }

    await POST(makeRequest(body))

    expect(mocks.handleEmailGate).toHaveBeenCalledTimes(1)
    expect(mocks.handleEmailGate).toHaveBeenCalledWith(body)
  })

  it('Test 2: missing fields default to empty strings (handler is the validator)', async () => {
    mocks.handleEmailGate.mockResolvedValue({ ok: false, error: 'invalid email' })

    await POST(makeRequest({ email: 'foo@bar.com' }))

    expect(mocks.handleEmailGate).toHaveBeenCalledWith({
      email:          'foo@bar.com',
      toolSlug:       '',
      toolResultJson: '',
      agencySlug:     '',
      _hp:            undefined,
    })
  })

  it('Test 3: invalid JSON body returns 400 + ok:false WITHOUT calling the handler', async () => {
    const res = await POST(makeRequest({}, { invalidJson: true }))

    expect(res.status).toBe(400)
    const body = (await res.json()) as { ok: boolean; error?: string }
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/invalid json/i)
    expect(mocks.handleEmailGate).not.toHaveBeenCalled()
  })

  it('Test 4: handler ok:true → response 200 + body { ok: true }', async () => {
    mocks.handleEmailGate.mockResolvedValue({ ok: true })

    const res = await POST(makeRequest({
      email: 'a@b.com', toolSlug: 't', toolResultJson: '{}', agencySlug: 's',
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('Test 5: handler ok:false STILL returns 200 — we do not leak bot signal via 4xx', async () => {
    // Handler returns ok:false for both honeypot hits and validation failures.
    // The route MUST NOT translate this into a 4xx, otherwise scrapers learn
    // which bodies trigger validation vs honeypot.
    mocks.handleEmailGate.mockResolvedValue({
      ok: false,
      error: 'We could not send the report right now. Please try again or contact us directly.',
    })

    const res = await POST(makeRequest({
      email: 'not-an-email', toolSlug: 't', toolResultJson: '{}', agencySlug: 's',
    }))

    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/could not send the report/i)
  })

  it('Test 6: honeypot value passes through to handler unchanged', async () => {
    // The handler checks _hp; our route must NOT strip it or filter it out.
    // If the route ever swallows _hp, every bot submission would skip the
    // silent-discard branch and land in the real validation pipeline.
    mocks.handleEmailGate.mockResolvedValue({ ok: true })

    await POST(makeRequest({
      email: 'a@b.com', toolSlug: 't', toolResultJson: '{}', agencySlug: 's',
      _hp: 'spam-bot-filled-this',
    }))

    expect(mocks.handleEmailGate).toHaveBeenCalledWith(
      expect.objectContaining({ _hp: 'spam-bot-filled-this' }),
    )
  })
})
