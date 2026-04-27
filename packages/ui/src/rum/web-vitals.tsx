'use client'
/**
 * packages/ui/src/rum/web-vitals.tsx
 *
 * Real User Monitoring (RUM) reporter component.
 * Dynamically imports web-vitals (avoids SSR cost) and registers all five core metrics.
 * Sends events to Google Analytics 4 via window.gtag.
 *
 * This component renders null — it is side-effect only.
 *
 * Requirements:
 *   REQ-094: LCP < 1.8s desktop / < 2.2s mobile (performance budget tracking)
 *   REQ-095: CLS = 0 (monitored via onCLS)
 *   REQ-097: RUM script (web-vitals) on all pages
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
        window.gtag?.('event', metric.name, {
          value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
          event_category: 'Web Vitals',
          event_label: metric.id,
          non_interaction: true,
          send_to: ga4MeasurementId,
        })
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
