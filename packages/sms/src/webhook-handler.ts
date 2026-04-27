/**
 * packages/sms/src/webhook-handler.ts
 *
 * Twilio SMS status callback webhook handler.
 * Validates Twilio signature before any processing (CLAUDE.md §7).
 * Handles STOP keyword opt-out for TCPA compliance.
 *
 * REQ-423
 */
import twilio from 'twilio'
import Redis from 'ioredis'
import { recordOptOut } from './opt-in.js'
import { createLogger } from '@mjagency/config'
import { getTwilioConfig } from './twilio.js'

const log = createLogger({ service: 'mjagency-sms-webhook' })

interface TwilioStatusParams {
  MessageSid: string
  MessageStatus: string
  To: string
  From: string
  Body?: string
  AccountSid: string
}

function getRedis(): Redis {
  return new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  })
}

/**
 * Handle a Twilio status callback (POST from Twilio).
 * Called from the API route after raw body is read.
 *
 * @param rawBody - URL-encoded string from req.text()
 * @param sig - X-Twilio-Signature header value
 * @param requestUrl - Full URL of the webhook endpoint (required for Twilio signature validation)
 * @param agencyId - Agency this webhook belongs to
 */
export async function handleTwilioStatusWebhook(
  rawBody: string,
  sig: string,
  requestUrl: string,
  agencyId: string
): Promise<Response> {
  // 1. Get Twilio config for signature validation
  let authToken: string
  try {
    const config = getTwilioConfig(agencyId)
    authToken = config.authToken
  } catch {
    log.error({ agencyId }, 'Twilio config not found for agency')
    return Response.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  // 2. Parse form-encoded body into params object for signature validation
  const params = Object.fromEntries(new URLSearchParams(rawBody).entries()) as unknown as TwilioStatusParams

  // 3. Validate Twilio signature (CLAUDE.md §7 — all webhooks HMAC-verified)
  const isValid = twilio.validateRequest(authToken, sig, requestUrl, params as unknown as Record<string, string>)
  if (!isValid) {
    log.warn({ agencyId }, 'Twilio webhook signature invalid')
    return Response.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const { MessageSid, MessageStatus, To, From, Body } = params

  if (!MessageSid) {
    return Response.json({ error: 'Missing MessageSid' }, { status: 400 })
  }

  // 4. Redis idempotency
  const redis = getRedis()
  const idempotencyKey = `agency:${agencyId}:sms:status:${MessageSid}`
  try {
    const exists = await redis.get(idempotencyKey)
    if (exists) {
      return Response.json({ ok: true })
    }
    await redis.set(idempotencyKey, '1', 'EX', 86400)
  } finally {
    await redis.quit()
  }

  log.info({ agencyId, messageSid: MessageSid, status: MessageStatus }, 'Twilio status webhook received')

  // 5. Handle STOP keyword for TCPA opt-out
  if (Body && Body.trim().toUpperCase() === 'STOP') {
    log.info({ agencyId, from: '[REDACTED]' }, 'STOP keyword received — recording opt-out')
    // From is the subscriber's number (the one who sent STOP)
    await recordOptOut(agencyId, From)
  }

  // 6. Log delivery status for observability
  // CRM delivery status update wired when CRM collections are available (09-01+)
  log.info({ agencyId, messageSid: MessageSid, to: '[REDACTED]', status: MessageStatus }, 'SMS status logged')

  return Response.json({ ok: true })
}
