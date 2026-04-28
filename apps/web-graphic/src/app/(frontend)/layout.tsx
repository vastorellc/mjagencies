import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { GA4InjectScript } from '@mjagency/analytics/ga4-script'

export const metadata: Metadata = {
  title: 'MJAgency Platform — Graphic Design',
  description:
    'The MJAgency multi-brand platform: 12 agency verticals — ecommerce, growth, webdev, AI, branding, strategy, finance, engineering, product, video, and graphic — all in one place.',
}

export default function FrontendLayout({ children }: { children: ReactNode }): ReactNode {
  // REQ-140 / Plan 11-01: GA4 client tag (consent-gated SSR injection per D-01/D-02).
  // Plan 11-05 will wrap this layout with <ConsentProvider>; the GA4InjectScript
  // server component reads the mj_consent cookie directly so it works either way.
  // The per-request CSP nonce (Plan 11-07) is read from x-nonce inside GA4InjectScript.
  const ga4Id = process.env['NEXT_PUBLIC_GA4_MEASUREMENT_ID']
  return (
    <html lang="en">
      <body>
        {ga4Id ? <GA4InjectScript measurementId={ga4Id} /> : null}
        {children}
      </body>
    </html>
  )
}
