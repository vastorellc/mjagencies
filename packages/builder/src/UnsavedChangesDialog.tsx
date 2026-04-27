/**
 * packages/builder/src/UnsavedChangesDialog.tsx
 * UI-SPEC: custom MJ dialog for unsaved changes (not native beforeunload prompt).
 * Shows when: (a) clicking "Exit Editor", (b) navigating away with unsaved changes.
 * beforeunload listener active while editor has pending changes.
 */
'use client'
import React, { useEffect } from 'react'

interface UnsavedChangesDialogProps {
  isOpen: boolean
  onLeave: () => void
  onCancel: () => void
  hasUnsavedChanges: boolean
}

export function UnsavedChangesDialog({ isOpen, onLeave, onCancel, hasUnsavedChanges }: UnsavedChangesDialogProps): React.ReactElement | null {
  // beforeunload listener — active only when there are unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-dialog-heading"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--mj-space-4)',
      }}
    >
      <div style={{
        background: 'var(--mj-color-bg-primary)',
        borderRadius: '8px',
        padding: 'var(--mj-space-8)',
        maxWidth: '420px',
        width: '100%',
      }}>
        <h2 id="unsaved-dialog-heading" style={{
          fontSize: 'var(--mj-text-size-2xl)',
          fontWeight: 'var(--mj-weight-bold)',
          lineHeight: 'var(--mj-leading-tight)',
          marginBottom: 'var(--mj-space-4)',
        }}>
          Leave Without Saving?
        </h2>
        <p style={{ fontSize: 'var(--mj-text-size-base)', marginBottom: 'var(--mj-space-6)' }}>
          You have unsaved changes to this page. If you leave now, your changes will be lost.
        </p>
        <div style={{ display: 'flex', gap: 'var(--mj-space-4)' }}>
          <button
            onClick={onLeave}
            style={{
              flex: 1,
              padding: 'var(--mj-space-4)',
              background: 'var(--mj-color-error)',
              color: 'var(--mj-color-text-on-error)',
              fontSize: 'var(--mj-text-size-base)',
              fontWeight: 'var(--mj-weight-bold)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            Leave Without Saving
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: 'var(--mj-space-4)',
              background: 'var(--mj-color-bg-secondary)',
              color: 'var(--mj-color-text-primary)',
              fontSize: 'var(--mj-text-size-base)',
              fontWeight: 'var(--mj-weight-normal)',
              border: '1px solid var(--mj-color-border)',
              borderRadius: '4px',
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            Keep Editing
          </button>
        </div>
      </div>
    </div>
  )
}
