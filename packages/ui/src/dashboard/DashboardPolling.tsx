'use client'
/**
 * packages/ui/src/dashboard/DashboardPolling.tsx
 *
 * Top-level dashboard client component. Wraps useDashboardPolling and renders
 * either the per-agency KPI grid or the platform rollup table based on viewMode.
 *
 * D-14: 60s polling, paused while tab not visible.
 * Pitfall 4.5: zero inline styles — all visuals via dashboard.css.
 */
import type * as React from 'react'
import type { DashboardMetrics } from '@mjagency/analytics'
import { useDashboardPolling } from './use-dashboard-polling.js'
import { TrafficKpiCard } from './TrafficKpiCard.js'
import { RumKpiCard } from './RumKpiCard.js'
import { LeadsKpiCard } from './LeadsKpiCard.js'
import { DealsKpiCard } from './DealsKpiCard.js'
import { RevenueKpiCard } from './RevenueKpiCard.js'
import { TopPagesTable } from './TopPagesTable.js'
import { AgencyRollupTable } from './AgencyRollupTable.js'
import { RefreshControl } from './RefreshControl.js'

export interface DashboardPollingProps {
  initial: DashboardMetrics
  viewMode: 'agency' | 'platform'
}

export function DashboardPolling({ initial, viewMode }: DashboardPollingProps): React.ReactElement {
  const { data, lastUpdatedAt, lastErrorAt, isFetching, refresh } = useDashboardPolling({
    initial,
    viewMode,
  })

  if (viewMode === 'platform') {
    return (
      <>
        <RefreshControl
          isFetching={isFetching}
          lastUpdatedAt={lastUpdatedAt}
          lastErrorAt={lastErrorAt}
          onRefresh={() => void refresh()}
        />
        <section className="dashboard-section" aria-label="Platform overview">
          <h2 className="dashboard-section__title">Platform overview</h2>
          <AgencyRollupTable agencies={data.agencies} />
        </section>
      </>
    )
  }

  // Per-agency view — show first (and only) agency's metrics.
  const agency = data.agencies[0]
  if (!agency) {
    return (
      <section className="dashboard-empty">
        <h2 className="dashboard-empty__title">Your dashboard will populate within 24 hours</h2>
        <p className="dashboard-empty__copy">
          We&rsquo;re still gathering analytics for this agency. Come back tomorrow.
        </p>
      </section>
    )
  }

  return (
    <>
      <RefreshControl
        isFetching={isFetching}
        lastUpdatedAt={lastUpdatedAt}
        lastErrorAt={lastErrorAt}
        onRefresh={() => void refresh()}
      />

      <section className="dashboard-section" aria-label="Key performance indicators">
        <h2 className="dashboard-section__title">Key performance indicators</h2>
        <div className="dashboard-grid">
          <TrafficKpiCard sessions={agency.sessions} />
          <LeadsKpiCard count={agency.leads.count} trendWoW={agency.leads.trendWoW} />
          <DealsKpiCard
            pipelineValue={agency.pipeline.value}
            openCount={agency.pipeline.openCount}
          />
          <RevenueKpiCard
            amountMtd={agency.revenue.amountMtd}
            invoiceCount={agency.revenue.invoiceCount}
          />
        </div>
      </section>

      <section className="dashboard-section" aria-label="Real user measurements">
        <h2 className="dashboard-section__title">Real user measurements (last 24 hours)</h2>
        <div className="dashboard-grid">
          <RumKpiCard metric="LCP" value={agency.rum.lcp} />
          <RumKpiCard metric="INP" value={agency.rum.inp} />
          <RumKpiCard metric="CLS" value={agency.rum.cls} />
        </div>
      </section>

      <section className="dashboard-section" aria-label="Top pages">
        <h2 className="dashboard-section__title">Top pages</h2>
        <TopPagesTable pages={agency.topPages} />
      </section>
    </>
  )
}
