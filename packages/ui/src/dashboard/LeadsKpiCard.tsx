import type * as React from 'react'
/**
 * packages/ui/src/dashboard/LeadsKpiCard.tsx
 * REQ-143 — new leads (7d) with WoW trend, from crm_contacts aggregate.
 */
import { KpiCard } from './KpiCard.js'

export interface LeadsKpiCardProps {
  count: number
  trendWoW: number
  loading?: boolean
}

export function LeadsKpiCard({ count, trendWoW, loading }: LeadsKpiCardProps): React.ReactElement {
  if (loading) {
    return <KpiCard label="New leads (7d)" value="—" loading />
  }
  return (
    <KpiCard
      label="New leads (7d)"
      value={count.toLocaleString('en-US')}
      trend={{
        delta: trendWoW,
        direction: trendWoW >= 0 ? 'positive' : 'negative',
        label: 'vs prior 7 days',
      }}
    />
  )
}
