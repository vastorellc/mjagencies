import React from 'react';
import type { BlogGridProps } from './types.js';

export function BlogGrid({ posts, columns = 3, className }: BlogGridProps): React.ReactElement {
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: 'var(--mj-space-6)',
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: 'var(--mj-radius-md)',
    border: '1px solid var(--mj-color-border)',
    overflow: 'hidden',
    background: 'var(--mj-color-surface)',
    display: 'flex',
    flexDirection: 'column',
  };

  const imageStyle: React.CSSProperties = {
    width: '100%',
    aspectRatio: '16/9',
    objectFit: 'cover',
    display: 'block',
    background: 'var(--mj-color-surface-subtle)',
  };

  const bodyStyle: React.CSSProperties = {
    padding: 'var(--mj-space-4)',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--mj-space-2)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-lg)',
    fontWeight: 'var(--mj-font-semibold)' as React.CSSProperties['fontWeight'],
    color: 'var(--mj-color-text-primary)',
    margin: 0,
    lineHeight: 'var(--mj-leading-snug)',
  };

  const excerptStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-sm)',
    color: 'var(--mj-color-text-secondary)',
    margin: 0,
    flex: 1,
    lineHeight: 'var(--mj-leading-relaxed)',
  };

  const metaStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-xs)',
    color: 'var(--mj-color-text-muted)',
    display: 'flex',
    gap: 'var(--mj-space-2)',
  };

  return (
    <section className={className} style={{ padding: 'var(--mj-space-8) 0' }}>
      <div style={gridStyle}>
        {posts.map((post) => (
          <article key={post.slug} style={cardStyle}>
            {post.imageUrl && (
              <img
                src={post.imageUrl}
                alt={post.imageAlt ?? post.title}
                style={imageStyle}
                loading="lazy"
              />
            )}
            <div style={bodyStyle}>
              <h3 style={titleStyle}>
                <a href={`/blog/${post.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {post.title}
                </a>
              </h3>
              <p style={excerptStyle}>{post.excerpt}</p>
              <div style={metaStyle}>
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
                {post.authorName && <span>{post.authorName}</span>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
