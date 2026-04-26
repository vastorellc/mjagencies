/**
 * packages/auth/src/mfa-lockout.ts
 *
 * Redis-backed MFA lockout — 3 consecutive TOTP failures → 15-minute lockout.
 *
 * Assumption A2 (RESEARCH §A2): 3 failures within any rolling window triggers a 15-minute
 * lockout. The lockout window resets from the LAST failure (sliding behavior):
 *   - An attacker cannot reset by waiting between attempts
 *   - An honest user who fat-fingers 3 times waits up to 15 minutes
 *
 * T-03-006: 6-digit TOTP = 10^6 space; 3 failures per 15 min = ~12 attempts/hour per user.
 * Brute-force rate is effectively bounded to 3 guesses per 15 minutes.
 *
 * Key format: agency:<agencyId>:session:mfa-lockout:<userId>
 * (REDIS_KEY.session.mfaLockout from @mjagency/config)
 *
 * Node-runtime only (Redis client requires Node.js).
 */

import 'server-only'
import { REDIS_KEY } from '@mjagency/config'
import type { Redis } from 'ioredis'

const MAX_FAILURES_BEFORE_LOCKOUT = 3
const LOCKOUT_TTL_SECONDS = 15 * 60 // 15 minutes

/**
 * Check whether a user is currently locked out of MFA verification.
 * Returns true if the Redis failure counter has reached MAX_FAILURES_BEFORE_LOCKOUT.
 */
export async function isLockedOut(
  redis: Redis,
  agencyId: string,
  userId: string,
): Promise<boolean> {
  const count = await redis.get(REDIS_KEY.session.mfaLockout(agencyId, userId))
  return count !== null && parseInt(count, 10) >= MAX_FAILURES_BEFORE_LOCKOUT
}

/**
 * Record a failed TOTP attempt. Returns the new failure count.
 * On reaching MAX_FAILURES_BEFORE_LOCKOUT, the key TTL is set to LOCKOUT_TTL_SECONDS
 * — the lockout window starts from the LAST failure (sliding behavior is intentional —
 * an attacker can't reset by waiting; honest users wait out the full window).
 */
export async function recordFailedAttempt(
  redis: Redis,
  agencyId: string,
  userId: string,
): Promise<number> {
  const key = REDIS_KEY.session.mfaLockout(agencyId, userId)
  const count = await redis.incr(key)
  // First INCR has no TTL — set it now so successful verify clears, but failures lock for 15min
  await redis.expire(key, LOCKOUT_TTL_SECONDS)
  return count
}

/**
 * Clear the MFA lockout state for a user (called on successful TOTP verification).
 * Deletes the Redis key so the failure counter resets to zero.
 */
export async function clearLockout(
  redis: Redis,
  agencyId: string,
  userId: string,
): Promise<void> {
  await redis.del(REDIS_KEY.session.mfaLockout(agencyId, userId))
}
