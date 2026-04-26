import React from 'react'
import type { CaseStudyCardProps } from './types.js'

export const CaseStudyCard: React.FC<CaseStudyCardProps> = ({
  title,
  client,
  result,
  description,
  imageUrl,
  imageAlt,
  href,
  className = '',
}): React.ReactElement => {
  const content = (
    <div
      style={{
        backgroundColor: 'var(--mj-color-surface)',
        borderRadius: 'var(--mj-radius-md)',
        border: '1px solid var(--mj-color-border)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {imageUrl !== undefined && (
        <img
          src={imageUrl}
          alt={imageAlt ?? ''}
          style={{ width: '100%', height: '200px', objectFit: 'cover' }}
          loading="lazy"
          decoding="async"
        />
      )}
      <div style={{ padding: 'var(--mj-space-6)', flex: 1 }}>
        <p
          style={{
            fontFamily: 'var(--mj-font-body)',
            fontSize: 'var(--mj-text-xs)',
            color: 'var(--mj-color-brand-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 700,
            margin: '0 0 var(--mj-space-2)',
          }}
        >
          {client}
        </p>
        <h3
          style={{
            fontFamily: 'var(--mj-font-heading)',
            fontSize: 'var(--mj-text-xl)',
            color: 'var(--mj-color-text-primary)',
            margin: '0 0 var(--mj-space-3)',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontFamily: 'var(--mj-font-body)',
            fontSize: 'var(--mj-text-base)',
            color: 'var(--mj-color-text-secondary)',
            margin: '0 0 var(--mj-space-4)',
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
        <div
          style={{
            padding: 'var(--mj-space-3) var(--mj-space-4)',
            backgroundColor: 'var(--mj-color-bg)',
            borderRadius: 'var(--mj-radius-sm)',
            borderLeft: '3px solid var(--mj-color-brand-primary)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--mj-font-body)',
              fontSize: 'var(--mj-text-sm)',
              fontWeight: 700,
              color: 'var(--mj-color-text-primary)',
              margin: 0,
            }}
          >
            {result}
          </p>
        </div>
        {href !== undefined && (
          <span
            style={{
              display: 'inline-block',
              marginTop: 'var(--mj-space-4)',
              fontFamily: 'var(--mj-font-body)',
              fontSize: 'var(--mj-text-sm)',
              fontWeight: 600,
              color: 'var(--mj-color-brand-primary)',
            }}
          >
            Read case study &rarr;
          </span>
        )}
      </div>
    </div>
  )

  return href !== undefined ? (
    <a
      href={href}
      className={`mj-block mj-block--case-study-card ${className}`}
      style={{ display: 'block', textDecoration: 'none' }}
    >
      {content}
    </a>
  ) : (
    <article className={`mj-block mj-block--case-study-card ${className}`}>
      {content}
    </article>
  )
}

export default CaseStudyCard
