/**
 * packages/ui/src/dashboard/Sparkline.tsx
 *
 * Inline SVG polyline sparkline for dashboard KPI cards.
 *
 * Pitfall 4.5: this component MUST NOT use a `style={...}` prop on the SVG
 * elements — the per-request CSP nonce (Plan 11-07) blocks inline styles.
 * Instead it relies on the external `.dashboard-sparkline` class defined in
 * dashboard.css which sets stroke + fill via var(--mj-color-brand-500).
 */
import * as React from 'react'

export interface SparklineProps {
  /** Series of numeric data points (e.g. daily session counts). */
  points: number[]
  /** Optional accessible title for screen readers. */
  title?: string
}

export function Sparkline({ points, title }: SparklineProps): React.ReactElement | null {
  if (points.length === 0) return null
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = max - min === 0 ? 1 : max - min
  const segments = points
    .map((p, i) => {
      const x = points.length === 1 ? 50 : (i / (points.length - 1)) * 100
      const y = 100 - ((p - min) / range) * 100
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="dashboard-sparkline"
      role="img"
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <polyline points={segments} />
    </svg>
  )
}
