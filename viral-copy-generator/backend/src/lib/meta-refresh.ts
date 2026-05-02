// backend/src/lib/meta-refresh.ts
// Weekly Meta long-lived-token refresh job (SETTINGS-07).
// Cron: Mondays 09:00 UTC — 7-day cadence gives 8.5× safety margin on 60-day tokens
// (research Pattern 7 + Pitfall 6). Facebook page tokens are NOT refreshed here.
import { PgBoss } from 'pg-boss'  // NAMED import — not default (v12 ESM breaking change)
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings, type PlatformConfig } from '../db/schema.js'
import { encrypt, decrypt } from './encryption.js'
import { refreshInstagramToken } from './oauth-meta.js'

const QUEUE_NAME = 'meta-token-refresh'
const CRON = '0 9 * * 1' // Mondays 09:00 UTC — 7-day cadence vs. 60-day token (8.5× safety margin)

export async function registerMetaTokenRefreshJob(boss: PgBoss): Promise<void> {
  // Pitfall 5: createQueue must precede schedule — pg-boss v12 has FK on pgboss.schedule.name
  await boss.createQueue(QUEUE_NAME)

  // schedule() is not idempotent — duplicate key on restart is expected and harmless
  // Same pattern as registerCleanupJob in boss.ts
  try {
    await boss.schedule(QUEUE_NAME, CRON, {})
  } catch (err: unknown) {
    const msg = (err as Error).message ?? ''
    if (!msg.includes('duplicate') && !msg.includes('unique')) throw err
  }

  await boss.work(QUEUE_NAME, async (_job) => {
    await refreshAllInstagramTokens()
    console.log('[pg-boss] meta-token-refresh completed')
  })

  console.log('[pg-boss] meta-token-refresh job registered (cron:', CRON, ')')
}

// Satisfies Record<string, unknown> constraint required by db.execute<T> generic
type SettingsRow = {
  user_id: string
  platform_config: PlatformConfig | null
  [key: string]: unknown
}

/**
 * Worker body — exported separately so unit tests can call it without pg-boss.
 *
 * Iterates every user whose Instagram is connected, calls refreshInstagramToken
 * on the decrypted long-lived token, re-encrypts the result, and JSONB-merges
 * it back via SELECT FOR UPDATE inside a transaction.
 *
 * Per-user errors are caught and logged with user_id but NEVER abort the loop
 * (research Pitfall 6) — one Meta API failure must not block all other users.
 *
 * Facebook page_access_tokens are intentionally NOT refreshed here (research
 * Pattern 7 — Facebook page tokens have a different lifecycle).
 *
 * Security: token values are NEVER written to console output (T-02-19).
 */
export async function refreshAllInstagramTokens(): Promise<void> {
  // Filter: only rows where instagram is non-null (skips facebook-only and empty rows)
  const result = await db.execute<SettingsRow>(sql`
    SELECT user_id, platform_config
    FROM settings
    WHERE platform_config -> 'instagram' IS NOT NULL
      AND platform_config -> 'instagram' != 'null'::jsonb
  `)

  // Drizzle's execute() returns either an array (Postgres.js driver) or a
  // { rows } shape (node-postgres driver).
  // CLAUDE.md rule 9: no `as unknown as` double-cast bridges.
  // Single explicit cast over the union shape:
  const data: SettingsRow[] = Array.isArray(result)
    ? result
    : (result as { rows: SettingsRow[] }).rows

  for (const row of data) {
    const ig = row.platform_config?.instagram
    if (!ig?.access_token) continue

    try {
      const plaintext = decrypt(ig.access_token)
      const refreshed = await refreshInstagramToken(plaintext)

      const patch = {
        instagram: {
          access_token: encrypt(refreshed.access_token),
          expiry: Date.now() + refreshed.expires_in * 1000,
        },
      }

      await db.transaction(async (tx) => {
        // SELECT FOR UPDATE prevents concurrent refresh races (research Pattern 7)
        await tx.execute(sql`SELECT id FROM settings WHERE user_id = ${row.user_id} FOR UPDATE`)

        await tx
          .update(settings)
          .set({
            platform_config: sql`COALESCE(${settings.platform_config}, '{}')::jsonb || ${JSON.stringify(patch)}::jsonb`,
            updated_at: sql`NOW()`,
          })
          .where(eq(settings.user_id, row.user_id))
      })

      // Log status only — never log token values (T-02-19)
      console.log(`[meta-token-refresh] refreshed user ${row.user_id}`)
    } catch (err) {
      // Pitfall 6: log per-user failure with user_id for Phase 8 admin visibility;
      // do NOT propagate — one failure must not abort the iteration
      console.error(`[meta-token-refresh] FAILED user ${row.user_id}: ${(err as Error).message}`)
    }
  }
}
