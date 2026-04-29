import type { Metadata } from 'next'
import type React from 'react'
import { fetchPagesIndex } from '@mjagency/cms'
import { MjImage } from '@mjagency/media'

const AGENCY_ID = 'branding'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Brand Identity Services — MJ Branding Agency',
  description: 'Brand strategy, visual identity, logo design, brand system development, and rebrands for companies at every stage — from seed-stage startups to enterprise.',
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
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)' }}>Brand Identity Services</h1>
        {services.length === 0 ? (
          <p style={{ color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-8)' }}>
            We create cohesive brand systems — strategy, logo, visual identity, and guidelines — that make your company instantly recognizable.{' '}
            <a href="/contact" style={{ color: 'var(--mj-color-brand-500)' }}>Contact us</a> to discuss your brand project.
          </p>
        ) : (
          <ul style={{ marginTop: 'var(--mj-space-8)', listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--mj-space-4)' }} aria-label="Our services">
            {services.map(s => (
              <li key={s.id}>
                <article style={{ padding: 'var(--mj-space-6)', backgroundColor: 'var(--mj-color-bg-secondary)', borderRadius: 'var(--mj-radius-lg)' }}>
                  {s.featured_image && (
                    <MjImage
                      cloudflareImageId={s.featured_image.cloudflare_image_id}
                      alt={s.featured_image.alt_text}
                      width={s.featured_image.width}
                      height={s.featured_image.height}
                      sizes="(min-width: 768px) 50vw, 100vw"
                      style={{ borderRadius: 'var(--mj-radius-md)', marginBottom: 'var(--mj-space-4)' }}
                    />
                  )}
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
