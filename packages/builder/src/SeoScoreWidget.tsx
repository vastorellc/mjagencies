/**
 * packages/builder/src/SeoScoreWidget.tsx
 * UI-SPEC: SEO score widget in admin bar + meta panel.
 * Color ramp: 0-49 error, 50-79 warning, 80-100 success.
 * Accessible: aria-label with full score text.
 */
'use client'

import React from 'react'

interface SeoScoreWidgetProps {
  score: number
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--mj-color-success)'
  if (score >= 50) return 'var(--mj-color-warning)'
  return 'var(--mj-color-error)'
}

export function SeoScoreWidget({ score }: SeoScoreWidgetProps): React.ReactElement {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)))
  const color = getScoreColor(clampedScore)
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--mj-space-1)' }}
      title="Score reflects title, meta description, word count, and heading structure."
    >
      <span
        aria-label={`SEO score: ${clampedScore} out of 100`}
        style={{
          fontSize: 'var(--mj-text-size-sm)',
          fontWeight: 'var(--mj-weight-bold)',
          color,
          lineHeight: 'var(--mj-leading-normal)',
          minWidth: '2.5rem',
          textAlign: 'right',
        }}
      >
        {clampedScore}
      </span>
      <span style={{ fontSize: 'var(--mj-text-size-sm)', color: 'var(--mj-color-text-secondary)' }}>
        SEO Score
      </span>
    </div>
  )
}
