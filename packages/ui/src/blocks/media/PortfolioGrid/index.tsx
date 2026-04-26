import React from 'react'
import type { PortfolioGridProps } from './types.js'

export const PortfolioGrid: React.FC<PortfolioGridProps> = ({
  items,
  columns = 3,
  className = '',
}): React.ReactElement => (
  <section className={`mj-block mj-block--portfolio-grid ${className}`}>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 'var(--mj-space-6)',
      }}
    >
      {items.map((item, index) => {
        const card = (
          <div
            style={{
              borderRadius: 'var(--mj-radius-md)',
              overflow: 'hidden',
              backgroundColor: 'var(--mj-color-surface)',
              border: '1px solid var(--mj-color-border)',
            }}
          >
            <div style={{ position: 'relative', overflow: 'hidden' }}>
              <img
                src={item.imageUrl}
                alt={item.imageAlt}
                style={{
                  width: '100%',
                  height: '240px',
                  objectFit: 'cover',
                  display: 'block',
                  transition: 'transform 0.3s ease',
                }}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div style={{ padding: 'var(--mj-space-5)' }}>
              {item.category !== undefined && (
                <p
                  style={{
                    fontFamily: 'var(--mj-font-body)',
                    fontSize: 'var(--mj-text-xs)',
                    color: 'var(--mj-color-brand-primary)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    margin: '0 0 var(--mj-space-2)',
                  }}
                >
                  {item.category}
                </p>
              )}
              <h3
                style={{
                  fontFamily: 'var(--mj-font-heading)',
                  fontSize: 'var(--mj-text-lg)',
                  color: 'var(--mj-color-text-primary)',
                  margin: 0,
                }}
              >
                {item.title}
              </h3>
            </div>
          </div>
        )

        return item.href !== undefined ? (
          <a
            key={index}
            href={item.href}
            style={{ display: 'block', textDecoration: 'none' }}
          >
            {card}
          </a>
        ) : (
          <div key={index}>{card}</div>
        )
      })}
    </div>
  </section>
)

export default PortfolioGrid
