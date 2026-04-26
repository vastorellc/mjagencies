import React from 'react'
import type { TimelineProps } from './types.js'

export const Timeline: React.FC<TimelineProps> = ({
  items,
  className = '',
}): React.ReactElement => (
  <section
    className={`mj-block mj-block--timeline ${className}`}
    style={{
      padding: 'var(--mj-space-10) 0',
      backgroundColor: 'var(--mj-color-bg)',
    }}
  >
    <ol
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {items.map((item, idx) => (
        <li
          key={idx}
          style={{
            display: 'flex',
            gap: 'var(--mj-space-6)',
            paddingBottom: idx < items.length - 1 ? 'var(--mj-space-8)' : 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: 'var(--mj-radius-full)',
                backgroundColor: 'var(--mj-color-brand-primary)',
                flexShrink: 0,
                marginTop: 'var(--mj-space-1)',
              }}
            />
            {idx < items.length - 1 && (
              <div
                style={{
                  width: '2px',
                  flex: 1,
                  backgroundColor: 'var(--mj-color-border)',
                  marginTop: 'var(--mj-space-2)',
                }}
              />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <time
              dateTime={item.date}
              style={{
                fontFamily: 'var(--mj-font-body)',
                fontSize: 'var(--mj-text-xs)',
                color: 'var(--mj-color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {item.date}
            </time>
            <h3
              style={{
                fontFamily: 'var(--mj-font-heading)',
                fontSize: 'var(--mj-text-lg)',
                color: 'var(--mj-color-text-primary)',
                margin: 'var(--mj-space-1) 0',
              }}
            >
              {item.title}
            </h3>
            <p
              style={{
                fontFamily: 'var(--mj-font-body)',
                fontSize: 'var(--mj-text-base)',
                color: 'var(--mj-color-text-secondary)',
                margin: 0,
                lineHeight: '1.6',
              }}
            >
              {item.description}
            </p>
          </div>
        </li>
      ))}
    </ol>
  </section>
)

export default Timeline
