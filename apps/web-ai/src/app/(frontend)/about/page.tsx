import type { Metadata } from 'next'
import type React from 'react'
import { fetchPageBySlug } from '@mjagency/cms'
import { MjImage } from '@mjagency/media'
import { notFound } from 'next/navigation'

const AGENCY_ID = 'ai'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'About — MJ AI Agency',
  description: 'Learn about the team and values behind MJ AI Agency.',
}

export default async function AboutPage(): Promise<React.ReactElement> {
  const page = await fetchPageBySlug(AGENCY_ID, 'about')
  if (!page) notFound()

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
        {page.featured_image && (
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
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)' }}>
          {page.title}
        </h1>
        {page.aio_tldr && (
          <p style={{ fontSize: 'var(--mj-text-size-xl)', color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-4)', maxWidth: '65ch' }}>
            {page.aio_tldr}
          </p>
        )}
        <a
          href="/contact"
          style={{ display: 'inline-block', marginTop: 'var(--mj-space-8)', padding: 'var(--mj-space-4) var(--mj-space-6)', backgroundColor: 'var(--mj-color-brand-500)', color: 'var(--mj-color-bg)', fontWeight: 'var(--mj-weight-semibold)', borderRadius: 'var(--mj-radius-md)', textDecoration: 'none' }}
        >
          Work with us
        </a>
      </main>
    </>
  )
}
