/**
 * packages/analytics/src/meta-pixel.tsx
 * REQ-142: Meta Pixel browser-side script component.
 *
 * Server component — consent-gated, nonce-aware (mirrors GA4InjectScript pattern).
 * Renders Meta Pixel initialization + noscript fallback.
 *
 * Server-side CAPI (packages/meta-capi) is separate; this adds browser-side
 * PageView + ViewContent attribution for agencies that need browser pixel matching.
 *
 * CSP note (Plan 11-07): CSP intentionally omits facebook.com connect-src (D-10).
 * The pixel JS loads from connect.facebook.net which requires:
 *   script-src: 'nonce-X' https://connect.facebook.net
 *   img-src:    'self' data: https://www.facebook.com
 * Middleware must add these per-request when pixelId is configured for the agency.
 */
import Script from 'next/script'
import { cookies, headers } from 'next/headers'
import type { JSX } from 'react'

interface MetaPixelScriptProps {
  pixelId: string
}

export async function MetaPixelScript({ pixelId }: MetaPixelScriptProps): Promise<JSX.Element | null> {
  const consent = (await cookies()).get('mj_consent')?.value
  if (consent === 'tracking_blocked') return null

  const nonce = (await headers()).get('x-nonce') ?? ''

  return (
    <>
      <Script id="meta-pixel-init" strategy="afterInteractive" nonce={nonce}>
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height={1}
          width={1}
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  )
}
