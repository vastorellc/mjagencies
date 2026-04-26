import React from 'react'
import type { ThreeColumnProps } from './types.js'

export const ThreeColumn: React.FC<ThreeColumnProps> = ({
  columns,
  className = '',
}): React.ReactElement => (
  <section
    className={`mj-block mj-block--three-column ${className}`}
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 'var(--mj-space-8)',
      padding: 'var(--mj-space-10) 0',
      backgroundColor: 'var(--mj-color-bg)',
    }}
  >
    {columns.map((col, idx) => (
      <div
        key={idx}
        style={{
          fontFamily: 'var(--mj-font-body)',
          color: 'var(--mj-color-text-primary)',
        }}
      >
        {col.content}
      </div>
    ))}
  </section>
)

export default ThreeColumn
