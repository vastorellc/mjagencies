import type * as React from 'react'
/**
 * packages/ui/src/dashboard/DataSourcesFooter.tsx
 *
 * UI-SPEC Surface 1 footer — discloses where each KPI is sourced from. Renders
 * statically; no client behavior required.
 */

export function DataSourcesFooter(): React.ReactElement {
  return (
    <footer className="dashboard-footer">
      <p>
        Data sources: traffic + top pages from Google Analytics 4 (5-minute cache);
        leads + pipeline + revenue from this agency&rsquo;s database; LCP / INP / CLS
        p75 from real-user measurements (last 24 hours).
      </p>
    </footer>
  )
}
