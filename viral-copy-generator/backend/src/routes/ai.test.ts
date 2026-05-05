import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../app'

// Mock Supabase auth
vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.headers.authorization = 'Bearer test_token'
    next()
  },
}))

// Mock the database
vi.mock('../db/index', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([
      {
        api_key_encrypted: 'test_encrypted_key',
        ai_provider: 'openai',
      },
    ]),
  },
}))

// Mock decryption
vi.mock('../lib/encryption', () => ({
  decrypt: vi.fn().mockReturnValue('test_openai_key'),
}))

describe('POST /api/ai/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 VALIDATION_ERROR when prompt is missing', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer test_token')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.message).toContain('Prompt')
    expect(res.body.error.requestId).toBeDefined()
  })

  it('returns 400 VALIDATION_ERROR when prompt is empty', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer test_token')
      .send({ prompt: '' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR when prompt is not a string', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer test_token')
      .send({ prompt: 123 })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR when no API key configured', async () => {
    // Mock DB to return no API key
    const dbMock = require('../db/index').db
    dbMock.where.mockResolvedValueOnce([
      {
        api_key_encrypted: null,
        ai_provider: 'openai',
      },
    ])

    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer test_token')
      .send({ prompt: 'test prompt' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.message).toContain('API key')
    expect(res.body.error.message).toContain('Settings')
    expect(res.body.error.field).toBe('api_key')
  })

  it('includes request ID in error response', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer test_token')
      .send({ prompt: '' })

    expect(res.body.error.requestId).toBeDefined()
    expect(typeof res.body.error.requestId).toBe('string')
    expect(res.body.error.requestId.length).toBeGreaterThan(0)
  })

  it('sets X-Request-Id header on all responses', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer test_token')
      .send({ prompt: '' })

    expect(res.headers['x-request-id']).toBeDefined()
    expect(res.headers['x-request-id']).toBe(res.body.error.requestId)
  })

  it('never exposes original error details in response', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer test_token')
      .send({ prompt: '' })

    const body = JSON.stringify(res.body)
    expect(body).not.toContain('original')
    expect(body).not.toContain('stack')
    expect(body).not.toContain('developerMessage')
  })

  it('sets correct HTTP status code for VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer test_token')
      .send({ prompt: '' })

    // VALIDATION_ERROR should be 400
    expect(res.status).toBe(400)
  })

  it('response includes retryable flag', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer test_token')
      .send({ prompt: '' })

    expect(res.body.error).toHaveProperty('retryable')
    expect(typeof res.body.error.retryable).toBe('boolean')
  })
})

describe('Error Response Format', () => {
  it('all error responses have consistent shape', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer test_token')
      .send({ prompt: '' })

    expect(res.body).toHaveProperty('error')
    expect(res.body.error).toHaveProperty('code')
    expect(res.body.error).toHaveProperty('message')
    expect(res.body.error).toHaveProperty('retryable')
    expect(res.body.error).not.toHaveProperty('original')
  })

  it('optional fields are present when applicable', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', 'Bearer test_token')
      .send({ prompt: '' })

    // VALIDATION_ERROR from missing prompt should have field
    const payload = res.body.error
    if (payload.code === 'VALIDATION_ERROR' && payload.message.includes('Prompt')) {
      expect(payload).toHaveProperty('field')
    }
  })
})
