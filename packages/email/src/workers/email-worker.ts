/**
 * packages/email/src/workers/email-worker.ts
 * BullMQ encrypted worker. Calls sendEmail after warmup gate check.
 * REQ-111, REQ-113 (35-day warmup)
 */
import { createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'
import { createLogger } from '@mjagency/config'
import { sendEmail, type EmailJobData } from '../sender.js'
import { rejectSendIfWarmupIncomplete } from '../warmup.js'

const log = createLogger({ service: 'mjagency-email-worker' })

export function createEmailWorker(agencyId: string) {
  return createEncryptedWorker<EmailJobData>(
    'email-send',
    async (job) => {
      log.info({ agencyId: job.data.agencyId, to: '[REDACTED]' }, 'Processing email job')
      await rejectSendIfWarmupIncomplete(job.data.agencyId)
      await sendEmail(job.data)
    },
    {
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
      keyPrefix: REDIS_KEY.bullPrefix(agencyId),
    }
  )
}
