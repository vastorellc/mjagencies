import { mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'

const agencies = {
  growth: { id: 'growth', name: 'MJ Growth Agency', title: 'MJ Growth Agency — Performance Marketing That Compounds' },
  webdev: { id: 'webdev', name: 'MJ Webdev Agency', title: 'MJ Webdev Agency — Custom Next.js + Headless Builds' },
  ai: { id: 'ai', name: 'MJ AI Agency', title: 'MJ AI Agency — Applied AI Solutions for Business' },
  branding: { id: 'branding', name: 'MJ Branding Agency', title: 'MJ Branding Agency — Brands Built to Lead' },
  strategy: { id: 'strategy', name: 'MJ Strategy Agency', title: 'MJ Strategy Agency — Business Strategy Meets Execution' },
  finance: { id: 'finance', name: 'MJ Finance Agency', title: 'MJ Finance Agency — CFO-Level Financial Strategy' },
  engineering: { id: 'engineering', name: 'MJ Engineering Agency', title: 'MJ Engineering Agency — Systems That Scale' },
  product: { id: 'product', name: 'MJ Product Agency', title: 'MJ Product Agency — Product Strategy and Execution' },
  video: { id: 'video', name: 'MJ Video Agency', title: 'MJ Video Agency — Video Production That Performs' },
  graphic: { id: 'graphic', name: 'MJ Graphic Agency', title: 'MJ Graphic Agency — Visual Design at Agency Speed' },
  brand: { id: 'brand', name: 'MJAgency', title: 'MJAgency — The Multi-Agency Platform' },
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, { encoding: 'utf8' })
}

const SKIP_LINK = `      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
        style={{ padding: 'var(--mj-space-2) var(--mj-space-4)', backgroundColor: 'var(--mj-color-bg)', outline: '2px solid var(--mj-color-border-focus)', color: 'var(--mj-color-text-primary)' }}
      >
        Skip to main content
      </a>`

function makeHome(slug, agencyId, name, title) {
  return `import type { Metadata } from 'next'
import type React from 'react'
import { notFound } from 'next/navigation'
import { MjImage } from '@mjagency/media'
import { fetchPageBySlug } from '@mjagency/cms'
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'

const AGENCY_ID = '${agencyId}'

export const revalidate = 60

export const metadata: Metadata = {
  title: '${title}',
}

function AiDisclosureBanner(): React.ReactElement {
  return (
    <div
      role="note"
      aria-label="AI content disclosure"
      style={{
        padding: 'var(--mj-space-2) var(--mj-space-4)',
        backgroundColor: 'var(--mj-color-warning-surface)',
        borderLeft: '4px solid var(--mj-color-warning)',
        fontSize: 'var(--mj-text-size-sm)',
        color: 'var(--mj-color-text-primary)',
      }}
    >
      <strong>Some content on this page was AI-assisted</strong>
      <p>This content has been reviewed for accuracy. AI-generated content exceeds 70% of this page.</p>
    </div>
  )
}

export default async function HomePage(): Promise<React.ReactElement> {
  const page = await fetchPageBySlug(AGENCY_ID, 'home')
  if (!page) notFound()

  const faqJsonLd = page.faqs && page.faqs.length > 0 ? buildFaqJsonLd(page.faqs) : null

  return (
    <>
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeFaqJsonLd(faqJsonLd) }}
        />
      )}
${SKIP_LINK}
      {page.ai_disclosure_required && <AiDisclosureBanner />}
      <main id="main-content" style={{ padding: 'var(--mj-space-20) var(--mj-space-6)' }}>
        {page.featured_image && (
          <MjImage
            cloudflareImageId={page.featured_image.cloudflare_image_id}
            alt={page.featured_image.alt_text}
            width={page.featured_image.width}
            height={page.featured_image.height}
            blurHash={page.featured_image.blurhash ? { hash: page.featured_image.blurhash, width: page.featured_image.width, height: page.featured_image.height } : undefined}
            priority
            sizes="(min-width: 1280px) 1200px, 100vw"
          />
        )}
        <h1
          style={{
            fontSize: 'var(--mj-text-size-5xl)',
            fontWeight: 'var(--mj-weight-bold)',
            color: 'var(--mj-color-text-primary)',
            fontFamily: 'var(--mj-font-heading)',
          }}
        >
          {page.title}
        </h1>
        {page.aio_tldr && (
          <p style={{ fontSize: 'var(--mj-text-size-xl)', color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-4)', maxWidth: '60ch' }}>
            {page.aio_tldr}
          </p>
        )}
        <div style={{ display: 'flex', gap: 'var(--mj-space-4)', marginTop: 'var(--mj-space-8)', flexWrap: 'wrap' }}>
          <a
            href="/contact"
            style={{ display: 'inline-block', padding: 'var(--mj-space-4) var(--mj-space-6)', backgroundColor: 'var(--mj-color-brand-500)', color: 'var(--mj-color-bg)', fontWeight: 'var(--mj-weight-semibold)', borderRadius: 'var(--mj-radius-md)', textDecoration: 'none' }}
          >
            Get in touch
          </a>
          <a
            href="/services"
            style={{ display: 'inline-block', padding: 'var(--mj-space-4) var(--mj-space-6)', border: '2px solid var(--mj-color-border)', color: 'var(--mj-color-text-primary)', fontWeight: 'var(--mj-weight-medium)', borderRadius: 'var(--mj-radius-md)', textDecoration: 'none' }}
          >
            View services
          </a>
        </div>
      </main>
    </>
  )
}
`
}

function makeAbout(agencyId, name) {
  return `import type { Metadata } from 'next'
import type React from 'react'
import { fetchPageBySlug } from '@mjagency/cms'
import { notFound } from 'next/navigation'

const AGENCY_ID = '${agencyId}'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'About — ${name}',
  description: 'Learn about the team and values behind ${name}.',
}

export default async function AboutPage(): Promise<React.ReactElement> {
  const page = await fetchPageBySlug(AGENCY_ID, 'about')
  if (!page) notFound()

  return (
    <>
${SKIP_LINK}
      <main id="main-content" style={{ padding: 'var(--mj-space-16) var(--mj-space-6)' }}>
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
`
}

function makeServicesIndex(agencyId) {
  return `import type { Metadata } from 'next'
import type React from 'react'
import { fetchPagesIndex } from '@mjagency/cms'

const AGENCY_ID = '${agencyId}'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Services',
}

export default async function ServicesPage(): Promise<React.ReactElement> {
  const services = await fetchPagesIndex(AGENCY_ID, 'service')

  return (
    <>
${SKIP_LINK}
      <main id="main-content" style={{ padding: 'var(--mj-space-16) var(--mj-space-6)' }}>
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)' }}>Services</h1>
        {services.length === 0 ? (
          <p style={{ color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-8)' }}>
            Service pages coming soon. <a href="/contact" style={{ color: 'var(--mj-color-brand-500)' }}>Contact us</a>.
          </p>
        ) : (
          <ul style={{ marginTop: 'var(--mj-space-8)', listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--mj-space-4)' }} aria-label="Our services">
            {services.map(s => (
              <li key={s.id}>
                <article style={{ padding: 'var(--mj-space-6)', backgroundColor: 'var(--mj-color-bg-secondary)', borderRadius: 'var(--mj-radius-lg)' }}>
                  <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)' }}>{s.title}</h2>
                  <a href={\`/services/\${s.slug}\`} style={{ color: 'var(--mj-color-brand-500)', marginTop: 'var(--mj-space-3)', display: 'inline-block' }}>View service details</a>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
`
}

function makeServiceSlug(agencyId, name) {
  return `import type { Metadata } from 'next'
import type React from 'react'
import { notFound } from 'next/navigation'
import { fetchPageBySlug, fetchAllPageSlugs } from '@mjagency/cms'
import { MjImage } from '@mjagency/media'

const AGENCY_ID = '${agencyId}'

export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await fetchAllPageSlugs(AGENCY_ID)
  return slugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = await fetchPageBySlug(AGENCY_ID, slug)
  if (!page) return {}
  return { title: page.meta_title ?? \`\${page.title} — ${name}\`, description: page.meta_description ?? page.aio_tldr }
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }): Promise<React.ReactElement> {
  const { slug } = await params
  const page = await fetchPageBySlug(AGENCY_ID, slug)
  if (!page) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: page.title,
    provider: { '@type': 'Organization', name: '${name}' },
    areaServed: 'US',
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
${SKIP_LINK}
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
`
}

function makeBlogIndex(agencyId) {
  return `import type { Metadata } from 'next'
import type React from 'react'
import { fetchPostsIndex } from '@mjagency/cms'

const AGENCY_ID = '${agencyId}'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Insights',
}

export default async function BlogIndexPage(): Promise<React.ReactElement> {
  const { posts } = await fetchPostsIndex(AGENCY_ID, 12, 1)

  return (
    <>
${SKIP_LINK}
      <main id="main-content" style={{ padding: 'var(--mj-space-16) var(--mj-space-6)' }}>
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)' }}>Insights</h1>
        {posts.length === 0 ? (
          <p style={{ marginTop: 'var(--mj-space-16)', color: 'var(--mj-color-text-secondary)', fontSize: 'var(--mj-text-size-lg)' }}>No posts published yet. Check back soon.</p>
        ) : (
          <ul style={{ marginTop: 'var(--mj-space-8)', listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--mj-space-8)' }} aria-label="Blog posts">
            {posts.map(post => (
              <li key={post.id}>
                <article>
                  <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)' }}>
                    <a href={\`/blog/\${post.slug}\`} style={{ color: 'inherit', textDecoration: 'none' }}>{post.title}</a>
                  </h2>
                  {post.publishedAt && (
                    <time dateTime={post.publishedAt} style={{ fontSize: 'var(--mj-text-size-sm)', color: 'var(--mj-color-text-tertiary)', marginTop: 'var(--mj-space-2)', display: 'block' }}>
                      {new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </time>
                  )}
                  {post.excerpt && <p style={{ color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-2)', maxWidth: '65ch' }}>{post.excerpt}</p>}
                  <a href={\`/blog/\${post.slug}\`} style={{ color: 'var(--mj-color-brand-500)', marginTop: 'var(--mj-space-3)', display: 'inline-block' }}>Read article</a>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
`
}

function makeBlogSlug(agencyId, name) {
  return `import type { Metadata } from 'next'
import type React from 'react'
import { notFound } from 'next/navigation'
import { fetchPostBySlug, fetchAllPostSlugs } from '@mjagency/cms'
import { MjImage } from '@mjagency/media'

const AGENCY_ID = '${agencyId}'

export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await fetchAllPostSlugs(AGENCY_ID)
  return slugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await fetchPostBySlug(AGENCY_ID, slug)
  if (!post) return {}
  return { title: \`\${post.title} — ${name}\`, description: post.excerpt ?? post.aio_tldr }
}

function AiDisclosureBanner(): React.ReactElement {
  return (
    <div
      role="note"
      aria-label="AI content disclosure"
      style={{
        padding: 'var(--mj-space-2) var(--mj-space-4)',
        backgroundColor: 'var(--mj-color-warning-surface)',
        borderLeft: '4px solid var(--mj-color-warning)',
        fontSize: 'var(--mj-text-size-sm)',
        color: 'var(--mj-color-text-primary)',
        marginBottom: 'var(--mj-space-6)',
      }}
    >
      <strong>Some content on this page was AI-assisted</strong>
      <p>This content has been reviewed for accuracy. AI-generated content exceeds 70% of this page.</p>
    </div>
  )
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }): Promise<React.ReactElement> {
  const { slug } = await params
  const post = await fetchPostBySlug(AGENCY_ID, slug)
  if (!post) notFound()

  return (
    <>
${SKIP_LINK}
      <main id="main-content" style={{ padding: 'var(--mj-space-16) var(--mj-space-6)', maxWidth: '75ch', margin: '0 auto' }}>
        {post.ai_disclosure_required && <AiDisclosureBanner />}
        <article>
          <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)', lineHeight: 'var(--mj-leading-tight)' }}>{post.title}</h1>
          {post.publishedAt && (
            <time dateTime={post.publishedAt} style={{ fontSize: 'var(--mj-text-size-sm)', color: 'var(--mj-color-text-tertiary)', marginTop: 'var(--mj-space-4)', display: 'block' }}>
              Published {new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
          )}
          {post.featured_image && (
            <MjImage
              cloudflareImageId={post.featured_image.cloudflare_image_id}
              alt={post.featured_image.alt_text}
              width={post.featured_image.width}
              height={post.featured_image.height}
              priority
              sizes="(min-width: 860px) 75ch, 100vw"
              style={{ marginTop: 'var(--mj-space-8)', borderRadius: 'var(--mj-radius-lg)' }}
            />
          )}
          {post.author && (
            <section aria-label="Article author" style={{ marginTop: 'var(--mj-space-12)', paddingTop: 'var(--mj-space-8)', borderTop: '1px solid var(--mj-color-border)' }}>
              <p style={{ fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)' }}>{post.author.name}</p>
              {post.author.bio && <p style={{ color: 'var(--mj-color-text-secondary)', fontSize: 'var(--mj-text-size-sm)' }}>{post.author.bio}</p>}
            </section>
          )}
        </article>
        <nav aria-label="Blog navigation" style={{ marginTop: 'var(--mj-space-12)' }}>
          <a href="/blog" style={{ color: 'var(--mj-color-brand-500)', fontWeight: 'var(--mj-weight-medium)', textDecoration: 'none' }}>← Back to all articles</a>
        </nav>
      </main>
    </>
  )
}
`
}

function makeContact(agencyId, name, slug) {
  const domain = slug === 'brand' ? 'mjagency.com' : `${slug}.mjagency.com`
  return `import type { Metadata } from 'next'
import type React from 'react'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Contact — ${name}',
}

export default function ContactPage(): React.ReactElement {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: '${name}',
    url: 'https://${domain}',
    areaServed: 'US',
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
${SKIP_LINK}
      <main id="main-content" style={{ padding: 'var(--mj-space-16) var(--mj-space-6)', maxWidth: '600px' }}>
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)' }}>
          Contact ${name}
        </h1>
        <p style={{ fontSize: 'var(--mj-text-size-lg)', color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-4)' }}>
          Tell us about your project. We respond within one business day.
        </p>
        <form
          aria-label="Contact form"
          noValidate
          action="/api/contact"
          method="POST"
          style={{ marginTop: 'var(--mj-space-10)', display: 'grid', gap: 'var(--mj-space-6)' }}
        >
          <div>
            <label htmlFor="contact-name" style={{ display: 'block', fontWeight: 'var(--mj-weight-medium)', color: 'var(--mj-color-text-primary)', marginBottom: 'var(--mj-space-2)' }}>
              Full name <span aria-hidden="true" style={{ color: 'var(--mj-color-error)' }}>*</span>
            </label>
            <input
              type="text"
              id="contact-name"
              name="name"
              required
              aria-required="true"
              autoComplete="name"
              style={{ width: '100%', padding: 'var(--mj-space-3) var(--mj-space-4)', border: '1px solid var(--mj-color-border)', borderRadius: 'var(--mj-radius-md)', fontSize: 'var(--mj-text-size-base)', color: 'var(--mj-color-text-primary)', backgroundColor: 'var(--mj-color-bg)' }}
            />
          </div>
          <div>
            <label htmlFor="contact-email" style={{ display: 'block', fontWeight: 'var(--mj-weight-medium)', color: 'var(--mj-color-text-primary)', marginBottom: 'var(--mj-space-2)' }}>
              Email address <span aria-hidden="true" style={{ color: 'var(--mj-color-error)' }}>*</span>
            </label>
            <input
              type="email"
              id="contact-email"
              name="email"
              required
              aria-required="true"
              autoComplete="email"
              style={{ width: '100%', padding: 'var(--mj-space-3) var(--mj-space-4)', border: '1px solid var(--mj-color-border)', borderRadius: 'var(--mj-radius-md)', fontSize: 'var(--mj-text-size-base)', color: 'var(--mj-color-text-primary)', backgroundColor: 'var(--mj-color-bg)' }}
            />
          </div>
          <div>
            <label htmlFor="contact-message" style={{ display: 'block', fontWeight: 'var(--mj-weight-medium)', color: 'var(--mj-color-text-primary)', marginBottom: 'var(--mj-space-2)' }}>
              Message <span aria-hidden="true" style={{ color: 'var(--mj-color-error)' }}>*</span>
            </label>
            <textarea
              id="contact-message"
              name="message"
              required
              aria-required="true"
              rows={6}
              style={{ width: '100%', padding: 'var(--mj-space-3) var(--mj-space-4)', border: '1px solid var(--mj-color-border)', borderRadius: 'var(--mj-radius-md)', fontSize: 'var(--mj-text-size-base)', color: 'var(--mj-color-text-primary)', backgroundColor: 'var(--mj-color-bg)', resize: 'vertical' }}
            />
          </div>
          <div>
            <button
              type="submit"
              style={{ padding: 'var(--mj-space-4) var(--mj-space-8)', backgroundColor: 'var(--mj-color-brand-500)', color: 'var(--mj-color-bg)', fontWeight: 'var(--mj-weight-semibold)', borderRadius: 'var(--mj-radius-md)', border: 'none', cursor: 'pointer' }}
            >
              Send message
            </button>
          </div>
        </form>
      </main>
    </>
  )
}
`
}

function makeFaq(agencyId, name) {
  return `import type { Metadata } from 'next'
import type React from 'react'
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'FAQ — ${name}',
}

const FAQ_ITEMS = [
  {
    question: 'What services does ${name} offer?',
    answer: 'We offer a range of specialized services tailored for growing businesses. Contact us for a detailed overview of our current offerings.',
  },
  {
    question: 'How do I get started working with you?',
    answer: 'Fill out our contact form and we will schedule a discovery call within one business day to discuss your project.',
  },
  {
    question: 'What is your typical engagement timeline?',
    answer: 'Project timelines vary by scope. Most project engagements run 6–16 weeks. Ongoing retainer work operates on a monthly basis.',
  },
]

export default function FaqPage(): React.ReactElement {
  const faqJsonLd = buildFaqJsonLd(FAQ_ITEMS)

  return (
    <>
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeFaqJsonLd(faqJsonLd) }}
        />
      )}
${SKIP_LINK}
      <main id="main-content" style={{ padding: 'var(--mj-space-16) var(--mj-space-6)', maxWidth: '800px' }}>
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)' }}>
          Frequently Asked Questions
        </h1>
        <dl style={{ marginTop: 'var(--mj-space-12)' }}>
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} style={{ padding: 'var(--mj-space-6) 0', borderBottom: '1px solid var(--mj-color-border)' }}>
              <dt style={{ fontSize: 'var(--mj-text-size-lg)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)' }}>
                {item.question}
              </dt>
              <dd style={{ marginTop: 'var(--mj-space-3)', color: 'var(--mj-color-text-secondary)', lineHeight: 'var(--mj-leading-relaxed)' }}>
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
        <p style={{ marginTop: 'var(--mj-space-12)', color: 'var(--mj-color-text-secondary)' }}>
          Still have questions?{' '}
          <a href="/contact" style={{ color: 'var(--mj-color-brand-500)', fontWeight: 'var(--mj-weight-medium)' }}>
            Contact us
          </a>
          {' '}and we will get back to you within one business day.
        </p>
      </main>
    </>
  )
}
`
}

function makePrivacy(agencyId, name, slug) {
  const emailSlug = slug === 'brand' ? 'brand' : slug
  return `import type { Metadata } from 'next'
import type React from 'react'

export const metadata: Metadata = {
  title: 'Privacy Policy — ${name}',
  robots: { index: false },
}

export default function PrivacyPage(): React.ReactElement {
  return (
    <>
${SKIP_LINK}
      <main id="main-content" style={{ padding: 'var(--mj-space-16) var(--mj-space-6)', maxWidth: '800px' }}>
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)' }}>
          Privacy Policy
        </h1>
        <p style={{ color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-2)' }}>Last updated: January 1, 2026</p>
        <section style={{ marginTop: 'var(--mj-space-8)' }}>
          <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)', marginBottom: 'var(--mj-space-4)' }}>Information We Collect</h2>
          <p style={{ color: 'var(--mj-color-text-secondary)', lineHeight: 'var(--mj-leading-relaxed)' }}>
            ${name} collects information you provide directly, including name, email address, and project details via our contact form. We also collect analytics data to improve our website.
          </p>
        </section>
        <section style={{ marginTop: 'var(--mj-space-8)' }}>
          <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)', marginBottom: 'var(--mj-space-4)' }}>Your Rights</h2>
          <p style={{ color: 'var(--mj-color-text-secondary)', lineHeight: 'var(--mj-leading-relaxed)' }}>
            You may request access, correction, or deletion of your personal data by emailing privacy@${emailSlug}.mjagency.com. We will respond within 30 days.
          </p>
        </section>
      </main>
    </>
  )
}
`
}

function makeTerms(agencyId, name) {
  return `import type { Metadata } from 'next'
import type React from 'react'

export const metadata: Metadata = {
  title: 'Terms of Service — ${name}',
  robots: { index: false },
}

export default function TermsPage(): React.ReactElement {
  return (
    <>
${SKIP_LINK}
      <main id="main-content" style={{ padding: 'var(--mj-space-16) var(--mj-space-6)', maxWidth: '800px' }}>
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)' }}>
          Terms of Service
        </h1>
        <p style={{ color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-2)' }}>Last updated: January 1, 2026</p>
        <section style={{ marginTop: 'var(--mj-space-8)' }}>
          <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)', marginBottom: 'var(--mj-space-4)' }}>Services</h2>
          <p style={{ color: 'var(--mj-color-text-secondary)', lineHeight: 'var(--mj-leading-relaxed)' }}>
            ${name} provides professional services under the terms of a separately executed Statement of Work. These terms govern use of our website and general engagement inquiries.
          </p>
        </section>
        <section style={{ marginTop: 'var(--mj-space-8)' }}>
          <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)', marginBottom: 'var(--mj-space-4)' }}>Governing Law</h2>
          <p style={{ color: 'var(--mj-color-text-secondary)', lineHeight: 'var(--mj-leading-relaxed)' }}>
            These terms are governed by the laws of the State of Delaware, United States, without regard to its conflict of law provisions.
          </p>
        </section>
      </main>
    </>
  )
}
`
}

function makeNotFound(name) {
  return `import type React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page not found — ${name}',
}

export default function NotFound(): React.ReactElement {
  return (
    <main id="main-content" style={{ padding: 'var(--mj-space-24) var(--mj-space-6)', textAlign: 'center' }}>
      <h1 style={{ fontSize: 'var(--mj-text-size-5xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)' }}>
        Page not found
      </h1>
      <p style={{
        fontSize: 'var(--mj-text-size-base)',
        color: 'var(--mj-color-text-secondary)',
        marginTop: 'var(--mj-space-4)',
        maxWidth: '40ch',
        margin: 'var(--mj-space-4) auto 0',
      }}>
        We could not find the page you were looking for. Return to the home page or use the navigation above.
      </p>
      <a
        href="/"
        style={{
          display: 'inline-block',
          marginTop: 'var(--mj-space-8)',
          padding: 'var(--mj-space-4) var(--mj-space-6)',
          backgroundColor: 'var(--mj-color-brand-500)',
          color: 'var(--mj-color-bg)',
          borderRadius: 'var(--mj-radius-md)',
          textDecoration: 'none',
          fontWeight: 'var(--mj-weight-semibold)',
        }}
      >
        Return home
      </a>
    </main>
  )
}
`
}

let count = 0

for (const [slug, info] of Object.entries(agencies)) {
  const { id: agencyId, name, title } = info
  const base = slug === 'brand' ? 'apps/web-main/src/app/(frontend)' : `apps/web-${slug}/src/app/(frontend)`

  write(`${base}/page.tsx`, makeHome(slug, agencyId, name, title))
  write(`${base}/about/page.tsx`, makeAbout(agencyId, name))
  write(`${base}/services/page.tsx`, makeServicesIndex(agencyId))
  write(`${base}/services/[slug]/page.tsx`, makeServiceSlug(agencyId, name))
  write(`${base}/blog/page.tsx`, makeBlogIndex(agencyId))
  write(`${base}/blog/[slug]/page.tsx`, makeBlogSlug(agencyId, name))
  write(`${base}/contact/page.tsx`, makeContact(agencyId, name, slug))
  write(`${base}/faq/page.tsx`, makeFaq(agencyId, name))
  write(`${base}/privacy/page.tsx`, makePrivacy(agencyId, name, slug))
  write(`${base}/terms/page.tsx`, makeTerms(agencyId, name, slug))
  write(`${base}/not-found.tsx`, makeNotFound(name))
  count += 11
  console.log(`  Generated ${slug}: 11 pages`)
}

console.log(`\nTotal: ${count} page files generated`)
