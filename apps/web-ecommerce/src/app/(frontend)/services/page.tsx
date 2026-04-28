import type { Metadata } from 'next'
import type React from 'react'
import { fetchPagesIndex } from '@mjagency/cms'

const AGENCY_ID = 'ecommerce'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Ecommerce Services — MJ Ecommerce Agency',
  description: 'Shopify development, conversion rate optimization, paid acquisition, and headless ecommerce builds for high-growth online brands.',
}

export default async function ServicesPage(): Promise<React.ReactElement> {
  const services = await fetchPagesIndex(AGENCY_ID, 'service')

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
        style={{ padding: 'var(--mj-space-2) var(--mj-space-4)', backgroundColor: 'var(--mj-color-bg)', outline: '2px solid var(--mj-color-border-focus)', color: 'var(--mj-color-text-primary)' }}
      >
        Skip to main content
      </a>
      <main id="main-content" style={{ padding: 'var(--mj-space-16) var(--mj-space-6)' }}>
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)' }}>
          Ecommerce Services
        </h1>
        <p style={{ fontSize: 'var(--mj-text-size-xl)', color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-4)', maxWidth: '60ch' }}>
          End-to-end ecommerce solutions built for brands that want to grow revenue, not just traffic.
        </p>
        {services.length > 0 ? (
          <ul style={{ marginTop: 'var(--mj-space-12)', display: 'grid', gap: 'var(--mj-space-6)', listStyle: 'none', padding: 0 }} aria-label="Our services">
            {services.map(service => (
              <li key={service.id}>
                <article style={{ padding: 'var(--mj-space-8)', backgroundColor: 'var(--mj-color-bg-secondary)', borderRadius: 'var(--mj-radius-lg)', border: '1px solid var(--mj-color-border)' }}>
                  <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)' }}>
                    {service.title}
                  </h2>
                  {service.aio_tldr && (
                    <p style={{ color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-3)' }}>
                      {service.aio_tldr}
                    </p>
                  )}
                  <a
                    href={`/services/${service.slug}`}
                    style={{ display: 'inline-block', marginTop: 'var(--mj-space-4)', color: 'var(--mj-color-brand-500)', fontWeight: 'var(--mj-weight-medium)', textDecoration: 'none' }}
                  >
                    View service details
                  </a>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ marginTop: 'var(--mj-space-12)', color: 'var(--mj-color-text-secondary)' }}>
            We offer Shopify development, CRO, and paid acquisition for high-growth ecommerce brands. <a href="/contact" style={{ color: 'var(--mj-color-brand-500)' }}>Contact us</a> to discuss your project.
          </p>
        )}
      </main>
    </>
  )
}
