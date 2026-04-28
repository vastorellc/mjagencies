/**
 * packages/tools/src/pages/ToolResultSection.tsx
 * REQ-413: result is inline (id="tool-result") — NOT a separate route.
 * data-print-region="tool-result" for print/share.
 */
'use client'
import type { ToolResult } from '../engine/types.js'
import { BenchmarkBadge } from './BenchmarkBadge.js'

interface ToolResultSectionProps {
  result: ToolResult | null
}

export function ToolResultSection({ result }: ToolResultSectionProps): React.JSX.Element | null {
  if (!result) return null

  return (
    <section
      id="tool-result"
      data-print-region="tool-result"
      aria-label="Your Results"
      style={{ scrollMarginTop: 'var(--mj-space-16)', marginTop: 'var(--mj-space-12)' }}
    >
      <h2
        style={{
          fontSize: 'var(--mj-text-size-2xl)',
          fontWeight: 'var(--mj-weight-bold)',
          lineHeight: 'var(--mj-leading-tight)',
          marginBottom: 'var(--mj-space-6)',
        }}
      >
        Your Results
      </h2>
      <BenchmarkBadge expired={result.benchmarkExpired} updatedLabel={result.benchmarkUpdatedLabel} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mj-space-4)' }}>
        {result.metrics.map((metric) => (
          <div
            key={metric.name}
            style={{
              background: 'var(--mj-color-bg-secondary)',
              padding: 'var(--mj-space-6)',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                fontSize: metric.isPrimary ? 'var(--mj-text-size-4xl)' : 'var(--mj-text-size-2xl)',
                fontWeight: 'var(--mj-weight-bold)',
                lineHeight: 'var(--mj-leading-tight)',
                color: 'var(--mj-color-text-primary)',
              }}
            >
              {metric.value}
            </div>
            <div
              style={{
                fontSize: 'var(--mj-text-size-sm)',
                color: 'var(--mj-color-text-secondary)',
                marginTop: 'var(--mj-space-1)',
              }}
            >
              {metric.label}
            </div>
            {metric.description && (
              <p style={{ fontSize: 'var(--mj-text-size-base)', marginTop: 'var(--mj-space-2)' }}>
                {metric.description}
              </p>
            )}
          </div>
        ))}
      </div>
      <p
        style={{
          fontSize: 'var(--mj-text-size-sm)',
          color: 'var(--mj-color-text-secondary)',
          marginTop: 'var(--mj-space-6)',
        }}
      >
        {result.disclaimer}
      </p>
      <p style={{ fontSize: 'var(--mj-text-size-sm)', color: 'var(--mj-color-text-secondary)' }}>
        {result.benchmarkCitation}
      </p>
    </section>
  )
}
