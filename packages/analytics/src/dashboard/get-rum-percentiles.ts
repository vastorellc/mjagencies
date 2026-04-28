/**
 * packages/analytics/src/dashboard/get-rum-percentiles.ts
 *
 * REQ-143 + Plan 11-07: RUM p75 LCP/INP/CLS over last 24h, per page.
 * Reads from web_vitals table populated by WebVitalsReporter sendBeacon (Plan 11-07).
 *
 * Pattern follows packages/db withAgencyContext — set_config('app.agency_id', ..., true)
 * is applied transaction-locally so RLS policies pass on the per-agency database.
 */
import 'server-only'
import { sql } from 'drizzle-orm'
import { createAgencyDb, withAgencyContext, type AgencyDb } from '@mjagency/db'
import type { AgencySlug } from '@mjagency/config'

export type RumMetricName = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB'

export interface RumPercentile {
  metric: RumMetricName
  pagePath: string | null // null = aggregated across pages
  p75: number
  rating: 'good' | 'needs-improvement' | 'poor'
}

export interface AgencyDbContext {
  /** Per-agency Drizzle client. Caller is responsible for lifecycle. */
  db: AgencyDb
  /** UUID used to set app.agency_id for RLS. */
  agencyId: string
}

/**
 * Resolve a per-agency DB client + agencyId from environment variables.
 * Used by the dashboard data layer when a long-lived AgencyDb is not injected.
 *
 * Returns null when DB credentials or agency UUID are not configured (allows
 * dashboard to render in environments without DB connectivity).
 */
export function resolveAgencyDb(slug: AgencySlug): AgencyDbContext | null {
  const password = process.env['DB_APP_PASSWORD']
  const agencyId = process.env['NEXT_PUBLIC_AGENCY_ID'] ?? process.env['AGENCY_ID']
  if (!password || !agencyId) return null
  return { db: createAgencyDb(slug, password), agencyId }
}

/** Per-page p75 over last 24h for a metric. Returns top 10 worst pages. */
export async function getRumPerPagePercentiles(
  ctx: AgencyDbContext,
  metric: RumMetricName,
): Promise<RumPercentile[]> {
  const result = await withAgencyContext(ctx.db, ctx.agencyId, async (tx) => {
    const r = await tx.execute<{ page_path: string; p75: number }>(sql`
      SELECT
        page_path,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY value)::double precision AS p75
      FROM web_vitals
      WHERE agency_id = ${ctx.agencyId}::uuid
        AND metric_name = ${metric}
        AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY page_path
      ORDER BY p75 DESC
      LIMIT 10
    `)
    return r
  })
  const rows = (result as unknown as { rows?: Array<{ page_path: string; p75: number }> }).rows ?? []
  return rows.map((r) => ({
    metric,
    pagePath: r.page_path,
    p75: r.p75,
    rating: rateMetric(metric, r.p75),
  }))
}

/** Site-wide p75 (aggregated across pages) for a single metric over last 24h. */
export async function getRumOverallP75(
  ctx: AgencyDbContext,
  metric: RumMetricName,
): Promise<RumPercentile> {
  const result = await withAgencyContext(ctx.db, ctx.agencyId, async (tx) => {
    const r = await tx.execute<{ p75: number | null }>(sql`
      SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY value)::double precision AS p75
      FROM web_vitals
      WHERE agency_id = ${ctx.agencyId}::uuid
        AND metric_name = ${metric}
        AND created_at > NOW() - INTERVAL '24 hours'
    `)
    return r
  })
  const rows = (result as unknown as { rows?: Array<{ p75: number | null }> }).rows ?? []
  const p75 = rows[0]?.p75 ?? 0
  return { metric, pagePath: null, p75, rating: rateMetric(metric, p75) }
}

/**
 * UI-SPEC Surface 1 thresholds. Aligned with web-vitals package + Google CrUX
 * "good / needs-improvement / poor" tiering.
 */
export function rateMetric(
  metric: RumMetricName,
  value: number,
): 'good' | 'needs-improvement' | 'poor' {
  if (metric === 'LCP') {
    return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor'
  }
  if (metric === 'INP') {
    return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor'
  }
  if (metric === 'CLS') {
    return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor'
  }
  if (metric === 'FCP') {
    return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor'
  }
  // TTFB
  return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor'
}
