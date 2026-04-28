/**
 * packages/compliance/src/erasure/delete-from-redis.ts
 * Plan 11-05 / REQ-144 D-05 (system 2 of 7):
 *
 * Best-effort deletion of cache entries keyed by an email-derived hash within the
 * per-agency Redis namespace `agency:<agencyId>:*`.
 *
 * NOTE: We do NOT scan the entire `agency:*` keyspace blindly — we look up keys
 * known to be email-keyed (rate-limit by email-hash, identity caches, etc.).
 * Phase 9 + Phase 11-01 maintain explicit lists of email-keyed cache patterns.
 */
import { createHash } from 'node:crypto'
import { Redis } from 'ioredis'

export interface DeleteFromRedisInput {
  agencyId: string
  email: string
}

export interface DeleteFromRedisResult {
  deleted: number
  skipped: number
  scannedPatterns: string[]
}

export async function deleteFromRedis(
  input: DeleteFromRedisInput,
): Promise<DeleteFromRedisResult> {
  const host = process.env['REDIS_HOST'] ?? 'localhost'
  const port = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)
  const redis = new Redis({ host, port })

  try {
    const emailHash = createHash('sha256').update(input.email).digest('hex')
    const patterns = [
      `agency:${input.agencyId}:cache:contact:${emailHash}*`,
      `agency:${input.agencyId}:ratelimit:email:${emailHash}*`,
      `agency:${input.agencyId}:session:user:${emailHash}*`,
    ]

    let totalDeleted = 0
    for (const pattern of patterns) {
      const stream = redis.scanStream({ match: pattern, count: 100 })
      const keys: string[] = []
      for await (const batch of stream) {
        const arr = batch as unknown as string[]
        for (const k of arr) keys.push(k)
      }
      if (keys.length > 0) {
        await redis.del(...keys)
        totalDeleted += keys.length
      }
    }

    return { deleted: totalDeleted, skipped: 0, scannedPatterns: patterns }
  } finally {
    await redis.quit().catch(() => {
      /* ignore close errors */
    })
  }
}
