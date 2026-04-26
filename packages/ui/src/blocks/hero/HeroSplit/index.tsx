'use client'
import React from 'react'
import type { HeroSplitProps } from './types.js'

export const HeroSplit: React.FC<HeroSplitProps> = ({
  headline,
  subheadline,
  ctaText,
  ctaHref,
  imageUrl,
  imageAlt,
  imagePosition = 'right',
  className = '',
}): React.ReactElement => (
  <section
    className={`mj-block mj-block--hero-split ${className}`}
    style={{
      display: 'flex',
      flexDirection: imagePosition === 'left' ? 'row-reverse' : 'row',
      minHeight: '60vh',
    }}
  >
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 'var(--mj-space-12)',
        backgroundColor: 'var(--mj-color-bg)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--mj-font-heading)',
          fontSize: 'var(--mj-text-4xl)',
          color: 'var(--mj-color-text-primary)',
          margin: 0,
        }}
      >
        {headline}
      </h1>
      {subheadline !== undefined && (
        <p
          style={{
            fontSize: 'var(--mj-text-lg)',
            color: 'var(--mj-color-text-secondary)',
            marginTop: 'var(--mj-space-4)',
          }}
        >
          {subheadline}
        </p>
      )}
      {ctaText !== undefined && ctaHref !== undefined && (
        <a
          href={ctaHref}
          style={{
            display: 'inline-block',
            marginTop: 'var(--mj-space-6)',
            padding: 'var(--mj-space-3) var(--mj-space-6)',
            backgroundColor: 'var(--mj-color-brand-primary)',
            color: 'var(--mj-color-bg)',
            borderRadius: 'var(--mj-radius-md)',
            textDecoration: 'none',
            fontFamily: 'var(--mj-font-body)',
            alignSelf: 'flex-start',
          }}
        >
          {ctaText}
        </a>
      )}
    </div>
    <div
      style={{
        flex: 1,
        minHeight: '400px',
        overflow: 'hidden',
      }}
    >
      <img
        src={imageUrl}
        alt={imageAlt}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        loading="eager"
        decoding="async"
      />
    </div>
  </section>
)

export default HeroSplit
