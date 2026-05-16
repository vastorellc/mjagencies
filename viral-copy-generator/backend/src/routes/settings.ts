import { Router, type Request, type Response } from 'express'
import { eq, sql } from 'drizzle-orm'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { db } from '../db/index.js'
import { settings, type PlatformConfig } from '../db/schema.js'
import { encrypt, decrypt, maskKey } from '../lib/encryption.js'
import { ValidationError, DatabaseError, StorageError } from '../lib/errors.js'
import { MODELS, defaultModelFor, type ModelCapabilities, type AIProvider } from '../lib/models.js'

export const settingsRouter = Router()

const VALID_PROVIDERS = ['claude', 'gemini', 'openai', 'deepseek'] as const
type Provider = (typeof VALID_PROVIDERS)[number]
const VALID_PLATFORMS = ['youtube', 'instagram', 'tiktok', 'facebook', 'x'] as const
const DEFAULT_NICHES = ['travel', 'hotels', 'cars', 'bikes', 'coding', 'lifestyle', 'food', 'other']

interface SettingsResponse {
  ai_provider: Provider
  api_key_masked: string | null
  default_niche: string
  enabled_platforms: string[]
  available_niches: string[]
  connected: { youtube: boolean; instagram: boolean; facebook: boolean }
  // SETTINGS-10: server timezone is fixed to PKT
  timezone: 'Asia/Karachi'
}

settingsRouter.get('/', async (_req: Request, res: Response) => {
  const userId = res.locals.userId as string
  let rows: Array<typeof settings.$inferSelect>
  try {
    rows = await db.select().from(settings).where(eq(settings.user_id, userId)).limit(1)
  } catch (err) {
    throw new DatabaseError(
      'Failed to load settings',
      `Could not fetch user settings: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }

  if (rows.length === 0) {
    const fallback: SettingsResponse = {
      ai_provider: 'gemini',
      api_key_masked: null,
      default_niche: 'travel',
      enabled_platforms: ['youtube', 'instagram', 'facebook'],
      available_niches: DEFAULT_NICHES,
      connected: { youtube: false, instagram: false, facebook: false },
      timezone: 'Asia/Karachi',
    }
    res.json(fallback)
    return
  }
  const row = rows[0]
  const cfg = (row.platform_config ?? {}) as PlatformConfig
  let masked: string | null = null
  if (row.api_key_encrypted) {
    try {
      masked = maskKey(decrypt(row.api_key_encrypted))
    } catch {
      // Corrupt or wrong-key ciphertext — surface as null rather than 500
      masked = null
    }
  }
  const body: SettingsResponse = {
    ai_provider: row.ai_provider as Provider,
    api_key_masked: masked,
    default_niche: row.default_niche,
    enabled_platforms: row.enabled_platforms,
    available_niches: row.available_niches ?? DEFAULT_NICHES,
    connected: {
      youtube: !!cfg.youtube,
      instagram: !!cfg.instagram,
      facebook: !!cfg.facebook,
    },
    timezone: 'Asia/Karachi',
  }
  res.json(body)
})

interface PatchBody {
  ai_provider?: string
  api_key?: string
  default_niche?: string
  enabled_platforms?: string[]
  available_niches?: string[]
}

settingsRouter.patch('/', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const body = req.body as PatchBody

  if (body.ai_provider !== undefined && !VALID_PROVIDERS.includes(body.ai_provider as Provider)) {
    throw new ValidationError(
      `Unknown AI provider "${body.ai_provider}"`,
      `ai_provider not in [${VALID_PROVIDERS.join(', ')}]`,
      { field: 'ai_provider' }
    )
  }
  if (body.enabled_platforms !== undefined) {
    if (
      !Array.isArray(body.enabled_platforms) ||
      body.enabled_platforms.some(
        (p) => !VALID_PLATFORMS.includes(p as (typeof VALID_PLATFORMS)[number]),
      )
    ) {
      throw new ValidationError(
        `Invalid platform selection`,
        `enabled_platforms contains invalid values. Valid: [${VALID_PLATFORMS.join(', ')}]`,
        { field: 'enabled_platforms' }
      )
    }
  }
  if (body.available_niches !== undefined) {
    if (!Array.isArray(body.available_niches)) {
      throw new ValidationError(
        'available_niches must be an array',
        `available_niches is ${typeof body.available_niches}, expected array`,
        { field: 'available_niches' }
      )
    }
    if (body.available_niches.length === 0 || body.available_niches.length > 50) {
      throw new ValidationError(
        'available_niches must contain 1-50 items',
        `length=${body.available_niches.length}`,
        { field: 'available_niches' }
      )
    }
    const seen = new Set<string>()
    for (const niche of body.available_niches) {
      if (typeof niche !== 'string') {
        throw new ValidationError(
          'Each niche must be a string',
          `niche is ${typeof niche}`,
          { field: 'available_niches' }
        )
      }
      const trimmed = niche.trim().toLowerCase()
      if (trimmed.length === 0 || trimmed.length > 50) {
        throw new ValidationError(
          'Each niche must be 1-50 characters (trimmed)',
          `niche "${niche}" → trimmed length=${trimmed.length}`,
          { field: 'available_niches' }
        )
      }
      if (seen.has(trimmed)) {
        throw new ValidationError(
          'Duplicate niche found',
          `niche "${trimmed}" appears multiple times`,
          { field: 'available_niches' }
        )
      }
      seen.add(trimmed)
    }
  }
  if (body.default_niche !== undefined) {
    if (typeof body.default_niche !== 'string' || body.default_niche.trim().length === 0) {
      throw new ValidationError(
        'default_niche must be a non-empty string',
        `default_niche is "${body.default_niche}"`,
        { field: 'default_niche' }
      )
    }
  }
  if (body.api_key !== undefined) {
    if (typeof body.api_key !== 'string' || body.api_key.length === 0 || body.api_key.length > 200) {
      throw new ValidationError(
        'API key must be 1-200 characters',
        `api_key length=${body.api_key?.length || 0}, must be 1-200`,
        { field: 'api_key' }
      )
    }
  }

  // Build the patch object — only include keys the caller sent
  const update: Record<string, unknown> = { updated_at: sql`NOW()` }
  if (body.ai_provider !== undefined) update.ai_provider = body.ai_provider
  if (body.default_niche !== undefined) update.default_niche = body.default_niche.trim()
  if (body.enabled_platforms !== undefined) update.enabled_platforms = body.enabled_platforms
  if (body.available_niches !== undefined) {
    update.available_niches = body.available_niches.map(n => n.trim().toLowerCase())
  }
  if (body.api_key !== undefined) {
    try {
      update.api_key_encrypted = encrypt(body.api_key.trim())
    } catch (err) {
      throw new StorageError(
        'Failed to encrypt API key',
        `Encryption error: ${err instanceof Error ? err.message : String(err)}`,
        { original: err }
      )
    }
  }

  // UPSERT keyed on user_id (UNIQUE in schema). On first save, INSERT defaults for unspecified columns.
  try {
    await db
      .insert(settings)
      .values({
        user_id: userId,
        ai_provider: (body.ai_provider as Provider) ?? 'gemini',
        api_key_encrypted: body.api_key ? encrypt(body.api_key.trim()) : null,
        default_niche: body.default_niche?.trim() ?? 'travel',
        enabled_platforms: body.enabled_platforms ?? ['youtube', 'instagram', 'facebook'],
        available_niches: body.available_niches?.map(n => n.trim().toLowerCase()) ?? DEFAULT_NICHES,
      })
      .onConflictDoUpdate({ target: settings.user_id, set: update })
  } catch (err) {
    throw new DatabaseError(
      'Failed to update settings',
      `Database error: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }

  // Return masked + summary
  let refreshed: Array<typeof settings.$inferSelect>
  try {
    refreshed = await db.select().from(settings).where(eq(settings.user_id, userId)).limit(1)
  } catch (err) {
    throw new DatabaseError(
      'Settings updated but failed to refresh',
      `Could not fetch updated settings: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }

  const row = refreshed[0]
  let masked: string | null = null
  if (row?.api_key_encrypted) {
    try {
      masked = maskKey(decrypt(row.api_key_encrypted))
    } catch {
      masked = null
    }
  }

  res.json({
    ok: true,
    api_key_masked: masked,
    ai_provider: row?.ai_provider,
    default_niche: row?.default_niche,
    enabled_platforms: row?.enabled_platforms,
    available_niches: row?.available_niches ?? DEFAULT_NICHES,
  })
})

// GET /settings/key — returns decrypted API key to the authenticated owner ONLY.
// CLAUDE.md: key returned via dedicated endpoint, never embedded in general GET /settings.
// Frontend calls this only immediately before callAI() — key stays in function scope.
settingsRouter.get('/key', async (_req: Request, res: Response) => {
  const userId = res.locals.userId as string
  let rows: Array<{ api_key_encrypted: string | null }>
  try {
    rows = await db
      .select({ api_key_encrypted: settings.api_key_encrypted })
      .from(settings)
      .where(eq(settings.user_id, userId))
      .limit(1)
  } catch (err) {
    throw new DatabaseError(
      'Failed to load API key',
      `Could not fetch user settings: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }

  if (!rows[0]?.api_key_encrypted) {
    res.json({ api_key: null })
    return
  }

  let api_key: string | null = null
  try {
    api_key = decrypt(rows[0].api_key_encrypted)
  } catch (err) {
    throw new StorageError(
      'Failed to decrypt API key',
      `Decryption error: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }

  // T-5-01: key returned to authenticated owner only — never logged, never in general GET
  res.json({ api_key })
})

// SETTINGS-09: Disconnect a platform — JSONB merge patch sets the named key to null
// without disturbing other platforms.
settingsRouter.delete('/connections/:platform', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const platform: string = req.params['platform'] as string
  if (!['youtube', 'instagram', 'facebook'].includes(platform)) {
    throw new ValidationError(
      `Unknown platform "${platform}"`,
      `platform not in [youtube, instagram, facebook]`,
      { field: 'platform' }
    )
  }
  const patch: Record<string, null> = { [platform]: null }
  try {
    await db.transaction(async (tx) => {
      // Lock the row to prevent concurrent JSONB writes (research Pitfall 3)
      await tx.execute(sql`SELECT id FROM settings WHERE user_id = ${userId} FOR UPDATE`)
      await tx
        .update(settings)
        .set({
          platform_config: sql`COALESCE(${settings.platform_config}, '{}')::jsonb || ${JSON.stringify(patch)}::jsonb`,
          updated_at: sql`NOW()`,
        })
        .where(eq(settings.user_id, userId))
    })
  } catch (err) {
    throw new DatabaseError(
      'Failed to disconnect platform',
      `Database error: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }
  res.json({ ok: true })
})

// Helper to extract clean error message from provider-specific errors
function extractErrorMessage(err: unknown, provider: string): string {
  const errStr = String(err)
  const errMsg = err instanceof Error ? err.message : errStr

  // Google Gemini errors
  if (provider === 'gemini') {
    if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid')) {
      return 'Invalid API key'
    }
    if (errMsg.includes('UNAUTHENTICATED')) {
      return 'Invalid API key'
    }
    if (errMsg.includes('QUOTA') || errMsg.includes('Resource has been exhausted')) {
      return 'Quota exceeded — add credits to your account'
    }
    if (errMsg.includes('RESOURCE_EXHAUSTED')) {
      return 'Rate limited — key is valid but account is rate-limited'
    }
    if (errMsg.includes('PERMISSION_DENIED')) {
      return 'API key does not have permission for this model'
    }
  }

  // Anthropic Claude errors
  if (provider === 'claude') {
    if (errMsg.includes('invalid_api_key') || errMsg.includes('401')) {
      return 'Invalid API key'
    }
    if (errMsg.includes('rate_limit')) {
      return 'Rate limited — key is valid but account is rate-limited'
    }
    if (errMsg.includes('overloaded')) {
      return 'API temporarily overloaded — try again in a moment'
    }
  }

  // OpenAI / DeepSeek errors (already handled in catch block, but fallback here)
  if (provider === 'openai' || provider === 'deepseek') {
    if (errMsg.includes('invalid_api_key') || errMsg.includes('401')) {
      return 'Invalid API key'
    }
    if (errMsg.includes('rate_limit') || errMsg.includes('429')) {
      return 'Rate limited — key is valid but account is rate-limited'
    }
    if (errMsg.includes('insufficient_quota') || errMsg.includes('quota_exceeded')) {
      return 'Quota exceeded — add credits to your account'
    }
  }

  // Fallback: don't expose raw error
  return 'API validation failed — please check your key and try again'
}

// POST /settings/validate-key — Verify API key AND model ID with the provider.
// Body: { provider: AIProvider, api_key: string, model_id?: string }
// Response: ValidateKeyResponse (key_valid, model_valid, capabilities, error_kind)
// Back-compat: 'error' field retained for existing SettingsPage.tsx caller (line 95)
interface ValidateKeyBody {
  provider: AIProvider
  api_key: string
  model_id?: string  // Phase 11 VERIFY-03 — optional; defaults to defaultModelFor(provider)
}

interface ValidateKeyResponse {
  valid: boolean
  key_valid: boolean
  model_valid: boolean
  error_kind: 'invalid_key' | 'model_not_found' | 'rate_limited' | 'service_unavailable' | 'network_error' | null
  error_message?: string
  error?: string  // back-compat alias of error_message for existing frontend caller
  capabilities?: ModelCapabilities
  model_id: string
}

settingsRouter.post('/validate-key', async (req: Request, res: Response) => {
  const body = req.body as Partial<ValidateKeyBody>
  const provider = body.provider
  const apiKey = body.api_key?.trim() ?? ''
  const modelIdInput = body.model_id?.trim()

  // Whitelist provider (T-11-14)
  if (provider !== 'openai' && provider !== 'deepseek' && provider !== 'claude' && provider !== 'gemini') {
    return res.status(400).json({
      valid: false, key_valid: false, model_valid: false,
      error_kind: null, error: 'unknown provider', error_message: 'unknown provider',
      model_id: '',
    } satisfies ValidateKeyResponse)
  }

  if (!apiKey) {
    return res.status(400).json({
      valid: false, key_valid: false, model_valid: false,
      error_kind: 'invalid_key', error: 'api_key required', error_message: 'api_key required',
      model_id: modelIdInput ?? '',
    } satisfies ValidateKeyResponse)
  }

  // Resolve model_id (default if omitted) and validate against MODELS whitelist (T-11-02)
  const modelId = modelIdInput ?? defaultModelFor(provider)
  if (!MODELS[modelId]) {
    return res.status(400).json({
      valid: false, key_valid: false, model_valid: false,
      error_kind: 'model_not_found',
      error: `unknown model_id: ${modelId}`,
      error_message: `Model ID not in registry. Pick one of: ${Object.keys(MODELS).join(', ')}`,
      model_id: modelId,
    } satisfies ValidateKeyResponse)
  }

  const capabilities: ModelCapabilities = MODELS[modelId].capabilities

  try {
    if (provider === 'openai' || provider === 'deepseek') {
      const client = new OpenAI({
        apiKey,
        ...(provider === 'deepseek' && { baseURL: 'https://api.deepseek.com' }),
      })
      await client.models.retrieve(modelId)
    } else if (provider === 'claude') {
      const client = new Anthropic({ apiKey })
      await client.models.retrieve(modelId)
    } else {
      // gemini — use @google/genai (Pitfall 5: not @google/generative-ai)
      const client = new GoogleGenAI({ apiKey })
      await client.models.get({ model: modelId })
    }

    return res.json({
      valid: true, key_valid: true, model_valid: true,
      error_kind: null,
      capabilities, model_id: modelId,
    } satisfies ValidateKeyResponse)
  } catch (err) {
    // Discriminate per-provider — see RESEARCH Pitfalls 3/4/6
    const status = (err as { status?: number | string }).status
    const code = (err as { code?: string }).code
    const message = ((err as { message?: string }).message ?? '').slice(0, 500)

    let error_kind: 'invalid_key' | 'model_not_found' | 'rate_limited' | 'service_unavailable' | 'network_error' = 'network_error'
    let key_valid = false
    let model_valid = false

    if (provider === 'claude') {
      // Pitfall 3: Anthropic triple-nesting — err.error.error.type, not err.error.type
      const errBody = (err as { error?: { error?: { type?: string } } }).error
      const nestedType = errBody?.error?.type
      if (status === 401 || nestedType === 'authentication_error') {
        error_kind = 'invalid_key'
      } else if (status === 404 || nestedType === 'not_found_error') {
        error_kind = 'model_not_found'
        key_valid = true  // 404 means key authenticated; model is the issue
      } else if (status === 429) {
        error_kind = 'rate_limited'; key_valid = true; model_valid = true
      } else if (typeof status === 'number' && status >= 500) {
        error_kind = 'service_unavailable'
      }
    } else if (provider === 'openai' || provider === 'deepseek') {
      // Pitfall 4: key on code === 'model_not_found', NOT on type
      if (status === 401 || code === 'invalid_api_key') {
        error_kind = 'invalid_key'
      } else if (status === 404 || code === 'model_not_found') {
        error_kind = 'model_not_found'; key_valid = true
      } else if (status === 429) {
        error_kind = 'rate_limited'; key_valid = true; model_valid = true
      } else if (typeof status === 'number' && status >= 500) {
        error_kind = 'service_unavailable'
      }
    } else {
      // gemini — Pitfall 6: no typed NotFoundError; check status string or message
      if (status === 'UNAUTHENTICATED' || status === 401 || /API_KEY_INVALID/.test(message)) {
        error_kind = 'invalid_key'
      } else if (status === 'NOT_FOUND' || status === 404 || /model.*not found/i.test(message)) {
        error_kind = 'model_not_found'; key_valid = true
      } else if (status === 'RESOURCE_EXHAUSTED' || status === 429) {
        error_kind = 'rate_limited'; key_valid = true; model_valid = true
      } else if (typeof status === 'number' && status >= 500) {
        error_kind = 'service_unavailable'
      }
    }

    // T-11-12: sanitize error — never leak stack traces; truncate to 500 chars
    const error_message = message || 'Validation failed'
    return res.json({
      valid: false, key_valid, model_valid,
      error_kind, error: error_message, error_message,
      model_id: modelId,
      ...(model_valid && key_valid ? { capabilities } : {}),
    } satisfies ValidateKeyResponse)
  }
})
