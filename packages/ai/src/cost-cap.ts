/**
 * packages/ai/src/cost-cap.ts
 *
 * Per-agency LiteLLM cost cap enforcement (REQ-080).
 *
 * - API key resolution: LITELLM_API_KEY_<AGENCY_ID_UPPER> with fallback to LITELLM_API_KEY
 * - Monthly budget: LITELLM_BUDGET_<AGENCY_ID_UPPER> (cents) enforced via Redis counter
 * - Redis key: agency:<id>:ai:monthly-spend
 * - Monthly reset: BullMQ cron '0 0 1 * *' (registered in cost-reset.ts)
 *
 * Redis client pattern copied verbatim from packages/seo/src/config-cache.ts (lines 14-19).
 * Always wrap in try { ... } finally { await redis.quit() }.
 */
import { Redis } from 'ioredis'

// ---------------------------------------------------------------------------
// Redis client factory (copied from packages/seo/src/config-cache.ts)
// ---------------------------------------------------------------------------
function createRedisClient(): Redis {
  return new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  })
}

const MONTHLY_SPEND_KEY = (agencyId: string): string =>
  `agency:${agencyId}:ai:monthly-spend`

// 35 days in seconds — slightly longer than a calendar month so unset keys eventually drop
const TTL_SECONDS = 35 * 86400

// ---------------------------------------------------------------------------
// AiBudgetExceededError
// ---------------------------------------------------------------------------

/**
 * Thrown by checkAgencyCostCap when an agency has exceeded its monthly LiteLLM budget.
 * Callers must catch this error and return an appropriate user-facing error response.
 */
export class AiBudgetExceededError extends Error {
  constructor(agencyId: string) {
    super(`Agency ${agencyId} exceeded monthly LiteLLM budget`)
    this.name = 'AiBudgetExceededError'
  }
}

// ---------------------------------------------------------------------------
// getAgencyLiteLLMKey
// ---------------------------------------------------------------------------

/**
 * Resolves the LiteLLM API key for the given agency.
 * Checks LITELLM_API_KEY_<AGENCY_ID_UPPER> first; falls back to LITELLM_API_KEY.
 * Returns empty string if neither is set.
 */
export function getAgencyLiteLLMKey(agencyId: string): string {
  const perAgencyKey = `LITELLM_API_KEY_${agencyId.toUpperCase()}`
  return process.env[perAgencyKey] ?? process.env['LITELLM_API_KEY'] ?? ''
}

// ---------------------------------------------------------------------------
// checkAgencyCostCap
// ---------------------------------------------------------------------------

/**
 * Checks whether an agency has exceeded its monthly LiteLLM budget.
 * If LITELLM_BUDGET_<AGENCY_ID_UPPER> is not set, no cap is enforced and function resolves.
 * If the Redis monthly-spend counter >= cap (cents), throws AiBudgetExceededError.
 */
export async function checkAgencyCostCap(agencyId: string): Promise<void> {
  const budgetEnvVar = `LITELLM_BUDGET_${agencyId.toUpperCase()}`
  const budgetStr = process.env[budgetEnvVar]

  // No cap configured — allow all requests
  if (!budgetStr) return

  const cap = parseInt(budgetStr, 10)
  if (isNaN(cap)) return

  const redis = createRedisClient()
  try {
    const raw = await redis.get(MONTHLY_SPEND_KEY(agencyId))
    const spent = raw !== null ? parseInt(raw, 10) : 0
    if (spent >= cap) {
      throw new AiBudgetExceededError(agencyId)
    }
  } finally {
    await redis.quit()
  }
}

// ---------------------------------------------------------------------------
// recordAgencySpend
// ---------------------------------------------------------------------------

/**
 * Records AI spend for an agency in Redis.
 * INCRBY on agency:<id>:ai:monthly-spend by Math.ceil(cents).
 * Sets EXPIRE to 35 days if the key was newly created (TTL was -1).
 * Errors are swallowed — cost tracking must never break user requests.
 */
export async function recordAgencySpend(agencyId: string, cents: number): Promise<void> {
  const key = MONTHLY_SPEND_KEY(agencyId)
  const increment = Math.ceil(cents)
  const redis = createRedisClient()
  try {
    await redis.incrby(key, increment)
    // Check TTL: if key was just created, TTL returns -1 (no expiry set yet)
    const ttl = await redis.ttl(key)
    if (ttl === -1) {
      await redis.expire(key, TTL_SECONDS)
    }
  } catch (err) {
    console.warn(`[ai-cost-cap] failed to record spend for ${agencyId}: ${(err as Error).message}`)
    // Swallow — cost tracking must never break user requests
  } finally {
    await redis.quit()
  }
}

// ---------------------------------------------------------------------------
// resetMonthlySpend
// ---------------------------------------------------------------------------

/**
 * Deletes ALL agency monthly-spend keys matching `agency:*:ai:monthly-spend`.
 * Called by the BullMQ monthly cron on the 1st of each month at midnight UTC.
 * Returns the count of keys deleted.
 */
export async function resetMonthlySpend(): Promise<number> {
  const pattern = 'agency:*:ai:monthly-spend'
  const redis = createRedisClient()
  try {
    const keys: string[] = []
    let cursor = '0'

    // SCAN in a loop to collect all matching keys (avoids KEYS blocking Redis)
    do {
      const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor
      keys.push(...batch)
    } while (cursor !== '0')

    if (keys.length === 0) return 0

    // Delete keys in a pipeline for efficiency
    const pipeline = redis.pipeline()
    for (const key of keys) {
      pipeline.del(key)
    }
    await pipeline.exec()

    return keys.length
  } finally {
    await redis.quit()
  }
}
