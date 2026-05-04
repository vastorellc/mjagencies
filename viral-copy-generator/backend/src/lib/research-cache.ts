// backend/src/lib/research-cache.ts
// Phase 9: Content Research Engine — RESEARCH-06
// Trend cache read/write + refreshAllNiches orchestrator
// Full implementation in Plan 09-03. This stub satisfies tsc for boss.ts dynamic import.
import type { TrendItem } from '../db/schema.js'

// Stub: getTrendCache — returns null when no fresh row exists (source, niche)
export async function getTrendCache(_source: string, _niche: string): Promise<TrendItem[] | null> {
  // TODO Plan 09-03: implement with db.execute sql`SELECT ... WHERE fetched_at > NOW() - INTERVAL '24 hours'`
  throw new Error('research-cache.ts not yet implemented — available in Plan 09-03')
}

// Stub: setTrendCache — upserts (source, niche) row
export async function setTrendCache(
  _source: string,
  _niche: string,
  _data: TrendItem[],
): Promise<void> {
  // TODO Plan 09-03: implement with ON CONFLICT (source, niche) DO UPDATE
  throw new Error('research-cache.ts not yet implemented — available in Plan 09-03')
}

// Stub: isCacheFresh — checks if cached row is within 24h TTL
export async function isCacheFresh(_source: string, _niche: string): Promise<boolean> {
  // TODO Plan 09-03
  return false
}

// Stub: refreshAllNiches — called by pg-boss refresh-trends job
// Fetches all 4 trend sources for all 6 niches and upserts into trend_cache
export async function refreshAllNiches(): Promise<void> {
  // TODO Plan 09-03: iterate NICHES, call all 4 fetchers, call setTrendCache
  throw new Error('refreshAllNiches not yet implemented — available in Plan 09-03')
}
