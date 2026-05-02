// backend/src/index.ts
import 'dotenv/config'
import { runMigrations } from './db/migrate.js'
import { getBoss, registerCleanupJob } from './lib/boss.js'
import { registerMetaTokenRefreshJob } from './lib/meta-refresh.js'
import { initStorage } from './lib/storage.js'
import { app } from './app.js'

const REQUIRED_ENV = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  // Phase 2: per-user crypto + OAuth (T-02-07)
  'ENCRYPTION_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'META_APP_ID',
  'META_APP_SECRET',
  'APP_URL', // OAuth redirect URI base
] as const
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)
}

// Defense-in-depth: ENCRYPTION_KEY must be at least 32 chars (T-02-07)
if (process.env.ENCRYPTION_KEY!.length < 32) {
  throw new Error('ENCRYPTION_KEY must be at least 32 characters')
}

async function main(): Promise<void> {
  // 1. Run Drizzle migrations first (fast, idempotent — safe to run on every startup)
  await runMigrations()

  // 2. Init VPS storage directory
  await initStorage()

  // 3. Start pg-boss — creates pgboss.* schema in Supabase DB if not exists
  const boss = await getBoss()
  await registerCleanupJob(boss)
  await registerMetaTokenRefreshJob(boss)  // Phase 2 SETTINGS-07

  // 4. Start Express server last — only accept requests after all deps are ready
  const PORT = process.env.PORT ?? 3001
  app.listen(PORT, () => {
    console.log(`[server] listening on :${PORT}`)
    console.log(`[server] GET /health → public`)
    console.log(`[server] GET /api/posts → auth required`)
  })
}

main().catch(err => {
  console.error('[startup error]', err)
  process.exit(1)
})
