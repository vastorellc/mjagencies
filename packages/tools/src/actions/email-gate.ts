/**
 * packages/tools/src/actions/email-gate.ts
 *
 * Public API route handler logic for the tool email gate.
 * REQ-123: PDF behind email gate → CRM hook.
 * REQ-402: PDF must be re-sendable.
 *
 * Consumed by: apps/web-{agency}/src/app/api/tools/email-gate/route.ts
 * This is NOT a server action (no requireSession) — public visitor flow.
 * Follows Phase 9 ContactForm public API route pattern.
 *
 * Security: T-10-02-01 (agencySlug from server env), T-10-02-02 (sensitiveData: true),
 *           T-10-02-04 (honeypot field present).
 */
import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'

export interface EmailGateInput {
  /** Visitor's email address */
  email: string
  /** Tool slug used to generate the PDF */
  toolSlug: string
  /** Serialized tool result for PDF generation */
  toolResultJson: string
  /** Agency this tool belongs to */
  agencySlug: string
  /** Honeypot field — must be empty */
  _hp?: string
}

export interface EmailGateJobData {
  email: string
  toolSlug: string
  toolResultJson: string
  agencySlug: string
}

export interface EmailGateOutput {
  ok: boolean
  error?: string
}

/** Basic email format validation — no external service */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Enqueues a PDF generation + email job to BullMQ.
 * Called from the per-agency API route (not a server action).
 * Returns { ok: true } immediately — PDF delivery is async.
 *
 * T-10-02-02: sensitiveData: true encrypts PII (email) via AES-GCM-256.
 * T-10-02-04: honeypot field silently discards bot submissions.
 */
export async function handleEmailGate(input: EmailGateInput): Promise<EmailGateOutput> {
  const log = createLogger({ service: 'mjagency-tools', agencyId: input.agencySlug })

  // T-10-02-04: Honeypot check (Phase 9 ContactForm pattern)
  if (input._hp) {
    log.info({ toolSlug: input.toolSlug }, 'email-gate: honeypot triggered — silent discard')
    return { ok: true }
  }

  // Email validation
  if (!input.email || !isValidEmail(input.email)) {
    return { ok: false, error: 'We could not send the report right now. Please try again or contact us directly.' }
  }

  if (!input.toolSlug || !input.agencySlug) {
    return { ok: false, error: 'We could not send the report right now. Please try again or contact us directly.' }
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

  // T-10-02-02: sensitiveData: true — email address is PII, encrypted AES-GCM-256 in Redis
  await queue.add('send-pdf', jobData, { sensitiveData: true })

  log.info({ toolSlug: input.toolSlug }, 'email-gate: pdf job enqueued')
  return { ok: true }
}
