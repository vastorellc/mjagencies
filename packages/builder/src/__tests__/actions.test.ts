/**
 * packages/builder/src/__tests__/actions.test.ts
 *
 * Unit tests for the Puck builder server actions: saveDraft + publishPage.
 *
 * Both follow the canonical 'use server' contract (CLAUDE.md Rule 3 + Rule 8):
 *   - requireSession() first
 *   - session.agencyId must match input.agencyId
 *   - PATCH /api/pages/{id} with the right body shape
 *
 * Two security regressions we guard against:
 *   1. Auth bypass — any code path that skips requireSession would let an
 *      unauthenticated visitor mutate published pages (XSS / defacement).
 *   2. Cross-tenant edit — agency-A admin editing agency-B pages.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@mjagency/auth', () => ({
  requireSession: mocks.requireSession,
}))

vi.mock('@mjagency/config', () => ({
  createLogger: () => mocks.log,
}))

// PAYLOAD_URL / PAYLOAD_API_KEY are read at module load — set BEFORE imports
process.env['PAYLOAD_URL']     = 'http://payload.test'
process.env['PAYLOAD_API_KEY'] = 'test-key'

const { saveDraft }    = await import('../actions/save-draft.js')
const { publishPage }  = await import('../actions/publish-page.js')

const SESSION = (agencyId: string) => ({
  sub: 'u', agencyId, role: 'admin' as const, jti: 'j', familyId: 'f',
})

interface FetchCall { url: string; init: RequestInit }

function captureFetch(status = 200): FetchCall[] {
  const calls: FetchCall[] = []
  global.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response('{}', { status })
  }) as typeof fetch
  return calls
}

beforeEach(() => {
  mocks.requireSession.mockReset()
  mocks.log.info.mockReset()
  mocks.log.error.mockReset()
  process.env['PAYLOAD_URL']     = 'http://payload.test'
  process.env['PAYLOAD_API_KEY'] = 'test-key'
})

// ── saveDraft ────────────────────────────────────────────────────────────

describe('saveDraft — auth + agency isolation', () => {
  it('Test 1: requireSession is called BEFORE any fetch', async () => {
    let order = ''
    mocks.requireSession.mockImplementationOnce(async () => {
      order += 'session,'
      return SESSION('finance')
    })
    global.fetch = vi.fn(async () => {
      order += 'fetch,'
      return new Response('{}', { status: 200 })
    }) as typeof fetch

    await saveDraft({ agencyId: 'finance', pageId: 'p1', puckData: { x: 1 } })
    expect(order).toBe('session,fetch,')
  })

  it('Test 2: session.agencyId mismatch throws Forbidden, no fetch', async () => {
    mocks.requireSession.mockResolvedValueOnce(SESSION('agency-A'))
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    await expect(
      saveDraft({ agencyId: 'agency-B', pageId: 'p1', puckData: {} }),
    ).rejects.toThrow('Forbidden')

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('Test 3: requireSession throwing propagates (no swallow)', async () => {
    mocks.requireSession.mockRejectedValueOnce(new Error('NEXT_REDIRECT:/login'))

    await expect(
      saveDraft({ agencyId: 'finance', pageId: 'p1', puckData: {} }),
    ).rejects.toThrow('NEXT_REDIRECT')
  })
})

describe('saveDraft — PATCH body', () => {
  beforeEach(() => {
    mocks.requireSession.mockResolvedValue(SESSION('finance'))
  })

  it('Test 4: PATCHes /api/pages/{id} with status:draft + puck_data', async () => {
    const calls = captureFetch()
    const puckData = { content: { root: { children: [] } } }

    await saveDraft({ agencyId: 'finance', pageId: 'p-abc', puckData })

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('http://payload.test/api/pages/p-abc')
    expect(calls[0]!.init.method).toBe('PATCH')

    const body = JSON.parse(calls[0]!.init.body as string) as Record<string, unknown>
    expect(body.status).toBe('draft')
    expect(body.puck_data).toEqual(puckData)
  })

  it('Test 5: failed PATCH returns ok:false with user-facing error', async () => {
    captureFetch(500)
    const result = await saveDraft({ agencyId: 'finance', pageId: 'p1', puckData: {} })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/could not be saved/i)
  })

  it('Test 6: Authorization header carries the API key (Bearer scheme)', async () => {
    const calls = captureFetch()
    await saveDraft({ agencyId: 'finance', pageId: 'p1', puckData: {} })

    const headers = calls[0]!.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer test-key')
    expect(headers['Content-Type']).toBe('application/json')
  })
})

// ── publishPage ──────────────────────────────────────────────────────────

describe('publishPage — auth + agency isolation', () => {
  it('Test 7: session mismatch throws Forbidden', async () => {
    mocks.requireSession.mockResolvedValueOnce(SESSION('agency-A'))
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    await expect(
      publishPage({
        agencyId: 'agency-B',
        pageId:   'p1',
        puckData: {},
        meta: { title: 't', description: 'd', slug: 's' },
      }),
    ).rejects.toThrow('Forbidden')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('publishPage — PATCH body', () => {
  beforeEach(() => {
    mocks.requireSession.mockResolvedValue(SESSION('finance'))
  })

  it('Test 8: PATCHes status:published + puck_data + meta + published_at timestamp', async () => {
    const before = Date.now()
    const calls = captureFetch()

    await publishPage({
      agencyId: 'finance',
      pageId:   'p-xyz',
      puckData: { content: { root: { children: ['hero'] } } },
      meta:     { title: 'Home', description: 'Welcome', slug: 'home' },
    })
    const after = Date.now()

    const body = JSON.parse(calls[0]!.init.body as string) as Record<string, unknown>
    expect(body.status).toBe('published')
    expect(body.meta_title).toBe('Home')
    expect(body.meta_description).toBe('Welcome')
    expect(body.slug).toBe('home')
    expect(body.puck_data).toEqual({ content: { root: { children: ['hero'] } } })

    const publishedAt = Date.parse(body.published_at as string)
    expect(publishedAt).toBeGreaterThanOrEqual(before)
    expect(publishedAt).toBeLessThanOrEqual(after + 100)
  })

  it('Test 9: failed publish returns ok:false (no half-state)', async () => {
    captureFetch(503)
    const result = await publishPage({
      agencyId: 'finance',
      pageId:   'p1',
      puckData: {},
      meta:     { title: 't', description: 'd', slug: 's' },
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/could not be saved/i)
  })

  it('Test 10: success returns ok:true with no error field', async () => {
    captureFetch()
    const result = await publishPage({
      agencyId: 'finance',
      pageId:   'p1',
      puckData: {},
      meta:     { title: 't', description: 'd', slug: 's' },
    })
    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('Test 11: success path emits a structured info log', async () => {
    captureFetch()
    await publishPage({
      agencyId: 'finance',
      pageId:   'p-log',
      puckData: {},
      meta:     { title: 't', description: 'd', slug: 's' },
    })
    expect(mocks.log.info).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: 'p-log' }),
      expect.stringMatching(/published/i),
    )
  })
})
