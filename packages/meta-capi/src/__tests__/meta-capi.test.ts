/**
 * Unit tests for sendCapiEvent — Meta CAPI direct fetch with SHA-256 hashing.
 *
 * Covers Pitfalls 3.2–3.5 (RESEARCH §3) and the threat register mitigations
 * declared in Plan 11-03 §threat_model:
 *   T-11-03-01: em/ph SHA-256 normalized before send
 *   T-11-03-03: phone normalization spec
 *   T-11-03-04: event_time in seconds, not ms
 *   T-11-03-05: test_event_code only when env var present
 *   T-11-03-10: throws when no user identifier present
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import { sendCapiEvent } from '../meta-capi.js'

const PIXEL_ID = '111222333'
const ACCESS_TOKEN = 'EAA-test-access-token'
const AGENCY_ID = 'web-ecommerce'
const ENV_SUFFIX = 'WEB_ECOMMERCE'

interface FetchCall {
  url: string
  init: { method: string; headers: Record<string, string>; body: string }
}

function captureFetch(): { calls: FetchCall[] } {
  const captured: FetchCall[] = []
  global.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const initObj = init ?? { method: 'GET', headers: {} as Record<string, string>, body: '' }
    captured.push({
      url: typeof url === 'string' ? url : url.toString(),
      init: {
        method: initObj.method ?? 'GET',
        headers: (initObj.headers ?? {}) as Record<string, string>,
        body: typeof initObj.body === 'string' ? initObj.body : '',
      },
    })
    return new Response('{}', { status: 200 })
  }) as unknown as typeof fetch
  return { calls: captured }
}

describe('sendCapiEvent', () => {
  beforeEach(() => {
    process.env[`META_PIXEL_ID_${ENV_SUFFIX}`] = PIXEL_ID
    process.env[`META_ACCESS_TOKEN_${ENV_SUFFIX}`] = ACCESS_TOKEN
    delete process.env[`META_TEST_EVENT_CODE_${ENV_SUFFIX}`]
  })

  afterEach(() => {
    delete process.env[`META_PIXEL_ID_${ENV_SUFFIX}`]
    delete process.env[`META_ACCESS_TOKEN_${ENV_SUFFIX}`]
    delete process.env[`META_TEST_EVENT_CODE_${ENV_SUFFIX}`]
    vi.restoreAllMocks()
  })

  it('hashes email with lowercase + trim (Meta normalization spec)', async () => {
    const fetcher = captureFetch()
    await sendCapiEvent(AGENCY_ID, {
      event_name: 'Lead',
      user_data: { em: '  Foo@Example.COM  ' },
    })

    const expected = createHash('sha256').update('foo@example.com').digest('hex')
    const body = JSON.parse(fetcher.calls[0]!.init.body)
    expect(body.data[0].user_data.em).toBe(expected)
  })

  it('hashes phone as 1XXXXXXXXXX (Pitfall 3.2 — drops leading 1, prepends 1)', async () => {
    const fetcher = captureFetch()
    await sendCapiEvent(AGENCY_ID, {
      event_name: 'Lead',
      user_data: { ph: '(415) 555-1234' },
    })
    const expected = createHash('sha256').update('14155551234').digest('hex')
    const body = JSON.parse(fetcher.calls[0]!.init.body)
    expect(body.data[0].user_data.ph).toBe(expected)
  })

  it('handles phone already prefixed with country code', async () => {
    const fetcher = captureFetch()
    await sendCapiEvent(AGENCY_ID, {
      event_name: 'Lead',
      user_data: { ph: '+1 415-555-1234' },
    })
    const expected = createHash('sha256').update('14155551234').digest('hex')
    const body = JSON.parse(fetcher.calls[0]!.init.body)
    expect(body.data[0].user_data.ph).toBe(expected)
  })

  it('event_time is Unix seconds, not milliseconds (Pitfall 3.3)', async () => {
    const fetcher = captureFetch()
    const before = Math.floor(Date.now() / 1000)
    await sendCapiEvent(AGENCY_ID, {
      event_name: 'Lead',
      user_data: { em: 'x@y.com' },
    })
    const body = JSON.parse(fetcher.calls[0]!.init.body)
    expect(body.data[0].event_time).toBeGreaterThanOrEqual(before)
    expect(body.data[0].event_time).toBeLessThan(before + 10) // not 1000× larger
  })

  it('omits test_event_code when env var unset (Pitfall 3.4)', async () => {
    const fetcher = captureFetch()
    await sendCapiEvent(AGENCY_ID, {
      event_name: 'Lead',
      user_data: { em: 'x@y.com' },
    })
    const body = JSON.parse(fetcher.calls[0]!.init.body)
    expect(body.test_event_code).toBeUndefined()
  })

  it('includes test_event_code when env var present', async () => {
    process.env[`META_TEST_EVENT_CODE_${ENV_SUFFIX}`] = 'TEST12345'
    const fetcher = captureFetch()
    await sendCapiEvent(AGENCY_ID, {
      event_name: 'Lead',
      user_data: { em: 'x@y.com' },
    })
    const body = JSON.parse(fetcher.calls[0]!.init.body)
    expect(body.test_event_code).toBe('TEST12345')
  })

  it('throws when no user identifier present (Pitfall 3.5)', async () => {
    captureFetch()
    await expect(
      sendCapiEvent(AGENCY_ID, {
        event_name: 'Lead',
        user_data: {},
      }),
    ).rejects.toThrow(/at least one of: em, ph, ip\+ua, external_id/)
  })

  it('accepts ip+ua pair as fallback identifier (Pitfall 3.5)', async () => {
    captureFetch()
    await expect(
      sendCapiEvent(AGENCY_ID, {
        event_name: 'Lead',
        user_data: {
          client_ip_address: '1.2.3.4',
          client_user_agent: 'Mozilla/5.0',
        },
      }),
    ).resolves.not.toThrow()
  })

  it('throws when only ip is present without ua (Pitfall 3.5)', async () => {
    captureFetch()
    await expect(
      sendCapiEvent(AGENCY_ID, {
        event_name: 'Lead',
        user_data: { client_ip_address: '1.2.3.4' },
      }),
    ).rejects.toThrow(/at least one of/)
  })

  it('POSTs to graph.facebook.com/v22.0/{pixel_id}/events', async () => {
    const fetcher = captureFetch()
    await sendCapiEvent(AGENCY_ID, {
      event_name: 'Lead',
      user_data: { em: 'x@y.com' },
    })
    expect(fetcher.calls[0]!.url).toBe(`https://graph.facebook.com/v22.0/${PIXEL_ID}/events`)
    expect(fetcher.calls[0]!.init.method).toBe('POST')
  })

  it('sends access_token in body, not as URL query or header', async () => {
    const fetcher = captureFetch()
    await sendCapiEvent(AGENCY_ID, {
      event_name: 'Lead',
      user_data: { em: 'x@y.com' },
    })
    expect(fetcher.calls[0]!.url).not.toContain('access_token')
    const body = JSON.parse(fetcher.calls[0]!.init.body)
    expect(body.access_token).toBe(ACCESS_TOKEN)
  })

  it('generates a UUID event_id when caller does not provide one', async () => {
    const fetcher = captureFetch()
    await sendCapiEvent(AGENCY_ID, {
      event_name: 'Lead',
      user_data: { em: 'x@y.com' },
    })
    const body = JSON.parse(fetcher.calls[0]!.init.body)
    expect(body.data[0].event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('honors caller-provided event_id (for retry idempotency)', async () => {
    const fetcher = captureFetch()
    await sendCapiEvent(AGENCY_ID, {
      event_name: 'Lead',
      event_id: 'caller-provided-id-123',
      user_data: { em: 'x@y.com' },
    })
    const body = JSON.parse(fetcher.calls[0]!.init.body)
    expect(body.data[0].event_id).toBe('caller-provided-id-123')
  })

  it('throws when META_PIXEL_ID env var missing for agency', async () => {
    delete process.env[`META_PIXEL_ID_${ENV_SUFFIX}`]
    captureFetch()
    await expect(
      sendCapiEvent(AGENCY_ID, {
        event_name: 'Lead',
        user_data: { em: 'x@y.com' },
      }),
    ).rejects.toThrow(/META_PIXEL_ID_WEB_ECOMMERCE/)
  })

  it('throws on non-2xx response from graph.facebook.com', async () => {
    global.fetch = vi.fn(async () => new Response('{"error":"bad token"}', { status: 401 })) as unknown as typeof fetch
    await expect(
      sendCapiEvent(AGENCY_ID, {
        event_name: 'Lead',
        user_data: { em: 'x@y.com' },
      }),
    ).rejects.toThrow(/Meta CAPI failed 401/)
  })

  it('passes Purchase custom_data (value + currency) through unchanged', async () => {
    const fetcher = captureFetch()
    await sendCapiEvent(AGENCY_ID, {
      event_name: 'Purchase',
      user_data: { em: 'buyer@example.com' },
      custom_data: { value: 199.99, currency: 'USD' },
    })
    const body = JSON.parse(fetcher.calls[0]!.init.body)
    expect(body.data[0].custom_data.value).toBe(199.99)
    expect(body.data[0].custom_data.currency).toBe('USD')
  })

  it('redacts PII inadvertently placed in custom_data string fields', async () => {
    const fetcher = captureFetch()
    await sendCapiEvent(AGENCY_ID, {
      event_name: 'Lead',
      user_data: { em: 'x@y.com' },
      custom_data: { note: 'Contact john@example.com about the lead' },
    })
    const body = JSON.parse(fetcher.calls[0]!.init.body)
    // redactPii() replaces emails with [EMAIL_N] tokens
    expect(body.data[0].custom_data.note).not.toContain('john@example.com')
    expect(body.data[0].custom_data.note).toContain('[EMAIL_')
  })

  it('hashes external_id (lowercase + trim) when provided', async () => {
    const fetcher = captureFetch()
    await sendCapiEvent(AGENCY_ID, {
      event_name: 'Lead',
      user_data: { external_id: '  Contact-ABC123  ' },
    })
    const expected = createHash('sha256').update('contact-abc123').digest('hex')
    const body = JSON.parse(fetcher.calls[0]!.init.body)
    expect(body.data[0].user_data.external_id).toBe(expected)
  })

  it('hyphenated agencyId normalizes to underscored env var (web-ecommerce → WEB_ECOMMERCE)', async () => {
    // Already covered implicitly by other tests, but assert explicitly for clarity.
    const fetcher = captureFetch()
    await sendCapiEvent('web-ecommerce', {
      event_name: 'Lead',
      user_data: { em: 'x@y.com' },
    })
    expect(fetcher.calls.length).toBe(1)
  })
})
