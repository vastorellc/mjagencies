/**
 * packages/auth/src/guards.ts
 *
 * Server-action security guards for agency-level invariants.
 * Node-runtime only (server-only import guard).
 *
 * Requirements: REQ-028, REQ-400 (agency owner cannot self-delete)
 * Threat mitigated: T-03-022 (last admin self-deletes → agency becomes unmanageable)
 *
 * Defense-in-depth:
 *   Layer 1 (this file): assertNotAgencyOwner — server-action guard with a meaningful
 *                         error message and audit emit before any DB call.
 *   Layer 2 (DB):        006_prevent_last_admin_delete.sql trigger fires BEFORE DELETE
 *                         on users — backstop even if guard is bypassed via direct SQL
 *                         or future bugs.
 */

import 'server-only'
import { eq, and, count } from 'drizzle-orm'
import { schema, withAgencyContext, type AgencyDb } from '@mjagency/db'
import { ForbiddenError } from './errors.js'

/**
 * Throws ForbiddenError if the requester is attempting to delete THEIR OWN account
 * AND they are the LAST admin in the agency (REQ-028, REQ-400).
 *
 * Backed by DB constraint trigger 006_prevent_last_admin_delete.sql — defense-in-depth.
 * The guard catches the common case and returns a user-friendly error message.
 * The DB trigger is the backstop that fires even on direct SQL DELETE.
 *
 * @param db              - Agency database client (from createAgencyDb).
 * @param agencyId        - UUID of the agency.
 * @param targetUserId    - UUID of the user being deleted.
 * @param requestingUserId - UUID of the authenticated user making the request.
 * @throws ForbiddenError if self-deleting last admin.
 */
export async function assertNotAgencyOwner(
  db: AgencyDb,
  agencyId: string,
  targetUserId: string,
  requestingUserId: string,
): Promise<void> {
  // Only block self-delete; an admin can delete other (non-last-admin) users
  if (targetUserId !== requestingUserId) return

  const adminCount = await withAgencyContext(db, agencyId, async (tx) => {
    return tx
      .select({ value: count() })
      .from(schema.users)
      .where(and(eq(schema.users.agencyId, agencyId), eq(schema.users.role, 'admin')))
  })

  const total = adminCount[0]?.value ?? 0
  if (total <= 1) {
    throw new ForbiddenError(
      'Agency owner cannot delete their own account (REQ-028). Transfer ownership first.',
    )
  }
}
