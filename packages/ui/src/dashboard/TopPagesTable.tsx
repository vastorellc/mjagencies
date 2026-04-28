import type * as React from 'react'
/**
 * packages/ui/src/dashboard/TopPagesTable.tsx
 *
 * UI-SPEC Surface 1 Top Pages table — top 10 pages by GA4 sessions over 7d
 * with optional LCP p75 column from web_vitals (when present).
 */
import type { TopPage } from '@mjagency/analytics'

export interface TopPagesTableProps {
  pages: TopPage[] | { error: string }
  loading?: boolean
}

export function TopPagesTable({ pages, loading }: TopPagesTableProps): React.ReactElement {
  if (loading) {
    return (
      <div className="kpi-card kpi-card--skeleton" aria-busy="true" aria-label="Top pages loading" />
    )
  }

  if ('error' in pages) {
    return (
      <div className="kpi-card">
        <h2 className="kpi-card__label">Top pages</h2>
        <span className="kpi-card__error" role="status">
          Top pages unavailable. Other metrics still up to date.
        </span>
      </div>
    )
  }

  if (pages.length === 0) {
    return (
      <div className="kpi-card">
        <h2 className="kpi-card__label">Top pages</h2>
        <span className="kpi-card__empty">Your dashboard will populate within 24 hours</span>
      </div>
    )
  }

  return (
    <table className="dashboard-table" aria-label="Top pages by sessions">
      <thead>
        <tr>
          <th scope="col">Page</th>
          <th scope="col">Sessions</th>
          <th scope="col">LCP p75</th>
        </tr>
      </thead>
      <tbody>
        {pages.map((p) => (
          <tr key={p.pagePath}>
            <td>{p.pagePath}</td>
            <td>{p.sessions.toLocaleString('en-US')}</td>
            <td>{formatLcp(p.lcpP75)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function formatLcp(p75?: number): string {
  if (p75 === undefined || p75 === null) return '—'
  return `${(p75 / 1000).toFixed(2)}s`
}
