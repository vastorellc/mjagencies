/**
 * packages/auth/src/redis.ts
 *
 * ioredis client factory for auth flows.
 *
 * Auth flows MUST pass the same client instance to rotateRefreshToken / regenerateSession
 * so connection pooling is preserved. App startup typically constructs one client and shares it.
 */

import 'server-only'
import IORedis, { type Redis, type RedisOptions } from 'ioredis'

/**
 * Builds an ioredis client from env (REDIS_URL) or accepts override options.
 * lazyConnect:false means the connection is established immediately on creation.
 */
export function createAuthRedis(opts: RedisOptions = {}): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
  return new IORedis(url, { lazyConnect: false, maxRetriesPerRequest: 3, ...opts })
}
