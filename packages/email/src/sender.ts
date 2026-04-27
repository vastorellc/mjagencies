/**
 * packages/email/src/sender.ts
 *
 * SMTP email sender using nodemailer.
 * Called exclusively from createEmailWorker — never from request handlers.
 * CLAUDE.md Rule (BullMQ email): email MUST be dispatched via BullMQ async,
 * never synchronous in the request path.
 *
 * REQ-111 (email sending), REQ-112 (DKIM-ready SMTP)
 */
import nodemailer from 'nodemailer'
import { createLogger } from '@mjagency/config'

const log = createLogger({ service: 'mjagency-email-sender' })

export interface EmailJobData {
  to: string
  subject: string
  html: string
  from: string
  agencyId: string
  replyTo?: string
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env['SMTP_HOST'] ?? 'localhost',
    port: parseInt(process.env['SMTP_PORT'] ?? '587', 10),
    secure: process.env['SMTP_PORT'] === '465',
    auth: {
      user: process.env['SMTP_USER'],
      pass: process.env['SMTP_PASS'],
    },
  })
}

/**
 * Send a single email via SMTP.
 * Called by createEmailWorker — not exported for direct call from route handlers.
 */
export async function sendEmail(job: EmailJobData): Promise<void> {
  const transport = createTransport()

  await transport.sendMail({
    from: job.from,
    to: job.to,
    subject: job.subject,
    html: job.html,
    replyTo: job.replyTo,
  })

  // Redact PII — log agencyId only, never to/from addresses
  log.info({ agencyId: job.agencyId, subject: job.subject }, 'Email sent successfully')
}
