import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import request from 'supertest'

// Set env BEFORE any module imports — encryption.ts and oauth-google.ts read env at call time
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'a'.repeat(48)
process.env.GOOGLE_CLIENT_ID = 'test-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
process.env.META_APP_ID = process.env.META_APP_ID ?? 'test'
process.env.META_APP_SECRET = process.env.META_APP_SECRET ?? 'test'
process.env.APP_URL = 'http://localhost:5173'

// Stub Supabase auth — same pattern as settings.test.ts
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

// Mock googleapis OAuth2Client — avoid real network calls in tests
const fakeTokens = {
  access_token: 'ya29.fake-access',
  refresh_token: '1//fake-refresh',
  expiry_date: Date.now() + 3600_000,
}

vi.mock('googleapis', () => {
  return {
    google: {
      auth: {
        OAuth2: class MockOAuth2 {
          public id: string
          public secret: string
          public redirect: string

          constructor(id: string, secret: string, redirect: string) {
            this.id = id
            this.secret = secret
            this.redirect = redirect
          }

          generateAuthUrl(opts: {
            access_type: string
            prompt: string
            state: string
            scope: string[]
            redirect_uri?: string
            include_granted_scopes?: boolean
          }): string {
            const params = new URLSearchParams({
              access_type: opts.access_type,
              prompt: opts.prompt,
              state: opts.state,
              scope: opts.scope.join(' '),
              redirect_uri: this.redirect,
              client_id: this.id,
              response_type: 'code',
            })
            return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
          }

          async getToken(code: string): Promise<{ tokens: typeof fakeTokens }> {
            if (code === 'good-code') return { tokens: fakeTokens }
            throw new Error('invalid_grant')
          }
        },
      },
    },
  }
})

import { createTestDb, resetTestDb } from './_helpers.js'
import { decrypt } from '../src/lib/encryption.js'
import { settings } from '../src/db/schema.js'
import { eq } from 'drizzle-orm'

let testDb: Awaited<ReturnType<typeof createTestDb>>['db']
let app: import('express').Express

beforeAll(async () => {
  ;({ db: testDb } = await createTestDb())
  app = (await import('../src/app.js')).app
})

beforeEach(async () => {
  await resetTestDb()
})

describe('Google OAuth (SETTINGS-04)', () => {
  const userA = '00000000-0000-0000-0000-00000000000a'

  it('Test 1: GET /connect returns 200 JSON { auth_url } pointing at accounts.google.com with required params', async () => {
    const res = await request(app)
      .get('/api/auth/google/connect')
      .set('Authorization', 'Bearer user-a')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('auth_url')

    const url = new URL(res.body.auth_url as string)
    expect(url.host).toBe('accounts.google.com')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('state')).toMatch(/^[0-9a-f]{64}$/)
    expect(url.searchParams.get('scope')).toContain('youtube.upload')
    expect(url.searchParams.get('scope')).toContain('youtube.readonly')
  })

  it('Test 2: GET /connect issues a unique state on each call', async () => {
    const r1 = await request(app)
      .get('/api/auth/google/connect')
      .set('Authorization', 'Bearer user-a')
    const r2 = await request(app)
      .get('/api/auth/google/connect')
      .set('Authorization', 'Bearer user-a')

    const s1 = new URL(r1.body.auth_url as string).searchParams.get('state')
    const s2 = new URL(r2.body.auth_url as string).searchParams.get('state')
    expect(s1).not.toBe(s2)
  })

  it('Test 3: GET /callback with invalid state redirects to oauth_failed (NOT 500)', async () => {
    const res = await request(app).get(
      '/api/auth/google/callback?code=good-code&state=deadbeef',
    )
    expect(res.status).toBe(302)
    expect(res.headers['location']).toContain('error=oauth_failed')
  })

  it('Test 4: GET /callback with valid state encrypts tokens, JSONB-merges, and redirects to connected=youtube', async () => {
    // Issue a fresh state via /connect (auth-gated)
    const init = await request(app)
      .get('/api/auth/google/connect')
      .set('Authorization', 'Bearer user-a')
    expect(init.status).toBe(200)

    const state = new URL(init.body.auth_url as string).searchParams.get('state')!
    expect(state).toMatch(/^[0-9a-f]{64}$/)

    // Callback comes from Google — no auth header (state carries the userId)
    const cb = await request(app).get(
      `/api/auth/google/callback?code=good-code&state=${state}`,
    )
    expect(cb.status).toBe(302)
    expect(cb.headers['location']).toContain('connected=youtube')

    // Inspect DB — youtube.access_token must be ciphertext (not 'ya29.fake-access')
    const rows = await testDb.select().from(settings).where(eq(settings.user_id, userA))
    expect(rows.length).toBe(1)
    const cfg = rows[0].platform_config as {
      youtube?: { access_token: string; refresh_token: string; expiry: number }
    }
    expect(cfg.youtube).toBeTruthy()
    const storedAccess = cfg.youtube!.access_token
    // Must NOT be plaintext
    expect(storedAccess).not.toBe(fakeTokens.access_token)
    // Must decrypt back to plaintext
    expect(decrypt(storedAccess)).toBe(fakeTokens.access_token)
    // refresh_token also encrypted
    const storedRefresh = cfg.youtube!.refresh_token
    expect(storedRefresh).not.toBe(fakeTokens.refresh_token)
    expect(decrypt(storedRefresh)).toBe(fakeTokens.refresh_token)
  })

  it('Test 5: Reusing the same state on a second /callback call fails (single-use)', async () => {
    const init = await request(app)
      .get('/api/auth/google/connect')
      .set('Authorization', 'Bearer user-a')
    const state = new URL(init.body.auth_url as string).searchParams.get('state')!

    const first = await request(app).get(
      `/api/auth/google/callback?code=good-code&state=${state}`,
    )
    expect(first.headers['location']).toContain('connected=youtube')

    // Second use of same state — must fail
    const second = await request(app).get(
      `/api/auth/google/callback?code=good-code&state=${state}`,
    )
    expect(second.status).toBe(302)
    expect(second.headers['location']).toContain('error=oauth_failed')
  })
})
