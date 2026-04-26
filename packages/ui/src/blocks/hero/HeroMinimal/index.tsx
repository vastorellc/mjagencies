'use client'
import React from 'react'
import type { HeroMinimalProps } from './types.js'

export const HeroMinimal: React.FC<HeroMinimalProps> = ({
  headline,
  subheadline,
  ctaText,
  ctaHref,
  className = '',
}): React.ReactElement => (
  <section
    className={`mj-block mj-block--hero-minimal ${className}`}
    style={{
      textAlign: 'center',
      padding: 'var(--mj-space-16)',
      backgroundColor: 'var(--mj-color-bg)',
    }}
  >
    <h1
      style={{
        fontFamily: 'var(--mj-font-heading)',
        fontSize: 'var(--mj-text-5xl)',
        color: 'var(--mj-color-text-primary)',
        margin: '0 auto',
        maxWidth: '800px',
      }}
    >
      {headline}
    </h1>
    {subheadline !== undefined && (
      <p
        style={{
          fontSize: 'var(--mj-text-xl)',
          color: 'var(--mj-color-text-secondary)',
          marginTop: 'var(--mj-space-4)',
          maxWidth: '600px',
          margin: 'var(--mj-space-4) auto 0',
        }}
      >
        {subheadline}
      </p>
    )}
    {ctaText !== undefined && ctaHref !== undefined && (
      <div style={{ marginTop: 'var(--mj-space-8)' }}>
        <a
          href={ctaHref}
          style={{
            display: 'inline-block',
            padding: 'var(--mj-space-3) var(--mj-space-8)',
            backgroundColor: 'var(--mj-color-brand-primary)',
            color: 'var(--mj-color-bg)',
            borderRadius: 'var(--mj-radius-md)',
            textDecoration: 'none',
            fontFamily: 'var(--mj-font-body)',
            fontSize: 'var(--mj-text-lg)',
          }}
        >
          {ctaText}
        </a>
      </div>
    )}
  </section>
)

export default HeroMinimal
