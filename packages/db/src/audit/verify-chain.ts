/**
 * packages/db/src/audit/verify-chain.ts
 *
 * TypeScript chain verifier for the hash-chained audit log.
 *
 * Walks every row in audit_log for a given agency (or all agencies), recomputes
 * SHA-256 over the same canonical string that the Postgres trigger used, and
 * compares against the stored `row_hash`. Reports any rows where the hash
 * does not match — indicating tampering or chain corruption (T-02-017 detection).
 *
 * Algorithm (per RESEARCH §5.4):
 *   For each row ordered by id within a (table_name, agency_id) stream:
 *   1. Rebuild the canonical string in the same format as the trigger:
 *      id|occurred_at|table_name|op|row_pk|actor_id|agency_id|txid|correlation_id|old_row|new_row|prev_hash_hex
 *   2. Compute SHA-256 over the canonical string using Node's `createHash`.
 *   3. Compare with stored row_hash. If different → row is broken.
 *
 * Per-stream semantics:
 *   The trigger chains rows per `(table_name, agency_id)` stream. The verifier
 *   uses `LAG(row_hash) OVER (PARTITION BY table_name, agency_id ORDER BY id)`
 *   to retrieve the previous hash in the same stream.
 */

import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { AgencyDb } from '../client.js'

export interface AuditChainResult {
  broken: number[]
  total: number
}

/**
 * Walks the audit_log chain for all agencies and returns broken row IDs.
 *
 * Uses a single SQL query with LAG window function to retrieve each row's
 * expected previous hash from the same stream, then recomputes SHA-256 in Node
 * to verify against the stored row_hash.
 *
 * @param db - AgencyDb connected as migrations_runner (BYPASSRLS) for full scan
 * @returns { broken: number[]; total: number }
 */
export async function verifyAuditChain(db: AgencyDb): Promise<AuditChainResult> {
  // Fetch all rows with their in-stream prev_hash via LAG window function
  // Using migrations_runner (BYPASSRLS) connection for full-table scan
  const rows = await db.execute(sql`
    SELECT
      id,
      occurred_at,
      table_name,
      op,
      row_pk,
      actor_id,
      agency_id,
      txid,
      correlation_id,
      old_row,
      new_row,
      row_hash,
      LAG(row_hash) OVER (
        PARTITION BY table_name, agency_id
        ORDER BY id
      ) AS expected_prev_hash
    FROM audit_log
    ORDER BY table_name, agency_id, id
  `)

  const broken: number[] = []

  for (const row of rows) {
    const typedRow = row as {
      id: bigint | string
      occurred_at: Date | string
      table_name: string
      op: string
      row_pk: string
      actor_id: string | null
      agency_id: string
      txid: bigint | string
      correlation_id: string | null
      old_row: unknown
      new_row: unknown
      row_hash: Buffer | string
      expected_prev_hash: Buffer | string | null
    }

    // Rebuild the canonical string matching the Postgres trigger's concat_ws logic
    const prevHashHex =
      typedRow.expected_prev_hash == null
        ? 'genesis'
        : Buffer.isBuffer(typedRow.expected_prev_hash)
          ? typedRow.expected_prev_hash.toString('hex')
          : Buffer.from(typedRow.expected_prev_hash as string, 'hex').toString('hex')

    const occurredAt =
      typedRow.occurred_at instanceof Date
        ? typedRow.occurred_at.toISOString()
        : String(typedRow.occurred_at)

    const canonical = [
      String(typedRow.id),
      occurredAt,
      typedRow.table_name,
      typedRow.op,
      typedRow.row_pk,
      typedRow.actor_id ?? '',
      typedRow.agency_id,
      String(typedRow.txid),
      typedRow.correlation_id ?? '',
      typedRow.old_row == null ? 'null' : JSON.stringify(typedRow.old_row),
      typedRow.new_row == null ? 'null' : JSON.stringify(typedRow.new_row),
      prevHashHex,
    ].join('|')

    const computed = createHash('sha256').update(canonical, 'utf8').digest()

    const storedHash = Buffer.isBuffer(typedRow.row_hash)
      ? typedRow.row_hash
      : Buffer.from(typedRow.row_hash as string, 'hex')

    if (!computed.equals(storedHash)) {
      broken.push(Number(typedRow.id))
    }
  }

  return { broken, total: rows.length }
}
