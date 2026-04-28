import type { Metadata } from 'next'
import type React from 'react'
import { fetchPagesIndex } from '@mjagency/cms'

const AGENCY_ID = 'finance'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Financial Advisory Services — MJ Finance Agency',
  description: 'Fractional CFO services, financial modeling, fundraising preparation, cash flow management, and financial strategy for growth-stage companies.',
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
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)' }}>Financial Advisory Services</h1>
        {services.length === 0 ? (
          <p style={{ color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-8)' }}>
            We provide fractional CFO services, financial modeling, investor readiness, and ongoing financial strategy for companies scaling from $1M to $50M in revenue.{' '}
            <a href="/contact" style={{ color: 'var(--mj-color-brand-500)' }}>Contact us</a> to discuss your financial goals.
          </p>
        ) : (
          <ul style={{ marginTop: 'var(--mj-space-8)', listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--mj-space-4)' }} aria-label="Our services">
            {services.map(s => (
              <li key={s.id}>
                <article style={{ padding: 'var(--mj-space-6)', backgroundColor: 'var(--mj-color-bg-secondary)', borderRadius: 'var(--mj-radius-lg)' }}>
                  <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)' }}>{s.title}</h2>
                  <a href={`/services/${s.slug}`} style={{ color: 'var(--mj-color-brand-500)', marginTop: 'var(--mj-space-3)', display: 'inline-block' }}>View service details</a>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
