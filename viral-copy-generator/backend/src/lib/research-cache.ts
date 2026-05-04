// backend/src/lib/research-cache.ts
// RESEARCH-06: 24-hour trend data cache with upsert pattern
// trend_cache is global (no user_id) — all users sharing a niche get the same data
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import type { TrendItem } from '../db/schema.js'

const ALL_NICHES = ['travel', 'hotels', 'cars', 'bikes', 'coding', 'lifestyle'] as const

// ── Cache query ───────────────────────────────────────────────────────────────
// Returns null on cache miss. Returns { data, fetchedAt } on cache hit.
export async function getTrendCache(
  source: string,
  niche: string,
): Promise<{ data: TrendItem[]; fetchedAt: string } | null> {
  const rows = await db.execute<{ data: TrendItem[]; fetched_at: string }>(
    sql`SELECT data, fetched_at::text AS fetched_at
        FROM trend_cache
        WHERE source = ${source}
          AND niche = ${niche}
          AND fetched_at > NOW() - INTERVAL '24 hours'
        ORDER BY fetched_at DESC
        LIMIT 1`,
  )
  const row = rows.rows[0]
  if (!row) return null
  return { data: row.data, fetchedAt: row.fetched_at }
}

// ── Cache upsert ──────────────────────────────────────────────────────────────
// ON CONFLICT requires unique('trend_cache_source_niche_unique') — set in schema.ts Plan 09-01
export async function setTrendCache(
  source: string,
  niche: string,
  data: TrendItem[],
): Promise<void> {
  await db.execute(
    sql`INSERT INTO trend_cache (source, niche, data, fetched_at)
        VALUES (${source}, ${niche}, ${JSON.stringify(data)}::jsonb, NOW())
        ON CONFLICT (source, niche)
        DO UPDATE SET data = ${JSON.stringify(data)}::jsonb, fetched_at = NOW()`,
  )
}

// ── Cache freshness check ─────────────────────────────────────────────────────
export async function isCacheFresh(source: string, niche: string): Promise<boolean> {
  const result = await getTrendCache(source, niche)
  return result !== null
}

// ── Niche refresh — called by pg-boss job handler ────────────────────────────
// Lazy-imports all four fetchers to avoid circular dep between boss.ts and db module
export async function refreshAllNiches(): Promise<void> {
  const [
    { fetchYouTubeTrends },
    { fetchGoogleTrends },
    { fetchRedditTrends },
    { fetchExplodingTopics },
  ] = await Promise.all([
    import('./trends/youtube.js'),
    import('./trends/google-trends.js'),
    import('./trends/reddit.js'),
    import('./trends/exploding.js'),
  ])

  for (const niche of ALL_NICHES) {
    try {
      const [yt, gt, rd, et] = await Promise.allSettled([
        fetchYouTubeTrends(niche),
        fetchGoogleTrends(niche),
        fetchRedditTrends(niche),
        fetchExplodingTopics(niche),
      ])

      const merged: TrendItem[] = [
        ...(yt.status === 'fulfilled' ? yt.value : []),
        ...(gt.status === 'fulfilled' ? gt.value : []),
        ...(rd.status === 'fulfilled' ? rd.value : []),
        ...(et.status === 'fulfilled' ? et.value : []),
      ]

      await setTrendCache('all', niche, merged)
    } catch (err) {
      // Per-niche failure never aborts the refresh loop
      console.error(`[research-cache] refresh failed for niche=${niche}:`, err)
    }
  }
}
