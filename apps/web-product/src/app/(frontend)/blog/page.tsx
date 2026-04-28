import type { Metadata } from 'next'
import type React from 'react'
import { fetchPostsIndex } from '@mjagency/cms'

const AGENCY_ID = 'product'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Product Insights — MJ Product Agency Blog',
  description: 'Practical product management thinking — on roadmap strategy, user research, prioritization frameworks, OKR design, and building product teams that ship with conviction.',
}

export default async function BlogIndexPage(): Promise<React.ReactElement> {
  const { posts } = await fetchPostsIndex(AGENCY_ID, 12, 1)

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
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)' }}>Insights</h1>
        {posts.length === 0 ? (
          <p style={{ marginTop: 'var(--mj-space-16)', color: 'var(--mj-color-text-secondary)', fontSize: 'var(--mj-text-size-lg)' }}>No posts published yet. Check back soon.</p>
        ) : (
          <ul style={{ marginTop: 'var(--mj-space-8)', listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--mj-space-8)' }} aria-label="Blog posts">
            {posts.map(post => (
              <li key={post.id}>
                <article>
                  <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)' }}>
                    <a href={`/blog/${post.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{post.title}</a>
                  </h2>
                  {post.publishedAt && (
                    <time dateTime={post.publishedAt} style={{ fontSize: 'var(--mj-text-size-sm)', color: 'var(--mj-color-text-tertiary)', marginTop: 'var(--mj-space-2)', display: 'block' }}>
                      {new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </time>
                  )}
                  {post.excerpt && <p style={{ color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-2)', maxWidth: '65ch' }}>{post.excerpt}</p>}
                  <a href={`/blog/${post.slug}`} style={{ color: 'var(--mj-color-brand-500)', marginTop: 'var(--mj-space-3)', display: 'inline-block' }}>Read article</a>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
