import React from 'react'
import type { TwoColumnProps } from './types.js'

export const TwoColumn: React.FC<TwoColumnProps> = ({
  leftContent,
  rightContent,
  gap,
  className = '',
}): React.ReactElement => (
  <section
    className={`mj-block mj-block--two-column ${className}`}
    style={{
      display: 'flex',
      flexDirection: 'row',
      gap: gap ?? 'var(--mj-space-8)',
      padding: 'var(--mj-space-10) 0',
      backgroundColor: 'var(--mj-color-bg)',
    }}
  >
    <div
      style={{
        flex: 1,
        fontFamily: 'var(--mj-font-body)',
        color: 'var(--mj-color-text-primary)',
      }}
    >
      {leftContent}
    </div>
    <div
      style={{
        flex: 1,
        fontFamily: 'var(--mj-font-body)',
        color: 'var(--mj-color-text-primary)',
      }}
    >
      {rightContent}
    </div>
  </section>
)

export default TwoColumn
