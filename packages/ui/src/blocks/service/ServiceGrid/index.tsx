import React from 'react'
import type { ServiceGridProps } from './types.js'

export const ServiceGrid: React.FC<ServiceGridProps> = ({
  items,
  columns = 3,
  className = '',
}): React.ReactElement => (
  <section className={`mj-block mj-block--service-grid ${className}`}>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 'var(--mj-space-8)',
      }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            backgroundColor: 'var(--mj-color-surface)',
            borderRadius: 'var(--mj-radius-md)',
            padding: 'var(--mj-space-8)',
            border: '1px solid var(--mj-color-border)',
          }}
        >
          {item.iconUrl !== undefined && (
            <img
              src={item.iconUrl}
              alt={item.iconAlt ?? ''}
              style={{ width: 'var(--mj-space-12)', height: 'var(--mj-space-12)', marginBottom: 'var(--mj-space-4)' }}
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
            {item.href !== undefined ? (
              <a
                href={item.href}
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </h3>
          <p
            style={{
              fontFamily: 'var(--mj-font-body)',
              fontSize: 'var(--mj-text-base)',
              color: 'var(--mj-color-text-secondary)',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {item.description}
          </p>
        </div>
      ))}
    </div>
  </section>
)

export default ServiceGrid
