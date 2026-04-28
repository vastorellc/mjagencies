/**
 * packages/analytics/src/dashboard/get-dashboard-metrics.ts
 *
 * REQ-143 orchestrator: returns all KPI data for one or more agencies.
 *
 * Pitfall 4.3 mitigation: per-agency aggregates + GA4 reads run in parallel via
 * Promise.allSettled so a single failing source (e.g., GA4 quota exhaustion)
 * never breaks the dashboard — partial errors surface inline (UI-SPEC Surface 1).
 *
 * Per-agency view: pass [session.agencyId].
 * Platform view (super_admin): pass all 12 agency UUIDs; orchestrator fans out
 * one set of queries per agency, parallel.
 */
import 'server-only'
import {
  getSessionsLast7d,
  getTopPages,
  type SessionsData,
  type TopPage,
} from './get-ga4-traffic.js'
import {
  getRumOverallP75,
  type RumPercentile,
  type AgencyDbContext,
} from './get-rum-percentiles.js'
import {
  getLeadsCount,
  getLeadsTrendWoW,
  getOpenPipelineValue,
  getOpenPipelineCount,
  getRevenueMtd,
} from './get-postgres-aggregates.js'

export interface AgencyTarget {
  /** Agency UUID — used for RLS + GA4 secret lookup. */
  agencyId: string
  /**
   * Per-agency Drizzle connection context (db + agencyId UUID).
   * When omitted, RUM + Postgres aggregates are skipped (returns zeros).
   */
  dbContext?: AgencyDbContext
  /** Display label shown in the platform-overview rollup table. */
  label?: string
}

export interface PerAgencyMetrics {
  agencyId: string
  label: string
  sessions: SessionsData | { error: string }
  topPages: TopPage[] | { error: string }
  rum: { lcp: RumPercentile; inp: RumPercentile; cls: RumPercentile }
  leads: { count: number; trendWoW: number }
  pipeline: { value: number; openCount: number }
  revenue: { amountMtd: number; invoiceCount: number }
  generatedAt: string
}

export interface DashboardMetrics {
  view: 'agency' | 'platform'
  agencies: PerAgencyMetrics[]
}

const ZERO_RUM = (metric: 'LCP' | 'INP' | 'CLS'): RumPercentile => ({
  metric,
  pagePath: null,
  p75: 0,
  rating: 'good',
})

async function metricsForAgency(target: AgencyTarget): Promise<PerAgencyMetrics> {
  const { agencyId, dbContext, label } = target

  // GA4 reads (network-bound, cached in Redis 5min)
  const ga4Promises = Promise.allSettled([
    getSessionsLast7d(agencyId),
    getTopPages(agencyId, 10),
  ])

  // Postgres aggregate reads (skipped when no DB context — returns zeros)
  const dbPromises: Promise<unknown>[] = dbContext
    ? [
        getRumOverallP75(dbContext, 'LCP'),
        getRumOverallP75(dbContext, 'INP'),
        getRumOverallP75(dbContext, 'CLS'),
        getLeadsCount(dbContext, 7),
        getLeadsTrendWoW(dbContext),
        getOpenPipelineValue(dbContext),
        getOpenPipelineCount(dbContext),
        getRevenueMtd(dbContext),
      ]
    : []

  const [ga4Results, dbResults] = await Promise.all([
    ga4Promises,
    Promise.allSettled(dbPromises),
  ])

  const sessionsR = ga4Results[0]
  const topPagesR = ga4Results[1]
  const sessions =
    sessionsR.status === 'fulfilled' ? sessionsR.value : { error: String(sessionsR.reason) }
  const topPages =
    topPagesR.status === 'fulfilled' ? topPagesR.value : { error: String(topPagesR.reason) }

  const lcp = dbContext && dbResults[0]?.status === 'fulfilled' ? (dbResults[0].value as RumPercentile) : ZERO_RUM('LCP')
  const inp = dbContext && dbResults[1]?.status === 'fulfilled' ? (dbResults[1].value as RumPercentile) : ZERO_RUM('INP')
  const cls = dbContext && dbResults[2]?.status === 'fulfilled' ? (dbResults[2].value as RumPercentile) : ZERO_RUM('CLS')
  const leadsCount = dbContext && dbResults[3]?.status === 'fulfilled' ? (dbResults[3].value as number) : 0
  const leadsTrend = dbContext && dbResults[4]?.status === 'fulfilled' ? (dbResults[4].value as number) : 0
  const pipelineValue = dbContext && dbResults[5]?.status === 'fulfilled' ? (dbResults[5].value as number) : 0
  const openCount = dbContext && dbResults[6]?.status === 'fulfilled' ? (dbResults[6].value as number) : 0
  const revenue =
    dbContext && dbResults[7]?.status === 'fulfilled'
      ? (dbResults[7].value as { amount: number; invoiceCount: number })
      : { amount: 0, invoiceCount: 0 }

  return {
    agencyId,
    label: label ?? agencyId,
    sessions,
    topPages,
    rum: { lcp, inp, cls },
    leads: { count: leadsCount, trendWoW: leadsTrend },
    pipeline: { value: pipelineValue, openCount },
    revenue: { amountMtd: revenue.amount, invoiceCount: revenue.invoiceCount },
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Fans out per-agency metric collection in parallel (Pitfall 4.3).
 * Each per-agency call is itself wrapped in Promise.allSettled so partial
 * failures (e.g., GA4 down) don't cascade.
 */
export async function getDashboardMetrics(targets: AgencyTarget[]): Promise<DashboardMetrics> {
  const agencies = await Promise.all(targets.map(metricsForAgency))
  return {
    view: agencies.length > 1 ? 'platform' : 'agency',
    agencies,
  }
}
