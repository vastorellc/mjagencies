import type { Metadata } from 'next'
import type React from 'react'
import { notFound } from 'next/navigation'
import { fetchPageBySlug, fetchAllPageSlugs } from '@mjagency/cms'
import { MjImage } from '@mjagency/media'

const AGENCY_ID = 'webdev'

export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await fetchAllPageSlugs(AGENCY_ID)
  return slugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = await fetchPageBySlug(AGENCY_ID, slug)
  if (!page) return {}
  return { title: page.meta_title ?? `${page.title} — MJ Webdev Agency`, description: page.meta_description ?? page.aio_tldr }
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }): Promise<React.ReactElement> {
  const { slug } = await params
  const page = await fetchPageBySlug(AGENCY_ID, slug)
  if (!page) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: page.title,
    provider: { '@type': 'Organization', name: 'MJ Webdev Agency' },
    areaServed: 'US',
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\u003c') }} />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
        style={{ padding: 'var(--mj-space-2) var(--mj-space-4)', backgroundColor: 'var(--mj-color-bg)', outline: '2px solid var(--mj-color-border-focus)', color: 'var(--mj-color-text-primary)' }}
      >
        Skip to main content
      </a>
      <main id="main-content" style={{ padding: 'var(--mj-space-16) var(--mj-space-6)' }}>
        {page.featured_image && (
          <MjImage
            cloudflareImageId={page.featured_image.cloudflare_image_id}
            alt={page.featured_image.alt_text}
            width={page.featured_image.width}
            height={page.featured_image.height}
            priority
            sizes="(min-width: 1280px) 1200px, 100vw"
          />
        )}
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)', marginTop: 'var(--mj-space-8)' }}>{page.title}</h1>
        {page.aio_tldr && <p style={{ fontSize: 'var(--mj-text-size-xl)', color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-4)' }}>{page.aio_tldr}</p>}
        <div style={{ display: 'flex', gap: 'var(--mj-space-4)', marginTop: 'var(--mj-space-8)', flexWrap: 'wrap' }}>
          <a href="/contact" style={{ padding: 'var(--mj-space-4) var(--mj-space-6)', backgroundColor: 'var(--mj-color-brand-500)', color: 'var(--mj-color-bg)', fontWeight: 'var(--mj-weight-semibold)', borderRadius: 'var(--mj-radius-md)', textDecoration: 'none' }}>Start your project</a>
          <a href="/services" style={{ padding: 'var(--mj-space-4) var(--mj-space-6)', border: '2px solid var(--mj-color-border)', color: 'var(--mj-color-text-primary)', fontWeight: 'var(--mj-weight-medium)', borderRadius: 'var(--mj-radius-md)', textDecoration: 'none' }}>View all services</a>
        </div>
      </main>
    </>
  )
}
