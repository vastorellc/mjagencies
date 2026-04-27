/**
 * packages/builder/src/PuckAdminBar.tsx
 * UI-SPEC Surface 5 — fixed admin bar.
 * Height: 48px, top: 0, full width, z-index above all page content.
 * Background: var(--mj-color-bg-secondary).
 * Contains: toggle (edit/exit), SEO score widget, preview toggle, publish button.
 */
'use client'
import React, { useState, useEffect } from 'react'
import { SeoScoreWidget } from './SeoScoreWidget.js'

interface PuckAdminBarProps {
  isEditMode: boolean
  isPreviewMode: boolean
  seoScore: number
  hasUnsavedChanges: boolean
  isPublishing: boolean
  onToggleEdit: () => void
  onTogglePreview: () => void
  onPublish: () => void
  publishFeedback: { type: 'success' | 'error'; message: string } | null
}

export function PuckAdminBar({
  isEditMode, isPreviewMode, seoScore, hasUnsavedChanges,
  isPublishing, onToggleEdit, onTogglePreview, onPublish, publishFeedback,
}: PuckAdminBarProps): React.ReactElement {
  const [toastVisible, setToastVisible] = useState(false)

  useEffect(() => {
    if (publishFeedback?.type === 'success') {
      setToastVisible(true)
      const timer = setTimeout(() => setToastVisible(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [publishFeedback])

  return (
    <>
      {/* Admin bar — fixed, 48px, full width, z-index above all */}
      <div
        role="toolbar"
        aria-label="Page editor controls"
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          height: '48px',
          zIndex: 10000,
          background: 'var(--mj-color-bg-secondary)',
          borderBottom: '1px solid var(--mj-color-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--mj-space-6)',
          gap: 'var(--mj-space-4)',
        }}
      >
        {/* Edit/Exit toggle */}
        <button
          aria-pressed={isEditMode}
          onClick={onToggleEdit}
          style={{
            padding: 'var(--mj-space-2) var(--mj-space-4)',
            fontSize: 'var(--mj-text-size-sm)',
            fontWeight: 'var(--mj-weight-bold)',
            background: isEditMode ? 'var(--mj-color-brand-500)' : 'transparent',
            color: isEditMode ? 'var(--mj-color-text-on-brand)' : 'var(--mj-color-text-primary)',
            border: `1px solid ${isEditMode ? 'var(--mj-color-brand-500)' : 'var(--mj-color-border)'}`,
            borderRadius: '4px',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {isEditMode ? 'Exit Editor' : 'Edit Page'}
        </button>

        {/* Unsaved indicator */}
        {hasUnsavedChanges && (
          <span style={{ fontSize: 'var(--mj-text-size-sm)', color: 'var(--mj-color-warning)' }}>
            You have unpublished changes
          </span>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* SEO score */}
        <SeoScoreWidget score={seoScore} />

        {/* Preview toggle */}
        <button
          onClick={onTogglePreview}
          style={{
            padding: 'var(--mj-space-2) var(--mj-space-4)',
            fontSize: 'var(--mj-text-size-sm)',
            background: 'transparent',
            color: 'var(--mj-color-text-primary)',
            border: '1px solid var(--mj-color-border)',
            borderRadius: '4px',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {isPreviewMode ? 'Back to Editor' : 'Preview'}
        </button>

        {/* Publish */}
        <button
          onClick={onPublish}
          disabled={isPublishing}
          style={{
            padding: 'var(--mj-space-2) var(--mj-space-6)',
            fontSize: 'var(--mj-text-size-sm)',
            fontWeight: 'var(--mj-weight-bold)',
            background: isPublishing ? 'var(--mj-color-bg-secondary)' : 'var(--mj-color-brand-500)',
            color: isPublishing ? 'var(--mj-color-text-disabled)' : 'var(--mj-color-text-on-brand)',
            border: 'none',
            borderRadius: '4px',
            cursor: isPublishing ? 'not-allowed' : 'pointer',
            minHeight: '44px',
          }}
        >
          {isPublishing ? 'Publishing...' : 'Publish Page'}
        </button>
      </div>

      {/* 3-second toast on publish success */}
      {toastVisible && publishFeedback?.type === 'success' && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 'var(--mj-space-6)',
            right: 'var(--mj-space-6)',
            zIndex: 10001,
            background: 'var(--mj-color-success)',
            color: 'var(--mj-color-text-on-success)',
            padding: 'var(--mj-space-4) var(--mj-space-6)',
            borderRadius: '4px',
            fontSize: 'var(--mj-text-size-sm)',
            fontWeight: 'var(--mj-weight-bold)',
          }}
        >
          Page published. Changes are live.
        </div>
      )}

      {/* Persistent error banner if publish failed */}
      {publishFeedback?.type === 'error' && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: '48px', left: 0, right: 0,
            zIndex: 9999,
            background: 'var(--mj-color-error)',
            color: 'var(--mj-color-text-on-error)',
            padding: 'var(--mj-space-2) var(--mj-space-6)',
            fontSize: 'var(--mj-text-size-sm)',
            textAlign: 'center',
          }}
        >
          {publishFeedback.message}
        </div>
      )}
    </>
  )
}
