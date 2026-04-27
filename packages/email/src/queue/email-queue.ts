/**
 * packages/email/src/queue/email-queue.ts
 * BullMQ encrypted queue for email dispatch.
 * sensitiveData: true — job payload contains PII (to, html body).
 * REQ-111
 */
import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'
import type { EmailJobData } from '../sender.js'

export function createEmailQueue(agencyId: string) {
  return createEncryptedQueue<EmailJobData>('email-send', {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    keyPrefix: REDIS_KEY.bullPrefix(agencyId),
  })
}
