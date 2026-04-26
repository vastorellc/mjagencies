'use client'
/**
 * SEO/AIO/GEO sidebar panel for Payload admin editor (REQ-055).
 * Phase 5: displays stub scores from computeSeoScore().
 * Phase 6: replaces computeSeoScore stub with real plugin engine.
 *
 * Rendered in Payload admin afterDocControls slot (always visible, right sidebar).
 * Registered via buildPayloadConfig admin.components.afterDocControls as a relative path.
 */
import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { computeSeoScore } from '@mjagency/cms'
import type { SeoScores } from '@mjagency/cms'

function ScoreBar({ label, score }: { label: string; score: number }): React.ReactElement {
  const color =
    score >= 70
      ? 'var(--mj-color-success, #22c55e)'
      : score >= 40
        ? 'var(--mj-color-warning, #f59e0b)'
        : 'var(--mj-color-danger, #ef4444)'
  return (
    <div style={{ marginBottom: 'var(--mj-space-2, 8px)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'var(--mj-text-sm, 13px)',
        }}
      >
        <span style={{ color: 'var(--mj-color-text-secondary, #6b7280)' }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{score}</span>
      </div>
      <div
        style={{
          height: 4,
          background: 'var(--mj-color-border, #e5e7eb)',
          borderRadius: 'var(--mj-radius-full, 9999px)',
          marginTop: 2,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${score}%`,
            background: color,
            borderRadius: 'var(--mj-radius-full, 9999px)',
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  )
}

export default function SeoPanel(): React.ReactElement {
  const { docConfig } = useDocumentInfo()
  // Phase 5 stub: derive content string from docConfig (simplified)
  // Phase 6: replace with actual Lexical editor content extraction
  const content = JSON.stringify(docConfig ?? '')
  const scores: SeoScores = computeSeoScore(content)

  return (
    <div
      style={{
        padding: 'var(--mj-space-4, 16px)',
        border: '1px solid var(--mj-color-border, #e5e7eb)',
        borderRadius: 'var(--mj-radius-md, 6px)',
        marginTop: 'var(--mj-space-4, 16px)',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--mj-font-heading, inherit)',
          fontSize: 'var(--mj-text-base, 14px)',
          fontWeight: 600,
          marginBottom: 'var(--mj-space-3, 12px)',
          color: 'var(--mj-color-text-primary, #111827)',
        }}
      >
        SEO / AIO / GEO
      </h3>
      <ScoreBar label="SEO Score" score={scores.seo} />
      <ScoreBar label="AIO Score" score={scores.aio} />
      <ScoreBar label="GEO Score" score={scores.geo} />
      <div
        style={{
          marginTop: 'var(--mj-space-3, 12px)',
          fontSize: 'var(--mj-text-xs, 11px)',
          color: 'var(--mj-color-text-secondary, #6b7280)',
        }}
      >
        <div>Word count: {scores.wordCount}</div>
        <div>
          Internal links: {scores.internalLinkCount}{' '}
          {scores.internalLinkCount < 3 ? '(need 3+)' : '(OK)'}
        </div>
        <div>Alt coverage: {Math.round(scores.altCoverage * 100)}%</div>
        <div style={{ marginTop: 'var(--mj-space-2, 8px)', fontStyle: 'italic' }}>
          Phase 5 stub scores — Phase 6 wires real plugin engine
        </div>
      </div>
    </div>
  )
}
