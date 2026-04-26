/**
 * packages/cms/src/dam/views.ts
 *
 * DAM view type definitions and role-based view selection (REQ-060).
 *
 * 3 views:
 *   1. super_admin_library  — All 12 agencies, all assets, full management
 *   2. agency_library       — Own agency only, full management
 *   3. editor_picker        — Scoped by editor_grants, read-only, 4-tab picker
 *                             Tabs: Upload / Library / Stock / AI
 *                             Stock tab: proxy to /api/media/search?source=unsplash (Phase 8)
 *                             AI tab: stub in Phase 5 (Phase 7 wires real generation)
 */

export type DamViewId = 'super_admin_library' | 'agency_library' | 'editor_picker'

export interface DamViewConfig {
  id: DamViewId
  label: string
  /** Whether the view can manage (upload, delete, archive) assets */
  canManage: boolean
  /** If true, view is scoped to a specific agencyId (provided at render time) */
  agencyScoped: boolean
  /** Tabs available in this view */
  tabs: DamTab[]
}

export type DamTab = 'upload' | 'library' | 'stock' | 'ai'

export const DAM_VIEWS: Record<DamViewId, DamViewConfig> = {
  super_admin_library: {
    id: 'super_admin_library',
    label: 'Platform Asset Library',
    canManage: true,
    agencyScoped: false,
    tabs: ['upload', 'library'],
  },
  agency_library: {
    id: 'agency_library',
    label: 'Agency Asset Library',
    canManage: true,
    agencyScoped: true,
    tabs: ['upload', 'library'],
  },
  editor_picker: {
    id: 'editor_picker',
    label: 'Insert Media',
    canManage: false,
    agencyScoped: true,
    // Stock: server-side proxy via /api/media/search (CLAUDE.md §7 — never browser-side)
    // AI: stub in Phase 5, real generation in Phase 7
    tabs: ['upload', 'library', 'stock', 'ai'],
  },
}

/**
 * Returns the appropriate DAM view for a given user role.
 * Editors get the picker (read-only 4-tab); admins get the agency library; super_admin gets all.
 * Unknown roles default to editor_picker (safe minimum access — T-05-05-04 mitigation).
 */
export function getDamViewForRole(role: string): DamViewId {
  if (role === 'super_admin') return 'super_admin_library'
  if (role === 'admin') return 'agency_library'
  return 'editor_picker'
}
