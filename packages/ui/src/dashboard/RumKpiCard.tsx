import type * as React from 'react'
/**
 * packages/ui/src/dashboard/RumKpiCard.tsx
 *
 * UI-SPEC Surface 1 RUM card with threshold pill (Healthy / Above target).
 * Used for LCP / INP / CLS p75 cards. Reads RumPercentile from
 * @mjagency/analytics dashboard data layer.
 */
import type { RumPercentile } from '@mjagency/analytics'
import { RumThresholdPill } from './RumThresholdPill.js'

export interface RumKpiCardProps {
  metric: 'LCP' | 'INP' | 'CLS'
  value: RumPercentile
  /** Override the visible label (default = metric + " p75"). */
  label?: string
  /** Render skeleton instead of value. */
  loading?: boolean
  /** Render empty-state copy when no data points received yet. */
  empty?: boolean
}

export function RumKpiCard(props: RumKpiCardProps): React.ReactElement {
  const { metric, value, label, loading, empty } = props
  const visibleLabel = label ?? `${metric} (p75)`

  if (loading) {
    return (
      <div className="kpi-card kpi-card--skeleton" aria-busy="true" aria-label={`${visibleLabel} loading`} />
    )
  }

  return (
    <div className="kpi-card">
      <h2 className="kpi-card__label">{visibleLabel}</h2>
      {empty ? (
        <span className="kpi-card__empty">Your dashboard will populate within 24 hours</span>
      ) : (
        <>
          <span className="kpi-card__value" aria-live="polite">
            {formatRumValue(metric, value.p75)}
          </span>
          <RumThresholdPill rating={value.rating} />
        </>
      )}
    </div>
  )
}

function formatRumValue(metric: 'LCP' | 'INP' | 'CLS', p75: number): string {
  if (metric === 'CLS') return p75.toFixed(2)
  if (metric === 'LCP') return `${(p75 / 1000).toFixed(2)}s`
  return `${Math.round(p75)}ms` // INP
}
