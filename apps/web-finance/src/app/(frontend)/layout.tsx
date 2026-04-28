import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { GA4InjectScript } from '@mjagency/analytics/ga4-script'
import { ClarityInjectScript } from '@mjagency/analytics/clarity-script'
import { MetaPixelScript } from '@mjagency/analytics/meta-pixel'

export const metadata: Metadata = {
  title: 'MJAgency Platform — Finance',
  description:
    'The MJAgency multi-brand platform: 12 agency verticals — ecommerce, growth, webdev, AI, branding, strategy, finance, engineering, product, video, and graphic — all in one place.',
}

export default function FrontendLayout({ children }: { children: ReactNode }): ReactNode {
  // REQ-140 / Plan 11-01: GA4 client tag (consent-gated SSR injection per D-01/D-02).
  // REQ-141 / Plan 11-02: Microsoft Clarity heatmaps (consent-gated SSR injection per D-01/D-02).
  // Both server components read mj_consent cookie directly — pre-consent flash impossible.
  // The per-request CSP nonce (Plan 11-07) is read from x-nonce inside GA4InjectScript.
  const ga4Id = process.env['NEXT_PUBLIC_GA4_MEASUREMENT_ID']
  const clarityProjectId = process.env['NEXT_PUBLIC_CLARITY_PROJECT_ID']
  const metaPixelId = process.env['NEXT_PUBLIC_META_PIXEL_ID']
  return (
    <html lang="en">
      <body>
        {ga4Id ? <GA4InjectScript measurementId={ga4Id} /> : null}
        {clarityProjectId ? <ClarityInjectScript projectId={clarityProjectId} /> : null}
          {metaPixelId ? <MetaPixelScript pixelId={metaPixelId} /> : null}
        {children}
      </body>
    </html>
  )
}
