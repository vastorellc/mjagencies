import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { Inter } from 'next/font/google'
import { WebVitalsReporter } from '@mjagency/ui'
import { GA4InjectScript } from '@mjagency/analytics/ga4-script'
import { ClarityInjectScript } from '@mjagency/analytics/clarity-script'
import { MetaPixelScript } from '@mjagency/analytics/meta-pixel'
import {
  ConsentProvider,
  CookieHintBanner,
  OptOutModal,
  type ConsentState,
} from '@mjagency/compliance'

/**
 * Frontend layout for apps/web-main public-facing routes.
 *
 * Responsibilities:
 *   1. Load Inter font via next/font/google and inject --font-brand CSS variable (REQ-094/CLS=0)
 *   2. Set canonical metadata for the brand hub (overridden by individual pages)
 *   3. Mount WebVitalsReporter for GA4 RUM reporting on all pages (REQ-097)
 *   4. Plan 11-01: Inject consent-gated GA4 client tag (REQ-140) inside CSP-nonce envelope
 *   5. Plan 11-02: Inject consent-gated Microsoft Clarity heatmaps (REQ-141)
 *   6. Plan 11-05: Wrap children in ConsentProvider (D-01/D-02), mount OptOutModal,
 *      conditionally render CookieHintBanner on first visit.
 *
 * Font strategy: display:swap prevents invisible text (CLS protection — REQ-095).
 * GA4 measurement ID injected at runtime from NEXT_PUBLIC_GA4_MEASUREMENT_ID env var.
 * NEXT_PUBLIC_GA4_ID is the legacy variable used by WebVitalsReporter; both can co-exist.
 */

const inter = Inter({ subsets: ['latin'], variable: '--font-brand', display: 'swap' })

export const metadata: Metadata = {
  title: 'MJAgency — Growth-Obsessed Digital Strategies',
  description:
    'MJAgency delivers data-driven digital strategies for brands that demand measurable growth. 12 specialized agencies, one platform.',
}

export default async function FrontendLayout({
  children,
}: {
  children: ReactNode
}): Promise<React.JSX.Element> {
  const cookieJar = await cookies()
  const consent: ConsentState =
    cookieJar.get('mj_consent')?.value === 'tracking_blocked'
      ? 'tracking_blocked'
      : 'tracking_allowed'
  const hintDismissed = cookieJar.get('mj_consent_hint_dismissed')?.value === '1'

  const ga4LegacyId = process.env['NEXT_PUBLIC_GA4_ID'] ?? ''
  // Plan 11-01: server-component GA4 client tag (consent-gated SSR injection per D-01/D-02).
  // Plan 11-02: server-component Microsoft Clarity tag (same consent gate, same SSR pattern).
  const ga4Id = process.env['NEXT_PUBLIC_GA4_MEASUREMENT_ID']
  const clarityProjectId = process.env['NEXT_PUBLIC_CLARITY_PROJECT_ID']
  const metaPixelId = process.env['NEXT_PUBLIC_META_PIXEL_ID']

  return (
    <ConsentProvider initial={consent}>
      {ga4Id ? <GA4InjectScript measurementId={ga4Id} /> : null}
      {clarityProjectId ? <ClarityInjectScript projectId={clarityProjectId} /> : null}
      {metaPixelId ? <MetaPixelScript pixelId={metaPixelId} /> : null}
      <div className={inter.variable}>{children}</div>
      <WebVitalsReporter ga4MeasurementId={ga4LegacyId} />
      <OptOutModal />
      {!hintDismissed && <CookieHintBanner />}
    </ConsentProvider>
  )
}
