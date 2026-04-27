/**
 * packages/sms/src/opt-in.ts
 *
 * TCPA double opt-in/out management.
 * Consent state stored in Redis — never in DB (real-time check required).
 *
 * Key format: agency:<agencyId>:sms:optin:<sha256(phone)>
 * Phone is hashed with SHA-256 before use as a Redis key part — raw phone
 * numbers must never appear in key names (observability tooling exposure risk).
 *
 * Opt-in: key set (no TTL — consent is indefinite until opt-out)
 * Opt-out: key deleted
 *
 * REQ-423 (TCPA compliance)
 */
import { createHash } from 'crypto'
import Redis from 'ioredis'
import { createLogger } from '@mjagency/config'

const log = createLogger({ service: 'mjagency-sms-optin' })

function getRedis(): Redis {
  return new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  })
}

export function hashPhone(phone: string): string {
  return createHash('sha256').update(phone.trim()).digest('hex')
}

export function OPT_IN_REDIS_KEY(agencyId: string, phoneHash: string): string {
  return `agency:${agencyId}:sms:optin:${phoneHash}`
}

/** Returns true if the contact has opted in to SMS for this agency. */
export async function verifyOptIn(agencyId: string, phone: string): Promise<boolean> {
  const redis = getRedis()
  try {
    const key = OPT_IN_REDIS_KEY(agencyId, hashPhone(phone))
    const value = await redis.get(key)
    return value !== null
  } finally {
    await redis.quit()
  }
}

/**
 * Record explicit double opt-in from a contact.
 * Must only be called after verified opt-in action (web form, SMS reply, etc.).
 */
export async function recordOptIn(agencyId: string, phone: string): Promise<void> {
  const redis = getRedis()
  try {
    const key = OPT_IN_REDIS_KEY(agencyId, hashPhone(phone))
    await redis.set(key, '1')
    log.info({ agencyId, phone: '[REDACTED]' }, 'SMS opt-in recorded')
  } finally {
    await redis.quit()
  }
}

/**
 * Record opt-out. Deletes the opt-in key.
 * Called when STOP keyword is received via Twilio status webhook.
 */
export async function recordOptOut(agencyId: string, phone: string): Promise<void> {
  const redis = getRedis()
  try {
    const key = OPT_IN_REDIS_KEY(agencyId, hashPhone(phone))
    await redis.del(key)
    log.info({ agencyId, phone: '[REDACTED]' }, 'SMS opt-out recorded — consent revoked')
  } finally {
    await redis.quit()
  }
}
