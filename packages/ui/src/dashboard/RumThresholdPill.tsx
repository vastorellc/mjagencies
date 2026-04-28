import type * as React from 'react'
/**
 * packages/ui/src/dashboard/RumThresholdPill.tsx
 *
 * UI-SPEC Surface 1 RUM rating pill — small color-coded chip used by the
 * RumKpiCard. Foreground color is var(--mj-color-success | warning | error)
 * via the .rum-pill--{healthy,warning,poor} classes in dashboard.css.
 */

export interface RumThresholdPillProps {
  rating: 'good' | 'needs-improvement' | 'poor'
}

const HEALTHY_LABEL = 'Healthy'
const WARNING_LABEL = 'Above target'
const POOR_LABEL = 'Above target'

export function RumThresholdPill({ rating }: RumThresholdPillProps): React.ReactElement {
  if (rating === 'good') {
    return <span className="rum-pill rum-pill--healthy">{HEALTHY_LABEL}</span>
  }
  if (rating === 'needs-improvement') {
    return <span className="rum-pill rum-pill--warning">{WARNING_LABEL}</span>
  }
  return <span className="rum-pill rum-pill--poor">{POOR_LABEL}</span>
}
