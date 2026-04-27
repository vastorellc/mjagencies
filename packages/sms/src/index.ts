/**
 * packages/sms/src/index.ts
 * Barrel export for @mjagency/sms.
 * REQ-423
 */
export { createTwilioClient, getTwilioConfig } from './twilio.js'
export type { TwilioClientConfig } from './twilio.js'
export { verifyOptIn, recordOptIn, recordOptOut, hashPhone, OPT_IN_REDIS_KEY } from './opt-in.js'
export { createSmsQueue } from './queue/sms-queue.js'
export type { SmsJobData } from './queue/sms-queue.js'
export { createSmsWorker, TcpaConsentError } from './workers/sms-worker.js'
export { handleTwilioStatusWebhook } from './webhook-handler.js'
