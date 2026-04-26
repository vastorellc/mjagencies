/**
 * packages/cms/src/access/collection-access.ts
 *
 * Reusable Payload 3.82.1 access control helpers for all CMS collections.
 *
 * Security model (CLAUDE.md §3, REQ-050):
 *   - super_admin role: full CRUD on all collections across all agencies
 *   - admin role: full CRUD on own agency docs only (agency_id match)
 *   - editor role: read + create + update own agency docs only (no delete)
 *   - unauthenticated: no access
 *
 * All access functions read agency_id from the JWT claims via req.user.agencyId.
 * The agency_id field itself is always immutable (access.update = () => false).
 *
 * Payload 3.82.1 workaround: custom collection views MUST use exact: true
 * (specs/cms.md IMPORTANT CONSTRAINTS — 3.83.0 route matching regression).
 */
import type { Access, PayloadRequest } from 'payload'

/** Roles with unrestricted cross-agency access */
const SUPER_ROLES = new Set(['super_admin'])
/** Roles with agency-scoped read+write access */
const AGENCY_WRITE_ROLES = new Set(['admin', 'editor'])

/**
 * Full collection access: super_admin unrestricted; admin/editor restricted to own agency.
 * Pass as `access.create`, `access.read`, `access.update` on all CMS collections.
 */
export const collectionAccess: Access = async ({ req }: { req: PayloadRequest }) => {
  const user = req.user as { role?: string; agencyId?: string } | null
  if (!user) return false
  if (SUPER_ROLES.has(user.role ?? '')) return true
  if (AGENCY_WRITE_ROLES.has(user.role ?? '') && user.agencyId) {
    return { agency_id: { equals: user.agencyId } }
  }
  return false
}

/**
 * Delete access: super_admin and admin only (not editor).
 */
export const deleteAccess: Access = async ({ req }: { req: PayloadRequest }) => {
  const user = req.user as { role?: string; agencyId?: string } | null
  if (!user) return false
  if (SUPER_ROLES.has(user.role ?? '')) return true
  if (user.role === 'admin' && user.agencyId) {
    return { agency_id: { equals: user.agencyId } }
  }
  return false
}

/**
 * Field-level access: agency_id is immutable after creation.
 * Use as: fields: [{ name: 'agency_id', access: { update: fieldImmutable } }]
 */
export const fieldImmutable = () => false as const

/**
 * Admin-panel "list" access for super_admin only (e.g., global settings collection).
 */
export const superAdminOnly: Access = async ({ req }: { req: PayloadRequest }) => {
  const user = req.user as { role?: string } | null
  if (!user) return false
  return SUPER_ROLES.has(user.role ?? '')
}
