# Error Codes Reference

Comprehensive error code catalog for the viral-copy-generator platform.

---

## Error Response Format

All API errors return a structured JSON response:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly error message",
    "field": "field_name",           // optional — for validation errors
    "retryable": false,              // boolean — whether to offer retry button
    "requestId": "req_abc123..."     // optional — for server-side tracing
  }
}
```

**HTTP Status Codes:**
- `4xx` — Client error (request malformed, invalid input, auth failure)
- `5xx` — Server error (DB, external API, processing failure)

**Retryable:** When `retryable: true`, the frontend displays a Retry button. Common causes: network timeout, temporary service unavailability, rate limits.

---

## Validation Errors (400)

| Code | Message | Field | Retryable | Example |
|------|---------|-------|-----------|---------|
| `VALIDATION_ERROR` | Input validation failed | ✓ varies | false | Missing required field, invalid niche |
| `UNSUPPORTED_FILE_TYPE` | Video file required. Supported formats: MP4, MOV, AVI, MKV | — | false | User uploads .txt or image file |
| `FILE_TOO_LARGE` | Video is XMB. Maximum is 260MB. | — | false | User uploads 500MB file |

**Throwing validation errors:**
```typescript
// In Express route (async, forward via next())
throw new ValidationError(
  'Username is required',
  'Empty username in request body',
  { field: 'username' }
)
```

**Frontend handling:**
```typescript
try {
  await uploadFile(videoFile)
} catch (err) {
  const payload = getErrorPayload(err)
  if (payload?.code === 'FILE_TOO_LARGE') {
    // Show specific message
    setError(payload)
  }
}
```

---

## Authentication Errors (401)

| Code | Message | Retryable | Cause |
|------|---------|-----------|-------|
| `UNAUTHORIZED` | Authentication required | true | Missing/expired Bearer token in header |
| `UNAUTHORIZED` | API key not configured. Add it in Settings. | false | User has no api_key_encrypted in DB |

**Routes affected:** All `/api/*` routes except `/health`, `/api/auth/**`

**Retryable = true:** Frontend can offer "Retry" button; user may have been logged out due to session timeout. New login triggers token refresh.

---

## Permission Errors (403)

| Code | Message | Retryable | Cause |
|------|---------|-----------|-------|
| `FORBIDDEN` | Access denied | false | User is authenticated but lacks required role (admin-only route) |
| `FORBIDDEN` | Cannot disable your own account | false | Admin attempting to ban themselves |

**Admin routes:** `/api/admin/**`

---

## Not Found (404)

| Code | Message | Retryable | Cause |
|------|---------|-----------|-------|
| `NOT_FOUND` | Resource not found | false | Post/job/user doesn't exist or belongs to different user (RLS) |
| `NOT_FOUND` | Route not found | false | Request path does not match any registered route |

---

## Conflict (409)

| Code | Message | Retryable | Cause |
|------|---------|-----------|-------|
| `CONFLICT` | Resource already exists | false | Unique constraint violation (e.g., duplicate OAuth token storage) |

---

## Rate Limiting (429)

| Code | Message | Retryable | Cause |
|------|---------|-----------|-------|
| `RATE_LIMITED` | Too many requests. Please wait before trying again. | true | External API rate limit hit (OpenAI, Google Trends, etc.) |

---

## Database Errors (500)

| Code | Message | Retryable | Cause |
|------|---------|-----------|-------|
| `DATABASE_ERROR` | Database operation failed | true | Postgres connection error, query execution failure |
| `DATABASE_ERROR` | Failed to load settings | true | SELECT from settings table failed |

**Server-side logging:** Full error details logged with requestId; user sees safe generic message.

---

## External API Errors (502)

| Code | Message | Retryable | Cause |
|------|---------|-----------|-------|
| `EXTERNAL_API_ERROR` | External service unavailable | true | Google Trends, Reddit, Spotify, etc. timeout/down |
| `AI_PROVIDER_ERROR` | API key rejected by Gemini. Update it in Settings. | false | Invalid/expired OpenAI key |
| `AI_PROVIDER_ERROR` | Gemini quota exceeded | true | API usage limit hit — temporary, resolved by waiting |
| `AI_PROVIDER_ERROR` | OpenAI service temporarily unavailable | true | Transient provider outage |

**AI provider errors in `/api/ai/generate`:**
```typescript
// Backend throws with specific message + retryable flag
if (err.code === 'invalid_api_key') {
  throw new AIProviderError(
    'API key rejected. Update it in Settings.',
    `OpenAI returned 401: invalid_api_key`,
    { retryable: false, field: 'api_key' }
  )
}
if (err.status === 429) {
  throw new AIProviderError(
    'Rate limited. Please try again in a few moments.',
    `OpenAI returned 429 — quota exceeded`,
    { retryable: true }
  )
}
```

**Frontend recovery:**
```typescript
try {
  await proxyAIGenerate(prompt)
} catch (err) {
  const payload = getErrorPayload(err)
  if (!payload?.retryable) {
    // Guide user to Settings
    showError('Invalid API key. Update it in Settings.')
  } else {
    // Offer retry
    showRetryButton()
  }
}
```

---

## Storage/Processing Errors (500/422)

| Code | Message | Retryable | Cause |
|------|---------|-----------|-------|
| `STORAGE_ERROR` | Failed to decrypt API key | false | Decryption algorithm mismatch (should never occur) |
| `VIDEO_PROCESSING_ERROR` | Video processing failed | false | ffmpeg.wasm initialization or analysis error |
| `FFMPEG_ERROR` | Video normalization failed | false | FFmpeg encoding/muxing failed |

---

## Queue Job Errors (500)

| Code | Message | Retryable | Cause |
|------|---------|-----------|-------|
| `QUEUE_JOB_ERROR` | Background job failed | true | pg-boss job execution error (upload, webhook, etc.) |

**Admin job retry:** `/api/admin/jobs/{id}/retry` uses this error code if the retry itself fails.

---

## Unknown/Internal Errors (500)

| Code | Message | Retryable | Cause |
|------|---------|-----------|-------|
| `INTERNAL_ERROR` | An unexpected error occurred | false | Unmapped error; something broke unexpectedly |

**Frontend:** Display generic message; encourage user to refresh page and try again.

---

## Usage in Frontend Pages

### GeneratorPage (AI Generation Error)
```typescript
const handleAIGenerate = async () => {
  try {
    const result = await proxyAIGenerate({ prompt: buildPrompt(signals) })
    setAIOutput(result.text)
  } catch (err) {
    const payload = getErrorPayload(err)
    setAIError(payload ?? { message: 'Generation failed. Please try again.' })
  }
}

// In JSX:
{aiError && (
  <ApiErrorDisplay
    error={aiError}
    onRetry={() => handleAIGenerate()}
    onDismiss={() => setAIError(null)}
  />
)}
```

### SettingsPage (OAuth Error)
```typescript
const handleConnect = async (provider: 'google' | 'meta') => {
  try {
    await initiateOAuth(provider)
  } catch (err) {
    const payload = getErrorPayload(err)
    setConnectError(payload?.message ?? 'Connection failed. Try again.')
  }
}
```

### HistoryPage (View Logging Error)
```typescript
const handleLogView = async (platformPostId: string, actualViews: number) => {
  try {
    const result = await logActualViews(platformPostId, actualViews)
    // Optimistically update UI
  } catch (err) {
    const payload = getErrorPayload(err)
    if (payload?.retryable) {
      showRetryButton()
    } else {
      showError(payload?.message ?? 'Failed to log views.')
    }
  }
}
```

### AdminPage (Disable User Error)
```typescript
const handleDisableUser = async (userId: string) => {
  try {
    await disableAdminUser(userId)
    // Refresh user list
  } catch (err) {
    const payload = getErrorPayload(err)
    // Special case: "Cannot disable your own account"
    if (payload?.message.includes('own account')) {
      setError({ message: 'You cannot disable your own account.', severe: true })
    } else {
      setError(payload?.message ?? 'Failed to disable user.')
    }
  }
}
```

---

## Tracing with Request IDs

Every error response includes an optional `requestId`. The backend logs every error with its `requestId` for server-side correlation.

**Frontend:** Display request ID in error UI (copyable) for user to share with support.

```typescript
// ApiErrorDisplay component shows request ID tail
{payload?.requestId && (
  <button onClick={() => navigator.clipboard.writeText(payload.requestId!)}>
    {payload.requestId.slice(0, 8)}…
  </button>
)}
```

**Server-side:** Pino logs include requestId in error entries:
```
[WARN] request error {
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "errorCode": "AI_PROVIDER_ERROR",
  "statusCode": 502,
  "developerMessage": "OpenAI returned 429: quota_exceeded"
}
```

Operator can search logs: `grep "550e8400" logfile` to trace full request lifecycle.

---

## Migration Path

**Old codebase:** Simple string errors like `'upload_failed'`, `res.status(400).json({ error: 'string' })`

**New codebase:** Structured `{ error: { code, message, retryable, requestId } }`

**Backward compat:** `parseAPIError()` handles both old and new shapes. Legacy code throwing `throw new Error('upload_failed')` still works; new code uses AppError subclasses.

---

## Testing Errors

**Unit tests (Vitest):**
```typescript
import { ValidationError, AIProviderError } from '../lib/errors'

it('throws ValidationError for missing prompt', async () => {
  await expect(proxyAIGenerate({ prompt: '' })).rejects.toThrow(ValidationError)
})

it('marks rate limit errors as retryable', () => {
  const err = new AIProviderError('Rate limited', 'OpenAI 429', { retryable: true })
  expect(err.retryable).toBe(true)
})
```

**Integration tests (supertest):**
```typescript
it('returns 400 VALIDATION_ERROR for invalid input', async () => {
  const res = await request(app).post('/api/ai/generate').send({ prompt: '' })
  expect(res.status).toBe(400)
  expect(res.body.error.code).toBe('VALIDATION_ERROR')
  expect(res.body.error.requestId).toBeDefined()
})

it('returns 502 AI_PROVIDER_ERROR with retryable for quota', async () => {
  mockOpenAI.create.mockRejectedValue({ status: 429 })
  const res = await request(app).post('/api/ai/generate').send({ prompt: 'test' })
  expect(res.status).toBe(502)
  expect(res.body.error.code).toBe('AI_PROVIDER_ERROR')
  expect(res.body.error.retryable).toBe(true)
})
```

---

## Debugging Checklist

- [ ] Check `error.requestId` in browser console for server logs
- [ ] Verify error response shape: `{ error: { code, message, retryable, requestId } }`
- [ ] Check if error is retryable — should correspond to transient failure (timeout, rate limit)
- [ ] For API key errors — guide user to Settings, never suggest "try again"
- [ ] For DB errors — suggest refresh page; if persists, contact support with requestId
- [ ] For file upload errors — validate file size/type before upload; show human-readable limits
