import { describe, it, expect } from 'vitest'
import {
  AppError, ValidationError, AuthError, PermissionError, NotFoundError, ConflictError,
  FileTypeError, FileSizeError, RateLimitError, DatabaseError, StorageError,
  ExternalApiError, AIProviderError, VideoProcessingError, FFmpegError,
  QueueJobError, UnknownSystemError, isAppError, toErrorResponse,
} from './errors'

describe('Error Classes', () => {
  it('ValidationError: 400 VALIDATION_ERROR', () => {
    const err = new ValidationError('Username required', 'empty username field')
    expect(err.statusCode).toBe(400)
    expect(err.errorCode).toBe('VALIDATION_ERROR')
    expect(err.userMessage).toBe('Username required')
    expect(err.developerMessage).toBe('empty username field')
    expect(err.retryable).toBe(false)
  })

  it('AuthError: 401 UNAUTHORIZED with retryable=true', () => {
    const err = new AuthError('Please log in')
    expect(err.statusCode).toBe(401)
    expect(err.errorCode).toBe('UNAUTHORIZED')
    expect(err.retryable).toBe(true)
  })

  it('PermissionError: 403 FORBIDDEN', () => {
    const err = new PermissionError('Admin only')
    expect(err.statusCode).toBe(403)
    expect(err.errorCode).toBe('FORBIDDEN')
    expect(err.retryable).toBe(false)
  })

  it('NotFoundError: 404 NOT_FOUND', () => {
    const err = new NotFoundError('Post not found')
    expect(err.statusCode).toBe(404)
    expect(err.errorCode).toBe('NOT_FOUND')
  })

  it('ConflictError: 409 CONFLICT', () => {
    const err = new ConflictError('Email already registered')
    expect(err.statusCode).toBe(409)
    expect(err.errorCode).toBe('CONFLICT')
  })

  it('FileTypeError: 400 UNSUPPORTED_FILE_TYPE', () => {
    const err = new FileTypeError('Video file required')
    expect(err.statusCode).toBe(400)
    expect(err.errorCode).toBe('UNSUPPORTED_FILE_TYPE')
  })

  it('FileSizeError: 413 FILE_TOO_LARGE', () => {
    const err = new FileSizeError('Video is 500MB. Maximum is 260MB.')
    expect(err.statusCode).toBe(413)
    expect(err.errorCode).toBe('FILE_TOO_LARGE')
  })

  it('RateLimitError: 429 RATE_LIMITED with retryable=true', () => {
    const err = new RateLimitError()
    expect(err.statusCode).toBe(429)
    expect(err.errorCode).toBe('RATE_LIMITED')
    expect(err.retryable).toBe(true)
  })

  it('DatabaseError: 500 DATABASE_ERROR with retryable=true', () => {
    const err = new DatabaseError('DB failed', 'connection timeout')
    expect(err.statusCode).toBe(500)
    expect(err.errorCode).toBe('DATABASE_ERROR')
    expect(err.retryable).toBe(true)
  })

  it('StorageError: 500 STORAGE_ERROR', () => {
    const err = new StorageError('Encryption failed')
    expect(err.statusCode).toBe(500)
    expect(err.errorCode).toBe('STORAGE_ERROR')
    expect(err.retryable).toBe(false)
  })

  it('ExternalApiError: 502 EXTERNAL_API_ERROR with retryable=true', () => {
    const err = new ExternalApiError('Google Trends timeout')
    expect(err.statusCode).toBe(502)
    expect(err.errorCode).toBe('EXTERNAL_API_ERROR')
    expect(err.retryable).toBe(true)
  })

  it('AIProviderError: 502 AI_PROVIDER_ERROR', () => {
    const err = new AIProviderError('OpenAI key invalid')
    expect(err.statusCode).toBe(502)
    expect(err.errorCode).toBe('AI_PROVIDER_ERROR')
  })

  it('VideoProcessingError: 422 VIDEO_PROCESSING_ERROR', () => {
    const err = new VideoProcessingError('Analysis failed')
    expect(err.statusCode).toBe(422)
    expect(err.errorCode).toBe('VIDEO_PROCESSING_ERROR')
  })

  it('FFmpegError: 422 FFMPEG_ERROR', () => {
    const err = new FFmpegError()
    expect(err.statusCode).toBe(422)
    expect(err.errorCode).toBe('FFMPEG_ERROR')
  })

  it('QueueJobError: 500 QUEUE_JOB_ERROR with retryable=true', () => {
    const err = new QueueJobError('Job failed')
    expect(err.statusCode).toBe(500)
    expect(err.errorCode).toBe('QUEUE_JOB_ERROR')
    expect(err.retryable).toBe(true)
  })

  it('UnknownSystemError: 500 INTERNAL_ERROR', () => {
    const err = new UnknownSystemError()
    expect(err.statusCode).toBe(500)
    expect(err.errorCode).toBe('INTERNAL_ERROR')
  })
})

describe('Error Options', () => {
  it('stores field in ValidationError', () => {
    const err = new ValidationError('Bad input', 'invalid format', { field: 'username' })
    expect(err.field).toBe('username')
  })

  it('stores original error for debugging', () => {
    const cause = new Error('Postgres connection failed')
    const err = new DatabaseError('DB failed', 'connection error', { original: cause })
    expect(err.original).toBe(cause)
  })

  it('respects retryable override in options', () => {
    const err = new ValidationError('Something', 'dev message', { retryable: true })
    expect(err.retryable).toBe(true)
  })
})

describe('isAppError type guard', () => {
  it('returns true for AppError subclasses', () => {
    const err = new ValidationError('test')
    expect(isAppError(err)).toBe(true)
  })

  it('returns false for plain Error', () => {
    const err = new Error('plain error')
    expect(isAppError(err)).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(isAppError(null)).toBe(false)
    expect(isAppError(undefined)).toBe(false)
  })

  it('returns false for random objects', () => {
    expect(isAppError({ statusCode: 400 })).toBe(false)
  })
})

describe('toErrorResponse serializer', () => {
  it('serializes AppError to error response shape', () => {
    const err = new ValidationError('Bad username', 'empty field', {
      field: 'username',
    })
    const response = toErrorResponse(err, 'req_123')

    expect(response).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Bad username',
        field: 'username',
        retryable: false,
        requestId: 'req_123',
      },
    })
  })

  it('never includes original error in serialized output', () => {
    const cause = new Error('Internal DB error details')
    const err = new DatabaseError('Failed', 'connection issue', { original: cause })
    const response = toErrorResponse(err, 'req_456')

    expect(response.error).not.toHaveProperty('original')
    expect(JSON.stringify(response)).not.toContain('Internal DB error details')
  })

  it('omits optional fields when not set', () => {
    const err = new NotFoundError('Not found')
    const response = toErrorResponse(err)

    expect(response.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Not found',
      retryable: false,
    })
    expect(response.error).not.toHaveProperty('field')
    expect(response.error).not.toHaveProperty('requestId')
  })

  it('handles non-AppError inputs gracefully', () => {
    const plainErr = new Error('Something broke')
    const response = toErrorResponse(plainErr, 'req_789')

    expect(response).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        retryable: false,
        requestId: 'req_789',
      },
    })
  })
})
