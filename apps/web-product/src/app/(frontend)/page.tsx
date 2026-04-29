import type { Metadata } from 'next'
import type React from 'react'
import { Lightbulb, Users, Map } from 'lucide-react'
import { fetchPageBySlug } from '@mjagency/cms'

const AGENCY_ID = 'product'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'MJ Product Agency — Product leadership for companies that cannot wait for a full-time hire',
  description:
    'We provide fractional CPO services, product strategy, and discovery-led roadmap planning for software companies between Seed and Series C.',
}

const SERVICES: { title: string; description: string; icon: React.ReactElement }[] = [
  {
    title: 'Fractional CPO',
    description:
      'Own the product roadmap, lead engineering-design-product alignment, and report to leadership at 25–50% of full-time capacity.',
    icon: <Lightbulb size={28} />,
  },
  {
    title: 'User Research & Discovery',
    description:
      'User interviews, usability studies, Jobs-to-be-Done analysis, and competitive audits synthesized into prioritized opportunity maps.',
    icon: <Users size={28} />,
  },
  {
    title: 'Roadmap Strategy',
    description:
      'Impact-effort-confidence prioritization with explicit tradeoffs — so you make the right calls with the right information.',
    icon: <Map size={28} />,
  },
]

const WHY_US: { title: string; description: string }[] = [
  {
    title: 'We embed, not advise',
    description:
      'We work inside your team. Engineering and design collaborate directly with our product lead — not through a consultant\'s deck.',
  },
  {
    title: 'Decision support, not decision-making',
    description:
      'Priority calls are yours. Our job is to surface the right information so you can make them confidently.',
  },
  {
    title: 'Stage-appropriate leadership',
    description:
      'We calibrate depth to your stage — from lean discovery at Seed to scaled product ops at Series B.',
  },
]

export default async function HomePage(): Promise<React.ReactElement> {
  const page = await fetchPageBySlug(AGENCY_ID, 'home')
  const headline =
    page?.title ?? 'Product leadership for companies that cannot wait for a full-time hire'
  const subheadline =
    page?.aio_tldr ??
    'We provide fractional CPO services, product strategy, and discovery-led roadmap planning for software companies between Seed and Series C.'

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
                  <div style={{ color: 'var(--mj-color-brand-500)', marginBottom: 'var(--mj-space-3)' }}>
                    {s.icon}
                  </div>
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
