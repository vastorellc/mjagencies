import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { GA4InjectScript } from '@mjagency/analytics/ga4-script'
import { ClarityInjectScript } from '@mjagency/analytics/clarity-script'
import {
  ConsentProvider,
  CookieHintBanner,
  OptOutModal,
  type ConsentState,
} from '@mjagency/compliance'

export const metadata: Metadata = {
  title: 'MJAgency Platform — E-Commerce',
  description:
    'The MJAgency multi-brand platform: 12 agency verticals — ecommerce, growth, webdev, AI, branding, strategy, finance, engineering, product, video, and graphic — all in one place.',
}

/**
 * Plan 11-05 wiring (REQ-144 D-01 / D-02 / D-03):
 *   - SSR-computed initial consent state from mj_consent cookie (no flash)
 *   - ConsentProvider wraps GA4 + Clarity injectors so they read state from context
 *   - OptOutModal mounts in the same React tree so the footer link's CustomEvent
 *     can open it from anywhere
 *   - CookieHintBanner renders only on first visit (cookie-gated)
 *
 * REQ-140 / Plan 11-01: GA4 client tag (consent-gated SSR injection per D-01/D-02).
 * REQ-141 / Plan 11-02: Microsoft Clarity heatmaps (consent-gated SSR injection per D-01/D-02).
 * Both server components read the mj_consent cookie directly — pre-consent flash impossible.
 * The per-request CSP nonce (Plan 11-07) is read from x-nonce inside GA4InjectScript.
 */
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

  const ga4Id = process.env['NEXT_PUBLIC_GA4_MEASUREMENT_ID']
  const clarityProjectId = process.env['NEXT_PUBLIC_CLARITY_PROJECT_ID']

  return (
    <html lang="en">
      <body>
        <ConsentProvider initial={consent}>
          {ga4Id ? <GA4InjectScript measurementId={ga4Id} /> : null}
          {clarityProjectId ? <ClarityInjectScript projectId={clarityProjectId} /> : null}
          {children}
          <OptOutModal />
          {!hintDismissed && <CookieHintBanner />}
        </ConsentProvider>
      </body>
    </html>
  )
}
