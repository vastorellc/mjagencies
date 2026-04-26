import React from 'react'
import type { CtaFullProps } from './types.js'

export const CtaFull: React.FC<CtaFullProps> = ({
  headline,
  subheadline,
  primaryCta,
  secondaryCta,
  className = '',
}): React.ReactElement => (
  <section
    className={`mj-block mj-block--cta-full ${className}`}
    style={{
      textAlign: 'center',
      padding: 'var(--mj-space-16)',
      backgroundColor: 'var(--mj-color-brand-primary)',
    }}
  >
    <h2
      style={{
        fontFamily: 'var(--mj-font-heading)',
        fontSize: 'var(--mj-text-4xl)',
        color: 'var(--mj-color-bg)',
        margin: '0 auto',
        maxWidth: '720px',
      }}
    >
      {headline}
    </h2>
    {subheadline !== undefined && (
      <p
        style={{
          fontFamily: 'var(--mj-font-body)',
          fontSize: 'var(--mj-text-lg)',
          color: 'var(--mj-color-bg)',
          marginTop: 'var(--mj-space-4)',
          maxWidth: '560px',
          margin: 'var(--mj-space-4) auto 0',
          opacity: 0.9,
        }}
      >
        {subheadline}
      </p>
    )}
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 'var(--mj-space-4)',
        marginTop: 'var(--mj-space-8)',
        flexWrap: 'wrap',
      }}
    >
      <a
        href={primaryCta.href}
        style={{
          display: 'inline-block',
          padding: 'var(--mj-space-3) var(--mj-space-8)',
          backgroundColor: 'var(--mj-color-bg)',
          color: 'var(--mj-color-brand-primary)',
          borderRadius: 'var(--mj-radius-md)',
          textDecoration: 'none',
          fontFamily: 'var(--mj-font-body)',
          fontWeight: 600,
          fontSize: 'var(--mj-text-base)',
        }}
      >
        {primaryCta.text}
      </a>
      {secondaryCta !== undefined && (
        <a
          href={secondaryCta.href}
          style={{
            display: 'inline-block',
            padding: 'var(--mj-space-3) var(--mj-space-8)',
            backgroundColor: 'transparent',
            color: 'var(--mj-color-bg)',
            borderRadius: 'var(--mj-radius-md)',
            textDecoration: 'none',
            fontFamily: 'var(--mj-font-body)',
            fontWeight: 600,
            fontSize: 'var(--mj-text-base)',
            border: '2px solid var(--mj-color-bg)',
          }}
        >
          {secondaryCta.text}
        </a>
      )}
    </div>
  </section>
)

export default CtaFull
