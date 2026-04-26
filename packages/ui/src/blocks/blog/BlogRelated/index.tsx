import React from 'react';
import type { BlogRelatedProps } from './types.js';

export function BlogRelated({ posts, headline, className }: BlogRelatedProps): React.ReactElement {
  const sectionStyle: React.CSSProperties = {
    padding: 'var(--mj-space-8) 0',
    borderTop: '1px solid var(--mj-color-border)',
  };

  const headlineStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-xl)',
    fontWeight: 'var(--mj-font-semibold)' as React.CSSProperties['fontWeight'],
    color: 'var(--mj-color-text-primary)',
    margin: '0 0 var(--mj-space-5) 0',
  };

  const listStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--mj-space-4)',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    gap: 'var(--mj-space-3)',
    alignItems: 'flex-start',
  };

  const thumbStyle: React.CSSProperties = {
    width: '80px',
    height: '60px',
    objectFit: 'cover',
    borderRadius: 'var(--mj-radius-sm)',
    flexShrink: 0,
    background: 'var(--mj-color-surface-subtle)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-sm)',
    fontWeight: 'var(--mj-font-medium)' as React.CSSProperties['fontWeight'],
    color: 'var(--mj-color-text-primary)',
    margin: '0 0 var(--mj-space-1) 0',
    lineHeight: 'var(--mj-leading-snug)',
  };

  const excerptStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-xs)',
    color: 'var(--mj-color-text-muted)',
    margin: 0,
    lineHeight: 'var(--mj-leading-relaxed)',
  };

  return (
    <section className={className} style={sectionStyle}>
      {headline && <h3 style={headlineStyle}>{headline}</h3>}
      <ul style={listStyle}>
        {posts.map((post) => (
          <li key={post.slug} style={itemStyle}>
            {post.imageUrl && (
              <img
                src={post.imageUrl}
                alt={post.imageAlt ?? post.title}
                style={thumbStyle}
                loading="lazy"
              />
            )}
            <div>
              <h4 style={titleStyle}>
                <a href={`/blog/${post.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {post.title}
                </a>
              </h4>
              <p style={excerptStyle}>{post.excerpt}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
