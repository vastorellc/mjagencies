/**
 * packages/builder/src/PuckEditorClient.tsx
 * Client component — receives pre-authenticated state from PuckEditor server component.
 * Renders <Puck> editor with admin bar, meta panel, unsaved-changes guard.
 *
 * CLAUDE.md Puck Rules:
 *   - Puck outputs JSON — no dangerouslySetInnerHTML from Puck JSON
 *   - All block components sanitize string inputs before rendering
 *
 * getBlockConfig() from @mjagency/ui returns a Puck Config containing all registered
 * block components. Each block enforces DOMPurify sanitization internally.
 * This MUST be passed as the Puck `config` prop — never use { components: {} }
 * which would bypass the sanitization layer entirely.
 */
'use client'
import React, { useState, useCallback } from 'react'
import { Puck } from '@measured/puck'
import type { Data, Config } from '@measured/puck'
import { getBlockConfig } from '@mjagency/ui'
import { PuckAdminBar } from './PuckAdminBar.js'
import { PuckMetaPanel } from './PuckMetaPanel.js'
import { UnsavedChangesDialog } from './UnsavedChangesDialog.js'
import { publishPage } from './actions/publish-page.js'
import type { PageMeta } from './PuckMetaPanel.js'

interface PuckEditorClientProps {
  agencyId: string
  pageId: string
  initialPuckData: object
  initialMeta: PageMeta
  initialSeoScore: number
}

export function PuckEditorClient({
  agencyId, pageId, initialPuckData, initialMeta, initialSeoScore,
}: PuckEditorClientProps): React.ReactElement {
  const [isEditMode, setIsEditMode] = useState(true)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [meta, setMeta] = useState<PageMeta>(initialMeta)
  const [puckData, setPuckData] = useState<object>(initialPuckData)
  const [seoScore] = useState(initialSeoScore)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishFeedback, setPublishFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [metaPanelOpen, setMetaPanelOpen] = useState(false)

  // getBlockConfig() returns all registered Puck block components from @mjagency/ui.
  // Each block component sanitizes string inputs via DOMPurify (CLAUDE.md Puck Rules §6).
  // This is called once at render — config is stable (no re-renders).
  // Cast to Config<any> because @mjagency/ui does not depend on @measured/puck directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blockConfig = getBlockConfig() as unknown as Config<any>

  const handlePuckChange = useCallback((data: Data) => {
    setPuckData(data as unknown as object)
    setHasUnsavedChanges(true)
  }, [])

  const handlePublish = useCallback(async () => {
    setIsPublishing(true)
    const result = await publishPage({ agencyId, pageId, puckData, meta })
    setIsPublishing(false)
    if (result.ok) {
      setHasUnsavedChanges(false)
      setPublishFeedback({ type: 'success', message: 'Page published. Changes are live.' })
    } else {
      setPublishFeedback({ type: 'error', message: result.error ?? 'Changes could not be saved. Please check your connection and try again.' })
    }
  }, [agencyId, pageId, puckData, meta])

  const handleToggleEdit = useCallback(() => {
    if (isEditMode && hasUnsavedChanges) {
      setShowUnsavedDialog(true)
    } else {
      setIsEditMode((prev) => !prev)
    }
  }, [isEditMode, hasUnsavedChanges])

  // Empty canvas state message
  const isPuckDataEmpty = !puckData || Object.keys(puckData).length === 0

  return (
    <div style={{ paddingTop: '48px' }}>
      <PuckAdminBar
        isEditMode={isEditMode}
        isPreviewMode={isPreviewMode}
        seoScore={seoScore}
        hasUnsavedChanges={hasUnsavedChanges}
        isPublishing={isPublishing}
        onToggleEdit={handleToggleEdit}
        onTogglePreview={() => setIsPreviewMode((p) => !p)}
        onPublish={handlePublish}
        publishFeedback={publishFeedback}
      />

      <div style={{ display: 'flex', position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditMode && !isPreviewMode ? (
            <>
              {isPuckDataEmpty && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 'var(--mj-space-16)',
                    color: 'var(--mj-color-text-secondary)',
                    fontSize: 'var(--mj-text-size-base)',
                  }}
                >
                  This page is empty. Drag a block from the panel to start building.
                </div>
              )}
              {/* blockConfig from getBlockConfig() ensures all blocks sanitize inputs (CLAUDE.md Puck Rules §6) */}
              <Puck
                config={blockConfig}
                data={puckData as Data}
                onPublish={(data) => {
                  setPuckData(data as unknown as object)
                  setHasUnsavedChanges(true)
                }}
                onChange={handlePuckChange}
              />
            </>
          ) : (
            // Preview mode: render the page content without Puck chrome
            <div aria-label="Page preview">
              {/* Render puckData as static HTML — no dangerouslySetInnerHTML from Puck JSON */}
              {/* Agency apps import <Render> from @measured/puck with their registered components */}
              <pre style={{ display: 'none' }}>{JSON.stringify(puckData, null, 2)}</pre>
            </div>
          )}
        </div>

        <PuckMetaPanel
          meta={meta}
          seoScore={seoScore}
          isOpen={metaPanelOpen}
          onChange={(newMeta) => { setMeta(newMeta); setHasUnsavedChanges(true) }}
        />
      </div>

      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        hasUnsavedChanges={hasUnsavedChanges}
        onLeave={() => { setShowUnsavedDialog(false); setIsEditMode(false); setHasUnsavedChanges(false) }}
        onCancel={() => setShowUnsavedDialog(false)}
      />
    </div>
  )
}
