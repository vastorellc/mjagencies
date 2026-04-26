import React from 'react'
import type { CtaInlineProps } from './types.js'

export const CtaInline: React.FC<CtaInlineProps> = ({
  text,
  ctaText,
  ctaHref,
  className = '',
}): React.ReactElement => (
  <div
    className={`mj-block mj-block--cta-inline ${className}`}
    style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 'var(--mj-space-4)',
      padding: 'var(--mj-space-6) var(--mj-space-8)',
      backgroundColor: 'var(--mj-color-surface)',
      borderRadius: 'var(--mj-radius-lg)',
      border: '1px solid var(--mj-color-border)',
    }}
  >
    <p
      style={{
        fontFamily: 'var(--mj-font-body)',
        fontSize: 'var(--mj-text-base)',
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
        padding: 'var(--mj-space-2) var(--mj-space-6)',
        backgroundColor: 'var(--mj-color-brand-primary)',
        color: 'var(--mj-color-bg)',
        borderRadius: 'var(--mj-radius-md)',
        textDecoration: 'none',
        fontFamily: 'var(--mj-font-body)',
        fontSize: 'var(--mj-text-sm)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {ctaText}
    </a>
  </div>
)

export default CtaInline
