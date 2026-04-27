/**
 * packages/sms/src/twilio.ts
 *
 * Per-agency Twilio client factory.
 * Each agency can have its own Twilio account (for separate phone numbers).
 * Env var pattern: TWILIO_ACCOUNT_SID_{AGENCY_ID_UPPER} / TWILIO_AUTH_TOKEN_{AGENCY_ID_UPPER}
 * Falls back to global TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN if per-agency not set.
 *
 * REQ-423
 */
import twilio from 'twilio'

export interface TwilioClientConfig {
  accountSid: string
  authToken: string
  fromNumber: string
}

export function getTwilioConfig(agencyId: string): TwilioClientConfig {
  const upper = agencyId.toUpperCase().replace(/-/g, '_')

  const accountSid =
    process.env[`TWILIO_ACCOUNT_SID_${upper}`] ??
    process.env['TWILIO_ACCOUNT_SID'] ??
    ''

  const authToken =
    process.env[`TWILIO_AUTH_TOKEN_${upper}`] ??
    process.env['TWILIO_AUTH_TOKEN'] ??
    ''

  const fromNumber =
    process.env[`TWILIO_FROM_${upper}`] ??
    process.env['TWILIO_FROM'] ??
    ''

  if (!accountSid || !authToken) {
    throw new Error(`Twilio credentials not configured for agency ${agencyId}`)
  }

  return { accountSid, authToken, fromNumber }
}

/**
 * Create a Twilio REST client for a specific agency.
 * Reads per-agency env vars first, then global fallback.
 */
export function createTwilioClient(agencyId: string): ReturnType<typeof twilio> {
  const { accountSid, authToken } = getTwilioConfig(agencyId)
  return twilio(accountSid, authToken)
}
