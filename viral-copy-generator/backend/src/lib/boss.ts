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
