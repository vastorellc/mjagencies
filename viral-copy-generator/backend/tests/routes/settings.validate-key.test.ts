// Integration tests for POST /api/settings/validate-key (Phase 11 VERIFY-03)
// Tests model verification, capabilities, and error_kind discrimination across 4 providers.
// All SDK calls are mocked — no real network traffic.

// Set env BEFORE importing app / helpers
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'a'.repeat(48)
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? 'test'
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? 'test'
process.env.META_APP_ID = process.env.META_APP_ID ?? 'test'
process.env.META_APP_SECRET = process.env.META_APP_SECRET ?? 'test'
process.env.APP_URL = process.env.APP_URL ?? 'http://localhost:5173'

import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'

// Stub Supabase auth so authMiddleware accepts deterministic Bearer tokens
vi.mock('../../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === 'test-user-token') {
          return {
            data: { user: { id: '00000000-0000-0000-0000-000000000099', app_metadata: {} } },
            error: null,
          }
        }
        return { data: { user: null }, error: { message: 'invalid' } }
      }),
    },
  },
}))

// ---- SDK mocks (must be declared before importing app) ----

const mockOpenAIRetrieve = vi.fn()
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    models: { retrieve: mockOpenAIRetrieve },
  })),
  OpenAI: vi.fn().mockImplementation(() => ({
    models: { retrieve: mockOpenAIRetrieve },
  })),
}))

const mockAnthropicRetrieve = vi.fn()
const mockAnthropicImpl = vi.fn().mockImplementation(() => ({
  models: { retrieve: mockAnthropicRetrieve },
  messages: { create: vi.fn().mockResolvedValue({ content: [] }) },
}))
vi.mock('@anthropic-ai/sdk', () => ({
  default: mockAnthropicImpl,
  Anthropic: mockAnthropicImpl,
}))

const mockGeminiGet = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { get: mockGeminiGet },
  })),
}))

import { createTestDb } from '../../tests/_helpers.js'

let app: import('express').Express

beforeAll(async () => {
  await createTestDb()
  app = (await import('../../src/app.js')).app
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ---- Error factory helpers ----

function makeOpenAIError(status: number, code?: string): Error & { status: number; code?: string } {
  const e = new Error('OpenAI error') as Error & { status: number; code?: string }
  e.status = status
  if (code) e.code = code
  return e
}

function makeAnthropicError(
  status: number,
  type?: string,
): Error & { status: number; error?: { error?: { type?: string } } } {
  const e = new Error('Anthropic error') as Error & {
    status: number
    error?: { error?: { type?: string } }
  }
  e.status = status
  if (type) e.error = { error: { type } }
  return e
}

function makeGeminiError(
  statusStr: string | number,
  message?: string,
): Error & { status: string | number } {
  const e = new Error(message ?? 'Gemini error') as Error & { status: string | number }
  e.status = statusStr
  return e
}

const AUTH = { Authorization: 'Bearer test-user-token' }

describe('POST /api/settings/validate-key — model verification (VERIFY-03)', () => {
  // ============ OpenAI ============

  test('OpenAI: valid (key, model) → valid=true, model_valid=true, capabilities populated', async () => {
    mockOpenAIRetrieve.mockResolvedValueOnce({ id: 'gpt-5.5' })
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'openai', api_key: 'sk-test', model_id: 'gpt-5.5' })
    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
    expect(res.body.key_valid).toBe(true)
    expect(res.body.model_valid).toBe(true)
    expect(res.body.error_kind).toBeNull()
    expect(res.body.capabilities).toBeDefined()
    expect(res.body.capabilities.text).toBe(true)
    expect(res.body.model_id).toBe('gpt-5.5')
  })

  test('OpenAI: SDK 404 with code=model_not_found → error_kind=model_not_found, key_valid=true', async () => {
    mockOpenAIRetrieve.mockRejectedValueOnce(makeOpenAIError(404, 'model_not_found'))
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'openai', api_key: 'sk-test', model_id: 'gpt-5.5' })
    expect(res.body.valid).toBe(false)
    expect(res.body.model_valid).toBe(false)
    expect(res.body.error_kind).toBe('model_not_found')
    expect(res.body.key_valid).toBe(true)
  })

  test('OpenAI: SDK 401 invalid_api_key → error_kind=invalid_key, key_valid=false', async () => {
    mockOpenAIRetrieve.mockRejectedValueOnce(makeOpenAIError(401, 'invalid_api_key'))
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'openai', api_key: 'sk-bad', model_id: 'gpt-5.5' })
    expect(res.body.error_kind).toBe('invalid_key')
    expect(res.body.key_valid).toBe(false)
    expect(res.body.model_valid).toBe(false)
  })

  test('OpenAI: unknown model_id → 400 + error_kind=model_not_found (whitelist short-circuit, no SDK call)', async () => {
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'openai', api_key: 'sk-test', model_id: 'gpt-99-fake' })
    expect(res.status).toBe(400)
    expect(res.body.error_kind).toBe('model_not_found')
    expect(mockOpenAIRetrieve).not.toHaveBeenCalled()
  })

  // ============ Claude ============

  test('Claude: valid (key, model) → valid=true, model_valid=true, capabilities populated', async () => {
    mockAnthropicRetrieve.mockResolvedValueOnce({ id: 'claude-sonnet-4-6' })
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'claude', api_key: 'sk-ant-test', model_id: 'claude-sonnet-4-6' })
    expect(res.body.valid).toBe(true)
    expect(res.body.capabilities.vision).toBe(true)
    expect(res.body.model_id).toBe('claude-sonnet-4-6')
  })

  test('Claude: SDK 404 with triple-nested not_found_error → error_kind=model_not_found (Pitfall 3)', async () => {
    mockAnthropicRetrieve.mockRejectedValueOnce(makeAnthropicError(404, 'not_found_error'))
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'claude', api_key: 'sk-ant-test', model_id: 'claude-sonnet-4-6' })
    expect(res.body.error_kind).toBe('model_not_found')
    expect(res.body.key_valid).toBe(true)
    expect(res.body.model_valid).toBe(false)
  })

  test('Claude: SDK 401 with authentication_error → error_kind=invalid_key', async () => {
    mockAnthropicRetrieve.mockRejectedValueOnce(makeAnthropicError(401, 'authentication_error'))
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'claude', api_key: 'sk-ant-bad', model_id: 'claude-sonnet-4-6' })
    expect(res.body.error_kind).toBe('invalid_key')
    expect(res.body.key_valid).toBe(false)
  })

  test('Claude: omits model_id → defaults to claude-sonnet-4-6 (defaultModelFor flagship)', async () => {
    mockAnthropicRetrieve.mockResolvedValueOnce({ id: 'claude-sonnet-4-6' })
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'claude', api_key: 'sk-ant-test' })
    expect(res.body.valid).toBe(true)
    expect(res.body.model_id).toBe('claude-sonnet-4-6')
  })

  // ============ Gemini ============

  test('Gemini: valid (key, model) → valid=true, capabilities.video=true', async () => {
    mockGeminiGet.mockResolvedValueOnce({ name: 'models/gemini-3.1-pro-preview' })
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'gemini', api_key: 'AIza-test', model_id: 'gemini-3.1-pro-preview' })
    expect(res.body.valid).toBe(true)
    expect(res.body.capabilities.video).toBe(true)
    expect(res.body.model_id).toBe('gemini-3.1-pro-preview')
  })

  test('Gemini: SDK status=NOT_FOUND → error_kind=model_not_found (Pitfall 6)', async () => {
    mockGeminiGet.mockRejectedValueOnce(makeGeminiError('NOT_FOUND', 'Model not found'))
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'gemini', api_key: 'AIza-test', model_id: 'gemini-3.1-pro-preview' })
    expect(res.body.error_kind).toBe('model_not_found')
    expect(res.body.key_valid).toBe(true)
  })

  test('Gemini: API_KEY_INVALID in message → error_kind=invalid_key', async () => {
    mockGeminiGet.mockRejectedValueOnce(
      makeGeminiError('UNAUTHENTICATED', 'API_KEY_INVALID: the provided API key is invalid'),
    )
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'gemini', api_key: 'bad-key', model_id: 'gemini-3.1-pro-preview' })
    expect(res.body.error_kind).toBe('invalid_key')
    expect(res.body.key_valid).toBe(false)
  })

  test('Gemini: unknown model_id → 400 whitelist rejection, no SDK call', async () => {
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'gemini', api_key: 'AIza', model_id: 'gemini-99-fake' })
    expect(res.status).toBe(400)
    expect(res.body.error_kind).toBe('model_not_found')
    expect(mockGeminiGet).not.toHaveBeenCalled()
  })

  // ============ DeepSeek ============

  test('DeepSeek: valid (key, model) via OpenAI SDK shim → valid=true, capabilities.vision=false', async () => {
    mockOpenAIRetrieve.mockResolvedValueOnce({ id: 'deepseek-v4-flash' })
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'deepseek', api_key: 'sk-deepseek', model_id: 'deepseek-v4-flash' })
    expect(res.body.valid).toBe(true)
    expect(res.body.capabilities.vision).toBe(false)
    expect(res.body.model_id).toBe('deepseek-v4-flash')
  })

  test('DeepSeek: SDK 404 code=model_not_found → error_kind=model_not_found, key_valid=true', async () => {
    mockOpenAIRetrieve.mockRejectedValueOnce(makeOpenAIError(404, 'model_not_found'))
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'deepseek', api_key: 'sk-deepseek', model_id: 'deepseek-v4-flash' })
    expect(res.body.error_kind).toBe('model_not_found')
    expect(res.body.key_valid).toBe(true)
  })

  test('DeepSeek: SDK 401 → error_kind=invalid_key', async () => {
    mockOpenAIRetrieve.mockRejectedValueOnce(makeOpenAIError(401, 'invalid_api_key'))
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'deepseek', api_key: 'sk-bad', model_id: 'deepseek-v4-flash' })
    expect(res.body.error_kind).toBe('invalid_key')
    expect(res.body.key_valid).toBe(false)
  })

  // ============ Cross-provider edge cases ============

  test('rejects unknown provider with 400', async () => {
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'mistral', api_key: 'sk-x', model_id: 'x' })
    expect(res.status).toBe(400)
  })

  test('rejects missing api_key with 400 + error_kind=invalid_key', async () => {
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'openai' })
    expect(res.status).toBe(400)
    expect(res.body.error_kind).toBe('invalid_key')
  })

  test('back-compat: response always includes error field alias (legacy SettingsPage.tsx caller)', async () => {
    mockOpenAIRetrieve.mockRejectedValueOnce(makeOpenAIError(401, 'invalid_api_key'))
    const res = await request(app)
      .post('/api/settings/validate-key')
      .set(AUTH)
      .send({ provider: 'openai', api_key: 'sk-bad', model_id: 'gpt-5.5' })
    // Existing frontend reads result.error — must be present
    expect(res.body.error).toBeDefined()
    expect(typeof res.body.error).toBe('string')
  })

  test('returns 401 without auth header', async () => {
    const res = await request(app)
      .post('/api/settings/validate-key')
      .send({ provider: 'openai', api_key: 'sk-test', model_id: 'gpt-5.5' })
    expect(res.status).toBe(401)
  })
})
