'use client'
import React from 'react'
import type { HeroImageProps } from './types.js'

export const HeroImage: React.FC<HeroImageProps> = ({
  headline,
  subheadline,
  ctaText,
  ctaHref,
  imageUrl,
  imageAlt,
  imageDominantColor,
  overlayOpacity = 0.4,
  className = '',
}): React.ReactElement => (
  <section
    className={`mj-block mj-block--hero-image ${className}`}
    style={{
      position: 'relative',
      backgroundColor: imageDominantColor ?? 'var(--mj-color-surface)',
      minHeight: '60vh',
    }}
  >
    <img
      src={imageUrl}
      alt={imageAlt}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      loading="eager"
      decoding="async"
    />
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'var(--mj-color-bg)',
        opacity: overlayOpacity,
      }}
    />
    <div style={{ position: 'relative', zIndex: 1, padding: 'var(--mj-space-16)' }}>
      <h1
        style={{
          fontFamily: 'var(--mj-font-heading)',
          fontSize: 'var(--mj-text-5xl)',
          color: 'var(--mj-color-text-primary)',
          margin: 0,
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
            marginTop: 'var(--mj-space-8)',
            padding: 'var(--mj-space-3) var(--mj-space-6)',
            backgroundColor: 'var(--mj-color-brand-primary)',
            color: 'var(--mj-color-bg)',
            borderRadius: 'var(--mj-radius-md)',
            textDecoration: 'none',
            fontFamily: 'var(--mj-font-body)',
          }}
        >
          {ctaText}
        </a>
      )}
    </div>
  </section>
)

export default HeroImage
