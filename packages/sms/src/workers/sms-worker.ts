/**
 * packages/sms/src/workers/sms-worker.ts
 *
 * SMS BullMQ worker with TCPA double opt-in guard.
 *
 * TCPA guard is the FIRST operation — if consentVerified is false,
 * TcpaConsentError is thrown before any Twilio API call. This is
 * defense-in-depth: callers should also verify consent before enqueuing,
 * but the worker is the hard gate.
 *
 * Phone number is NEVER logged — only '[REDACTED]' in Pino logs.
 *
 * REQ-423
 */
import { createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'
import { createTwilioClient, getTwilioConfig } from '../twilio.js'
import type { SmsJobData } from '../queue/sms-queue.js'

const log = createLogger({ service: 'mjagency-sms-worker' })

export class TcpaConsentError extends Error {
  constructor(agencyId: string) {
    super(`TCPA: SMS send blocked — consentVerified is false for agency ${agencyId}. Opt-in required before sending SMS.`)
    this.name = 'TcpaConsentError'
  }
}

export function createSmsWorker(agencyId: string) {
  const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
  const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)

  return createEncryptedWorker<SmsJobData>(
    'sms-send',
    async (job) => {
      const { to, body, agencyId: jobAgencyId, consentVerified } = job.data

      // TCPA guard — FIRST check, before any Twilio call
      if (!consentVerified) {
        log.error({ agencyId: jobAgencyId, to: '[REDACTED]' }, 'TCPA guard: consentVerified=false — blocking SMS send')
        throw new TcpaConsentError(jobAgencyId)
      }

      const client = createTwilioClient(jobAgencyId)
      const { fromNumber } = getTwilioConfig(jobAgencyId)

      await client.messages.create({
        to,
        from: fromNumber,
        body,
      })

      // Never log raw phone number — CLAUDE.md Pino redact rules
      log.info({ agencyId: jobAgencyId, to: '[REDACTED]' }, 'SMS dispatched via Twilio')
    },
    {
      host: redisHost,
      port: redisPort,
      keyPrefix: REDIS_KEY.bullPrefix(agencyId),
    }
  )
}
