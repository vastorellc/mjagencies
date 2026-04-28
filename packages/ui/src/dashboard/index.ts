/**
 * packages/ui/src/dashboard/index.ts
 *
 * REQ-143 dashboard component barrel — re-exports all KPI primitives, tables,
 * tabs, refresh control, polling hook, and the DashboardPolling client wrapper.
 *
 * Consumers:
 *   - packages/cms/src/admin-views/DashboardView.tsx — Payload custom admin view
 */
export { KpiCard, type KpiCardProps, type KpiTrend } from './KpiCard.js'
export { Sparkline, type SparklineProps } from './Sparkline.js'
export { TrafficKpiCard, type TrafficKpiCardProps } from './TrafficKpiCard.js'
export { RumKpiCard, type RumKpiCardProps } from './RumKpiCard.js'
export { RumThresholdPill, type RumThresholdPillProps } from './RumThresholdPill.js'
export { LeadsKpiCard, type LeadsKpiCardProps } from './LeadsKpiCard.js'
export { DealsKpiCard, type DealsKpiCardProps } from './DealsKpiCard.js'
export { RevenueKpiCard, type RevenueKpiCardProps } from './RevenueKpiCard.js'
export { TopPagesTable, type TopPagesTableProps } from './TopPagesTable.js'
export { AgencyRollupTable, type AgencyRollupTableProps } from './AgencyRollupTable.js'
export { DashboardTabs, type DashboardTabsProps } from './DashboardTabs.js'
export { RefreshControl, type RefreshControlProps } from './RefreshControl.js'
export { DataSourcesFooter } from './DataSourcesFooter.js'
export {
  useDashboardPolling,
  type UseDashboardPollingOptions,
  type UseDashboardPollingResult,
} from './use-dashboard-polling.js'
export { DashboardPolling, type DashboardPollingProps } from './DashboardPolling.js'
