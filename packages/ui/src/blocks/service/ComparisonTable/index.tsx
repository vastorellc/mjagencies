import React from 'react'
import type { ComparisonTableProps } from './types.js'

export const ComparisonTable: React.FC<ComparisonTableProps> = ({
  headline,
  headers,
  rows,
  className = '',
}): React.ReactElement => (
  <section className={`mj-block mj-block--comparison-table ${className}`}>
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
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: 'var(--mj-font-body)',
          fontSize: 'var(--mj-text-base)',
        }}
      >
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                style={{
                  textAlign: index === 0 ? 'left' : 'center',
                  padding: 'var(--mj-space-4) var(--mj-space-5)',
                  backgroundColor: 'var(--mj-color-brand-primary)',
                  color: 'var(--mj-color-bg)',
                  fontFamily: 'var(--mj-font-heading)',
                  fontSize: 'var(--mj-text-sm)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderRight: index < headers.length - 1 ? '1px solid var(--mj-color-border)' : 'none',
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              style={{
                backgroundColor: rowIndex % 2 === 0 ? 'var(--mj-color-surface)' : 'var(--mj-color-bg)',
              }}
            >
              <td
                style={{
                  padding: 'var(--mj-space-4) var(--mj-space-5)',
                  color: 'var(--mj-color-text-primary)',
                  fontWeight: 600,
                  borderBottom: '1px solid var(--mj-color-border)',
                  borderRight: '1px solid var(--mj-color-border)',
                }}
              >
                {row.feature}
              </td>
              {row.values.map((value, colIndex) => (
                <td
                  key={colIndex}
                  style={{
                    padding: 'var(--mj-space-4) var(--mj-space-5)',
                    color: 'var(--mj-color-text-secondary)',
                    textAlign: 'center',
                    borderBottom: '1px solid var(--mj-color-border)',
                    borderRight: colIndex < row.values.length - 1 ? '1px solid var(--mj-color-border)' : 'none',
                  }}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
)

export default ComparisonTable
