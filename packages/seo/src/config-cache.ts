/**
 * packages/seo/src/config-cache.ts
 *
 * Redis-backed SEO config cache for per-agency plugin weight overrides.
 * Key: agency:<id>:seo-config (D-03)
 * TTL: 300 seconds (invalidated by afterOperation hook on settings save)
 */
import { Redis } from 'ioredis'
import { PLUGIN_DEFAULTS } from './plugin-defaults.js'
import type { PluginDefaults } from './plugin-defaults.js'

const CACHE_TTL_SECONDS = 300

function createRedisClient(): Redis {
  return new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  })
}

/**
 * Returns merged agency SEO config (defaults + agency override merge-patch).
 * Falls back to PLUGIN_DEFAULTS on cache miss — Payload settings lookup
 * is done in the server action context (plan 06-01 Task 2).
 */
export async function getAgencySeoConfig(agencyId: string): Promise<PluginDefaults> {
  const redis = createRedisClient()
  try {
    const cached = await redis.get(`agency:${agencyId}:seo-config`)
    if (cached) {
      const override = JSON.parse(cached) as Partial<PluginDefaults>
      // Merge-patch: agency override keys take precedence over defaults (D-02)
      // Deep merge at the top level only — nested objects are merged shallowly
      return {
        seo_classic: { ...PLUGIN_DEFAULTS.seo_classic, ...(override.seo_classic ?? {}) },
        aio_citations: {
          ...PLUGIN_DEFAULTS.aio_citations,
          ...(override.aio_citations ?? {}),
        },
        geo_chunking: { ...PLUGIN_DEFAULTS.geo_chunking, ...(override.geo_chunking ?? {}) },
        score_thresholds: {
          ...PLUGIN_DEFAULTS.score_thresholds,
          ...(override.score_thresholds ?? {}),
        },
      }
    }
    // Cache miss: return defaults
    return PLUGIN_DEFAULTS
  } finally {
    await redis.quit()
  }
}

/**
 * Stores per-agency plugin config override in Redis.
 * Called when loading from Payload settings to warm the cache.
 */
export async function setAgencySeoConfig(
  agencyId: string,
  config: Partial<PluginDefaults>,
): Promise<void> {
  const redis = createRedisClient()
  try {
    await redis.set(
      `agency:${agencyId}:seo-config`,
      JSON.stringify(config),
      'EX',
      CACHE_TTL_SECONDS,
    )
  } finally {
    await redis.quit()
  }
}

/**
 * Deletes the seo-config cache entry for an agency.
 * Exported for use in packages/cms settings afterOperation hook (D-03).
 */
export async function deleteSeoConfigCache(agencyId: string): Promise<void> {
  const redis = createRedisClient()
  try {
    await redis.del(`agency:${agencyId}:seo-config`)
  } finally {
    await redis.quit()
  }
}
