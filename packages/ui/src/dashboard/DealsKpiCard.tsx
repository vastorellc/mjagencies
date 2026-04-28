import type * as React from 'react'
/**
 * packages/ui/src/dashboard/DealsKpiCard.tsx
 * REQ-143 — open pipeline value + count, from crm_deals aggregate.
 */
import { KpiCard } from './KpiCard.js'

export interface DealsKpiCardProps {
  pipelineValue: number
  openCount: number
  loading?: boolean
}

export function DealsKpiCard({ pipelineValue, openCount, loading }: DealsKpiCardProps): React.ReactElement {
  if (loading) {
    return <KpiCard label="Open pipeline" value="—" loading />
  }
  return (
    <KpiCard
      label="Open pipeline"
      value={formatCurrency(pipelineValue)}
      trend={{
        delta: openCount,
        direction: 'positive',
        label: openCount === 1 ? 'open deal' : 'open deals',
      }}
    />
  )
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}
