import React from 'react'
import type { PricingTableProps } from './types.js'

export const PricingTable: React.FC<PricingTableProps> = ({
  plans,
  className = '',
}): React.ReactElement => (
  <section className={`mj-block mj-block--pricing-table ${className}`}>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${plans.length}, 1fr)`,
        gap: 'var(--mj-space-6)',
        alignItems: 'start',
      }}
    >
      {plans.map((plan, index) => (
        <div
          key={index}
          style={{
            borderRadius: 'var(--mj-radius-lg)',
            padding: 'var(--mj-space-8)',
            border: plan.highlighted === true
              ? '2px solid var(--mj-color-brand-primary)'
              : '1px solid var(--mj-color-border)',
            backgroundColor: plan.highlighted === true
              ? 'var(--mj-color-brand-primary)'
              : 'var(--mj-color-surface)',
            position: 'relative',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--mj-font-heading)',
              fontSize: 'var(--mj-text-xl)',
              color: plan.highlighted === true ? 'var(--mj-color-bg)' : 'var(--mj-color-text-primary)',
              margin: '0 0 var(--mj-space-4)',
            }}
          >
            {plan.name}
          </h3>
          <div
            style={{
              marginBottom: 'var(--mj-space-6)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--mj-font-heading)',
                fontSize: 'var(--mj-text-4xl)',
                fontWeight: 700,
                color: plan.highlighted === true ? 'var(--mj-color-bg)' : 'var(--mj-color-text-primary)',
              }}
            >
              {plan.price}
            </span>
            {plan.period !== undefined && (
              <span
                style={{
                  fontFamily: 'var(--mj-font-body)',
                  fontSize: 'var(--mj-text-sm)',
                  color: plan.highlighted === true ? 'var(--mj-color-bg)' : 'var(--mj-color-text-secondary)',
                  marginLeft: 'var(--mj-space-1)',
                }}
              >
                {plan.period}
              </span>
            )}
          </div>
          <ul
            style={{
              listStyle: 'none',
              margin: '0 0 var(--mj-space-8)',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--mj-space-3)',
            }}
          >
            {plan.features.map((feature, featureIndex) => (
              <li
                key={featureIndex}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--mj-space-2)',
                  fontFamily: 'var(--mj-font-body)',
                  fontSize: 'var(--mj-text-sm)',
                  color: plan.highlighted === true ? 'var(--mj-color-bg)' : 'var(--mj-color-text-secondary)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    color: plan.highlighted === true ? 'var(--mj-color-bg)' : 'var(--mj-color-success)',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
          <a
            href={plan.ctaHref}
            style={{
              display: 'block',
              textAlign: 'center',
              padding: 'var(--mj-space-3) var(--mj-space-6)',
              backgroundColor: plan.highlighted === true ? 'var(--mj-color-bg)' : 'var(--mj-color-brand-primary)',
              color: plan.highlighted === true ? 'var(--mj-color-brand-primary)' : 'var(--mj-color-bg)',
              borderRadius: 'var(--mj-radius-md)',
              textDecoration: 'none',
              fontFamily: 'var(--mj-font-body)',
              fontSize: 'var(--mj-text-base)',
              fontWeight: 600,
            }}
          >
            {plan.ctaText}
          </a>
        </div>
      ))}
    </div>
  </section>
)

export default PricingTable
