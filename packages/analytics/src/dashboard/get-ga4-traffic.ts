/**
 * packages/analytics/src/dashboard/get-ga4-traffic.ts
 *
 * REQ-143 + D-12: GA4 Data API reuse from Plan 11-01 (Sessions + Top Pages).
 * Inherits the 5-min Redis cache configured in runReport (Pitfall 4.2 GA4 quota mitigation).
 */
import 'server-only'
import { runReport } from '../ga4-data-api.js'

export interface SessionsData {
  totalSessions: number
  /** Percent change vs prior 7 days. Positive = growth. */
  trendWoW: number
  /** Per-day session counts for the 7-day window (used for sparkline). */
  sparklinePoints: number[]
}

export async function getSessionsLast7d(agencyId: string): Promise<SessionsData> {
  // Two date ranges: this week + prior week. GA4 returns the rows mixed; we split
  // by daily date dimension into the two halves.
  const rows = await runReport({
    agencyId,
    dateRanges: [
      { startDate: '7daysAgo', endDate: 'yesterday' },
      { startDate: '14daysAgo', endDate: '8daysAgo' },
    ],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'sessions' }],
  })

  // Split by row index: GA4 returns each date range's rows contiguously. With
  // 7-day ranges we expect ~14 rows total; the first half is "this week", the
  // second half is "prior week".
  const half = Math.floor(rows.length / 2)
  const thisWeekRows = rows.slice(0, half)
  const priorWeekRows = rows.slice(half)
  const thisTotal = thisWeekRows.reduce(
    (sum, r) => sum + parseInt(r.metricValues[0]?.value ?? '0', 10),
    0,
  )
  const priorTotal = priorWeekRows.reduce(
    (sum, r) => sum + parseInt(r.metricValues[0]?.value ?? '0', 10),
    0,
  )
  const trend = priorTotal === 0
    ? (thisTotal > 0 ? 100 : 0)
    : Math.round(((thisTotal - priorTotal) / priorTotal) * 100)
  const sparkline = thisWeekRows.map((r) => parseInt(r.metricValues[0]?.value ?? '0', 10))

  return { totalSessions: thisTotal, trendWoW: trend, sparklinePoints: sparkline }
}

export interface TopPage {
  pagePath: string
  sessions: number
  /** LCP p75 from web_vitals join — populated separately by the orchestrator. */
  lcpP75?: number
}

export async function getTopPages(agencyId: string, limit = 10): Promise<TopPage[]> {
  const rows = await runReport({
    agencyId,
    dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'sessions' }],
    limit,
    orderBys: [{ desc: true, metric: { metricName: 'sessions' } }],
  })
  return rows.map((r) => ({
    pagePath: r.dimensionValues[0]?.value ?? '',
    sessions: parseInt(r.metricValues[0]?.value ?? '0', 10),
  }))
}
