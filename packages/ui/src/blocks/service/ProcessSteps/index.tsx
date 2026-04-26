import React from 'react'
import type { ProcessStepsProps } from './types.js'

export const ProcessSteps: React.FC<ProcessStepsProps> = ({
  steps,
  className = '',
}): React.ReactElement => (
  <section className={`mj-block mj-block--process-steps ${className}`}>
    <ol
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--mj-space-10)',
      }}
    >
      {steps.map((step) => (
        <li
          key={step.step}
          style={{
            display: 'flex',
            gap: 'var(--mj-space-6)',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: 'var(--mj-space-12)',
              height: 'var(--mj-space-12)',
              borderRadius: 'var(--mj-radius-full)',
              backgroundColor: 'var(--mj-color-brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--mj-font-heading)',
              fontSize: 'var(--mj-text-lg)',
              fontWeight: 700,
              color: 'var(--mj-color-bg)',
            }}
          >
            {step.step}
          </div>
          <div style={{ flex: 1 }}>
            {step.iconUrl !== undefined && (
              <img
                src={step.iconUrl}
                alt=""
                aria-hidden="true"
                style={{ width: 'var(--mj-space-8)', height: 'var(--mj-space-8)', marginBottom: 'var(--mj-space-2)' }}
              />
            )}
            <h3
              style={{
                fontFamily: 'var(--mj-font-heading)',
                fontSize: 'var(--mj-text-xl)',
                color: 'var(--mj-color-text-primary)',
                margin: '0 0 var(--mj-space-2)',
              }}
            >
              {step.title}
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
              {step.description}
            </p>
          </div>
        </li>
      ))}
    </ol>
  </section>
)

export default ProcessSteps
