/**
 * packages/email/src/sequences/sequence-engine.ts
 *
 * Email sequence enrollment engine.
 * Each sequence step is enqueued as a delayed BullMQ job.
 * delayHours is converted to milliseconds for BullMQ's `delay` option.
 *
 * REQ-112 (email sequences)
 */
import { createEmailQueue } from '../queue/email-queue.js'
import { createLogger } from '@mjagency/config'

const log = createLogger({ service: 'mjagency-email-sequences' })

export interface SequenceStep {
  templateId: string
  delayHours: number
  subject: string
  htmlTemplate: string
}

/**
 * Enroll a contact in an email sequence.
 * Each step is enqueued as a delayed BullMQ job.
 * Step 1: delay = step.delayHours * 3600000 ms from now
 * Step 2: delay = (step1.delayHours + step2.delayHours) * 3600000 ms from now
 * (cumulative delay — each step is measured from enrollment time)
 */
export async function enrollContact(
  agencyId: string,
  contactId: string,
  steps: SequenceStep[],
): Promise<void> {
  const queue = createEmailQueue(agencyId)
  let cumulativeDelayMs = 0

  for (const step of steps) {
    cumulativeDelayMs += step.delayHours * 60 * 60 * 1000

    await (queue as unknown as {
      add: (name: string, data: object, opts: Record<string, unknown>) => Promise<void>
    }).add(
      'sequence-step',
      {
        agencyId,
        contactId,
        templateId: step.templateId,
        subject: step.subject,
        htmlTemplate: step.htmlTemplate,
        // Actual to/from resolved by worker from contact record
        to: `__resolve:${contactId}`, // worker resolves from CRM contact
        from: process.env['SMTP_FROM'] ?? `hello@${agencyId}.com`,
        html: step.htmlTemplate,
      },
      { sensitiveData: true, delay: cumulativeDelayMs }
    )

    log.info(
      { agencyId, contactId, templateId: step.templateId, delayHours: step.delayHours },
      'Sequence step enqueued'
    )
  }
}
