import type { Metadata } from 'next'
import type React from 'react'
import { fetchPageBySlug } from '@mjagency/cms'

const AGENCY_ID = 'finance'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'MJ Finance Agency — Financial clarity for companies scaling from $1M to $50M',
  description:
    'We provide fractional CFO services, financial modeling, and fundraising support for growth-stage companies that need senior finance expertise without a full-time hire.',
}

const SERVICES: { title: string; description: string }[] = [
  {
    title: 'Fractional CFO',
    description:
      'Monthly close oversight, board reporting, cash runway modeling, and ongoing financial strategy at 25–50% of full-time cost.',
  },
  {
    title: 'Fundraise Preparation',
    description:
      'Investor materials, 3-year financial model, cap table cleanup, and management Q&A coaching.',
  },
  {
    title: 'Financial Modeling',
    description:
      'Unit economics, pricing analysis, scenario planning, and the financial models that inform your biggest decisions.',
  },
]

const WHY_US: { title: string; description: string }[] = [
  {
    title: 'No full-time cost, full-time capability',
    description:
      'Senior CFO-level work at a fraction of the cost — without the overhead of a full-time executive.',
  },
  {
    title: 'We work alongside your team',
    description:
      'We layer onto your existing bookkeeper or controller. Strategy and investor relations are ours. Transactions are yours.',
  },
  {
    title: 'Board-ready reporting',
    description:
      'Every deliverable is designed to hold up under investor scrutiny — no spreadsheets, no shortcuts.',
  },
]

export default async function HomePage(): Promise<React.ReactElement> {
  const page = await fetchPageBySlug(AGENCY_ID, 'home')
  const headline = page?.title ?? 'Financial clarity for companies scaling from $1M to $50M'
  const subheadline =
    page?.aio_tldr ??
    'We provide fractional CFO services, financial modeling, and fundraising support for growth-stage companies that need senior finance expertise without a full-time hire.'

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
        style={{
          padding: 'var(--mj-space-2) var(--mj-space-4)',
          backgroundColor: 'var(--mj-color-bg)',
          outline: '2px solid var(--mj-color-border-focus)',
          color: 'var(--mj-color-text-primary)',
        }}
      >
        Skip to main content
      </a>
      <main id="main-content">
        {/* Hero */}
        <section
          aria-labelledby="hero-heading"
          style={{
            padding: 'var(--mj-space-24) var(--mj-space-6)',
            maxWidth: 'var(--mj-container-xl)',
            margin: '0 auto',
          }}
        >
          <h1
            id="hero-heading"
            style={{
              fontSize: 'var(--mj-text-size-5xl)',
              fontWeight: 'var(--mj-weight-bold)',
              color: 'var(--mj-color-text-primary)',
              fontFamily: 'var(--mj-font-heading)',
              lineHeight: 'var(--mj-leading-tight)',
              maxWidth: '18ch',
            }}
          >
            {headline}
          </h1>
          <p
            style={{
              fontSize: 'var(--mj-text-size-xl)',
              color: 'var(--mj-color-text-secondary)',
              marginTop: 'var(--mj-space-6)',
              maxWidth: '55ch',
              lineHeight: 'var(--mj-leading-relaxed)',
            }}
          >
            {subheadline}
          </p>
          <div
            style={{
              display: 'flex',
              gap: 'var(--mj-space-4)',
              marginTop: 'var(--mj-space-10)',
              flexWrap: 'wrap',
            }}
          >
            <a
              href="/contact"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: 'var(--mj-space-4) var(--mj-space-8)',
                backgroundColor: 'var(--mj-color-brand-500)',
                color: 'var(--mj-color-bg)',
                fontWeight: 'var(--mj-weight-semibold)',
                fontSize: 'var(--mj-text-size-base)',
                borderRadius: 'var(--mj-radius-md)',
                textDecoration: 'none',
              }}
            >
              Work with us
            </a>
            <a
              href="/services"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: 'var(--mj-space-4) var(--mj-space-8)',
                backgroundColor: 'transparent',
                color: 'var(--mj-color-text-primary)',
                fontWeight: 'var(--mj-weight-semibold)',
                fontSize: 'var(--mj-text-size-base)',
                borderRadius: 'var(--mj-radius-md)',
                textDecoration: 'none',
                border: '1px solid var(--mj-color-border)',
              }}
            >
              See our services
            </a>
          </div>
        </section>

        {/* Services preview */}
        <section
          aria-labelledby="services-heading"
          style={{
            padding: 'var(--mj-space-16) var(--mj-space-6)',
            backgroundColor: 'var(--mj-color-bg-secondary)',
          }}
        >
          <div style={{ maxWidth: 'var(--mj-container-xl)', margin: '0 auto' }}>
            <h2
              id="services-heading"
              style={{
                fontSize: 'var(--mj-text-size-3xl)',
                fontWeight: 'var(--mj-weight-bold)',
                color: 'var(--mj-color-text-primary)',
                fontFamily: 'var(--mj-font-heading)',
              }}
            >
              What we do
            </h2>
            <ul
              style={{
                marginTop: 'var(--mj-space-10)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 'var(--mj-space-6)',
                listStyle: 'none',
                padding: 0,
              }}
            >
              {SERVICES.map((s) => (
                <li
                  key={s.title}
                  style={{
                    padding: 'var(--mj-space-8)',
                    backgroundColor: 'var(--mj-color-bg)',
                    borderRadius: 'var(--mj-radius-lg)',
                    border: '1px solid var(--mj-color-border)',
                  }}
                >
                  <h3
                    style={{
                      fontSize: 'var(--mj-text-size-xl)',
                      fontWeight: 'var(--mj-weight-semibold)',
                      color: 'var(--mj-color-text-primary)',
                    }}
                  >
                    {s.title}
                  </h3>
                  <p
                    style={{
                      marginTop: 'var(--mj-space-3)',
                      fontSize: 'var(--mj-text-size-base)',
                      color: 'var(--mj-color-text-secondary)',
                      lineHeight: 'var(--mj-leading-relaxed)',
                    }}
                  >
                    {s.description}
                  </p>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 'var(--mj-space-10)' }}>
              <a
                href="/services"
                style={{
                  fontSize: 'var(--mj-text-size-base)',
                  fontWeight: 'var(--mj-weight-medium)',
                  color: 'var(--mj-color-brand-500)',
                  textDecoration: 'none',
                }}
              >
                View all services &rarr;
              </a>
            </div>
          </div>
        </section>

        {/* Why us */}
        <section
          aria-labelledby="why-heading"
          style={{ padding: 'var(--mj-space-16) var(--mj-space-6)' }}
        >
          <div style={{ maxWidth: 'var(--mj-container-xl)', margin: '0 auto' }}>
            <h2
              id="why-heading"
              style={{
                fontSize: 'var(--mj-text-size-3xl)',
                fontWeight: 'var(--mj-weight-bold)',
                color: 'var(--mj-color-text-primary)',
                fontFamily: 'var(--mj-font-heading)',
              }}
            >
              Why clients choose us
            </h2>
            <ul
              style={{
                marginTop: 'var(--mj-space-10)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 'var(--mj-space-8)',
                listStyle: 'none',
                padding: 0,
              }}
            >
              {WHY_US.map((w) => (
                <li key={w.title}>
                  <h3
                    style={{
                      fontSize: 'var(--mj-text-size-lg)',
                      fontWeight: 'var(--mj-weight-semibold)',
                      color: 'var(--mj-color-text-primary)',
                    }}
                  >
                    {w.title}
                  </h3>
                  <p
                    style={{
                      marginTop: 'var(--mj-space-2)',
                      fontSize: 'var(--mj-text-size-base)',
                      color: 'var(--mj-color-text-secondary)',
                      lineHeight: 'var(--mj-leading-relaxed)',
                    }}
                  >
                    {w.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA strip */}
        <section
          aria-label="Call to action"
          style={{
            padding: 'var(--mj-space-16) var(--mj-space-6)',
            backgroundColor: 'var(--mj-color-brand-500)',
          }}
        >
          <div
            style={{
              maxWidth: 'var(--mj-container-xl)',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--mj-space-6)',
            }}
          >
            <p
              style={{
                fontSize: 'var(--mj-text-size-2xl)',
                fontWeight: 'var(--mj-weight-bold)',
                color: 'var(--mj-color-bg)',
                fontFamily: 'var(--mj-font-heading)',
              }}
            >
              Ready to get started?
            </p>
            <a
              href="/contact"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: 'var(--mj-space-4) var(--mj-space-8)',
                backgroundColor: 'var(--mj-color-bg)',
                color: 'var(--mj-color-brand-500)',
                fontWeight: 'var(--mj-weight-semibold)',
                fontSize: 'var(--mj-text-size-base)',
                borderRadius: 'var(--mj-radius-md)',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Get in touch
            </a>
          </div>
        </section>
      </main>
    </>
  )
}
