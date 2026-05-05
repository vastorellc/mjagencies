// backend/src/lib/boss.ts
import { PgBoss } from 'pg-boss'  // NAMED import — not default import (v12 ESM breaking change)
import { cleanupStaleFiles } from './storage.js'

let boss: PgBoss | null = null

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss
  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    // pg-boss creates the pgboss.* schema automatically on start()
  })

  boss.on('error', (err: Error) => {
    console.error('[pg-boss error]', err.message)
  })

  await boss.start()
  console.log('[pg-boss] started')
  return boss
}

export async function registerCleanupJob(bossInstance: PgBoss): Promise<void> {
  // pg-boss v12: queue must be created before schedule() — foreign key constraint on pgboss.schedule.name
  await bossInstance.createQueue('cleanup-stale-files')

  // Runs every hour — deletes VPS files older than 1 hour (STORE-04)
  // schedule() is not idempotent in pg-boss v12 — ignore duplicate constraint on restart
  try {
    await bossInstance.schedule('cleanup-stale-files', '0 * * * *', {})
  } catch (err: unknown) {
    const msg = (err as Error).message ?? ''
    if (!msg.includes('duplicate') && !msg.includes('unique')) throw err
  }

  await bossInstance.work('cleanup-stale-files', async (_job) => {
    await cleanupStaleFiles()
    console.log('[pg-boss] cleanup-stale-files completed')
  })

  console.log('[pg-boss] cleanup-stale-files job registered')
}

// ── Phase 9: Content Research Engine — RESEARCH-06 ───────────────────────────
// Refreshes all trend sources for all niches daily at 5am UTC.
// refreshAllNiches imported lazily to avoid circular dep with research-cache.ts
// CJS/ESM interop note: google-trends-api default import returns 'object' — confirmed working
// ── Phase 11: Content Intelligence Layer — pattern aggregation ─────────────
// Updates platform viral patterns from learning signals daily at 4 AM UTC
export async function registerPatternUpdateJob(bossInstance: PgBoss): Promise<void> {
  // CRITICAL: createQueue() BEFORE schedule() — pg-boss v12 FK constraint
  await bossInstance.createQueue('update-viral-patterns')

  try {
    await bossInstance.schedule('update-viral-patterns', '0 4 * * *', {})
  } catch (err: unknown) {
    const msg = (err as Error).message ?? ''
    if (!msg.includes('duplicate') && !msg.includes('unique')) throw err
  }

  await bossInstance.work<Record<string, never>>('update-viral-patterns', async (_jobs) => {
    // Dynamic import to avoid circular dependency with pattern-analysis.ts
    const { updatePlatformPatterns } = await import('./pattern-analysis.js')
    await updatePlatformPatterns()
    console.log('[pg-boss] update-viral-patterns completed')
  })

  console.log('[pg-boss] update-viral-patterns job registered')
}

export async function registerResearchRefreshJob(bossInstance: PgBoss): Promise<void> {
  // CRITICAL: createQueue() BEFORE schedule() — pg-boss v12 FK constraint
  // pgboss.schedule.name has a FK referencing pgboss.queue.name
  await bossInstance.createQueue('refresh-trends')

  try {
    await bossInstance.schedule('refresh-trends', '0 5 * * *', {})
  } catch (err: unknown) {
    const msg = (err as Error).message ?? ''
    if (!msg.includes('duplicate') && !msg.includes('unique')) throw err
  }

  await bossInstance.work<Record<string, never>>('refresh-trends', async (_jobs) => {
    // Lazy import to avoid circular dep: research-cache imports db, boss imports nothing from db
    const { refreshAllNiches } = await import('./research-cache.js')
    await refreshAllNiches()
    console.log('[pg-boss] refresh-trends completed')
  })

  console.log('[pg-boss] refresh-trends job registered')
}
