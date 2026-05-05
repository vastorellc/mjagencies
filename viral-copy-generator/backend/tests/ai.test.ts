// Wave 0 stub — tests go GREEN when ai.ts route is implemented in Plan 05-02.
// Covers: AI-05 (T-5-01: API key NEVER in response body)
import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

// Set env before app import
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'a'.repeat(48)
process.env.APP_URL = process.env.APP_URL ?? 'http://localhost:5173'

// Mock the openai module to avoid real API calls in tests
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '{"youtube":{"title":"T","description":"D","tags":[],"hook":""},"instagram":{"caption":"","hashtags":[],"cover_text":""},"tiktok":{"hook":"","caption":"","hashtags":[]},"facebook":{"caption":"","cta":"","hashtags":[]},"x":{"tweet":"","hashtags":[]},"script_outline":""}' } }],
        }),
      },
    },
  })),
}))

// Mock the DB + decrypt to return a fake encrypted key
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            api_key_encrypted: 'fake_encrypted_key_base64',
            ai_provider: 'openai',
          }]),
        }),
      }),
    }),
  },
}))

vi.mock('../src/lib/encryption.js', () => ({
  decrypt: vi.fn().mockReturnValue('sk-real-api-key-that-must-not-appear-in-response'),
  encrypt: vi.fn().mockReturnValue('fake_encrypted'),
  maskKey: vi.fn().mockReturnValue('****abcd'),
}))

// Mock authMiddleware so we can test the route with a fake userId
vi.mock('../src/middleware/auth.js', () => ({
  authMiddleware: vi.fn((req: any, res: any, next: any) => {
    res.locals.userId = 'test-user-id'
    next()
  }),
}))

// Mock supabaseAdmin (imported transitively by authMiddleware)
vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id', app_metadata: {} } }, error: null }),
    },
  },
}))

import { app } from '../src/app.js'

describe('POST /api/ai/generate — T-5-01: API key never in response', () => {
  it('returns 200 with { text } and does not leak the API key', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer fake-token')
      .send({ prompt: 'Generate copy for a travel video' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('text')
    // T-5-01: The decrypted API key must NEVER appear in the response
    expect(JSON.stringify(res.body)).not.toContain('sk-real-api-key-that-must-not-appear-in-response')
    expect(JSON.stringify(res.body)).not.toContain('fake_encrypted_key_base64')
  })

  it('returns 400 VALIDATION_ERROR when no API key is configured for user', async () => {
    // Override DB mock to return no api_key_encrypted
    const { db } = await import('../src/db/index.js')
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ api_key_encrypted: null, ai_provider: 'openai' }]),
        }),
      }),
    } as any)

    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer fake-token')
      .send({ prompt: 'test' })

    expect(res.status).toBe(400)
    // New error format: structured error response
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.message).toContain('API key')
    expect(res.body.error.retryable).toBe(false)
    expect(res.body.error.requestId).toBeDefined()
  })

  it('returns 400 VALIDATION_ERROR when prompt is missing', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer fake-token')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.message).toContain('Prompt')
  })

  it('includes X-Request-Id header in error response', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer fake-token')
      .send({})

    expect(res.headers['x-request-id']).toBeDefined()
    expect(res.body.error.requestId).toBe(res.headers['x-request-id'])
  })
})
