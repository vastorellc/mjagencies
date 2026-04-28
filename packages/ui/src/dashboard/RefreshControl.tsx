'use client'
/**
 * packages/ui/src/dashboard/RefreshControl.tsx
 *
 * Manual refresh button + polite live status message ("Last updated 2s ago",
 * "Refreshing…", "Last refresh failed"). The status span uses aria-live="polite"
 * so screen readers announce updates without interrupting (UI-SPEC Surface 1 a11y).
 */
import type * as React from 'react'

export interface RefreshControlProps {
  isFetching: boolean
  lastUpdatedAt: string
  lastErrorAt: string | null
  onRefresh: () => void
}

export function RefreshControl({
  isFetching,
  lastUpdatedAt,
  lastErrorAt,
  onRefresh,
}: RefreshControlProps): React.ReactElement {
  const status = buildStatus({ isFetching, lastUpdatedAt, lastErrorAt })
  return (
    <div>
      <button
        type="button"
        className="dashboard-refresh"
        onClick={onRefresh}
        disabled={isFetching}
        aria-label="Refresh dashboard"
      >
        {isFetching ? 'Refreshing…' : 'Refresh now'}
      </button>
      <span className="dashboard-refresh__status" role="status" aria-live="polite">
        {' '}
        {status}
      </span>
    </div>
  )
}

function buildStatus(opts: {
  isFetching: boolean
  lastUpdatedAt: string
  lastErrorAt: string | null
}): string {
  if (opts.isFetching) return 'Refreshing now'
  if (opts.lastErrorAt) {
    const ago = secondsAgo(opts.lastErrorAt)
    return `Last refresh failed ${ago}s ago. Showing previous values.`
  }
  const ago = secondsAgo(opts.lastUpdatedAt)
  return `Last updated ${ago}s ago`
}

function secondsAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.round(ms / 1000))
}
