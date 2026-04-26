import React from 'react'
import type { QuoteBlockProps } from './types.js'

export const QuoteBlock: React.FC<QuoteBlockProps> = ({
  quote,
  attribution,
  role,
  avatarUrl,
  avatarAlt,
  className = '',
}): React.ReactElement => (
  <section
    className={`mj-block mj-block--quote-block ${className}`}
    style={{
      padding: 'var(--mj-space-10)',
      backgroundColor: 'var(--mj-color-surface)',
      borderRadius: 'var(--mj-radius-lg)',
    }}
  >
    <blockquote
      style={{
        margin: 0,
        padding: 0,
        borderLeft: '4px solid var(--mj-color-brand-primary)',
        paddingLeft: 'var(--mj-space-6)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--mj-font-heading)',
          fontSize: 'var(--mj-text-xl)',
          color: 'var(--mj-color-text-primary)',
          fontStyle: 'italic',
          lineHeight: '1.6',
          margin: 0,
        }}
      >
        {quote}
      </p>
      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--mj-space-3)',
          marginTop: 'var(--mj-space-4)',
        }}
      >
        {avatarUrl !== undefined && (
          <img
            src={avatarUrl}
            alt={avatarAlt ?? attribution}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--mj-radius-full)',
              objectFit: 'cover',
            }}
          />
        )}
        <div>
          <cite
            style={{
              fontFamily: 'var(--mj-font-body)',
              fontSize: 'var(--mj-text-sm)',
              fontWeight: 600,
              color: 'var(--mj-color-text-primary)',
              fontStyle: 'normal',
            }}
          >
            {attribution}
          </cite>
          {role !== undefined && (
            <p
              style={{
                fontFamily: 'var(--mj-font-body)',
                fontSize: 'var(--mj-text-xs)',
                color: 'var(--mj-color-text-secondary)',
                margin: 0,
              }}
            >
              {role}
            </p>
          )}
        </div>
      </footer>
    </blockquote>
  </section>
)

export default QuoteBlock
