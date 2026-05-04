// Core error system — typed, structured error handling across all routes

export interface ErrorOptions {
  field?: string
  source?: string
  retryable?: boolean
  original?: unknown
}

export interface ErrorResponse {
  error: {
    code: string
    message: string
    field?: string
    retryable: boolean
    requestId?: string
  }
}

// ============================================================================
// Base Error Class
// ============================================================================

export class AppError extends Error {
  readonly statusCode: number
  readonly errorCode: string
  readonly userMessage: string
  readonly developerMessage: string
  readonly field?: string
  readonly source?: string
  readonly retryable: boolean
  readonly original?: unknown

  constructor(
    statusCode: number,
    errorCode: string,
    userMessage: string,
    developerMessage: string,
    options?: ErrorOptions
  ) {
    super(developerMessage)
    Object.setPrototypeOf(this, AppError.prototype)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.errorCode = errorCode
    this.userMessage = userMessage
    this.developerMessage = developerMessage
    this.field = options?.field
    this.source = options?.source
    this.retryable = options?.retryable ?? false
    this.original = options?.original
  }
}

// ============================================================================
// HTTP 4xx Errors
// ============================================================================

export class ValidationError extends AppError {
  constructor(message: string, developerMessage?: string, options?: ErrorOptions) {
    super(400, 'VALIDATION_ERROR', message, developerMessage ?? message, options)
    Object.setPrototypeOf(this, ValidationError.prototype)
    this.name = 'ValidationError'
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Authentication required', developerMessage?: string, options?: ErrorOptions) {
    super(401, 'UNAUTHORIZED', message, developerMessage ?? message, options)
    Object.setPrototypeOf(this, AuthError.prototype)
    this.name = 'AuthError'
    this.retryable = true
  }
}

export class PermissionError extends AppError {
  constructor(message: string = 'Access denied', developerMessage?: string, options?: ErrorOptions) {
    super(403, 'FORBIDDEN', message, developerMessage ?? message, options)
    Object.setPrototypeOf(this, PermissionError.prototype)
    this.name = 'PermissionError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', developerMessage?: string, options?: ErrorOptions) {
    super(404, 'NOT_FOUND', message, developerMessage ?? message, options)
    Object.setPrototypeOf(this, NotFoundError.prototype)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists', developerMessage?: string, options?: ErrorOptions) {
    super(409, 'CONFLICT', message, developerMessage ?? message, options)
    Object.setPrototypeOf(this, ConflictError.prototype)
    this.name = 'ConflictError'
  }
}

// ============================================================================
// File Upload Errors (400/413)
// ============================================================================

export class FileUploadError extends AppError {
  constructor(message: string, developerMessage?: string, options?: ErrorOptions) {
    super(400, 'FILE_UPLOAD_ERROR', message, developerMessage ?? message, options)
    Object.setPrototypeOf(this, FileUploadError.prototype)
    this.name = 'FileUploadError'
  }
}

export class FileTypeError extends AppError {
  constructor(message: string, developerMessage?: string, options?: ErrorOptions) {
    super(400, 'UNSUPPORTED_FILE_TYPE', message, developerMessage ?? message, options)
    Object.setPrototypeOf(this, FileTypeError.prototype)
    this.name = 'FileTypeError'
  }
}

export class FileSizeError extends AppError {
  constructor(message: string, developerMessage?: string, options?: ErrorOptions) {
    super(413, 'FILE_TOO_LARGE', message, developerMessage ?? message, options)
    Object.setPrototypeOf(this, FileSizeError.prototype)
    this.name = 'FileSizeError'
  }
}

// ============================================================================
// HTTP 429 Rate Limit
// ============================================================================

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests. Please wait before trying again.', developerMessage?: string, options?: ErrorOptions) {
    super(429, 'RATE_LIMITED', message, developerMessage ?? message, { ...options, retryable: true })
    Object.setPrototypeOf(this, RateLimitError.prototype)
    this.name = 'RateLimitError'
  }
}

// ============================================================================
// HTTP 5xx Errors
// ============================================================================

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', developerMessage?: string, options?: ErrorOptions) {
    super(500, 'DATABASE_ERROR', message, developerMessage ?? message, { ...options, retryable: true })
    Object.setPrototypeOf(this, DatabaseError.prototype)
    this.name = 'DatabaseError'
  }
}

export class StorageError extends AppError {
  constructor(message: string = 'Storage operation failed', developerMessage?: string, options?: ErrorOptions) {
    super(500, 'STORAGE_ERROR', message, developerMessage ?? message, options)
    Object.setPrototypeOf(this, StorageError.prototype)
    this.name = 'StorageError'
  }
}

export class ExternalApiError extends AppError {
  constructor(message: string = 'External service unavailable', developerMessage?: string, options?: ErrorOptions) {
    super(502, 'EXTERNAL_API_ERROR', message, developerMessage ?? message, { ...options, retryable: true })
    Object.setPrototypeOf(this, ExternalApiError.prototype)
    this.name = 'ExternalApiError'
  }
}

export class AIProviderError extends AppError {
  constructor(message: string, developerMessage?: string, options?: ErrorOptions) {
    super(502, 'AI_PROVIDER_ERROR', message, developerMessage ?? message, options)
    Object.setPrototypeOf(this, AIProviderError.prototype)
    this.name = 'AIProviderError'
  }
}

export class VideoProcessingError extends AppError {
  constructor(message: string = 'Video processing failed', developerMessage?: string, options?: ErrorOptions) {
    super(422, 'VIDEO_PROCESSING_ERROR', message, developerMessage ?? message, options)
    Object.setPrototypeOf(this, VideoProcessingError.prototype)
    this.name = 'VideoProcessingError'
  }
}

export class FFmpegError extends AppError {
  constructor(message: string = 'Video normalization failed', developerMessage?: string, options?: ErrorOptions) {
    super(422, 'FFMPEG_ERROR', message, developerMessage ?? message, options)
    Object.setPrototypeOf(this, FFmpegError.prototype)
    this.name = 'FFmpegError'
  }
}

export class QueueJobError extends AppError {
  constructor(message: string = 'Background job failed', developerMessage?: string, options?: ErrorOptions) {
    super(500, 'QUEUE_JOB_ERROR', message, developerMessage ?? message, { ...options, retryable: true })
    Object.setPrototypeOf(this, QueueJobError.prototype)
    this.name = 'QueueJobError'
  }
}

export class UnknownSystemError extends AppError {
  constructor(message: string = 'An unexpected error occurred', developerMessage?: string, options?: ErrorOptions) {
    super(500, 'INTERNAL_ERROR', message, developerMessage ?? message, options)
    Object.setPrototypeOf(this, UnknownSystemError.prototype)
    this.name = 'UnknownSystemError'
  }
}

// ============================================================================
// Type Guards and Serializers
// ============================================================================

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}

export function toErrorResponse(err: unknown, requestId?: string): ErrorResponse {
  if (isAppError(err)) {
    return {
      error: {
        code: err.errorCode,
        message: err.userMessage,
        field: err.field,
        retryable: err.retryable,
        requestId,
      },
    }
  }

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      retryable: false,
      requestId,
    },
  }
}
