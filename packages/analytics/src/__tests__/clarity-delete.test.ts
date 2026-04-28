/**
 * packages/analytics/src/__tests__/clarity-delete.test.ts
 * Plan 11-02 — Clarity Delete API client unit tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { clarityDeleteUser } from '../clarity-delete.js'

describe('clarityDeleteUser', () => {
  const ORIGINAL_FETCH = global.fetch

  beforeEach(() => {
    process.env.CLARITY_API_TOKEN_WEB_ECOMMERCE = 'token-abc'
  })

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH
    vi.restoreAllMocks()
  })

  it('returns ok:false when clarityUserId is missing', async () => {
    const r = await clarityDeleteUser('web-ecommerce', '')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(r.errorMessage).toBe('Missing clarityUserId')
  })

  it('returns ok:false when clarityUserId is too short', async () => {
    const r = await clarityDeleteUser('web-ecommerce', 'abc')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })

  it('POSTs to clarity.ms/api/v3/delete with bearer token + userId body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    global.fetch = fetchMock as unknown as typeof fetch

    const r = await clarityDeleteUser('web-ecommerce', 'user-clarity-id-123')

    expect(r.ok).toBe(true)
    expect(r.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.clarity.ms/api/v3/delete',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-abc',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ userId: 'user-clarity-id-123' }),
      }),
    )
  })

  it('returns ok:false on Clarity API error (4xx/5xx)', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('Forbidden', { status: 403 }),
    ) as unknown as typeof fetch

    const r = await clarityDeleteUser('web-ecommerce', 'user-id-1234')

    expect(r.ok).toBe(false)
    expect(r.status).toBe(403)
    expect(r.errorMessage).toBe('Forbidden')
  })

  it('throws when CLARITY_API_TOKEN env var missing', async () => {
    delete process.env.CLARITY_API_TOKEN_WEB_HEALTHCARE
    await expect(clarityDeleteUser('web-healthcare', 'user-id-1234')).rejects.toThrow(
      /Missing env var: CLARITY_API_TOKEN_WEB_HEALTHCARE/,
    )
  })
})
