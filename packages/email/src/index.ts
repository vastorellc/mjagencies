/**
 * packages/email/src/index.ts
 * Barrel export for @mjagency/email.
 * REQ-111, REQ-112, REQ-113, REQ-414
 */
import type { CollectionConfig } from 'payload'

export { sendEmail } from './sender.js'
export type { EmailJobData } from './sender.js'
export { createEmailQueue } from './queue/email-queue.js'
export { createEmailWorker } from './workers/email-worker.js'
export { validateDkim, validateSpf, validateDmarc, validateEmailDns } from './dns-validate.js'
export type { DnsValidationResult } from './dns-validate.js'
export { enrollContact } from './sequences/sequence-engine.js'
export type { SequenceStep } from './sequences/sequence-engine.js'
export {
  rejectSendIfWarmupIncomplete,
  incrementWarmupDay,
  getWarmupDay,
  isEmailWarmupComplete,
  EmailWarmupIncompleteError,
} from './warmup.js'
export { emailTemplatesCollection } from './collections/email-templates.js'
export { emailSequencesCollection } from './collections/email-sequences.js'

import { emailTemplatesCollection } from './collections/email-templates.js'
import { emailSequencesCollection } from './collections/email-sequences.js'

export const emailCollections: CollectionConfig[] = [
  emailTemplatesCollection,
  emailSequencesCollection,
]
