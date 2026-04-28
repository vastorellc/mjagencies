import type { Metadata } from 'next'
import type React from 'react'
import { fetchPageBySlug } from '@mjagency/cms'
import { notFound } from 'next/navigation'

const AGENCY_ID = 'ecommerce'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'About MJ Ecommerce Agency — Our Story and Team',
  description: 'We are a dedicated ecommerce agency helping online brands grow revenue through Shopify development, conversion optimization, and paid acquisition.',
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
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)' }}>
          {page.title}
        </h1>
        {page.aio_tldr && (
          <p style={{ fontSize: 'var(--mj-text-size-xl)', color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-6)', maxWidth: '65ch' }}>
            {page.aio_tldr}
          </p>
        )}
        <section aria-labelledby="values-heading" style={{ marginTop: 'var(--mj-space-16)' }}>
          <h2 id="values-heading" style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)' }}>
            What we stand for
          </h2>
          <ul style={{ marginTop: 'var(--mj-space-6)', display: 'grid', gap: 'var(--mj-space-4)', listStyle: 'none', padding: 0 }}>
            <li style={{ padding: 'var(--mj-space-6)', backgroundColor: 'var(--mj-color-bg-secondary)', borderRadius: 'var(--mj-radius-lg)' }}>
              <strong style={{ color: 'var(--mj-color-text-primary)' }}>Revenue-first thinking</strong>
              <p style={{ color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-2)' }}>Every decision we make is tied back to measurable revenue impact for our clients.</p>
            </li>
            <li style={{ padding: 'var(--mj-space-6)', backgroundColor: 'var(--mj-color-bg-secondary)', borderRadius: 'var(--mj-radius-lg)' }}>
              <strong style={{ color: 'var(--mj-color-text-primary)' }}>Deep technical expertise</strong>
              <p style={{ color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-2)' }}>From headless storefronts to custom Shopify apps, we build what most agencies cannot.</p>
            </li>
            <li style={{ padding: 'var(--mj-space-6)', backgroundColor: 'var(--mj-color-bg-secondary)', borderRadius: 'var(--mj-radius-lg)' }}>
              <strong style={{ color: 'var(--mj-color-text-primary)' }}>Transparent reporting</strong>
              <p style={{ color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-2)' }}>You always know where your budget goes and what it returns. No smoke and mirrors.</p>
            </li>
          </ul>
        </section>
        <div style={{ display: 'flex', gap: 'var(--mj-space-4)', marginTop: 'var(--mj-space-12)', flexWrap: 'wrap' }}>
          <a
            href="/contact"
            style={{ display: 'inline-block', padding: 'var(--mj-space-4) var(--mj-space-6)', backgroundColor: 'var(--mj-color-brand-500)', color: 'var(--mj-color-bg)', fontWeight: 'var(--mj-weight-semibold)', borderRadius: 'var(--mj-radius-md)', textDecoration: 'none' }}
          >
            Work with us
          </a>
        </div>
      </main>
    </>
  )
}
