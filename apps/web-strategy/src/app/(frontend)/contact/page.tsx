/**
 * apps/web-strategy/src/app/(frontend)/contact/page.tsx
 *
 * Contact page for the strategy agency.
 * Server component — wraps ContactFormClient (client component).
 *
 * REQ-114, REQ-415
 */
import type { Metadata } from 'next'
import { ContactFormClient } from '@mjagency/ui'

const AGENCY_ID = process.env['NEXT_PUBLIC_AGENCY_SLUG'] ?? 'strategy'
const AGENCY_NAME = process.env['NEXT_PUBLIC_AGENCY_NAME'] ?? 'MJAgency Strategy'

export const metadata: Metadata = {
  title: `Contact ${AGENCY_NAME}`,
  description: `Get in touch with ${AGENCY_NAME}. Send us a message and we will respond within one business day.`,
}

export default function ContactPage(): React.JSX.Element {
  return (
    <main
      id="main-content"
      style={{
        padding: 'var(--mj-space-16) var(--mj-space-6)',
        maxWidth: 'var(--mj-container-md)',
        margin: '0 auto',
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only"
        style={{ position: 'absolute', top: 'var(--mj-space-2)', left: 'var(--mj-space-2)' }}
      >
        Skip to main content
      </a>

      <section style={{ marginBottom: 'var(--mj-space-10)' }}>
        <h1
          style={{
            fontSize: 'var(--mj-text-size-5xl)',
            fontWeight: 'var(--mj-weight-bold)',
            lineHeight: 'var(--mj-leading-tight)',
            color: 'var(--mj-color-text-primary)',
            marginBottom: 'var(--mj-space-4)',
          }}
        >
          Contact Us
        </h1>
        <p
          style={{
            fontSize: 'var(--mj-text-size-lg)',
            color: 'var(--mj-color-text-secondary)',
            lineHeight: 'var(--mj-leading-normal)',
          }}
        >
          Ready to develop a winning strategy? Send us a message and we&apos;ll get back to you
          within one business day.
        </p>
      </section>

      <ContactFormClient
        agencyId={AGENCY_ID}
        contactEmail={process.env['NEXT_PUBLIC_CONTACT_EMAIL'] ?? `hello@${AGENCY_ID}.mjagency.com`}
      />
    </main>
  )
}
