'use client'
/**
 * packages/ui/src/rum/web-vitals.tsx
 *
 * Real User Monitoring (RUM) reporter component.
 * Dynamically imports web-vitals (avoids SSR cost) and registers all five core metrics.
 *
 * Plan 11-07 — DUAL-EMIT:
 *   1. window.gtag(...)              — preserved from Phase 8 (GA4 funnel)
 *   2. navigator.sendBeacon('/api/rum', ...)  — added for Postgres persistence (web_vitals table)
 *      The dashboard (Plan 11-04) reads percentile_cont(0.75) over web_vitals to render the
 *      LCP/INP/CLS p75 cards. sendBeacon is fire-and-forget and survives page unload.
 *
 * This component renders null — it is side-effect only.
 *
 * Requirements:
 *   REQ-094: LCP < 1.8s desktop / < 2.2s mobile (performance budget tracking)
 *   REQ-095: CLS = 0 (monitored via onCLS)
 *   REQ-097: RUM script (web-vitals) on all pages
 *   REQ-145 supplementary: web_vitals Postgres persistence (Plan 11-07)
 */
import { useEffect } from 'react'
import type { Metric } from 'web-vitals'

// Extend Window interface to avoid TypeScript strict-mode errors when calling gtag
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function WebVitalsReporter({
  ga4MeasurementId,
}: {
  ga4MeasurementId: string
}): null {
  useEffect(() => {
    void import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      const send = (metric: Metric): void => {
        // ── Existing GA4 emission (Phase 8) — KEEP ────────────────────────────
        window.gtag?.('event', metric.name, {
          value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
          event_category: 'Web Vitals',
          event_label: metric.id,
          non_interaction: true,
          send_to: ga4MeasurementId,
        })

        // ── Plan 11-07 — Postgres persistence via /api/rum ────────────────────
        const payload = JSON.stringify({
          metric_name: metric.name,
          value: metric.value,
          rating: metric.rating,
          navigation_type: metric.navigationType,
          page_path: window.location.pathname,
        })
        try {
          if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            // sendBeacon is fire-and-forget; survives the unload event
            navigator.sendBeacon('/api/rum', new Blob([payload], { type: 'application/json' }))
          } else {
            // Fallback for environments without sendBeacon (RUM is best-effort)
            void fetch('/api/rum', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payload,
              keepalive: true,
            }).catch(() => {
              /* silent fail — RUM is best-effort */
            })
          }
        } catch {
          /* silent fail — RUM is best-effort */
        }
      }
      onLCP(send)
      onINP(send)
      onCLS(send)
      onFCP(send)
      onTTFB(send)
    })
  }, [ga4MeasurementId])
  return null
}
