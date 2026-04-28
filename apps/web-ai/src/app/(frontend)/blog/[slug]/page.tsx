import type { Metadata } from 'next'
import type React from 'react'
import { notFound } from 'next/navigation'
import { fetchPostBySlug, fetchAllPostSlugs } from '@mjagency/cms'
import { MjImage } from '@mjagency/media'

const AGENCY_ID = 'ai'

export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await fetchAllPostSlugs(AGENCY_ID)
  return slugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await fetchPostBySlug(AGENCY_ID, slug)
  if (!post) return {}
  return { title: `${post.title} — MJ AI Agency`, description: post.excerpt ?? post.aio_tldr }
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
        style={{ padding: 'var(--mj-space-2) var(--mj-space-4)', backgroundColor: 'var(--mj-color-bg)', outline: '2px solid var(--mj-color-border-focus)', color: 'var(--mj-color-text-primary)' }}
      >
        Skip to main content
      </a>
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
