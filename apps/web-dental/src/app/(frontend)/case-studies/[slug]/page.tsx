import type { Metadata } from 'next'
import type React from 'react'
import { notFound } from 'next/navigation'
import { fetchCaseStudyBySlug, fetchAllCaseStudySlugs } from '@mjagency/cms'
import { MjImage } from '@mjagency/media'

const AGENCY_ID = 'dental'

export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await fetchAllCaseStudySlugs(AGENCY_ID)
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const cs = await fetchCaseStudyBySlug(AGENCY_ID, slug)
  if (!cs) return {}
  return {
    title: cs.meta_title ?? `${cs.title} — MJ Dental Agency Case Study`,
    description: cs.meta_description ?? cs.aio_tldr ?? `${cs.client}: ${cs.results}`,
  }
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }): Promise<React.ReactElement> {
  const { slug } = await params
  const cs = await fetchCaseStudyBySlug(AGENCY_ID, slug)
  if (!cs) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: cs.title,
    about: cs.client,
    publisher: { '@type': 'Organization', name: 'MJ Dental Agency' },
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
        {cs.featured_image && (
          <MjImage
            cloudflareImageId={cs.featured_image.cloudflare_image_id}
            alt={cs.featured_image.alt_text}
            width={cs.featured_image.width}
            height={cs.featured_image.height}
            priority
            sizes="(min-width: 1280px) 1200px, 100vw"
            style={{ borderRadius: 'var(--mj-radius-lg)' }}
          />
        )}
        <p style={{ fontSize: 'var(--mj-text-size-sm)', color: 'var(--mj-color-text-tertiary)', marginTop: 'var(--mj-space-8)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Case Study · {cs.client}
        </p>
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)', marginTop: 'var(--mj-space-2)' }}>
          {cs.title}
        </h1>
        {cs.aio_tldr && (
          <p style={{ fontSize: 'var(--mj-text-size-xl)', color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-4)', maxWidth: '70ch' }}>
            {cs.aio_tldr}
          </p>
        )}
        <section aria-label="Challenge" style={{ marginTop: 'var(--mj-space-12)' }}>
          <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)' }}>The challenge</h2>
          <p style={{ marginTop: 'var(--mj-space-3)', color: 'var(--mj-color-text-secondary)', maxWidth: '65ch' }}>{cs.challenge}</p>
        </section>
        <section aria-label="Solution" style={{ marginTop: 'var(--mj-space-8)' }}>
          <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)' }}>What we did</h2>
          <p style={{ marginTop: 'var(--mj-space-3)', color: 'var(--mj-color-text-secondary)', maxWidth: '65ch' }}>{cs.solution}</p>
        </section>
        <section aria-label="Results" style={{ marginTop: 'var(--mj-space-8)' }}>
          <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)' }}>Results</h2>
          <p style={{ marginTop: 'var(--mj-space-3)', color: 'var(--mj-color-text-secondary)', maxWidth: '65ch' }}>{cs.results}</p>
        </section>
        <div style={{ display: 'flex', gap: 'var(--mj-space-4)', marginTop: 'var(--mj-space-12)', flexWrap: 'wrap' }}>
          <a href="/contact" style={{ padding: 'var(--mj-space-4) var(--mj-space-6)', backgroundColor: 'var(--mj-color-brand-500)', color: 'var(--mj-color-bg)', fontWeight: 'var(--mj-weight-semibold)', borderRadius: 'var(--mj-radius-md)', textDecoration: 'none' }}>Discuss your project</a>
        </div>
      </main>
    </>
  )
}
