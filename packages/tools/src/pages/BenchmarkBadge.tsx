/**
 * packages/tools/src/pages/BenchmarkBadge.tsx
 * REQ-406: yellow warning badge when benchmark age > 12 months.
 * Tool stays fully functional — no lockout.
 * UI-SPEC: var(--mj-color-warning) background, role="status" yellow pill.
 */
'use client'

interface BenchmarkBadgeProps {
  expired: boolean
  updatedLabel: string
}

export function BenchmarkBadge({ expired, updatedLabel }: BenchmarkBadgeProps): React.JSX.Element | null {
  if (!expired) return null
  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-block',
        background: 'var(--mj-color-warning)',
        color: 'var(--mj-color-text-on-warning)',
        padding: 'var(--mj-space-1) var(--mj-space-2)',
        borderRadius: '9999px',
        fontSize: 'var(--mj-text-size-sm)',
        fontWeight: 'var(--mj-weight-normal)',
        lineHeight: 'var(--mj-leading-normal)',
        marginBottom: 'var(--mj-space-4)',
      }}
    >
      Benchmark data last updated {updatedLabel}. Results remain valid — updated benchmarks coming soon.
    </span>
  )
}
