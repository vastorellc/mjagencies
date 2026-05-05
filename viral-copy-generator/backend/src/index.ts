// backend/src/index.ts
import 'dotenv/config'
import { runMigrations } from './db/migrate.js'
import { getBoss, registerCleanupJob, registerResearchRefreshJob, registerPatternUpdateJob } from './lib/boss.js'
import { registerMetaTokenRefreshJob } from './lib/meta-refresh.js'
import { registerUploadWorkers } from './lib/upload-worker.js'
import { initStorage } from './lib/storage.js'
import { app } from './app.js'

const REQUIRED_ENV = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ENCRYPTION_KEY',
  'APP_URL',
] as const
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)
}

// Optional vars — warn on startup if absent so operator knows what features are disabled
const OPTIONAL_ENV: { key: string; feature: string }[] = [
  { key: 'GOOGLE_CLIENT_ID',    feature: 'YouTube OAuth' },
  { key: 'GOOGLE_CLIENT_SECRET', feature: 'YouTube OAuth' },
  { key: 'META_APP_ID',          feature: 'Instagram/Facebook OAuth' },
  { key: 'META_APP_SECRET',      feature: 'Instagram/Facebook OAuth' },
  { key: 'VPS_PUBLIC_URL',       feature: 'Phase 6 file uploads / Meta video fetch' },
]
for (const { key, feature } of OPTIONAL_ENV) {
  if (!process.env[key]) console.warn(`[startup] Optional env var ${key} not set — ${feature} disabled`)
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
  await registerUploadWorkers(boss)        // Phase 6 AUTOUP-07
  await registerPatternUpdateJob(boss)     // Phase 11: update viral patterns daily
  await registerResearchRefreshJob(boss)  // Phase 9 RESEARCH-06

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
