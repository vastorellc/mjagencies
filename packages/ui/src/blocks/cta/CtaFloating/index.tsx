'use client'
import React from 'react'
import type { CtaFloatingProps } from './types.js'

export const CtaFloating: React.FC<CtaFloatingProps> = ({
  text,
  ctaText,
  ctaHref,
  position = 'bottom-right',
  className = '',
}): React.ReactElement => (
  <div
    className={`mj-block mj-block--cta-floating ${className}`}
    style={{
      position: 'fixed',
      bottom: 'var(--mj-space-6)',
      ...(position === 'bottom-right'
        ? { right: 'var(--mj-space-6)' }
        : { left: 'var(--mj-space-6)' }),
      zIndex: 9000,
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--mj-space-3)',
      padding: 'var(--mj-space-3) var(--mj-space-5)',
      backgroundColor: 'var(--mj-color-surface)',
      borderRadius: 'var(--mj-radius-lg)',
      border: '1px solid var(--mj-color-border)',
      boxShadow: 'var(--mj-color-shadow-low)',
      maxWidth: '360px',
    }}
  >
    <p
      style={{
        fontFamily: 'var(--mj-font-body)',
        fontSize: 'var(--mj-text-sm)',
        color: 'var(--mj-color-text-primary)',
        margin: 0,
        flex: 1,
      }}
    >
      {text}
    </p>
    <a
      href={ctaHref}
      style={{
        display: 'inline-block',
        padding: 'var(--mj-space-2) var(--mj-space-4)',
        backgroundColor: 'var(--mj-color-brand-primary)',
        color: 'var(--mj-color-bg)',
        borderRadius: 'var(--mj-radius-md)',
        textDecoration: 'none',
        fontFamily: 'var(--mj-font-body)',
        fontSize: 'var(--mj-text-xs)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {ctaText}
    </a>
  </div>
)

export default CtaFloating
