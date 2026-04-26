import React from 'react'
import type { StatsBarProps } from './types.js'

export const StatsBar: React.FC<StatsBarProps> = ({
  stats,
  className = '',
}): React.ReactElement => (
  <section
    className={`mj-block mj-block--stats-bar ${className}`}
    style={{
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-around',
      flexWrap: 'wrap',
      gap: 'var(--mj-space-8)',
      padding: 'var(--mj-space-10)',
      backgroundColor: 'var(--mj-color-surface)',
      borderTop: '1px solid var(--mj-color-border)',
      borderBottom: '1px solid var(--mj-color-border)',
    }}
  >
    {stats.map((stat, idx) => (
      <div
        key={idx}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          minWidth: '120px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mj-font-heading)',
            fontSize: 'var(--mj-text-4xl)',
            fontWeight: 700,
            color: 'var(--mj-color-brand-primary)',
            lineHeight: 1,
          }}
        >
          {stat.value}
        </span>
        <span
          style={{
            fontFamily: 'var(--mj-font-body)',
            fontSize: 'var(--mj-text-sm)',
            color: 'var(--mj-color-text-secondary)',
            marginTop: 'var(--mj-space-2)',
          }}
        >
          {stat.label}
        </span>
        {stat.source !== undefined && (
          <cite
            style={{
              fontFamily: 'var(--mj-font-body)',
              fontSize: 'var(--mj-text-xs)',
              color: 'var(--mj-color-text-secondary)',
              fontStyle: 'italic',
              marginTop: 'var(--mj-space-1)',
            }}
          >
            {stat.source}
          </cite>
        )}
      </div>
    ))}
  </section>
)

export default StatsBar
