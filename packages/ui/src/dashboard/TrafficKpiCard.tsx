import type * as React from 'react'
/**
 * packages/ui/src/dashboard/TrafficKpiCard.tsx
 *
 * GA4 sessions card (last 7 days) with WoW trend + sparkline.
 * Renders inline error message on Promise.allSettled failure (UI-SPEC partial
 * error state — the rest of the dashboard keeps rendering).
 */
import type { SessionsData } from '@mjagency/analytics'
import { KpiCard } from './KpiCard.js'

export interface TrafficKpiCardProps {
  sessions: SessionsData | { error: string }
  loading?: boolean
}

export function TrafficKpiCard({ sessions, loading }: TrafficKpiCardProps): React.ReactElement {
  if (loading) {
    return <KpiCard label="Sessions (7d)" value="—" loading />
  }

  if ('error' in sessions) {
    return (
      <KpiCard
        label="Sessions (7d)"
        value="—"
        error="Traffic data unavailable. Other metrics still up to date."
      />
    )
  }

  return (
    <KpiCard
      label="Sessions (7d)"
      value={formatNumber(sessions.totalSessions)}
      trend={{
        delta: sessions.trendWoW,
        direction: sessions.trendWoW >= 0 ? 'positive' : 'negative',
        label: 'vs prior 7 days',
      }}
      sparklinePoints={sessions.sparklinePoints}
      sparklineTitle="Sessions per day, last 7 days"
    />
  )
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}
