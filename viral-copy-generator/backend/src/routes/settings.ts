import { Router, type Request, type Response } from 'express'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings, type PlatformConfig } from '../db/schema.js'
import { encrypt, decrypt, maskKey } from '../lib/encryption.js'
import { ValidationError, DatabaseError, StorageError } from '../lib/errors.js'

export const settingsRouter = Router()

const VALID_PROVIDERS = ['claude', 'gemini', 'openai', 'deepseek'] as const
type Provider = (typeof VALID_PROVIDERS)[number]
const VALID_PLATFORMS = ['youtube', 'instagram', 'tiktok', 'facebook', 'x'] as const
const VALID_NICHES = ['travel', 'hotels', 'cars', 'bikes', 'coding', 'lifestyle', 'food', 'other'] as const

interface SettingsResponse {
  ai_provider: Provider
  api_key_masked: string | null
  default_niche: string
  enabled_platforms: string[]
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
  if (
    body.default_niche !== undefined &&
    !VALID_NICHES.includes(body.default_niche as (typeof VALID_NICHES)[number])
  ) {
    throw new ValidationError(
      `Unknown niche "${body.default_niche}"`,
      `default_niche not in [${VALID_NICHES.join(', ')}]`,
      { field: 'default_niche' }
    )
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
  if (body.default_niche !== undefined) update.default_niche = body.default_niche
  if (body.enabled_platforms !== undefined) update.enabled_platforms = body.enabled_platforms
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
        default_niche: body.default_niche ?? 'travel',
        enabled_platforms: body.enabled_platforms ?? ['youtube', 'instagram', 'facebook'],
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
