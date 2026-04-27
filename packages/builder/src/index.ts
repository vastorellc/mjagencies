/**
 * packages/builder/src/index.ts
 * REQ-130, REQ-131, REQ-132
 */
// Server components (contain requireSession — import only in Server Component contexts)
export { PuckEditor } from './PuckEditor.js'

// Client components (safe to import in both server + client boundaries)
export { PuckAdminBar } from './PuckAdminBar.js'
export { PuckMetaPanel } from './PuckMetaPanel.js'
export type { PageMeta } from './PuckMetaPanel.js'
export { SeoScoreWidget } from './SeoScoreWidget.js'
export { UnsavedChangesDialog } from './UnsavedChangesDialog.js'

// Server actions
export { publishPage } from './actions/publish-page.js'
export type { PublishPageInput, PublishPageOutput } from './actions/publish-page.js'
export { saveDraft } from './actions/save-draft.js'
export type { SaveDraftInput } from './actions/save-draft.js'

// Builder types (Phase 1 contracts preserved)
export type { BuilderBlock, BuilderPage, BuilderAuthContext, BuilderConfig } from './types.js'
