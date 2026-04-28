import type * as React from 'react'
/**
 * packages/ui/src/dashboard/AgencyRollupTable.tsx
 *
 * UI-SPEC Surface 2 platform overview — one row per agency, super_admin only.
 * Columns: Agency, Sessions 7d, Leads 7d, Pipeline value, Revenue MTD, LCP p75.
 *
 * Threat T-11-04-02 surface: this component never decides authorization — the
 * server component (DashboardView) gates on session.role === 'super_admin'
 * before fetching the data; this component only renders.
 */
import type { PerAgencyMetrics } from '@mjagency/analytics'

export interface AgencyRollupTableProps {
  agencies: PerAgencyMetrics[]
  loading?: boolean
}

export function AgencyRollupTable({ agencies, loading }: AgencyRollupTableProps): React.ReactElement {
  if (loading) {
    return (
      <div className="kpi-card kpi-card--skeleton" aria-busy="true" aria-label="Platform rollup loading" />
    )
  }

  if (agencies.length === 0) {
    return (
      <div className="kpi-card">
        <h2 className="kpi-card__label">Platform overview</h2>
        <span className="kpi-card__empty">Your dashboard will populate within 24 hours</span>
      </div>
    )
  }

  return (
    <table className="dashboard-table" aria-label="Platform overview by agency">
      <thead>
        <tr>
          <th scope="col">Agency</th>
          <th scope="col">Sessions (7d)</th>
          <th scope="col">Leads (7d)</th>
          <th scope="col">Pipeline</th>
          <th scope="col">Revenue (MTD)</th>
          <th scope="col">LCP p75</th>
        </tr>
      </thead>
      <tbody>
        {agencies.map((a) => (
          <tr key={a.agencyId}>
            <td>{a.label}</td>
            <td>{formatSessions(a.sessions)}</td>
            <td>{a.leads.count.toLocaleString('en-US')}</td>
            <td>{formatCurrency(a.pipeline.value)}</td>
            <td>{formatCurrency(a.revenue.amountMtd)}</td>
            <td>{formatLcp(a.rum.lcp.p75)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function formatSessions(s: PerAgencyMetrics['sessions']): string {
  if ('error' in s) return '—'
  return s.totalSessions.toLocaleString('en-US')
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatLcp(p75: number): string {
  if (p75 === 0) return '—'
  return `${(p75 / 1000).toFixed(2)}s`
}
