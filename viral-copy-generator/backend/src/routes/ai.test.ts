// Wave 0 stub — tests go GREEN when ai.ts route is implemented in Plan 05-02.
// Covers: AI-05 (T-5-01: API key NEVER in response body)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

// Import will fail RED until Plan 05-02 creates backend/src/routes/ai.ts
// and app.ts wires /api/ai
import { app } from '../app.js'

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
vi.mock('../db/index.js', () => ({
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

vi.mock('../lib/encryption.js', () => ({
  decrypt: vi.fn().mockReturnValue('sk-real-api-key-that-must-not-appear-in-response'),
}))

// Mock authMiddleware so we can test the route with a fake userId
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: vi.fn((req: any, res: any, next: any) => {
    res.locals.userId = 'test-user-id'
    next()
  }),
}))

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

  it('returns 400 when no API key is configured for user', async () => {
    // Override DB mock to return no api_key_encrypted
    const { db } = await import('../db/index.js')
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
    expect(res.body.error).toBe('no_api_key')
  })
})
