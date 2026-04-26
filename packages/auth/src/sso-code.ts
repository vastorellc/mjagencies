/**
 * packages/auth/src/sso-code.ts
 *
 * SSO opaque-code store — creates and atomically redeems single-use codes via Redis.
 *
 * Q2 resolution (Plan 03-03, RESEARCH §5.3):
 *   Codes are stored under the PLATFORM-SHARED namespace `accounts:sso:code:<codeId>`
 *   (NOT per-agency `agency:<id>:session:*`). The exchange happens cross-agency by design:
 *   e.g., `ecommerce.brand.com` hits `accounts.brand.com/api/sso/exchange` to redeem the code,
 *   so the code must live in a namespace visible to both apps.
 *   Per-agency namespacing continues to apply for sessions and revocation lists (Plan 03-01).
 *
 * T-03-011 mitigation:
 *   `redis.getdel` is an atomic GETDEL — consumes on first redemption with no race window.
 *   60-second TTL (`SSO_CODE_TTL_SECONDS`) caps the attack window even if redemption stalls.
 *
 * NOTE: Node-runtime only — server-only guard prevents accidental Edge import.
 */

import 'server-only'
import { randomBytes } from 'node:crypto'
import type { Redis } from 'ioredis'
import { REDIS_KEY } from '@mjagency/config'

const SSO_CODE_TTL_SECONDS = 60

export interface SsoCodePayload {
  userId:    string   // user UUID
  agencyId:  string   // target agency (NOT necessarily 'brand' — the agency the user is SSOing INTO)
  familyId:  string   // freshly issued tokenFamilyId
  issuedAt:  number   // ms epoch
}

/**
 * Creates a single-use SSO code and stores it in Redis under the platform-shared namespace.
 *
 * Returns the 32-hex-char codeId (NOT the full payload). The codeId is passed to the browser
 * as an opaque query parameter and exchanged server-to-server via `redeemSsoCode`.
 *
 * @param redis   - ioredis client (platform-shared Redis instance)
 * @param payload - The session context to store alongside the code
 */
export async function createSsoCode(redis: Redis, payload: SsoCodePayload): Promise<string> {
  const codeId = randomBytes(16).toString('hex')
  await redis.set(
    REDIS_KEY.accounts.sso.code(codeId),  // ← cross-agency PLATFORM namespace
    JSON.stringify(payload),
    'EX', SSO_CODE_TTL_SECONDS,
  )
  return codeId
}

/**
 * Atomically redeems a single-use SSO code via GETDEL.
 *
 * Returns the stored `SsoCodePayload` on first redemption.
 * Returns `null` if the code has already been used, expired, or the stored JSON is malformed.
 *
 * T-03-011: GETDEL is atomic — no race window between GET and DEL.
 *
 * @param redis  - ioredis client (platform-shared Redis instance)
 * @param codeId - The 32-hex-char code from the query parameter
 */
export async function redeemSsoCode(redis: Redis, codeId: string): Promise<SsoCodePayload | null> {
  const stored = await redis.getdel(REDIS_KEY.accounts.sso.code(codeId))
  if (!stored) return null
  try {
    return JSON.parse(stored) as SsoCodePayload
  } catch {
    return null
  }
}
