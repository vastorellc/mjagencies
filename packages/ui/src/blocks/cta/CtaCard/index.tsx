import React from 'react'
import type { CtaCardProps } from './types.js'

export const CtaCard: React.FC<CtaCardProps> = ({
  headline,
  body,
  ctaText,
  ctaHref,
  iconUrl,
  iconAlt,
  className = '',
}): React.ReactElement => (
  <div
    className={`mj-block mj-block--cta-card ${className}`}
    style={{
      display: 'flex',
      flexDirection: 'column',
      padding: 'var(--mj-space-8)',
      backgroundColor: 'var(--mj-color-surface)',
      borderRadius: 'var(--mj-radius-lg)',
      border: '1px solid var(--mj-color-border)',
      boxShadow: 'var(--mj-color-shadow-low)',
    }}
  >
    {iconUrl !== undefined && (
      <img
        src={iconUrl}
        alt={iconAlt ?? ''}
        style={{
          width: '48px',
          height: '48px',
          marginBottom: 'var(--mj-space-4)',
          objectFit: 'contain',
        }}
      />
    )}
    <h3
      style={{
        fontFamily: 'var(--mj-font-heading)',
        fontSize: 'var(--mj-text-xl)',
        color: 'var(--mj-color-text-primary)',
        margin: '0 0 var(--mj-space-3)',
      }}
    >
      {headline}
    </h3>
    <p
      style={{
        fontFamily: 'var(--mj-font-body)',
        fontSize: 'var(--mj-text-base)',
        color: 'var(--mj-color-text-secondary)',
        margin: '0 0 var(--mj-space-6)',
        lineHeight: '1.6',
        flex: 1,
      }}
    >
      {body}
    </p>
    <a
      href={ctaHref}
      style={{
        display: 'inline-block',
        padding: 'var(--mj-space-2) var(--mj-space-6)',
        backgroundColor: 'var(--mj-color-brand-primary)',
        color: 'var(--mj-color-bg)',
        borderRadius: 'var(--mj-radius-md)',
        textDecoration: 'none',
        fontFamily: 'var(--mj-font-body)',
        fontSize: 'var(--mj-text-sm)',
        fontWeight: 600,
        alignSelf: 'flex-start',
      }}
    >
      {ctaText}
    </a>
  </div>
)

export default CtaCard
