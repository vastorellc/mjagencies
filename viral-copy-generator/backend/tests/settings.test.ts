import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import request from 'supertest'

// Set env BEFORE importing the app or the helpers
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'a'.repeat(48)
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? 'test'
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? 'test'
process.env.META_APP_ID = process.env.META_APP_ID ?? 'test'
process.env.META_APP_SECRET = process.env.META_APP_SECRET ?? 'test'
process.env.APP_URL = process.env.APP_URL ?? 'http://localhost:5173'

// Stub Supabase auth so authMiddleware accepts deterministic Bearer tokens
vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === 'user-a-token') return { data: { user: { id: '00000000-0000-0000-0000-00000000000a', app_metadata: {} } }, error: null }
        if (token === 'user-b-token') return { data: { user: { id: '00000000-0000-0000-0000-00000000000b', app_metadata: {} } }, error: null }
        return { data: { user: null }, error: { message: 'invalid' } }
      }),
    },
  },
}))

import { createTestDb, resetTestDb } from './_helpers.js'

let testDb: Awaited<ReturnType<typeof createTestDb>>['db']
let app: import('express').Express

beforeAll(async () => {
  ;({ db: testDb } = await createTestDb())
  app = (await import('../src/app.js')).app
})
beforeEach(async () => { await resetTestDb() })

import { decrypt } from '../src/lib/encryption.js'
import { settings } from '../src/db/schema.js'
import { eq } from 'drizzle-orm'

describe('settings (SETTINGS-01..10)', () => {
  const userA = '00000000-0000-0000-0000-00000000000a'
  const userB = '00000000-0000-0000-0000-00000000000b'

  it('Test 9: GET /api/settings without auth returns 401', async () => {
    const res = await request(app).get('/api/settings')
    expect(res.status).toBe(401)
  })

  it('Test 1: GET first-time user returns defaults; NO row created', async () => {
    const res = await request(app).get('/api/settings').set('Authorization', 'Bearer user-a-token')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      ai_provider: 'gemini', api_key_masked: null, default_niche: 'travel',
      enabled_platforms: ['youtube', 'instagram', 'facebook'],
      connected: { youtube: false, instagram: false, facebook: false },
      timezone: 'Asia/Karachi',
    })
    const rows = await testDb.select().from(settings).where(eq(settings.user_id, userA))
    expect(rows.length).toBe(0)
  })

  it('Test 2: PATCH stores AES-256-GCM ciphertext (NEVER plaintext) and returns ****ABCD', async () => {
    const plaintext = 'sk-ant-test1234567890ABCD'
    const res = await request(app).patch('/api/settings')
      .set('Authorization', 'Bearer user-a-token')
      .send({ ai_provider: 'claude', api_key: plaintext })
    expect(res.status).toBe(200)
    expect(res.body.api_key_masked).toBe('****ABCD')
    const rows = await testDb.select().from(settings).where(eq(settings.user_id, userA))
    expect(rows[0].api_key_encrypted).toBeTruthy()
    expect(rows[0].api_key_encrypted).not.toBe(plaintext)
    expect(rows[0].api_key_encrypted).not.toContain(plaintext)
    expect(decrypt(rows[0].api_key_encrypted!)).toBe(plaintext)
  })

  it('Test 3: GET after save returns ****last4; plaintext NEVER appears in body', async () => {
    await request(app).patch('/api/settings').set('Authorization', 'Bearer user-a-token').send({ api_key: 'sk-secret-1234' })
    const res = await request(app).get('/api/settings').set('Authorization', 'Bearer user-a-token')
    expect(res.body.api_key_masked).toBe('****1234')
    expect(JSON.stringify(res.body)).not.toContain('sk-secret')
  })

  it('Test 4: PATCH default_niche preserves api_key_encrypted (partial update)', async () => {
    await request(app).patch('/api/settings').set('Authorization', 'Bearer user-a-token').send({ api_key: 'sk-keep-9999' })
    await request(app).patch('/api/settings').set('Authorization', 'Bearer user-a-token').send({ default_niche: 'coding' })
    const rows = await testDb.select().from(settings).where(eq(settings.user_id, userA))
    expect(rows[0].default_niche).toBe('coding')
    expect(decrypt(rows[0].api_key_encrypted!)).toBe('sk-keep-9999')
  })

  it('Test 5: PATCH enabled_platforms accepts tiktok (storage permissive; UI greys it)', async () => {
    const res = await request(app).patch('/api/settings').set('Authorization', 'Bearer user-a-token')
      .send({ enabled_platforms: ['youtube', 'instagram', 'tiktok'] })
    expect(res.status).toBe(200)
    const get = await request(app).get('/api/settings').set('Authorization', 'Bearer user-a-token')
    expect(get.body.enabled_platforms).toEqual(['youtube', 'instagram', 'tiktok'])
  })

  it('Test 6: DELETE /connections/youtube nulls youtube but leaves instagram untouched (JSONB merge)', async () => {
    await testDb.insert(settings).values({
      user_id: userA,
      platform_config: {
        youtube: { access_token: 'enc-y', refresh_token: 'enc-yr', expiry: 9e12 },
        instagram: { access_token: 'enc-i', expiry: 9e12 },
      } as any,
    })
    const del = await request(app).delete('/api/settings/connections/youtube').set('Authorization', 'Bearer user-a-token')
    expect(del.status).toBe(200)
    const rows = await testDb.select().from(settings).where(eq(settings.user_id, userA))
    const cfg = rows[0].platform_config as any
    expect(cfg.youtube).toBeNull()
    expect(cfg.instagram).toEqual({ access_token: 'enc-i', expiry: 9e12 })
  })

  it('Test 7: Response NEVER contains api_key_encrypted or any access_token field', async () => {
    await request(app).patch('/api/settings').set('Authorization', 'Bearer user-a-token').send({ api_key: 'sk-no-leak-XYZ' })
    const res = await request(app).get('/api/settings').set('Authorization', 'Bearer user-a-token')
    const body = JSON.stringify(res.body)
    expect(body).not.toMatch(/api_key_encrypted/)
    expect(body).not.toMatch(/access_token/)
    expect(body).not.toContain('sk-no-leak-XYZ')
  })

  it('Test 8: Cross-user isolation — user B sees no data from user A', async () => {
    await request(app).patch('/api/settings').set('Authorization', 'Bearer user-a-token').send({ api_key: 'sk-A-secret' })
    const resB = await request(app).get('/api/settings').set('Authorization', 'Bearer user-b-token')
    expect(resB.body.api_key_masked).toBeNull()
    const rowsB = await testDb.select().from(settings).where(eq(settings.user_id, userB))
    expect(rowsB.length).toBe(0)
  })

  it('Test 10: PATCH with invalid ai_provider returns 400', async () => {
    const res = await request(app).patch('/api/settings').set('Authorization', 'Bearer user-a-token').send({ ai_provider: 'banana' })
    expect(res.status).toBe(400)
  })
})
