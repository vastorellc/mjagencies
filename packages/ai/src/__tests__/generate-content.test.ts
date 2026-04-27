/**
 * packages/ai/src/__tests__/generate-content.test.ts
 *
 * Vitest unit tests for generate-content.ts (Plan 07-01 Task 2).
 * Tests Phase 7 extensions while verifying Phase 5/6 backward compatibility.
 *
 * Tests:
 *   1. Stub fallback path (no LITELLM_API_URL) — unchanged Phase 5 behavior
 *   2. Cost cap throws when checkAgencyCostCap rejects
 *   3. Per-agency key used when agencyId provided
 *   4. Model routing: tier='tier2-writing' uses 'claude-sonnet-4-6'
 *   5. recordAgencySpend called after successful response
 *   6. Backward compat: call without agencyId → no Redis access, no errors
 *   7. metadata tags included in request body when agencyId provided
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AiBudgetExceededError } from '../cost-cap.js'

// Mock cost-cap module BEFORE importing generate-content
vi.mock('../cost-cap.js', () => ({
  checkAgencyCostCap: vi.fn(),
  recordAgencySpend: vi.fn(),
  getAgencyLiteLLMKey: vi.fn().mockReturnValue('agency-test-key'),
  AiBudgetExceededError: class AiBudgetExceededError extends Error {
    constructor(agencyId: string) {
      super(`Agency ${agencyId} exceeded monthly LiteLLM budget`)
      this.name = 'AiBudgetExceededError'
    }
  },
}))

import { generateContent } from '../generate-content.js'
import * as costCap from '../cost-cap.js'

const mockCheckAgencyCostCap = vi.mocked(costCap.checkAgencyCostCap)
const mockRecordAgencySpend = vi.mocked(costCap.recordAgencySpend)
const mockGetAgencyLiteLLMKey = vi.mocked(costCap.getAgencyLiteLLMKey)

/** Mock LiteLLM response */
function mockOkResponse(content: string = 'Generated content', model: string = 'gemini-2.5-flash-lite') {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      model,
      usage: { total_tokens: 500, prompt_tokens: 100, completion_tokens: 400 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckAgencyCostCap.mockResolvedValue(undefined)
  mockRecordAgencySpend.mockResolvedValue(undefined)
  mockGetAgencyLiteLLMKey.mockReturnValue('agency-test-key')
})

afterEach(() => {
  delete process.env['LITELLM_API_URL']
  delete process.env['LITELLM_API_KEY']
})

// ---------------------------------------------------------------------------
// 1. Stub fallback (no LITELLM_API_URL)
// ---------------------------------------------------------------------------
describe('stub fallback path', () => {
  it('returns stub when LITELLM_API_URL is not set', async () => {
    delete process.env['LITELLM_API_URL']
    const result = await generateContent({
      prompt: 'Write a homepage',
      agencySlug: 'ecommerce',
      pageType: 'home',
    })
    expect(result.model).toBe('stub')
    expect(result.isAiGenerated).toBe(true)
    expect(result.text).toContain('ecommerce')
  })

  it('does not call checkAgencyCostCap or recordAgencySpend in stub path', async () => {
    delete process.env['LITELLM_API_URL']
    await generateContent({
      prompt: 'Write a homepage',
      agencySlug: 'ecommerce',
      pageType: 'home',
      agencyId: 'ecommerce',
    })
    expect(mockCheckAgencyCostCap).not.toHaveBeenCalled()
    expect(mockRecordAgencySpend).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 2. Cost cap enforcement
// ---------------------------------------------------------------------------
describe('cost cap enforcement', () => {
  it('throws AiBudgetExceededError when checkAgencyCostCap rejects', async () => {
    process.env['LITELLM_API_URL'] = 'http://localhost:4000'
    mockCheckAgencyCostCap.mockRejectedValue(new AiBudgetExceededError('ecommerce'))

    await expect(
      generateContent({
        prompt: 'Write a blog post',
        agencySlug: 'ecommerce',
        pageType: 'blog',
        agencyId: 'ecommerce',
      }),
    ).rejects.toThrow('exceeded monthly LiteLLM budget')
  })

  it('calls checkAgencyCostCap with agencyId before fetch', async () => {
    process.env['LITELLM_API_URL'] = 'http://localhost:4000'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse())

    await generateContent({
      prompt: 'Write content',
      agencySlug: 'ecommerce',
      pageType: 'home',
      agencyId: 'ecommerce',
    })

    expect(mockCheckAgencyCostCap).toHaveBeenCalledWith('ecommerce')
    // checkAgencyCostCap called before fetch
    expect(mockCheckAgencyCostCap.mock.invocationCallOrder[0]).toBeLessThan(
      fetchSpy.mock.invocationCallOrder[0] ?? Infinity,
    )
    fetchSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// 3. Per-agency key resolution
// ---------------------------------------------------------------------------
describe('per-agency key resolution', () => {
  it('uses getAgencyLiteLLMKey when agencyId is provided', async () => {
    process.env['LITELLM_API_URL'] = 'http://localhost:4000'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse())

    await generateContent({
      prompt: 'Write content',
      agencySlug: 'ecommerce',
      pageType: 'home',
      agencyId: 'ecommerce',
    })

    expect(mockGetAgencyLiteLLMKey).toHaveBeenCalledWith('ecommerce')
    // Verify the request used the agency key from getAgencyLiteLLMKey
    const callArgs = fetchSpy.mock.calls[0]
    expect(callArgs).toBeDefined()
    const requestInit = callArgs?.[1] as RequestInit | undefined
    const headers = requestInit?.headers as Record<string, string> | undefined
    expect(headers?.['Authorization']).toBe('Bearer agency-test-key')
    fetchSpy.mockRestore()
  })

  it('uses global LITELLM_API_KEY when agencyId is not provided', async () => {
    process.env['LITELLM_API_URL'] = 'http://localhost:4000'
    process.env['LITELLM_API_KEY'] = 'global-key'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse())

    await generateContent({
      prompt: 'Write content',
      agencySlug: 'ecommerce',
      pageType: 'home',
    })

    const callArgs = fetchSpy.mock.calls[0]
    const requestInit = callArgs?.[1] as RequestInit | undefined
    const headers = requestInit?.headers as Record<string, string> | undefined
    expect(headers?.['Authorization']).toBe('Bearer global-key')
    expect(mockGetAgencyLiteLLMKey).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// 4. Model routing
// ---------------------------------------------------------------------------
describe('model routing', () => {
  it('uses claude-sonnet-4-6 when tier=tier2-writing', async () => {
    process.env['LITELLM_API_URL'] = 'http://localhost:4000'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockOkResponse('content', 'claude-sonnet-4-6'),
    )

    await generateContent({
      prompt: 'Write a blog',
      agencySlug: 'ecommerce',
      pageType: 'blog',
      agencyId: 'ecommerce',
      tier: 'tier2-writing',
    })

    const callArgs = fetchSpy.mock.calls[0]
    const requestInit = callArgs?.[1] as RequestInit | undefined
    const body = JSON.parse(requestInit?.body as string) as { model: string }
    expect(body.model).toBe('claude-sonnet-4-6')
    fetchSpy.mockRestore()
  })

  it('uses gemini-2.5-flash-lite by default (no tier specified)', async () => {
    process.env['LITELLM_API_URL'] = 'http://localhost:4000'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse())

    await generateContent({
      prompt: 'Write content',
      agencySlug: 'ecommerce',
      pageType: 'home',
    })

    const callArgs = fetchSpy.mock.calls[0]
    const requestInit = callArgs?.[1] as RequestInit | undefined
    const body = JSON.parse(requestInit?.body as string) as { model: string }
    expect(body.model).toBe('gemini-2.5-flash-lite')
    fetchSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// 5. recordAgencySpend called after success
// ---------------------------------------------------------------------------
describe('recordAgencySpend', () => {
  it('calls recordAgencySpend after successful LiteLLM response', async () => {
    process.env['LITELLM_API_URL'] = 'http://localhost:4000'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse())

    await generateContent({
      prompt: 'Write content',
      agencySlug: 'ecommerce',
      pageType: 'home',
      agencyId: 'ecommerce',
    })

    expect(mockRecordAgencySpend).toHaveBeenCalledWith('ecommerce', expect.any(Number))
    fetchSpy.mockRestore()
  })

  it('does not call recordAgencySpend when agencyId is not provided', async () => {
    process.env['LITELLM_API_URL'] = 'http://localhost:4000'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse())

    await generateContent({
      prompt: 'Write content',
      agencySlug: 'ecommerce',
      pageType: 'home',
    })

    expect(mockRecordAgencySpend).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// 6. Backward compatibility
// ---------------------------------------------------------------------------
describe('backward compatibility', () => {
  it('works without agencyId, tier, or systemPrompt (Phase 5/6 callers)', async () => {
    process.env['LITELLM_API_URL'] = 'http://localhost:4000'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse('Phase 5 content'))

    const result = await generateContent({
      prompt: 'Write a homepage',
      agencySlug: 'ecommerce',
      pageType: 'home',
    })

    expect(result.text).toBe('Phase 5 content')
    expect(result.isAiGenerated).toBe(true)
    expect(mockCheckAgencyCostCap).not.toHaveBeenCalled()
    expect(mockRecordAgencySpend).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('returns GenerateContentResult shape with all required fields', async () => {
    process.env['LITELLM_API_URL'] = 'http://localhost:4000'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse())

    const result = await generateContent({
      prompt: 'Write content',
      agencySlug: 'ecommerce',
      pageType: 'home',
    })

    expect(result).toHaveProperty('text')
    expect(result).toHaveProperty('aiContentRatio')
    expect(result).toHaveProperty('isAiGenerated', true)
    expect(result).toHaveProperty('model')
    fetchSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// 7. LiteLLM metadata tagging
// ---------------------------------------------------------------------------
describe('LiteLLM metadata tagging', () => {
  it('includes metadata.tags with agency:<id> when agencyId provided', async () => {
    process.env['LITELLM_API_URL'] = 'http://localhost:4000'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse())

    await generateContent({
      prompt: 'Write content',
      agencySlug: 'ecommerce',
      pageType: 'home',
      agencyId: 'ecommerce',
    })

    const callArgs = fetchSpy.mock.calls[0]
    const requestInit = callArgs?.[1] as RequestInit | undefined
    const body = JSON.parse(requestInit?.body as string) as { metadata?: { tags?: string[] } }
    expect(body.metadata?.tags).toContain('agency:ecommerce')
    fetchSpy.mockRestore()
  })

  it('does not include metadata when agencyId is not provided', async () => {
    process.env['LITELLM_API_URL'] = 'http://localhost:4000'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse())

    await generateContent({
      prompt: 'Write content',
      agencySlug: 'ecommerce',
      pageType: 'home',
    })

    const callArgs = fetchSpy.mock.calls[0]
    const requestInit = callArgs?.[1] as RequestInit | undefined
    const body = JSON.parse(requestInit?.body as string) as { metadata?: unknown }
    expect(body.metadata).toBeUndefined()
    fetchSpy.mockRestore()
  })
})
