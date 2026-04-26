import React from 'react'
import type { AwardsBarProps } from './types.js'

export const AwardsBar: React.FC<AwardsBarProps> = ({
  awards,
  className = '',
}): React.ReactElement => (
  <section className={`mj-block mj-block--awards-bar ${className}`}>
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--mj-space-8)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {awards.map((award, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--mj-space-2)',
            textAlign: 'center',
          }}
        >
          <img
            src={award.imageUrl}
            alt={award.imageAlt}
            style={{
              height: 'var(--mj-space-16)',
              width: 'auto',
              objectFit: 'contain',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--mj-font-body)',
              fontSize: 'var(--mj-text-xs)',
              color: 'var(--mj-color-text-secondary)',
              maxWidth: '120px',
              lineHeight: 1.4,
            }}
          >
            {award.name}
            {award.year !== undefined && (
              <span style={{ display: 'block', fontWeight: 700 }}>{award.year}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  </section>
)

export default AwardsBar
