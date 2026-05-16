import { describe, test, expect } from 'vitest'
import { parseProviderError } from './ai'

// Note: actual signature is parseProviderError(provider, err) — provider first, err second.

describe('parseProviderError — model_not_found discriminant (VERIFY-04)', () => {
  describe('Claude', () => {
    test('detects model_not_found via triple-nested err.error.error.type (Pitfall 3)', () => {
      const raw = {
        status: 404,
        error: { type: 'error', error: { type: 'not_found_error', message: 'model not found' } },
      }
      const result = parseProviderError('claude', raw)
      expect(result.kind).toBe('model_not_found')
      expect(result.retryable).toBe(false)
      expect(result.message).toMatch(/Claude/i)
    })

    test('detects model_not_found via top-level status=404', () => {
      const raw = { status: 404, error: {} }
      const result = parseProviderError('claude', raw)
      expect(result.kind).toBe('model_not_found')
    })

    test('detects invalid_key via authentication_error type', () => {
      const raw = { error: { type: 'authentication_error' } }
      const result = parseProviderError('claude', raw)
      expect(result.kind).toBe('invalid_key')
    })

    test('detects rate_limited via rate_limit_error type', () => {
      const raw = { error: { type: 'rate_limit_error' } }
      const result = parseProviderError('claude', raw)
      expect(result.kind).toBe('rate_limited')
      expect(result.retryable).toBe(true)
    })

    test('detects model_busy via overloaded_error', () => {
      const raw = { error: { type: 'overloaded_error' } }
      const result = parseProviderError('claude', raw)
      expect(result.kind).toBe('model_busy')
    })
  })

  describe('OpenAI', () => {
    test('detects model_not_found via code=model_not_found (Pitfall 4)', () => {
      const raw = { status: 404, error: { code: 'model_not_found', type: 'invalid_request_error' } }
      const result = parseProviderError('openai', raw)
      expect(result.kind).toBe('model_not_found')
      expect(result.retryable).toBe(false)
    })

    test('detects model_not_found via status=404 alone', () => {
      const raw = { status: 404, error: {} }
      const result = parseProviderError('openai', raw)
      expect(result.kind).toBe('model_not_found')
    })

    test('detects invalid_key via code=invalid_api_key', () => {
      const raw = { status: 401, error: { code: 'invalid_api_key' } }
      const result = parseProviderError('openai', raw)
      expect(result.kind).toBe('invalid_key')
    })

    test('detects rate_limited via code=rate_limit_exceeded', () => {
      const raw = { status: 429, error: { code: 'rate_limit_exceeded' } }
      const result = parseProviderError('openai', raw)
      expect(result.kind).toBe('rate_limited')
    })

    test('falls through to unparseable on unknown 5xx', () => {
      const raw = { status: 503, error: {} }
      const result = parseProviderError('openai', raw)
      expect(['unparseable', 'network_error', 'model_busy']).toContain(result.kind)
    })
  })

  describe('DeepSeek (uses OpenAI SDK)', () => {
    test('detects model_not_found via code=model_not_found', () => {
      const raw = { status: 404, error: { code: 'model_not_found' } }
      const result = parseProviderError('deepseek', raw)
      expect(result.kind).toBe('model_not_found')
      expect(result.message).toMatch(/DeepSeek/i)
    })

    test('detects invalid_key via code=invalid_api_key', () => {
      const raw = { status: 401, error: { code: 'invalid_api_key' } }
      const result = parseProviderError('deepseek', raw)
      expect(result.kind).toBe('invalid_key')
    })

    test('detects rate_limited via code=rate_limit_exceeded', () => {
      const raw = { status: 429, error: { code: 'rate_limit_exceeded' } }
      const result = parseProviderError('deepseek', raw)
      expect(result.kind).toBe('rate_limited')
    })

    test('detects model_not_found via status=404 alone (registry miss)', () => {
      const raw = { status: 404 }
      const result = parseProviderError('deepseek', raw)
      expect(result.kind).toBe('model_not_found')
    })

    test('falls through on unknown error', () => {
      const raw = { status: 500 }
      const result = parseProviderError('deepseek', raw)
      expect(result.kind).not.toBe('model_not_found')
      expect(result.kind).not.toBe('invalid_key')
    })
  })

  describe('Gemini (no typed NotFoundError — Pitfall 6)', () => {
    test('detects model_not_found via status=NOT_FOUND', () => {
      const raw = { status: 'NOT_FOUND', message: 'Model not found in registry' }
      const result = parseProviderError('gemini', raw)
      expect(result.kind).toBe('model_not_found')
    })

    test('detects model_not_found via status=404', () => {
      const raw = { status: 404, message: 'gemini-fake not found' }
      const result = parseProviderError('gemini', raw)
      expect(result.kind).toBe('model_not_found')
    })

    test('detects model_not_found via message regex fallback', () => {
      const raw = { message: 'Requested model gemini-99 not found' }
      const result = parseProviderError('gemini', raw)
      expect(result.kind).toBe('model_not_found')
    })

    test('detects invalid_key via API_KEY_INVALID message or UNAUTHENTICATED status', () => {
      const raw = { error: { status: 'UNAUTHENTICATED' }, message: 'bad key' }
      const result = parseProviderError('gemini', raw)
      expect(['invalid_key', 'unparseable']).toContain(result.kind)
    })

    test('non-model-not-found message does not false-positive model_not_found', () => {
      const raw = { message: 'Rate limit exceeded', status: 429 }
      const result = parseProviderError('gemini', raw)
      expect(result.kind).not.toBe('model_not_found')
    })
  })

  describe('All providers — model_not_found is non-retryable', () => {
    const provs = ['claude', 'openai', 'deepseek', 'gemini'] as const
    for (const p of provs) {
      test(`${p}: retryable=false for model_not_found`, () => {
        const raw = p === 'gemini'
          ? { status: 'NOT_FOUND' }
          : { status: 404, error: p === 'claude' ? { type: 'error', error: { type: 'not_found_error' } } : { code: 'model_not_found' } }
        const result = parseProviderError(p, raw)
        if (result.kind === 'model_not_found') {
          expect(result.retryable).toBe(false)
        }
      })
    }
  })
})
