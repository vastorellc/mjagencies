'use client'
/**
 * packages/ui/src/dashboard/use-dashboard-polling.ts
 *
 * REQ-143 + D-14: client polls /api/admin/dashboard/metrics every 60s while
 * `document.visibilityState === 'visible'`. Pauses on tab blur, resumes
 * immediately on tab visible.
 *
 * Pitfall 4.4 mitigation: the polling endpoint runs requireSession() server-side,
 * so cookie-only access enforces the same auth as the Payload custom view.
 *
 * Pitfall 4.8 mitigation: `inFlight` guard prevents the manual refresh button
 * from racing the 60s interval — second poll is a no-op while one is in flight.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import type { DashboardMetrics } from '@mjagency/analytics'

export interface UseDashboardPollingResult {
  data: DashboardMetrics
  /** ISO timestamp of last successful refresh. */
  lastUpdatedAt: string
  /** ISO timestamp of last error (or null). */
  lastErrorAt: string | null
  /** True while a poll is in flight. */
  isFetching: boolean
  /** Trigger an immediate refresh; respects the inFlight guard. */
  refresh: () => Promise<void>
}

export interface UseDashboardPollingOptions {
  /** Initial server-rendered metrics (paint without polling). */
  initial: DashboardMetrics
  /** 'agency' or 'platform' — passed to /api/admin/dashboard/metrics?view=. */
  viewMode: 'agency' | 'platform'
  /** Polling interval in ms. Default 60_000 (D-14). */
  intervalMs?: number
}

const DEFAULT_INTERVAL_MS = 60_000

export function useDashboardPolling(
  options: UseDashboardPollingOptions,
): UseDashboardPollingResult {
  const { initial, viewMode, intervalMs = DEFAULT_INTERVAL_MS } = options
  const [data, setData] = useState<DashboardMetrics>(initial)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>(new Date().toISOString())
  const [lastErrorAt, setLastErrorAt] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState<boolean>(false)
  const inFlightRef = useRef<boolean>(false)

  const refresh = useCallback(async (): Promise<void> => {
    // Pitfall 4.8: skip if one is already in flight (race guard for manual refresh).
    if (inFlightRef.current) return
    inFlightRef.current = true
    setIsFetching(true)
    try {
      const res = await fetch(`/api/admin/dashboard/metrics?view=${viewMode}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        setLastErrorAt(new Date().toISOString())
        return
      }
      const next = (await res.json()) as DashboardMetrics
      setData(next)
      setLastUpdatedAt(new Date().toISOString())
      setLastErrorAt(null)
    } catch {
      // Silent failure — UI keeps showing last good values; refresh status updated.
      setLastErrorAt(new Date().toISOString())
    } finally {
      inFlightRef.current = false
      setIsFetching(false)
    }
  }, [viewMode])

  useEffect(() => {
    let active = true
    const tick = (): void => {
      if (!active) return
      // D-14: pause polling while tab is hidden.
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      void refresh()
    }
    const id = setInterval(tick, intervalMs)
    const onVis = (): void => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void refresh()
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis)
    }
    return () => {
      active = false
      clearInterval(id)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis)
      }
    }
  }, [refresh, intervalMs])

  return { data, lastUpdatedAt, lastErrorAt, isFetching, refresh }
}
