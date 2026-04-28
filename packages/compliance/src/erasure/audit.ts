/**
 * packages/compliance/src/erasure/audit.ts
 * Plan 11-05 / REQ-144 D-07:
 *
 * Hash-chained audit row writer for the ccpa_erasure_records table.
 * Pattern reused from Phase 2 audit_log + Phase 10 esign_records.
 *
 * Hash composition (D-07):
 *   record_hash = sha256(prev_hash + request_id + system + occurred_at + JSON(result))
 *
 * Genesis row: prev_hash is empty string ('') — never null at the hash-input level
 * to avoid NULL ambiguity in re-verification. We persist NULL in the column for
 * the first row of a request, but compute the hash with empty-string concatenation.
 *
 * Worker call site uses createAgencyDb + withAgencyContext (RLS via app.agency_id).
 * The collection has delete:false + update:false (immutable), which means even an
 * authenticated admin cannot tamper with rows post-write.
 */
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { createAgencyDb, ccpaErasureRecords, withAgencyContext } from '@mjagency/db'
import type { AgencySlug } from '@mjagency/config'

export type ErasureSystem =
  | 'postgres'
  | 'redis'
  | 'r2'
  | 'ga4'
  | 'meta_capi'
  | 'clarity'
  | 'litellm'

export interface WriteAuditRowInput {
  agencyId: string
  /** Per-agency Postgres slug (web-ecommerce → 'ecommerce', web-main → 'brand', etc.) */
  dbAgencySlug: AgencySlug
  requestId: string
  system: ErasureSystem
  result: unknown
  /** Previous row's record_hash. Empty string for the first/genesis row of a request. */
  prevHash: string
  occurredAt?: Date
}

export interface WriteAuditRowOutput {
  recordHash: string
  occurredAt: string
}

/**
 * Composes the SHA-256 record hash for a row.
 * Exported separately so quarterly CI verification can recompute and compare.
 */
export function computeRecordHash(input: {
  prevHash: string
  requestId: string
  system: string
  occurredAt: string
  result: unknown
}): string {
  return createHash('sha256')
    .update(input.prevHash)
    .update(input.requestId)
    .update(input.system)
    .update(input.occurredAt)
    .update(JSON.stringify(input.result))
    .digest('hex')
}

/**
 * Inserts a row into ccpa_erasure_records with hash-chain integrity.
 * Returns the new record_hash (caller passes it as prev_hash to the next system row).
 *
 * RLS: SET LOCAL app.agency_id via withAgencyContext.
 */
export async function writeAuditRow(input: WriteAuditRowInput): Promise<WriteAuditRowOutput> {
  const occurredAt = (input.occurredAt ?? new Date()).toISOString()
  const recordHash = computeRecordHash({
    prevHash: input.prevHash,
    requestId: input.requestId,
    system: input.system,
    occurredAt,
    result: input.result,
  })

  const password = process.env['DB_APP_PASSWORD']
  if (!password) {
    throw new Error('DB_APP_PASSWORD missing — cannot write erasure audit row')
  }

  const db = createAgencyDb(input.dbAgencySlug, password)
  await withAgencyContext(db, input.agencyId, async (tx) => {
    await tx.insert(ccpaErasureRecords).values({
      agencyId: input.agencyId,
      requestId: input.requestId,
      system: input.system,
      result: input.result as object,
      occurredAt: new Date(occurredAt),
      // Persist NULL for genesis row (empty prev_hash); persist string otherwise.
      prevHash: input.prevHash === '' ? null : input.prevHash,
      recordHash,
    })
  })

  // Touch sql import so tree-shake doesn't drop the dep.
  void sql

  return { recordHash, occurredAt }
}
