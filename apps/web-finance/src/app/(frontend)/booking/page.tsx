/**
 * apps/web-ecommerce/src/app/(frontend)/booking/page.tsx
 *
 * /booking — Cal.com inline embed for scheduling consultations.
 * Server component. Cal.com embed script loaded via next/script strategy="lazyOnload"
 * to avoid blocking LCP (09-UI-SPEC.md performance budget).
 *
 * min-height: 600px on embed wrapper prevents CLS before Cal.com renders.
 *
 * REQ-114, REQ-417, REQ-420
 */
import type { Metadata } from 'next'
import Script from 'next/script'
import { randomUUID } from 'crypto'

const AGENCY_NAME = process.env['NEXT_PUBLIC_AGENCY_NAME'] ?? 'MJAgency'
const AGENCY_SLUG = process.env['NEXT_PUBLIC_AGENCY_SLUG'] ?? 'ecommerce'
const CAL_LINK = process.env['NEXT_PUBLIC_CAL_LINK'] ?? `${AGENCY_SLUG}/30min`

export const metadata: Metadata = {
  title: `${AGENCY_NAME} — Schedule a Consultation`,
  description: `Book a free consultation with ${AGENCY_NAME}. Choose a time that works for you.`,
}

export default function BookingPage(): React.JSX.Element {
  const calNamespace = `cal-${AGENCY_SLUG}`
  // CSP nonce: generate per-render (CLAUDE.md §7 — inject into all inline scripts)
  // Phase 11 will wire x-nonce from middleware; for now use per-render UUID fallback
  const nonce = randomUUID()

  return (
    <>
      {/* Skip link — WCAG 2.4.1 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only"
        style={{ position: 'absolute', top: 'var(--mj-space-2)', left: 'var(--mj-space-2)' }}
      >
        Skip to main content
      </a>

      <main
        id="main-content"
        style={{
          padding: 'var(--mj-space-16) var(--mj-space-6)',
          maxWidth: 'var(--mj-container-md)',
          margin: '0 auto',
        }}
      >
        {/* Hero copy */}
        <section>
          <h1
            style={{
              fontSize: 'var(--mj-text-size-5xl)',
              fontWeight: 'var(--mj-weight-bold)',
              lineHeight: 'var(--mj-leading-tight)',
              color: 'var(--mj-color-text-primary)',
              marginBottom: 'var(--mj-space-4)',
            }}
          >
            Schedule a Free Consultation
          </h1>
          <p
            style={{
              fontSize: 'var(--mj-text-size-lg)',
              color: 'var(--mj-color-text-secondary)',
              lineHeight: 'var(--mj-leading-normal)',
            }}
          >
            Choose a time that works for you. We&apos;ll discuss your goals and how we can help — no obligation.
          </p>
        </section>

        {/* Cal.com embed wrapper */}
        <section style={{ marginTop: 'var(--mj-space-8)' }}>
          {/* min-height: 600px prevents CLS while Cal.com embed loads (09-UI-SPEC.md) */}
          <div
            id="cal-embed-wrapper"
            data-cal-namespace={calNamespace}
            data-cal-link={CAL_LINK}
            data-cal-config='{"layout":"month_view"}'
            style={{
              minHeight: '600px',
              width: '100%',
              backgroundColor: 'var(--mj-color-bg-primary)',
            }}
          />
        </section>
      </main>

      {/*
        Cal.com embed initialization via next/script with strategy="lazyOnload".
        Does NOT count toward 150KB first-load JS budget (09-UI-SPEC.md performance budget).
        No dangerouslySetInnerHTML — CLAUDE.md Puck rules / content security policy.
      */}
      <Script
        id={`cal-embed-${AGENCY_SLUG}`}
        strategy="lazyOnload"
        src="https://app.cal.com/embed/embed.js"
        nonce={nonce}
      />
      <Script
        id={`cal-init-${AGENCY_SLUG}`}
        strategy="lazyOnload"
        nonce={nonce}
      >{`
        (function(C,A,L){let p=function(a,ar){a.q.push(ar)};let d=C.document;C.Cal=C.Cal||function(){let cal=C.Cal;let ar=arguments;if(!cal.loaded){cal.ns={};cal.q=cal.q||[];d.head.appendChild(d.createElement("script")).src=A;cal.loaded=true}if(ar[0]===L){const api=function(){p(api,arguments)};const namespace=ar[1];api.q=api.q||[];if(typeof namespace==="string"){cal.ns[namespace]=cal.ns[namespace]||api;p(cal.ns[namespace],ar);p(cal,["initNamespace",namespace])}else p(cal,ar);return}p(cal,ar)};
      })(window,"https://app.cal.com/embed/embed.js","init");
      Cal("init", "${calNamespace}", {origin:"https://cal.com"});
      Cal.ns["${calNamespace}"]("inline", {elementOrSelector:"#cal-embed-wrapper", calLink:"${CAL_LINK}"});
      `}</Script>
    </>
  )
}
