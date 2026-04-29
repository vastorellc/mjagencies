import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { GA4InjectScript } from '@mjagency/analytics/ga4-script'
import { ClarityInjectScript } from '@mjagency/analytics/clarity-script'
import { MetaPixelScript } from '@mjagency/analytics/meta-pixel'
import {
  ConsentProvider,
  CookieHintBanner,
  OptOutModal,
  type ConsentState,
} from '@mjagency/compliance'
import { SiteNav, SiteFooter } from '@mjagency/ui'

export const metadata: Metadata = {
  metadataBase: new URL(process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://webdev.mjagency.com'),
  title: 'MJ Web Dev Agency — Websites and web apps built to production standards',
  description:
    'Next.js, headless CMS, and custom web applications with the quality bar of an internal engineering team.',
}

export default async function FrontendLayout({
  children,
}: {
  children: ReactNode
}): Promise<React.JSX.Element> {
  // REQ-140 / Plan 11-01: GA4 client tag (consent-gated SSR injection per D-01/D-02).
  // REQ-141 / Plan 11-02: Microsoft Clarity heatmaps (consent-gated SSR injection per D-01/D-02).
  // Both server components read mj_consent cookie directly — pre-consent flash impossible.
  // The per-request CSP nonce (Plan 11-07) is read from x-nonce inside GA4InjectScript.
  const cookieJar = await cookies()
  const consent: ConsentState =
    cookieJar.get('mj_consent')?.value === 'tracking_blocked'
      ? 'tracking_blocked'
      : 'tracking_allowed'
  const hintDismissed = cookieJar.get('mj_consent_hint_dismissed')?.value === '1'

  const ga4Id = process.env['NEXT_PUBLIC_GA4_MEASUREMENT_ID']
  const clarityProjectId = process.env['NEXT_PUBLIC_CLARITY_PROJECT_ID']
  const metaPixelId = process.env['NEXT_PUBLIC_META_PIXEL_ID']

  return (
    <html lang="en">
      <body>
        <SiteNav agencyName="MJ Web Dev Agency" />
        <ConsentProvider initial={consent}>
          {ga4Id ? <GA4InjectScript measurementId={ga4Id} /> : null}
          {clarityProjectId ? <ClarityInjectScript projectId={clarityProjectId} /> : null}
          {metaPixelId ? <MetaPixelScript pixelId={metaPixelId} /> : null}
          {children}
          <OptOutModal />
          {!hintDismissed && <CookieHintBanner />}
          <SiteFooter agencyName="MJ Web Dev Agency" tagline="Next.js, headless CMS, and web applications built to production standards." />
        </ConsentProvider>
      </body>
    </html>
  )
}
