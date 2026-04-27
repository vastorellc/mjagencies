import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import { WebVitalsReporter } from '@mjagency/ui'

/**
 * Frontend layout for apps/web-main public-facing routes.
 *
 * Responsibilities:
 *   1. Load Inter font via next/font/google and inject --font-brand CSS variable (REQ-094/CLS=0)
 *   2. Set canonical metadata for the brand hub (overridden by individual pages)
 *   3. Mount WebVitalsReporter for GA4 RUM reporting on all pages (REQ-097)
 *
 * Font strategy: display:swap prevents invisible text (CLS protection — REQ-095).
 * GA4 measurement ID injected at runtime from NEXT_PUBLIC_GA4_ID env var.
 */

const inter = Inter({ subsets: ['latin'], variable: '--font-brand', display: 'swap' })

export const metadata: Metadata = {
  title: 'MJAgency — Growth-Obsessed Digital Strategies',
  description:
    'MJAgency delivers data-driven digital strategies for brands that demand measurable growth. 12 specialized agencies, one platform.',
}

export default function FrontendLayout({ children }: { children: ReactNode }): ReactNode {
  const ga4Id = process.env['NEXT_PUBLIC_GA4_ID'] ?? ''
  return (
    <>
      <div className={inter.variable}>{children}</div>
      <WebVitalsReporter ga4MeasurementId={ga4Id} />
    </>
  )
}
