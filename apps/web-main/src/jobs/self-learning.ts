/**
 * apps/web-main/src/jobs/self-learning.ts
 *
 * BullMQ repeatable worker for SEO self-learning loop (REQ-073).
 * Registered at server startup in instrumentation.node.ts.
 * Cron: daily at 2am ('0 2 * * *').
 *
 * Processes all agencies in one job run.
 * Skips agencies without GSC_SERVICE_ACCOUNT_KEY_<ID> or GA4_SERVICE_ACCOUNT_KEY_<ID> env vars.
 *
 * Security: credentials never logged; worker is system-level (overrideAccess:true in worker.ts).
 * Idempotency: Pitfall 7 — checks getRepeatableJobs() before adding repeatable job to avoid
 * duplicate registrations on server restart.
 */
import { createEncryptedWorker, createEncryptedQueue } from '@mjagency/queue'
import { runSelfLearningForAgency } from '@mjagency/seo'
import type { SelfLearningJobData } from '@mjagency/seo'

const REDIS_HOST = process.env['REDIS_HOST'] ?? 'localhost'
const REDIS_PORT = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)
const REDIS_OPTS = { host: REDIS_HOST, port: REDIS_PORT }

const SELF_LEARNING_CRON = '0 2 * * *'
const SELF_LEARNING_JOB_NAME = 'run'

export async function registerSelfLearning(): Promise<void> {
  // Pitfall 7 dedup: check before adding repeatable job to prevent duplicate runs on restart
  const queue = createEncryptedQueue<SelfLearningJobData>('seo-self-learning', REDIS_OPTS)
  const existingJobs = await (
    queue as unknown as {
      getRepeatableJobs(): Promise<Array<{ name: string; cron?: string; pattern?: string }>>
    }
  ).getRepeatableJobs()
  const alreadyRegistered = existingJobs.some(
    j => j.name === SELF_LEARNING_JOB_NAME && (j.cron === SELF_LEARNING_CRON || j.pattern === SELF_LEARNING_CRON),
  )
  if (!alreadyRegistered) {
    // Cast needed because createEncryptedQueue returns Queue<EncryptedPayload> for type safety
    // but the proxy's add() handler accepts T; non-sensitive data passes through unencrypted.
    await (
      queue as unknown as {
        add(
          name: string,
          data: SelfLearningJobData,
          opts: Record<string, unknown>,
        ): Promise<unknown>
      }
    ).add(SELF_LEARNING_JOB_NAME, {}, { repeat: { cron: SELF_LEARNING_CRON } })
  }

  createEncryptedWorker<SelfLearningJobData>(
    'seo-self-learning',
    async (_job) => {
      // Load all agencies from Payload settings collection
      const { getPayload } = await import('payload')
      const config = await import('@payload-config')
      const payload = await getPayload({ config: config.default })

      const settingsResult = await payload.find({
        collection: 'settings',
        limit: 100,
        overrideAccess: true,
      })

      for (const setting of settingsResult.docs) {
        const agencyId = (setting as Record<string, unknown>)['agency_id'] as string | undefined
        const siteUrl = (setting as Record<string, unknown>)['site_url'] as string | undefined
        const agencySlug = (setting as Record<string, unknown>)['site_name'] as string | undefined
        if (!agencyId || !siteUrl || !agencySlug) continue

        try {
          await runSelfLearningForAgency(agencyId, agencySlug, siteUrl, payload)
        } catch (err) {
          console.error(
            `[seo-self-learning] Failed for agency ${agencyId}:`,
            (err as Error).message,
          )
          // Continue to next agency even if one fails
        }
      }
    },
    REDIS_OPTS,
  )

  console.info('[seo-self-learning] Repeatable job registered (cron: 0 2 * * *)')
}
