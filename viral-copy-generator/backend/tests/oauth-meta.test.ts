import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import request from 'supertest'

// Set env BEFORE any module imports — encryption.ts + oauth-meta.ts read env at call time
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'a'.repeat(48)
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? 'test'
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? 'test'
process.env.META_APP_ID = 'test-meta-app-id'
process.env.META_APP_SECRET = 'test-meta-app-secret'
process.env.APP_URL = 'http://localhost:5173'

// Stub Supabase auth — same pattern as settings.test.ts and oauth-google.test.ts
vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === 'user-a')
          return {
            data: {
              user: { id: '00000000-0000-0000-0000-00000000000a', app_metadata: {} },
            },
            error: null,
          }
        return { data: { user: null }, error: { message: 'invalid' } }
      }),
    },
  },
}))

import { createTestDb, resetTestDb } from './_helpers.js'
import { decrypt } from '../src/lib/encryption.js'
import { settings } from '../src/db/schema.js'
import { eq } from 'drizzle-orm'
import { __test__ as oauthStateTest } from '../src/lib/oauth-state.js'

let testDb: Awaited<ReturnType<typeof createTestDb>>['db']
let app: import('express').Express

// ── fetch mock factory ────────────────────────────────────────────────────────
// Each test that exercises a callback will stub global.fetch before the request
// and restore it (or override) via beforeEach.

// Default: no real network calls allowed
const unexpectedFetch = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
  throw new Error(`unexpected fetch call: ${String(input)}`)
})

beforeAll(async () => {
  ;({ db: testDb } = await createTestDb())
  app = (await import('../src/app.js')).app
})

beforeEach(async () => {
  await resetTestDb()
  // Reset the oauth state map so tests are isolated
  oauthStateTest.clear()
  // Reset fetch to the guard that catches unexpected calls
  vi.stubGlobal('fetch', unexpectedFetch)
})

describe('Meta OAuth (SETTINGS-05, SETTINGS-06)', () => {
  const userA = '00000000-0000-0000-0000-00000000000a'

  // ── Instagram /connect ────────────────────────────────────────────────────

  it('Test 1: GET /instagram/connect returns 200 JSON { auth_url } pointing at api.instagram.com with required params (NOT 302)', async () => {
    const res = await request(app)
      .get('/api/auth/instagram/connect')
      .set('Authorization', 'Bearer user-a')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('auth_url')

    const url = new URL(res.body.auth_url as string)
    expect(url.host).toBe('api.instagram.com')
    expect(url.pathname).toBe('/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('test-meta-app-id')
    expect(url.searchParams.get('scope')).toBe('instagram_business_basic,instagram_business_content_publish')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toMatch(/^[0-9a-f]{64}$/)
  })

  // ── Instagram /callback success ───────────────────────────────────────────

  it('Test 2: /instagram/callback trims #_ from code, exchanges token (mocked), stores ciphertext, redirects connected=instagram', async () => {
    // Get a fresh state via /connect
    const connectRes = await request(app)
      .get('/api/auth/instagram/connect')
      .set('Authorization', 'Bearer user-a')
    expect(connectRes.status).toBe(200)
    const state = new URL(connectRes.body.auth_url as string).searchParams.get('state')!
    expect(state).toMatch(/^[0-9a-f]{64}$/)

    // Mock fetch sequence: short-lived -> long-lived -> /me
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const u = String(input)
      // Step A: short-lived token exchange (POST, URL-encoded)
      if (u === 'https://api.instagram.com/oauth/access_token') {
        return new Response(JSON.stringify({ access_token: 'short-token' }), { status: 200 })
      }
      // Step B: long-lived exchange
      if (u.startsWith('https://graph.instagram.com/access_token')) {
        return new Response(JSON.stringify({ access_token: 'long-token-60d', expires_in: 5184000 }), { status: 200 })
      }
      // Step C: account_type preflight
      if (u.startsWith('https://graph.instagram.com/me')) {
        return new Response(JSON.stringify({ account_type: 'BUSINESS', username: 'tester' }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${u}`)
    }))

    // code has trailing #_ (URL-encoded as %23_)
    const cb = await request(app).get(
      `/api/auth/instagram/callback?code=AQ123%23_&state=${state}`,
    )
    expect(cb.status).toBe(302)
    expect(cb.headers['location']).toContain('connected=instagram')

    // DB must contain encrypted (not plaintext) token
    const rows = await testDb.select().from(settings).where(eq(settings.user_id, userA))
    expect(rows.length).toBe(1)
    const cfg = rows[0].platform_config as {
      instagram?: { access_token: string; expiry: number }
    }
    expect(cfg.instagram).toBeTruthy()
    const stored = cfg.instagram!.access_token
    // Must NOT be plaintext
    expect(stored).not.toBe('long-token-60d')
    // Must decrypt back to plaintext
    expect(decrypt(stored)).toBe('long-token-60d')
    // Expiry must be in the future
    expect(cfg.instagram!.expiry).toBeGreaterThan(Date.now())
  })

  // ── Instagram /callback PERSONAL rejection ────────────────────────────────

  it('Test 3: /instagram/callback rejects PERSONAL account — no DB write, redirects error=instagram_personal_account', async () => {
    const connectRes = await request(app)
      .get('/api/auth/instagram/connect')
      .set('Authorization', 'Bearer user-a')
    const state = new URL(connectRes.body.auth_url as string).searchParams.get('state')!

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const u = String(input)
      if (u === 'https://api.instagram.com/oauth/access_token') {
        return new Response(JSON.stringify({ access_token: 'short-token' }), { status: 200 })
      }
      if (u.startsWith('https://graph.instagram.com/access_token')) {
        return new Response(JSON.stringify({ access_token: 'long-token-personal', expires_in: 5184000 }), { status: 200 })
      }
      if (u.startsWith('https://graph.instagram.com/me')) {
        return new Response(JSON.stringify({ account_type: 'PERSONAL', username: 'personal_user' }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${u}`)
    }))

    const cb = await request(app).get(
      `/api/auth/instagram/callback?code=AQ456&state=${state}`,
    )
    expect(cb.status).toBe(302)
    expect(cb.headers['location']).toContain('error=instagram_personal_account')

    // No DB row should be created
    const rows = await testDb.select().from(settings).where(eq(settings.user_id, userA))
    expect(rows.length).toBe(0)
  })

  // ── Instagram /callback invalid state ────────────────────────────────────

  it('Test 4: /instagram/callback with invalid state redirects error=oauth_failed (no DB write)', async () => {
    const cb = await request(app).get(
      '/api/auth/instagram/callback?code=some-code&state=deadbeef00000000000000000000000000000000000000000000000000000000',
    )
    expect(cb.status).toBe(302)
    expect(cb.headers['location']).toContain('error=oauth_failed')

    const rows = await testDb.select().from(settings).where(eq(settings.user_id, userA))
    expect(rows.length).toBe(0)
  })

  // ── Facebook /connect ─────────────────────────────────────────────────────

  it('Test 5: GET /facebook/connect returns 200 JSON { auth_url } pointing at www.facebook.com with required params (NOT 302)', async () => {
    const res = await request(app)
      .get('/api/auth/facebook/connect')
      .set('Authorization', 'Bearer user-a')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('auth_url')

    const url = new URL(res.body.auth_url as string)
    expect(url.host).toBe('www.facebook.com')
    expect(url.pathname).toBe('/v22.0/dialog/oauth')
    expect(url.searchParams.get('client_id')).toBe('test-meta-app-id')
    expect(url.searchParams.get('scope')).toBe('pages_show_list,pages_manage_posts,pages_read_engagement')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toMatch(/^[0-9a-f]{64}$/)
  })

  // ── Facebook /callback success ────────────────────────────────────────────

  it('Test 6: /facebook/callback success — page with CREATE_CONTENT; page_access_token encrypted; redirects connected=facebook', async () => {
    const connectRes = await request(app)
      .get('/api/auth/facebook/connect')
      .set('Authorization', 'Bearer user-a')
    expect(connectRes.status).toBe(200)
    const state = new URL(connectRes.body.auth_url as string).searchParams.get('state')!

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const u = String(input)
      // Step A: exchange code for user token
      if (u.startsWith('https://graph.facebook.com/v22.0/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'fb-user-token' }), { status: 200 })
      }
      // Step B: /me/accounts
      if (u.startsWith('https://graph.facebook.com/v22.0/me/accounts')) {
        return new Response(JSON.stringify({
          data: [
            { id: 'PAGE1', name: 'My Business Page', access_token: 'page-access-token', tasks: ['CREATE_CONTENT', 'MANAGE'] },
          ],
        }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${u}`)
    }))

    const cb = await request(app).get(
      `/api/auth/facebook/callback?code=fb-code&state=${state}`,
    )
    expect(cb.status).toBe(302)
    expect(cb.headers['location']).toContain('connected=facebook')
    expect(cb.headers['location']).not.toContain('warning=')

    const rows = await testDb.select().from(settings).where(eq(settings.user_id, userA))
    expect(rows.length).toBe(1)
    const cfg = rows[0].platform_config as {
      facebook?: { access_token: string; page_id: string; expiry: number }
    }
    expect(cfg.facebook).toBeTruthy()
    // page_id stored
    expect((cfg.facebook as { access_token: string; page_id: string; expiry: number }).page_id).toBe('PAGE1')
    // access_token is encrypted (not plaintext)
    const storedToken = (cfg.facebook as { access_token: string; page_id: string; expiry: number }).access_token
    expect(storedToken).not.toBe('page-access-token')
    expect(decrypt(storedToken)).toBe('page-access-token')
  })

  // ── Facebook /callback no qualifying page ─────────────────────────────────

  it('Test 7: /facebook/callback with no qualifying page sets setup_required=true, redirects connected=facebook (warning=no_facebook_page)', async () => {
    const connectRes = await request(app)
      .get('/api/auth/facebook/connect')
      .set('Authorization', 'Bearer user-a')
    const state = new URL(connectRes.body.auth_url as string).searchParams.get('state')!

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const u = String(input)
      if (u.startsWith('https://graph.facebook.com/v22.0/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'fb-user-token-nopages' }), { status: 200 })
      }
      if (u.startsWith('https://graph.facebook.com/v22.0/me/accounts')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${u}`)
    }))

    const cb = await request(app).get(
      `/api/auth/facebook/callback?code=fb-code-nopages&state=${state}`,
    )
    expect(cb.status).toBe(302)
    expect(cb.headers['location']).toContain('connected=facebook')
    expect(cb.headers['location']).toContain('warning=no_facebook_page')

    const rows = await testDb.select().from(settings).where(eq(settings.user_id, userA))
    expect(rows.length).toBe(1)
    const cfg = rows[0].platform_config as {
      facebook?: { setup_required: true }
    }
    expect(cfg.facebook).toBeTruthy()
    // Must have setup_required=true (no access_token or page_id)
    expect((cfg.facebook as { setup_required: true }).setup_required).toBe(true)
    expect((cfg.facebook as Record<string, unknown>).access_token).toBeUndefined()
    expect((cfg.facebook as Record<string, unknown>).page_id).toBeUndefined()
  })

  // ── Facebook /callback invalid state ─────────────────────────────────────

  it('Test 8: /facebook/callback with invalid state redirects error=oauth_failed', async () => {
    const cb = await request(app).get(
      '/api/auth/facebook/callback?code=some-code&state=deadbeef00000000000000000000000000000000000000000000000000000000',
    )
    expect(cb.status).toBe(302)
    expect(cb.headers['location']).toContain('error=oauth_failed')

    const rows = await testDb.select().from(settings).where(eq(settings.user_id, userA))
    expect(rows.length).toBe(0)
  })

  // ── Single-use state enforcement (both flows) ─────────────────────────────

  it('Test 9: Single-use state — replay attempt fails for both Instagram and Facebook callbacks', async () => {
    // Instagram replay
    const igConnect = await request(app)
      .get('/api/auth/instagram/connect')
      .set('Authorization', 'Bearer user-a')
    const igState = new URL(igConnect.body.auth_url as string).searchParams.get('state')!

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const u = String(input)
      if (u === 'https://api.instagram.com/oauth/access_token') {
        return new Response(JSON.stringify({ access_token: 'short' }), { status: 200 })
      }
      if (u.startsWith('https://graph.instagram.com/access_token')) {
        return new Response(JSON.stringify({ access_token: 'long-ig', expires_in: 5184000 }), { status: 200 })
      }
      if (u.startsWith('https://graph.instagram.com/me')) {
        return new Response(JSON.stringify({ account_type: 'BUSINESS', username: 'tester' }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${u}`)
    }))

    // First use succeeds
    const first = await request(app).get(
      `/api/auth/instagram/callback?code=AQ123&state=${igState}`,
    )
    expect(first.headers['location']).toContain('connected=instagram')

    // Second use of same state must fail (state consumed)
    const replay = await request(app).get(
      `/api/auth/instagram/callback?code=AQ123&state=${igState}`,
    )
    expect(replay.status).toBe(302)
    expect(replay.headers['location']).toContain('error=oauth_failed')

    // Facebook replay
    await resetTestDb()
    const fbConnect = await request(app)
      .get('/api/auth/facebook/connect')
      .set('Authorization', 'Bearer user-a')
    const fbState = new URL(fbConnect.body.auth_url as string).searchParams.get('state')!

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const u = String(input)
      if (u.startsWith('https://graph.facebook.com/v22.0/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'fb-user-tok' }), { status: 200 })
      }
      if (u.startsWith('https://graph.facebook.com/v22.0/me/accounts')) {
        return new Response(JSON.stringify({
          data: [{ id: 'PG2', name: 'Page2', access_token: 'pat2', tasks: ['CREATE_CONTENT'] }],
        }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${u}`)
    }))

    const fbFirst = await request(app).get(
      `/api/auth/facebook/callback?code=fb-code&state=${fbState}`,
    )
    expect(fbFirst.headers['location']).toContain('connected=facebook')

    const fbReplay = await request(app).get(
      `/api/auth/facebook/callback?code=fb-code&state=${fbState}`,
    )
    expect(fbReplay.status).toBe(302)
    expect(fbReplay.headers['location']).toContain('error=oauth_failed')
  })
})
