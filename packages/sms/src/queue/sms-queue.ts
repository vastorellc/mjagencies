/**
 * packages/sms/src/queue/sms-queue.ts
 * BullMQ encrypted queue for SMS dispatch.
 * sensitiveData: true — payload contains phone number (PII).
 * REQ-423
 */
import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'

export interface SmsJobData {
  to: string           // E.164 phone number, e.g. +12025551234
  body: string
  agencyId: string
  consentVerified: boolean  // TCPA: MUST be true — worker throws if false
}

export function createSmsQueue(agencyId: string) {
  return createEncryptedQueue<SmsJobData>('sms-send', {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    keyPrefix: REDIS_KEY.bullPrefix(agencyId),
  })
}
