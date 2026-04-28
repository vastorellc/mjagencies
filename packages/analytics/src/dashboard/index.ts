/**
 * packages/analytics/src/dashboard/index.ts
 *
 * REQ-143 dashboard data layer barrel — re-exports orchestrator + per-source
 * helpers for consumption by the Payload custom admin view (Plan 11-04).
 */
export {
  getDashboardMetrics,
  type DashboardMetrics,
  type PerAgencyMetrics,
  type AgencyTarget,
} from './get-dashboard-metrics.js'

export {
  getSessionsLast7d,
  getTopPages,
  type SessionsData,
  type TopPage,
} from './get-ga4-traffic.js'

export {
  getRumOverallP75,
  getRumPerPagePercentiles,
  rateMetric,
  resolveAgencyDb,
  type RumPercentile,
  type RumMetricName,
  type AgencyDbContext,
} from './get-rum-percentiles.js'

export {
  getLeadsCount,
  getLeadsTrendWoW,
  getOpenPipelineValue,
  getOpenPipelineCount,
  getRevenueMtd,
} from './get-postgres-aggregates.js'
