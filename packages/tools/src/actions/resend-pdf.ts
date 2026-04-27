/**
 * packages/tools/src/actions/resend-pdf.ts
 *
 * Re-sends a previously generated tool PDF to the given email.
 * REQ-402: tool PDF re-sendable via email form on confirmation page.
 *
 * Same public API route pattern — not a server action.
 * Consumed by apps/web-{agency}/src/app/api/tools/resend-pdf/route.ts
 *
 * UI-SPEC Surface 6: "Re-send to My Email" CTA on /tools/{slug}/confirm page.
 */
import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'
import type { EmailGateJobData } from './email-gate.js'

export interface ResendPdfInput {
  email: string
  toolSlug: string
  toolResultJson: string
  agencySlug: string
  _hp?: string
}

export interface ResendPdfOutput {
  ok: boolean
  error?: string
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Re-enqueues a PDF email job for the confirmation page "Re-send" CTA.
 * Follows identical encryption + honeypot pattern as handleEmailGate.
 */
export async function handleResendPdf(input: ResendPdfInput): Promise<ResendPdfOutput> {
  const log = createLogger({ service: 'mjagency-tools', agencyId: input.agencySlug })

  // Honeypot check
  if (input._hp) {
    log.info({ toolSlug: input.toolSlug }, 'resend-pdf: honeypot triggered — silent discard')
    return { ok: true }
  }

  if (!input.email || !isValidEmail(input.email)) {
    return { ok: false, error: 'We could not re-send the report right now. Please try again.' }
  }

  if (!input.toolSlug || !input.agencySlug) {
    return { ok: false, error: 'We could not re-send the report right now. Please try again.' }
  }

  const jobData: EmailGateJobData = {
    email: input.email,
    toolSlug: input.toolSlug,
    toolResultJson: input.toolResultJson,
    agencySlug: input.agencySlug,
  }

  const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
  const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)

  const queue = createEncryptedQueue<EmailGateJobData>('tool-pdf-email', {
    host: redisHost,
    port: redisPort,
    keyPrefix: REDIS_KEY.bullPrefix(input.agencySlug),
  })

  // sensitiveData: true — email address is PII (REQ-402, CLAUDE.md BullMQ rule)
  await queue.add('send-pdf', jobData, { sensitiveData: true })

  log.info({ toolSlug: input.toolSlug }, 'resend-pdf: pdf job re-enqueued')
  return { ok: true }
}
