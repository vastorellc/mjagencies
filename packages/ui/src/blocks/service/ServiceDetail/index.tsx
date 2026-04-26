import React from 'react'
import type { ServiceDetailProps } from './types.js'

export const ServiceDetail: React.FC<ServiceDetailProps> = ({
  title,
  description,
  iconUrl,
  iconAlt,
  features,
  ctaText,
  ctaHref,
  className = '',
}): React.ReactElement => (
  <section className={`mj-block mj-block--service-detail ${className}`}>
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: 'var(--mj-space-16) var(--mj-space-8)',
      }}
    >
      {iconUrl !== undefined && (
        <img
          src={iconUrl}
          alt={iconAlt ?? ''}
          style={{
            width: 'var(--mj-space-16)',
            height: 'var(--mj-space-16)',
            marginBottom: 'var(--mj-space-6)',
          }}
        />
      )}
      <h2
        style={{
          fontFamily: 'var(--mj-font-heading)',
          fontSize: 'var(--mj-text-4xl)',
          color: 'var(--mj-color-text-primary)',
          margin: '0 0 var(--mj-space-6)',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          fontFamily: 'var(--mj-font-body)',
          fontSize: 'var(--mj-text-lg)',
          color: 'var(--mj-color-text-secondary)',
          marginBottom: 'var(--mj-space-10)',
          lineHeight: 1.7,
        }}
      >
        {description}
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: '0 0 var(--mj-space-10)',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--mj-space-3)',
        }}
      >
        {features.map((feature, index) => (
          <li
            key={index}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--mj-space-3)',
              fontFamily: 'var(--mj-font-body)',
              fontSize: 'var(--mj-text-base)',
              color: 'var(--mj-color-text-primary)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                color: 'var(--mj-color-success)',
                fontWeight: 700,
                flexShrink: 0,
                marginTop: '2px',
              }}
            >
              ✓
            </span>
            {feature}
          </li>
        ))}
      </ul>
      {ctaText !== undefined && ctaHref !== undefined && (
        <a
          href={ctaHref}
          style={{
            display: 'inline-block',
            padding: 'var(--mj-space-4) var(--mj-space-8)',
            backgroundColor: 'var(--mj-color-brand-primary)',
            color: 'var(--mj-color-bg)',
            borderRadius: 'var(--mj-radius-md)',
            textDecoration: 'none',
            fontFamily: 'var(--mj-font-body)',
            fontSize: 'var(--mj-text-base)',
            fontWeight: 600,
          }}
        >
          {ctaText}
        </a>
      )}
    </div>
  </section>
)

export default ServiceDetail
