/**
 * packages/analytics/src/__tests__/ga4-server.test.ts
 * REQ-140 + Pitfall 1.4 — server-side validation rejects bad event_name + missing client_id.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendServerEvent } from '../ga4-server.js'

describe('sendServerEvent (Measurement Protocol)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env['NEXT_PUBLIC_GA4_MEASUREMENT_ID'] = 'G-TEST'
    process.env['GA4_API_SECRET_WEB_ECOMMERCE'] = 'secret123'
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 })) as never
  })

  afterEach(() => {
    delete process.env['NEXT_PUBLIC_GA4_MEASUREMENT_ID']
    delete process.env['NEXT_PUBLIC_GA4_MEASUREMENT_ID_WEB_ECOMMERCE']
    delete process.env['GA4_API_SECRET_WEB_ECOMMERCE']
    global.fetch = originalFetch
  })

  it('rejects invalid event_name (Pitfall 1.4)', async () => {
    await expect(
      sendServerEvent('web-ecommerce', { eventName: 'BadName!', clientId: 'abc12345' }),
    ).rejects.toThrow(/Invalid event_name/)
  })

  it('rejects event_name longer than 40 chars (Pitfall 1.4)', async () => {
    await expect(
      sendServerEvent('web-ecommerce', {
        eventName: 'a'.repeat(41),
        clientId: 'abc12345',
      }),
    ).rejects.toThrow(/Invalid event_name/)
  })

  it('rejects missing client_id (Pitfall 1.4)', async () => {
    await expect(
      sendServerEvent('web-ecommerce', { eventName: 'lead', clientId: '' }),
    ).rejects.toThrow(/Missing client_id/)
  })

  it('rejects short client_id (< 8 chars)', async () => {
    await expect(
      sendServerEvent('web-ecommerce', { eventName: 'lead', clientId: 'short' }),
    ).rejects.toThrow(/Missing client_id/)
  })

  it('throws when NEXT_PUBLIC_GA4_MEASUREMENT_ID missing', async () => {
    delete process.env['NEXT_PUBLIC_GA4_MEASUREMENT_ID']
    await expect(
      sendServerEvent('web-ecommerce', { eventName: 'lead', clientId: 'abc12345' }),
    ).rejects.toThrow(/Missing NEXT_PUBLIC_GA4_MEASUREMENT_ID/)
  })

  it('throws when GA4_API_SECRET_<SLUG> missing', async () => {
    delete process.env['GA4_API_SECRET_WEB_ECOMMERCE']
    await expect(
      sendServerEvent('web-ecommerce', { eventName: 'lead', clientId: 'abc12345' }),
    ).rejects.toThrow(/Missing env var: GA4_API_SECRET_WEB_ECOMMERCE/)
  })

  it('POSTs to mp/collect with correct query string', async () => {
    await sendServerEvent('web-ecommerce', { eventName: 'lead', clientId: 'abc12345' })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(
        /google-analytics\.com\/mp\/collect\?measurement_id=G-TEST&api_secret=secret123/,
      ),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  it('POSTs body with client_id + events array', async () => {
    await sendServerEvent('web-ecommerce', {
      eventName: 'lead',
      clientId: 'abc12345',
      params: { campaign: 'spring' },
    })
    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const init = callArgs?.[1] as RequestInit
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      client_id: 'abc12345',
      events: [{ name: 'lead', params: { campaign: 'spring' } }],
    })
  })

  it('prefers per-agency NEXT_PUBLIC_GA4_MEASUREMENT_ID_<SLUG> over fallback', async () => {
    process.env['NEXT_PUBLIC_GA4_MEASUREMENT_ID_WEB_ECOMMERCE'] = 'G-ECOM-SPECIFIC'
    await sendServerEvent('web-ecommerce', { eventName: 'lead', clientId: 'abc12345' })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('measurement_id=G-ECOM-SPECIFIC'),
      expect.anything(),
    )
  })

  it('throws on non-2xx response from GA4', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('bad request', { status: 400 })) as never
    await expect(
      sendServerEvent('web-ecommerce', { eventName: 'lead', clientId: 'abc12345' }),
    ).rejects.toThrow(/GA4 Measurement Protocol failed 400/)
  })
})
