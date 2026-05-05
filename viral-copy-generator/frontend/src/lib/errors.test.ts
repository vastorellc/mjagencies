import { describe, it, expect } from 'vitest'
import { parseAPIError, getErrorPayload, isRetryable } from './errors'

describe('parseAPIError', () => {
  it('parses structured backend error response', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username required',
          field: 'username',
          retryable: false,
          requestId: 'req_123',
        },
      }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    )

    const payload = await parseAPIError(mockResponse)
    expect(payload).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Username required',
      field: 'username',
      retryable: false,
      requestId: 'req_123',
    })
  })

  it('handles response without field/requestId', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'DATABASE_ERROR',
          message: 'Operation failed',
          retryable: true,
        },
      }),
      { status: 500 }
    )

    const payload = await parseAPIError(mockResponse)
    expect(payload.code).toBe('DATABASE_ERROR')
    expect(payload.message).toBe('Operation failed')
    expect(payload.field).toBeUndefined()
  })

  it('includes requestId in payload when present in error response', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'NETWORK_ERROR',
          message: 'Request timeout',
          retryable: true,
          requestId: 'req_from_body',
        },
      }),
      { status: 500 }
    )

    const payload = await parseAPIError(mockResponse)
    expect(payload.requestId).toBe('req_from_body')
  })

  it('falls back to safe defaults for unexpected JSON shape', async () => {
    const mockResponse = new Response(
      JSON.stringify({ unexpected: 'shape' }),
      { status: 500 }
    )

    const payload = await parseAPIError(mockResponse)
    expect(payload.code).toBe('UNKNOWN_ERROR')
    expect(payload.message).toBe('An error occurred')
    expect(payload.retryable).toBe(false)
  })

  it('handles non-JSON response (network error)', async () => {
    const mockResponse = new Response(
      'Internal Server Error',
      {
        status: 500,
        headers: { 'content-type': 'text/html' },
        statusText: 'Internal Server Error',
      }
    )

    const payload = await parseAPIError(mockResponse)
    expect(payload.code).toBe('NETWORK_ERROR')
    // statusText might be 'Internal Server Error' or 'Network error' depending on Response impl
    expect(payload.message).toBeTruthy()
    expect(payload.retryable).toBe(true)
  })

  it('handles empty response body', async () => {
    const mockResponse = new Response(
      '',
      { status: 500 }
    )

    const payload = await parseAPIError(mockResponse)
    expect(payload.code).toBe('NETWORK_ERROR')
    expect(payload.retryable).toBe(true)
  })
})

describe('getErrorPayload', () => {
  it('extracts structured payload from Error message', () => {
    const payload = {
      code: 'VALIDATION_ERROR',
      message: 'Username required',
      field: 'username',
      retryable: false,
    }
    const err = new Error(JSON.stringify(payload))

    const extracted = getErrorPayload(err)
    expect(extracted).toEqual(payload)
  })

  it('returns null for non-JSON error message', () => {
    const err = new Error('plain error message')
    const extracted = getErrorPayload(err)
    expect(extracted).toBeNull()
  })

  it('returns null if error is not an Error instance', () => {
    expect(getErrorPayload('string error')).toBeNull()
    expect(getErrorPayload(null)).toBeNull()
    expect(getErrorPayload(undefined)).toBeNull()
    expect(getErrorPayload({ message: 'obj' })).toBeNull()
  })

  it('validates payload shape before returning', () => {
    const invalidPayload = { code: 'TEST' } // missing 'message'
    const err = new Error(JSON.stringify(invalidPayload))

    const extracted = getErrorPayload(err)
    expect(extracted).toBeNull()
  })

  it('accepts payload with only code and message', () => {
    const minimalPayload = {
      code: 'CUSTOM_ERROR',
      message: 'Custom error occurred',
    }
    const err = new Error(JSON.stringify(minimalPayload))

    const extracted = getErrorPayload(err)
    expect(extracted).toEqual(minimalPayload)
  })
})

describe('isRetryable', () => {
  it('returns true when retryable is true', () => {
    const payload = {
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      retryable: true,
    }
    expect(isRetryable(payload)).toBe(true)
  })

  it('returns false when retryable is false', () => {
    const payload = {
      code: 'VALIDATION_ERROR',
      message: 'Bad input',
      retryable: false,
    }
    expect(isRetryable(payload)).toBe(false)
  })

  it('returns false when retryable is undefined', () => {
    const payload = {
      code: 'UNKNOWN_ERROR',
      message: 'Something failed',
      retryable: undefined,
    }
    expect(isRetryable(payload as any)).toBe(false)
  })
})

describe('Integration: Error roundtrip', () => {
  it('backend error → HTTP response → frontend parse → UI display', async () => {
    // Simulate backend sending an error response
    const backendError = {
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'Video is 500MB. Maximum is 260MB.',
        retryable: false,
        requestId: 'req_file_upload_001',
      },
    }

    const mockResponse = new Response(
      JSON.stringify(backendError),
      { status: 413 }
    )

    // Frontend parses the response
    const payload = await parseAPIError(mockResponse)

    // Verify payload is usable in UI
    expect(payload.code).toBe('FILE_TOO_LARGE')
    expect(payload.message).toBe('Video is 500MB. Maximum is 260MB.')
    expect(isRetryable(payload)).toBe(false)
    expect(payload.requestId).toBe('req_file_upload_001')
  })

  it('error thrown by API function → Error message → extracted payload', () => {
    // Simulate API function throwing structured error
    const errorPayload = {
      code: 'AI_PROVIDER_ERROR',
      message: 'OpenAI quota exceeded',
      retryable: true,
      requestId: 'req_ai_gen_123',
    }
    const thrownError = new Error(JSON.stringify(errorPayload))

    // Frontend catches and extracts
    const extracted = getErrorPayload(thrownError)

    // Verify payload is usable in error handler
    expect(extracted?.code).toBe('AI_PROVIDER_ERROR')
    expect(isRetryable(extracted!)).toBe(true)
  })
})
