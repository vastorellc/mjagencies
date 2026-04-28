import type * as React from 'react'
/**
 * packages/ui/src/dashboard/KpiCard.tsx
 *
 * Base KPI card primitive used by all Surface 1 KPI cards.
 *
 * Typography contract (UI-SPEC strict):
 *   - label = --mj-text-size-sm (14px) / --mj-weight-normal (400)
 *   - value = --mj-text-size-4xl (36px) / --mj-weight-bold (700)
 *   - trend / error = --mj-text-size-sm / --mj-weight-normal
 * No inline styles — all visual rules live in dashboard.css.
 *
 * a11y: KPI value spans render with aria-live="polite" so screen readers
 * announce the new number after each 60s refresh.
 */
import { Sparkline } from './Sparkline.js'

export interface KpiTrend {
  /** Percent delta vs prior window (e.g. 12 = +12% WoW). */
  delta: number
  /** Direction governs color — positive = success, negative = error. */
  direction: 'positive' | 'negative'
  /** Copy describing the comparison window (e.g. "vs prior 7 days"). */
  label?: string
}

export interface KpiCardProps {
  label: string
  /** Numeric or pre-formatted value (e.g. "$12,500" or 1234). */
  value: string | number
  /** Optional WoW trend chip below the value. */
  trend?: KpiTrend
  /** Optional sparkline (e.g. 7-day session counts). */
  sparklinePoints?: number[]
  /** Sparkline title for screen readers. */
  sparklineTitle?: string
  /** Render skeleton instead of value (initial paint while data loads). */
  loading?: boolean
  /** Inline error message (partial-error state, UI-SPEC Surface 1). */
  error?: string
  /** Render the empty-state copy from UI-SPEC Surface 1. */
  empty?: boolean
}

export function KpiCard(props: KpiCardProps): React.ReactElement {
  const { label, value, trend, sparklinePoints, sparklineTitle, loading, error, empty } = props

  if (loading) {
    return <div className="kpi-card kpi-card--skeleton" aria-busy="true" aria-label={`${label} loading`} />
  }

  return (
    <div className="kpi-card">
      <h2 className="kpi-card__label">{label}</h2>
      {error ? (
        <span className="kpi-card__error" role="status">{error}</span>
      ) : empty ? (
        <span className="kpi-card__empty">Your dashboard will populate within 24 hours</span>
      ) : (
        <>
          <span className="kpi-card__value" aria-live="polite">{value}</span>
          {trend ? (
            <span
              className={
                trend.direction === 'positive'
                  ? 'kpi-card__trend kpi-card__trend--positive'
                  : 'kpi-card__trend kpi-card__trend--negative'
              }
            >
              {trend.direction === 'positive' ? '+' : ''}
              {trend.delta}% {trend.label ?? 'vs prior 7 days'}
            </span>
          ) : null}
          {sparklinePoints && sparklinePoints.length > 0 ? (
            <Sparkline points={sparklinePoints} title={sparklineTitle} />
          ) : null}
        </>
      )}
    </div>
  )
}
