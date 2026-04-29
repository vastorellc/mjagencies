import type { Metadata } from 'next'
import type React from 'react'
import { fetchPageBySlug } from '@mjagency/cms'
import { MjImage } from '@mjagency/media'

const AGENCY_ID = 'restaurant'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'MJ Restaurant Agency — Marketing that drives results',
  description: 'Restaurant marketing — local awareness, off-premise revenue, loyalty growth, and reputation management.',
}

export default async function HomePage(): Promise<React.ReactElement> {
  const page = await fetchPageBySlug(AGENCY_ID, 'home')
  const headline = page?.title ?? 'MJ Restaurant Agency'
  const subheadline = page?.aio_tldr ?? 'Restaurant marketing — local awareness, off-premise revenue, loyalty growth, and reputation management.'

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
        style={{ padding: 'var(--mj-space-2) var(--mj-space-4)', backgroundColor: 'var(--mj-color-bg)', outline: '2px solid var(--mj-color-border-focus)', color: 'var(--mj-color-text-primary)' }}
      >
        Skip to main content
      </a>
      <main id="main-content">
        <section
          aria-labelledby="hero-heading"
          style={{ padding: 'var(--mj-space-24) var(--mj-space-6)', maxWidth: 'var(--mj-container-xl)', margin: '0 auto' }}
        >
          {page?.featured_image && (
            <MjImage
              cloudflareImageId={page.featured_image.cloudflare_image_id}
              alt={page.featured_image.alt_text}
              width={page.featured_image.width}
              height={page.featured_image.height}
              priority
              sizes="(min-width: 1280px) 1200px, 100vw"
              style={{ borderRadius: 'var(--mj-radius-lg)', marginBottom: 'var(--mj-space-12)' }}
            />
          )}
          <h1
            id="hero-heading"
            style={{ fontSize: 'var(--mj-text-size-5xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)', lineHeight: 'var(--mj-leading-tight)' }}
          >
            {headline}
          </h1>
          <p style={{ fontSize: 'var(--mj-text-size-xl)', color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-6)', maxWidth: '60ch' }}>
            {subheadline}
          </p>
          <div style={{ display: 'flex', gap: 'var(--mj-space-4)', marginTop: 'var(--mj-space-8)', flexWrap: 'wrap' }}>
            <a href="/services" style={{ padding: 'var(--mj-space-4) var(--mj-space-6)', backgroundColor: 'var(--mj-color-brand-500)', color: 'var(--mj-color-bg)', fontWeight: 'var(--mj-weight-semibold)', borderRadius: 'var(--mj-radius-md)', textDecoration: 'none' }}>Explore services</a>
            <a href="/contact" style={{ padding: 'var(--mj-space-4) var(--mj-space-6)', border: '2px solid var(--mj-color-border)', color: 'var(--mj-color-text-primary)', fontWeight: 'var(--mj-weight-medium)', borderRadius: 'var(--mj-radius-md)', textDecoration: 'none' }}>Talk to us</a>
          </div>
        </section>
      </main>
    </>
  )
}
