import React from 'react';
import type { BlogFeaturedProps } from './types.js';

export function BlogFeatured({ post, className }: BlogFeaturedProps): React.ReactElement {
  const cardStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    borderRadius: 'var(--mj-radius-lg)',
    overflow: 'hidden',
    border: '1px solid var(--mj-color-border)',
    background: 'var(--mj-color-surface)',
    minHeight: '420px',
  };

  const imageWrapStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
  };

  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  };

  const contentStyle: React.CSSProperties = {
    padding: 'var(--mj-space-10)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 'var(--mj-space-4)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-xs)',
    fontWeight: 'var(--mj-font-semibold)' as React.CSSProperties['fontWeight'],
    color: 'var(--mj-color-brand-primary)',
    textTransform: 'uppercase',
    letterSpacing: 'var(--mj-tracking-wide)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-3xl)',
    fontWeight: 'var(--mj-font-bold)' as React.CSSProperties['fontWeight'],
    color: 'var(--mj-color-text-primary)',
    margin: 0,
    lineHeight: 'var(--mj-leading-tight)',
  };

  const excerptStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-base)',
    color: 'var(--mj-color-text-secondary)',
    margin: 0,
    lineHeight: 'var(--mj-leading-relaxed)',
  };

  const metaStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-sm)',
    color: 'var(--mj-color-text-muted)',
    display: 'flex',
    gap: 'var(--mj-space-3)',
    alignItems: 'center',
  };

  const linkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--mj-space-2)',
    fontSize: 'var(--mj-text-sm)',
    fontWeight: 'var(--mj-font-semibold)' as React.CSSProperties['fontWeight'],
    color: 'var(--mj-color-brand-primary)',
    textDecoration: 'none',
  };

  return (
    <section className={className} style={{ padding: 'var(--mj-space-8) 0' }}>
      <article style={cardStyle}>
        <div style={imageWrapStyle}>
          <img src={post.imageUrl} alt={post.imageAlt} style={imageStyle} loading="eager" />
        </div>
        <div style={contentStyle}>
          <span style={labelStyle}>Featured Article</span>
          <h2 style={titleStyle}>{post.title}</h2>
          <p style={excerptStyle}>{post.excerpt}</p>
          <div style={metaStyle}>
            <span>{post.authorName}</span>
            <span aria-hidden="true">&middot;</span>
            <time dateTime={post.publishedAt}>
              {new Date(post.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </div>
          <a href={`/blog/${post.slug}`} style={linkStyle}>
            Read full article &rarr;
          </a>
        </div>
      </article>
    </section>
  );
}
