import React from 'react'
import type { FeatureListProps } from './types.js'

export const FeatureList: React.FC<FeatureListProps> = ({
  headline,
  features,
  className = '',
}): React.ReactElement => (
  <section className={`mj-block mj-block--feature-list ${className}`}>
    <h2
      style={{
        fontFamily: 'var(--mj-font-heading)',
        fontSize: 'var(--mj-text-3xl)',
        color: 'var(--mj-color-text-primary)',
        margin: '0 0 var(--mj-space-8)',
      }}
    >
      {headline}
    </h2>
    <div
      style={{
        border: '1px solid var(--mj-color-border)',
        borderRadius: 'var(--mj-radius-md)',
        overflow: 'hidden',
      }}
    >
      {features.map((feature, index) => (
        <div
          key={index}
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'center',
            gap: 'var(--mj-space-4)',
            padding: 'var(--mj-space-5) var(--mj-space-6)',
            borderBottom: index < features.length - 1 ? '1px solid var(--mj-color-border)' : 'none',
            backgroundColor: 'var(--mj-color-surface)',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: 'var(--mj-text-lg)',
              color: feature.included ? 'var(--mj-color-success)' : 'var(--mj-color-danger)',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {feature.included ? '✓' : '✕'}
          </span>
          <div>
            <p
              style={{
                fontFamily: 'var(--mj-font-body)',
                fontSize: 'var(--mj-text-base)',
                color: 'var(--mj-color-text-primary)',
                fontWeight: 600,
                margin: '0 0 var(--mj-space-1)',
              }}
            >
              {feature.title}
            </p>
            <p
              style={{
                fontFamily: 'var(--mj-font-body)',
                fontSize: 'var(--mj-text-sm)',
                color: 'var(--mj-color-text-secondary)',
                margin: 0,
              }}
            >
              {feature.description}
            </p>
          </div>
          <span
            style={{
              fontSize: 'var(--mj-text-xs)',
              padding: 'var(--mj-space-1) var(--mj-space-2)',
              borderRadius: 'var(--mj-radius-sm)',
              backgroundColor: feature.included
                ? 'var(--mj-color-success)'
                : 'var(--mj-color-danger)',
              color: 'var(--mj-color-bg)',
              fontFamily: 'var(--mj-font-body)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {feature.included ? 'Included' : 'Not included'}
          </span>
        </div>
      ))}
    </div>
  </section>
)

export default FeatureList
