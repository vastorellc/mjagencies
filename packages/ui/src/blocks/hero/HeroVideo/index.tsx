'use client'
import React from 'react'
import type { HeroVideoProps } from './types.js'

export const HeroVideo: React.FC<HeroVideoProps> = ({
  videoUrl,
  videoPoster,
  posterAlt,
  headline,
  subheadline,
  ctaText,
  ctaHref,
  overlayOpacity = 0.4,
  className = '',
}): React.ReactElement => (
  <section
    className={`mj-block mj-block--hero-video ${className}`}
    style={{
      position: 'relative',
      minHeight: '60vh',
      backgroundColor: 'var(--mj-color-surface)',
      overflow: 'hidden',
    }}
  >
    <video
      src={videoUrl}
      poster={videoPoster}
      muted
      loop
      autoPlay
      playsInline
      aria-label={posterAlt}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
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

export default HeroVideo
