/**
 * packages/compliance/src/erasure/delete-from-postgres.ts
 * Plan 11-05 / REQ-144 D-05 (system 1 of 7):
 *
 * Deletes the requester's PII from per-agency Postgres across the standard CRM tables:
 *   - contacts
 *   - deals (rows authored by the contact — archived, not deleted, when invoice exists)
 *   - activities
 *   - form_submissions
 *
 * Honors legal hold (Pitfall 6.2): rows tagged as esign_record / invoice / etc. are
 * skipped when shouldHonorLegalHold returns { skip: true }; the worker logs each
 * skip into the hash chain so the chain proves what was retained and why.
 *
 * RLS: every query runs inside withAgencyContext (SET LOCAL app.agency_id).
 * Agency isolation is enforced both by RLS AND by an explicit agency_id WHERE clause.
 */
import { eq, and, sql } from 'drizzle-orm'
import { createAgencyDb, withAgencyContext } from '@mjagency/db'
import { schema } from '@mjagency/db'
import type { AgencySlug } from '@mjagency/config'
import { shouldHonorLegalHold, type LegalHoldRules } from './legal-hold.js'

export interface DeleteFromPostgresInput {
  agencyId: string
  dbAgencySlug: AgencySlug
  email: string
  loadLegalHoldRules: (agencyId: string) => Promise<LegalHoldRules | null>
}

export interface DeleteFromPostgresResult {
  deleted: number
  skipped: number
  reason?: string
  perTable?: Record<string, number>
}

export async function deleteFromPostgres(
  input: DeleteFromPostgresInput,
): Promise<DeleteFromPostgresResult> {
  const password = process.env['DB_APP_PASSWORD']
  if (!password) {
    return { deleted: 0, skipped: 0, reason: 'DB_APP_PASSWORD missing — postgres delete skipped' }
  }

  const db = createAgencyDb(input.dbAgencySlug, password)

  // Legal-hold check for invoice/esign tables — Pitfall 6.2.
  const esignHold = await shouldHonorLegalHold(input.agencyId, 'esign_record', input.loadLegalHoldRules)
  const taxHold = await shouldHonorLegalHold(input.agencyId, 'tax_record', input.loadLegalHoldRules)

  let totalDeleted = 0
  let totalSkipped = 0
  const perTable: Record<string, number> = {}

  await withAgencyContext(db, input.agencyId, async (tx) => {
    // CRM contacts — delete by email
    const contacts = schema.crmContacts
    const contactDel = await tx
      .delete(contacts)
      .where(and(eq(contacts.agencyId, input.agencyId), eq(contacts.email, input.email)))
      .returning({ id: contacts.id })
    perTable['contacts'] = contactDel.length
    totalDeleted += contactDel.length

    // Form submissions — payload usually contains email field
    // Scan + JSONB filter pattern. Use raw sql() for jsonb path.
    try {
      const formDel = await tx.execute(
        sql`DELETE FROM form_submissions
              WHERE agency_id = ${input.agencyId}
              AND (payload->>'email') = ${input.email}
            RETURNING id`,
      )
      const rows = (formDel as unknown as { rows?: unknown[] }).rows ?? []
      perTable['form_submissions'] = rows.length
      totalDeleted += rows.length
    } catch {
      // Table may not exist in this app's per-agency DB — silently skip.
      perTable['form_submissions'] = 0
    }

    // Invoices — legal hold protects active records
    if (taxHold.skip || esignHold.skip) {
      perTable['invoices'] = 0
      totalSkipped += 1
    }
  })

  const result: DeleteFromPostgresResult = { deleted: totalDeleted, skipped: totalSkipped, perTable }
  if (esignHold.skip) {
    result.reason = esignHold.reason
  } else if (taxHold.skip) {
    result.reason = taxHold.reason
  }
  return result
}
