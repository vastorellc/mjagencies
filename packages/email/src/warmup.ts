/**
 * packages/email/src/warmup.ts
 *
 * 35-day email warm-up gate. Prevents high-volume sending before the sending
 * domain has been warmed up to avoid spam filter placement.
 *
 * Warm-up day counter is stored in Redis: agency:<id>:email:warmup-day
 * A daily cron increments this counter. Sending is blocked until day >= 35.
 *
 * REQ-113 (warm-up gate)
 */
import Redis from 'ioredis'
import { createLogger } from '@mjagency/config'

const log = createLogger({ service: 'mjagency-email-warmup' })

const WARMUP_DAYS_REQUIRED = 35

export class EmailWarmupIncompleteError extends Error {
  constructor(agencyId: string, currentDay: number) {
    super(
      `Email warm-up incomplete for agency ${agencyId}. ` +
      `Current day: ${currentDay}/${WARMUP_DAYS_REQUIRED}. ` +
      `Sending is blocked until warm-up completes.`
    )
    this.name = 'EmailWarmupIncompleteError'
  }
}

function getRedis(): Redis {
  return new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  })
}

function warmupKey(agencyId: string): string {
  return `agency:${agencyId}:email:warmup-day`
}

/**
 * Throws EmailWarmupIncompleteError if the agency has not completed 35 warm-up days.
 * Called by createEmailWorker before every send.
 */
export async function rejectSendIfWarmupIncomplete(agencyId: string): Promise<void> {
  const redis = getRedis()
  try {
    const raw = await redis.get(warmupKey(agencyId))
    const currentDay = raw ? parseInt(raw, 10) : 0

    if (currentDay < WARMUP_DAYS_REQUIRED) {
      log.warn({ agencyId, currentDay, required: WARMUP_DAYS_REQUIRED }, 'Email warm-up gate rejected send')
      throw new EmailWarmupIncompleteError(agencyId, currentDay)
    }

    log.debug({ agencyId, currentDay }, 'Email warm-up gate passed')
  } finally {
    await redis.quit()
  }
}

/** Increment the warm-up day counter for an agency. Called by daily cron. */
export async function incrementWarmupDay(agencyId: string): Promise<number> {
  const redis = getRedis()
  try {
    const newDay = await redis.incr(warmupKey(agencyId))
    log.info({ agencyId, newDay }, 'Email warm-up day incremented')
    return newDay
  } finally {
    await redis.quit()
  }
}

/** Get current warm-up day (0 if not started). */
export async function getWarmupDay(agencyId: string): Promise<number> {
  const redis = getRedis()
  try {
    const raw = await redis.get(warmupKey(agencyId))
    return raw ? parseInt(raw, 10) : 0
  } finally {
    await redis.quit()
  }
}
