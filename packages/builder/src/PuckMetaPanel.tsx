/**
 * packages/builder/src/PuckMetaPanel.tsx
 * UI-SPEC: right-side meta panel, 320px wide.
 * Contains: page title, meta description, slug, SEO score widget.
 * SEO score widget: computeLiveScore() result (0-100).
 */
'use client'
import React from 'react'
import { SeoScoreWidget } from './SeoScoreWidget.js'

export interface PageMeta {
  title: string
  description: string
  slug: string
}

interface PuckMetaPanelProps {
  meta: PageMeta
  seoScore: number
  isOpen: boolean
  onChange: (meta: PageMeta) => void
}

export function PuckMetaPanel({ meta, seoScore, isOpen, onChange }: PuckMetaPanelProps): React.ReactElement | null {
  if (!isOpen) return null

  return (
    <aside
      aria-label="Page meta settings"
      style={{
        position: 'fixed',
        top: '48px', right: 0, bottom: 0,
        width: '320px',
        zIndex: 9998,
        background: 'var(--mj-color-bg-secondary)',
        borderLeft: '1px solid var(--mj-color-border)',
        padding: 'var(--mj-space-6)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--mj-space-6)',
      }}
    >
      <div>
        <SeoScoreWidget score={seoScore} />
        <p style={{ fontSize: 'var(--mj-text-size-sm)', color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-1)' }}>
          Score reflects title, meta description, word count, and heading structure.
        </p>
      </div>

      {/* Page Title */}
      <div>
        <label htmlFor="meta-title" style={{ fontSize: 'var(--mj-text-size-sm)', display: 'block', marginBottom: 'var(--mj-space-2)', fontWeight: 'var(--mj-weight-bold)' }}>
          Page Title
        </label>
        <input
          id="meta-title"
          type="text"
          value={meta.title}
          onChange={(e) => onChange({ ...meta, title: e.target.value })}
          style={{
            width: '100%',
            padding: 'var(--mj-space-2) var(--mj-space-4)',
            fontSize: 'var(--mj-text-size-base)',
            border: '1px solid var(--mj-color-border)',
            borderRadius: '4px',
            background: 'var(--mj-color-bg-primary)',
            minHeight: '44px',
          }}
        />
      </div>

      {/* Meta Description */}
      <div>
        <label htmlFor="meta-description" style={{ fontSize: 'var(--mj-text-size-sm)', display: 'block', marginBottom: 'var(--mj-space-2)', fontWeight: 'var(--mj-weight-bold)' }}>
          Meta Description
        </label>
        <textarea
          id="meta-description"
          value={meta.description}
          onChange={(e) => onChange({ ...meta, description: e.target.value })}
          rows={4}
          style={{
            width: '100%',
            padding: 'var(--mj-space-2) var(--mj-space-4)',
            fontSize: 'var(--mj-text-size-base)',
            border: '1px solid var(--mj-color-border)',
            borderRadius: '4px',
            background: 'var(--mj-color-bg-primary)',
            resize: 'vertical',
            minHeight: '88px',
          }}
        />
      </div>

      {/* URL Slug */}
      <div>
        <label htmlFor="meta-slug" style={{ fontSize: 'var(--mj-text-size-sm)', display: 'block', marginBottom: 'var(--mj-space-2)', fontWeight: 'var(--mj-weight-bold)' }}>
          URL Slug
        </label>
        <input
          id="meta-slug"
          type="text"
          value={meta.slug}
          onChange={(e) => onChange({ ...meta, slug: e.target.value })}
          style={{
            width: '100%',
            padding: 'var(--mj-space-2) var(--mj-space-4)',
            fontSize: 'var(--mj-text-size-base)',
            border: '1px solid var(--mj-color-border)',
            borderRadius: '4px',
            background: 'var(--mj-color-bg-primary)',
            fontFamily: 'monospace',
            minHeight: '44px',
          }}
        />
      </div>
    </aside>
  )
}
