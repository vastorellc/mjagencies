/**
 * packages/analytics/src/ga4-script.tsx
 * REQ-140 + D-01/D-02 + REQ-146: consent-gated GA4 client script with per-request nonce.
 *
 * Server component — reads cookies + headers (Next.js 15 App Router):
 *   - cookies().get('mj_consent') === 'tracking_blocked' → renders null (CCPA opt-out)
 *   - headers().get('x-nonce') → injected by Plan 11-07 middleware as per-request CSP nonce
 *
 * Default-on tracking (D-01/D-02): only blocks when user explicitly opted out.
 * Pre-consent flash impossible — server-side gate, no client hydration race.
 *
 * CSP allowlist (set by Plan 11-07 middleware):
 *   script-src: 'self' 'nonce-X' 'strict-dynamic' https://www.googletagmanager.com
 *   img-src:    'self' data: https://www.google-analytics.com
 *   connect-src:'self' https://www.google-analytics.com
 */
import Script from 'next/script'
import { cookies, headers } from 'next/headers'
import type { JSX } from 'react'

interface GA4InjectScriptProps {
  measurementId: string
}

export async function GA4InjectScript({ measurementId }: GA4InjectScriptProps): Promise<JSX.Element | null> {
  const consent = (await cookies()).get('mj_consent')?.value
  // D-01/D-02: default-on tracking under CCPA opt-out model
  if (consent === 'tracking_blocked') return null

  const nonce = (await headers()).get('x-nonce') ?? ''

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
        nonce={nonce}
      />
      <Script id="ga4-init" strategy="afterInteractive" nonce={nonce}>
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}', { send_page_view: true });`}
      </Script>
    </>
  )
}
