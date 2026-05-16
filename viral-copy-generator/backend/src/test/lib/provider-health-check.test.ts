// backend/src/test/lib/provider-health-check.test.ts
// Phase 11 VERIFY-05 — Integration tests for runProviderHealthCheck.
// All external SDKs and the DB are mocked; no real network calls are made.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// ── SDK mocks (declared at top-level so vi.mock hoisting works) ───────────────

const mockOpenAIRetrieve = vi.fn()
const mockOpenAIChat = vi.fn()
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    models: { retrieve: mockOpenAIRetrieve },
    chat: { completions: { create: mockOpenAIChat } },
  })),
}))

const mockAnthropicRetrieve = vi.fn()
const mockAnthropicCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    models: { retrieve: mockAnthropicRetrieve },
    messages: { create: mockAnthropicCreate },
  })),
}))

const mockGeminiGet = vi.fn()
const mockGeminiGen = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { get: mockGeminiGet, generateContent: mockGeminiGen },
  })),
}))

// ── DB mock ────────────────────────────────────────────────────────────────────
// mockDbInsertValues is the inner spy that captures the actual values array.
const mockDbInsertValues = vi.fn().mockResolvedValue(undefined)
const mockDbInsert = vi.fn(() => ({ values: mockDbInsertValues }))
const mockDbExecute = vi.fn().mockResolvedValue(undefined)
vi.mock('../../db/index.js', () => ({
  db: { insert: mockDbInsert, execute: mockDbExecute },
}))

// ── Test suite ────────────────────────────────────────────────────────────────

describe('runProviderHealthCheck (VERIFY-05)', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.clearAllMocks()
    // Reset all mocks to default success state
    mockDbInsertValues.mockResolvedValue(undefined)
    mockDbExecute.mockResolvedValue(undefined)
    // Re-assign the factory mock so insert() returns the values spy after clearAllMocks
    mockDbInsert.mockImplementation(() => ({ values: mockDbInsertValues }))

    // Default SDK success responses
    mockOpenAIRetrieve.mockResolvedValue({ id: 'x' })
    mockOpenAIChat.mockResolvedValue({ id: 'cmpl' })
    mockAnthropicRetrieve.mockResolvedValue({ id: 'x' })
    mockAnthropicCreate.mockResolvedValue({ id: 'msg' })
    mockGeminiGet.mockResolvedValue({ name: 'x' })
    mockGeminiGen.mockResolvedValue({ text: '1' })
  })

  afterEach(() => {
    process.env = originalEnv
    // Clear module cache so re-imports pick up fresh env values
    vi.resetModules()
  })

  test('writes one row per model (8 rows) when all keys configured', async () => {
    process.env.HEALTHCHECK_OPENAI_KEY = 'sk-openai'
    process.env.HEALTHCHECK_ANTHROPIC_KEY = 'sk-anthropic'
    process.env.HEALTHCHECK_GOOGLE_KEY = 'AIza-google'
    process.env.HEALTHCHECK_DEEPSEEK_KEY = 'sk-deepseek'

    const { runProviderHealthCheck } = await import('../../lib/provider-health-check.js')
    await runProviderHealthCheck()

    expect(mockDbInsert).toHaveBeenCalledTimes(1)
    const values = mockDbInsertValues.mock.calls[0]?.[0] as Array<{ status: string }>
    expect(values).toHaveLength(8)
    expect(values.every((v) => v.status === 'ok')).toBe(true)
  })

  test('missing HEALTHCHECK_OPENAI_KEY writes status=not_configured (does NOT throw)', async () => {
    delete process.env.HEALTHCHECK_OPENAI_KEY
    process.env.HEALTHCHECK_ANTHROPIC_KEY = 'sk'
    process.env.HEALTHCHECK_GOOGLE_KEY = 'AIza'
    process.env.HEALTHCHECK_DEEPSEEK_KEY = 'sk'

    const { runProviderHealthCheck } = await import('../../lib/provider-health-check.js')
    await expect(runProviderHealthCheck()).resolves.toBeUndefined()

    const values = mockDbInsertValues.mock.calls[0]?.[0] as Array<{ provider: string; status: string; error_message: string }>
    const openaiRows = values.filter((v) => v.provider === 'openai')
    expect(openaiRows.length).toBeGreaterThan(0)
    expect(
      openaiRows.every(
        (r) => r.status === 'not_configured' && r.error_message.includes('HEALTHCHECK_OPENAI_KEY')
      )
    ).toBe(true)
  })

  test('fail-partial: when OpenAI SDK throws, Claude/Gemini/DeepSeek still insert', async () => {
    process.env.HEALTHCHECK_OPENAI_KEY = 'sk'
    process.env.HEALTHCHECK_ANTHROPIC_KEY = 'sk'
    process.env.HEALTHCHECK_GOOGLE_KEY = 'AIza'
    process.env.HEALTHCHECK_DEEPSEEK_KEY = 'sk'

    mockOpenAIRetrieve.mockRejectedValue(
      Object.assign(new Error('OpenAI down'), { status: 503 })
    )

    const { runProviderHealthCheck } = await import('../../lib/provider-health-check.js')
    await runProviderHealthCheck()

    const values = mockDbInsertValues.mock.calls[0]?.[0] as Array<{ provider: string; status: string }>
    expect(values).toHaveLength(8)

    const claudeOk = values.filter((v) => v.provider === 'claude' && v.status === 'ok')
    const geminiOk = values.filter((v) => v.provider === 'gemini' && v.status === 'ok')
    expect(claudeOk.length).toBeGreaterThan(0)
    expect(geminiOk.length).toBeGreaterThan(0)

    // OpenAI + DeepSeek both use OpenAI mock → service_unavailable (503 >= 500)
    const oaOrDsErr = values.filter(
      (v) => (v.provider === 'openai' || v.provider === 'deepseek') && v.status === 'service_unavailable'
    )
    expect(oaOrDsErr.length).toBeGreaterThan(0)
  })

  test('classifies SDK 404 as model_not_found', async () => {
    process.env.HEALTHCHECK_OPENAI_KEY = 'sk'
    delete process.env.HEALTHCHECK_ANTHROPIC_KEY
    delete process.env.HEALTHCHECK_GOOGLE_KEY
    delete process.env.HEALTHCHECK_DEEPSEEK_KEY

    mockOpenAIRetrieve.mockRejectedValue(
      Object.assign(new Error('404'), { status: 404, code: 'model_not_found' })
    )

    const { runProviderHealthCheck } = await import('../../lib/provider-health-check.js')
    await runProviderHealthCheck()

    const values = mockDbInsertValues.mock.calls[0]?.[0] as Array<{ provider: string; status: string }>
    const oaRows = values.filter((v) => v.provider === 'openai')
    expect(oaRows.every((r) => r.status === 'model_not_found')).toBe(true)
  })

  test('classifies SDK 401 as invalid_key', async () => {
    process.env.HEALTHCHECK_OPENAI_KEY = 'sk'
    delete process.env.HEALTHCHECK_ANTHROPIC_KEY
    delete process.env.HEALTHCHECK_GOOGLE_KEY
    delete process.env.HEALTHCHECK_DEEPSEEK_KEY

    mockOpenAIRetrieve.mockRejectedValue(
      Object.assign(new Error('401'), { status: 401 })
    )

    const { runProviderHealthCheck } = await import('../../lib/provider-health-check.js')
    await runProviderHealthCheck()

    const values = mockDbInsertValues.mock.calls[0]?.[0] as Array<{ provider: string; status: string }>
    const oaRows = values.filter((v) => v.provider === 'openai')
    expect(oaRows.every((r) => r.status === 'invalid_key')).toBe(true)
  })

  test('classifies SDK 429 as rate_limited', async () => {
    process.env.HEALTHCHECK_OPENAI_KEY = 'sk'
    delete process.env.HEALTHCHECK_ANTHROPIC_KEY
    delete process.env.HEALTHCHECK_GOOGLE_KEY
    delete process.env.HEALTHCHECK_DEEPSEEK_KEY

    mockOpenAIRetrieve.mockRejectedValue(
      Object.assign(new Error('429'), { status: 429 })
    )

    const { runProviderHealthCheck } = await import('../../lib/provider-health-check.js')
    await runProviderHealthCheck()

    const values = mockDbInsertValues.mock.calls[0]?.[0] as Array<{ provider: string; status: string }>
    const oaRows = values.filter((v) => v.provider === 'openai')
    expect(oaRows.every((r) => r.status === 'rate_limited')).toBe(true)
  })

  test('classifies SDK 5xx as service_unavailable', async () => {
    process.env.HEALTHCHECK_OPENAI_KEY = 'sk'
    delete process.env.HEALTHCHECK_ANTHROPIC_KEY
    delete process.env.HEALTHCHECK_GOOGLE_KEY
    delete process.env.HEALTHCHECK_DEEPSEEK_KEY

    mockOpenAIRetrieve.mockRejectedValue(
      Object.assign(new Error('503 Service Unavailable'), { status: 503 })
    )

    const { runProviderHealthCheck } = await import('../../lib/provider-health-check.js')
    await runProviderHealthCheck()

    const values = mockDbInsertValues.mock.calls[0]?.[0] as Array<{ provider: string; status: string }>
    const oaRows = values.filter((v) => v.provider === 'openai')
    expect(oaRows.every((r) => r.status === 'service_unavailable')).toBe(true)
  })

  test('runs cleanup query after insert', async () => {
    process.env.HEALTHCHECK_OPENAI_KEY = 'sk'
    process.env.HEALTHCHECK_ANTHROPIC_KEY = 'sk'
    process.env.HEALTHCHECK_GOOGLE_KEY = 'AIza'
    process.env.HEALTHCHECK_DEEPSEEK_KEY = 'sk'

    const { runProviderHealthCheck } = await import('../../lib/provider-health-check.js')
    await runProviderHealthCheck()

    expect(mockDbExecute).toHaveBeenCalled()
    const sqlArg: unknown = mockDbExecute.mock.calls[0]?.[0]
    const sqlText = JSON.stringify(sqlArg)
    expect(sqlText).toMatch(/DELETE FROM admin_provider_health/)
    expect(sqlText).toMatch(/ROW_NUMBER\(\) OVER/)
    expect(sqlText).toMatch(/rn <= 30/)
  })

  test('records latency_ms >= 0 for successful pings', async () => {
    process.env.HEALTHCHECK_OPENAI_KEY = 'sk'
    delete process.env.HEALTHCHECK_ANTHROPIC_KEY
    delete process.env.HEALTHCHECK_GOOGLE_KEY
    delete process.env.HEALTHCHECK_DEEPSEEK_KEY

    const { runProviderHealthCheck } = await import('../../lib/provider-health-check.js')
    await runProviderHealthCheck()

    const values = mockDbInsertValues.mock.calls[0]?.[0] as Array<{ provider: string; status: string; latency_ms: number }>
    const oaOkRows = values.filter((v) => v.provider === 'openai' && v.status === 'ok')
    expect(oaOkRows.length).toBeGreaterThan(0)
    // latency_ms is Date.now() delta — may be 0 on very fast mocked path; allow >=0
    for (const r of oaOkRows) expect(r.latency_ms).toBeGreaterThanOrEqual(0)
  })
})
