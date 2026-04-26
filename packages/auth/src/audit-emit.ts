/**
 * packages/auth/src/audit-emit.ts
 *
 * Audit emit helpers — wires Phase 2 02-06 audit triggers to the correct actor
 * and provides Pino observability for auth events.
 *
 * Requirements: REQ-027 (session regeneration on privilege escalation emits audit rows)
 * Threat mitigated: T-03-023 (audit row attributes to SYSTEM_ACTOR_ID instead of real actor)
 *
 * IMPORTANT: The hash-chained DB audit_log table (Phase 2 02-06) is the AUTHORITATIVE
 * system of record for compliance. emitAuthAudit (Pino) is off-DB observability for
 * SOC dashboards / Loki — NOT authoritative for compliance.
 *
 * Pattern reference: Phase 2 02-06 capture_audit_row() reads app.actor_id from the
 * session config. If not set, falls back to SYSTEM_ACTOR_ID ('00000000-0000-0000-0000-000000000001').
 * setAppActor() sets it SET LOCAL (true = transaction-scoped) so it never leaks via
 * PgBouncer pool reuse — same defense-in-depth as withAgencyContext's app.agency_id.
 */

import 'server-only'
import { sql } from 'drizzle-orm'
import { createLogger } from '@mjagency/config'
import type { AgencyDb } from '@mjagency/db'

const logger = createLogger({ service: 'auth' })

/**
 * Sets `app.actor_id` SET LOCAL inside the current transaction so the
 * Phase 2 02-06 capture_audit_row() trigger reads the correct actor.
 *
 * Must be called INSIDE withAgencyContext (which already sets app.agency_id).
 * On no-actor case (e.g. system-level auth), pass SYSTEM_ACTOR_ID — the trigger
 * will fall back to it automatically if the setting is null/empty.
 *
 * The `true` third argument to set_config means SET LOCAL — the value is
 * automatically reverted when the transaction ends, preventing cross-tenant
 * actor attribution leaks via PgBouncer pool reuse (pitfall 8.1 mitigation).
 *
 * @param tx          - Transaction object from withAgencyContext callback parameter.
 * @param actorUserId - UUID of the authenticated user performing the action.
 */
export async function setAppActor(
  tx: Parameters<Parameters<AgencyDb['transaction']>[0]>[0],
  actorUserId: string,
): Promise<void> {
  await tx.execute(sql`SELECT set_config('app.actor_id', ${actorUserId}, true)`)
}

/**
 * Union of all auth event names emitted via emitAuthAudit.
 *
 * DB impact legend:
 *   (DB)   — this event involves a DB write that triggers capture_audit_row()
 *   (Pino) — Pino only; no DB write at this phase
 */
export type AuthEventName =
  | 'login.success'           // (DB) sessions row created
  | 'login.failure'           // (Pino) no DB write
  | 'logout'                  // (DB) sessions row revokedAt updated
  | 'refresh.success'         // (Pino) Redis only at this phase
  | 'refresh.replay-revoke'   // (Pino) family revocation via Redis
  | 'mfa.verify.success'      // (DB) mfa_config lastVerifiedAt updated
  | 'mfa.verify.failure'      // (Pino) no DB write
  | 'mfa.recovery-code.used'  // (DB) mfa_config recovery_hashes updated
  | 'mfa.lockout'             // (DB) mfa_config lockout columns updated
  | 'session.regenerate'      // (DB) sessions row created
  | 'sso.code.created'        // (Pino) Redis only
  | 'sso.code.redeemed'       // (Pino) Redis only
  | 'sso.exchange.forbidden'  // (Pino) no DB write — flag for SOC
  | 'session.last-admin-delete-blocked' // (Pino) DB trigger raises BEFORE the delete

/**
 * Off-DB observability for auth events. Pino logs flow to Loki for SOC dashboards.
 *
 * THIS IS NOT THE AUDIT LOG OF RECORD. The hash-chained Phase 2 audit_log table is
 * the authoritative source for compliance. emitAuthAudit is for live observability only.
 *
 * Pino redact paths (Phase 1, packages/config/src/logger.ts) automatically scrub
 * tokens, emails, phones, and JWT payloads from the log entry.
 *
 * @param eventName - One of the locked AuthEventName values.
 * @param payload   - Context fields: agencyId, userId, and any event-specific fields.
 */
export function emitAuthAudit(
  eventName: AuthEventName,
  payload: { agencyId?: string; userId?: string; [k: string]: unknown },
): void {
  // Pino redact paths (Phase 1) scrub tokens, emails, phones automatically
  logger.info({ event: `auth.${eventName}`, ...payload }, `auth event: ${eventName}`)
}
