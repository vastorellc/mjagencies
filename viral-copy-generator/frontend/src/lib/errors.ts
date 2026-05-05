// Frontend error handling — parses backend error responses

export interface APIErrorPayload {
  code: string
  message: string
  field?: string
  retryable: boolean
  requestId?: string
}

/**
 * Parse any API response body into a structured error payload.
 * Handles both structured backend errors and legacy string-only errors.
 */
export async function parseAPIError(res: Response): Promise<APIErrorPayload> {
  try {
    const data = await res.json() as any

    // Structured backend error response
    if (data?.error) {
      return {
        code: data.error.code ?? 'UNKNOWN_ERROR',
        message: data.error.message ?? 'An error occurred',
        field: data.error.field,
        retryable: data.error.retryable ?? false,
        requestId: data.error.requestId,
      }
    }

    // Fallback for unexpected JSON shape
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An error occurred',
      retryable: false,
      requestId: res.headers.get('x-request-id') ?? undefined,
    }
  } catch {
    // Non-JSON response (network error, timeout, etc.)
    return {
      code: 'NETWORK_ERROR',
      message: res.statusText || 'Network error',
      retryable: true,
      requestId: res.headers.get('x-request-id') ?? undefined,
    }
  }
}

/**
 * Extract structured error payload from a thrown error.
 * Returns null if the error is not a structured API error.
 */
export function getErrorPayload(err: unknown): APIErrorPayload | null {
  if (err instanceof Error) {
    try {
      const payload = JSON.parse(err.message) as APIErrorPayload
      if (payload.code && payload.message !== undefined) {
        return payload
      }
    } catch {
      // Not JSON, not a structured error
    }
  }
  return null
}

/**
 * Check if an error is retryable based on error code and response.
 */
export function isRetryable(err: APIErrorPayload): boolean {
  return err.retryable === true
}
