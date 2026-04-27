/**
 * apps/web-main/src/jobs/cost-reset.ts
 *
 * BullMQ repeatable worker for monthly AI cost-cap reset (REQ-080).
 * Registered at server startup in instrumentation.node.ts.
 * Cron: monthly on the 1st at midnight UTC ('0 0 1 * *').
 *
 * Resets all per-agency Redis monthly-spend counters so the next billing month
 * starts fresh. Calls resetMonthlySpend() from packages/ai/src/cost-cap.ts.
 *
 * Idempotency: Pitfall 7 — checks getRepeatableJobs() before adding repeatable
 * job to avoid duplicate registrations on server restart.
 */
import { createEncryptedWorker, createEncryptedQueue } from '@mjagency/queue'

const REDIS_HOST = process.env['REDIS_HOST'] ?? 'localhost'
const REDIS_PORT = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)
const REDIS_OPTS = { host: REDIS_HOST, port: REDIS_PORT }

const COST_RESET_CRON = '0 0 1 * *'
const COST_RESET_JOB_NAME = 'reset'

export async function registerCostReset(): Promise<void> {
  // Pitfall 7 dedup: check before adding repeatable job to prevent duplicate runs on restart
  const queue = createEncryptedQueue<Record<string, never>>('ai-cost-reset', REDIS_OPTS)
  const existingJobs = await (
    queue as unknown as {
      getRepeatableJobs(): Promise<Array<{ name: string; cron?: string; pattern?: string }>>
    }
  ).getRepeatableJobs()
  const alreadyRegistered = existingJobs.some(
    j =>
      j.name === COST_RESET_JOB_NAME &&
      (j.cron === COST_RESET_CRON || j.pattern === COST_RESET_CRON),
  )
  if (!alreadyRegistered) {
    await (
      queue as unknown as {
        add(
          name: string,
          data: Record<string, never>,
          opts: Record<string, unknown>,
        ): Promise<unknown>
      }
    ).add(COST_RESET_JOB_NAME, {}, { repeat: { cron: COST_RESET_CRON } })
  }

  createEncryptedWorker<Record<string, never>>(
    'ai-cost-reset',
    async (_job) => {
      const { resetMonthlySpend } = await import('@mjagency/ai')
      const count = await resetMonthlySpend()
      console.info('[ai-cost-reset] cleared ' + count + ' counters')
    },
    REDIS_OPTS,
  )

  console.info('[ai-cost-reset] Repeatable job registered (cron: 0 0 1 * *)')
}
