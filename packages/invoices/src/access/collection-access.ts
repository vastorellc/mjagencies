/**
 * packages/invoices/src/access/collection-access.ts
 *
 * Reusable Payload access-control functions for the invoices collection.
 * Copied verbatim from packages/cms/src/access/collection-access.ts to avoid
 * a circular dependency between cms and invoices packages.
 *
 * Role model (3 roles only — CLAUDE.md §8, REQ-008):
 *   super_admin — unrestricted across all agencies
 *   admin       — full CRUD on own agency only
 *   editor      — read + create + update on collections allowed by editor_grants;
 *                 no delete, no settings
 *
 * agency_id isolation:
 *   Every document has an immutable `agency_id` field.
 *   collectionAccess checks req.user.agencyId === doc.agency_id for non-super_admin.
 *   fieldImmutable blocks any update to agency_id (REQ-014, CLAUDE.md §8).
 *
 * Payload 3.82.1 Access function signature:
 *   type Access = (args: { req: PayloadRequest; id?: string; data?: Record<string,unknown> }) => boolean | Where
 */

import type { Access, FieldAccess } from 'payload'

/**
 * Payload user shape stored in req.user after Payload auth.
 * Payload 3.82.1 users collection is 'users'; we extend it with agencyId + role.
 */
interface PayloadUser {
  id: string
  role?: 'super_admin' | 'admin' | 'editor'
  agencyId?: string
  email?: string
}

function getUser(req: Parameters<Access>[0]['req']): PayloadUser | null {
  return (req.user as PayloadUser | null) ?? null
}

/**
 * Standard collection access: super_admin unrestricted; admin/editor own agency only.
 * Returns a Payload Where clause for list operations (agency-scoped filter),
 * or a boolean for single-doc operations.
 */
export const collectionAccess: Access = ({ req }) => {
  const user = getUser(req)
  if (!user) return false
  if (user.role === 'super_admin') return true
  if (user.agencyId) {
    // Return a Where clause so list operations are automatically filtered
    return {
      agency_id: { equals: user.agencyId },
    }
  }
  return false
}

/**
 * Delete access: super_admin and admin only. Editors cannot delete.
 */
export const deleteAccess: Access = ({ req }) => {
  const user = getUser(req)
  if (!user) return false
  if (user.role === 'super_admin') return true
  if (user.role === 'admin' && user.agencyId) {
    return {
      agency_id: { equals: user.agencyId },
    }
  }
  return false
}

/**
 * Field-level immutability guard for agency_id.
 * Always returns false so the field cannot be updated after creation (REQ-014, CLAUDE.md §8).
 */
export const fieldImmutable: FieldAccess = () => false

/**
 * Super-admin only access (e.g. settings delete, system-level operations).
 */
export const superAdminOnly: Access = ({ req }) => {
  const user = getUser(req)
  return user?.role === 'super_admin'
}
