/**
 * packages/compliance/src/erasure/legal-hold.ts
 * Plan 11-05 / REQ-144 / Pitfall 6.2:
 *
 * Decides whether a deletion of a particular data class for a given agency must be
 * skipped because it falls under a regulated retention regime (HIPAA, ESIGN Act,
 * tax law). Each agency carries a legal_hold_rules JSON field on its Payload row;
 * this module reads it via Payload local API.
 *
 * Defaults (when agency row has no rules):
 *   - esign_record    → 7 years (ESIGN Act default — overridable per agency)
 *   - medical_record  → no default (must opt in via hipaa_required: true)
 *   - tax_record      → no default
 *
 * Returns { skip: true, reason: '...' } when the deletion must be deferred.
 * Worker logs and writes an audit row with `{ skipped: 1, reason }` so the chain
 * still proves the operation was acknowledged.
 */

export interface LegalHoldRules {
  /** Years to retain ESIGN Act records. Default 7 if undefined. */
  esign_retention_years?: number
  /** Whether HIPAA-controlled medical records must be retained for the regulated period. */
  hipaa_required?: boolean
  /** Years to retain tax records (typically 7 federal + state-specific). */
  tax_retention_years?: number
}

export type LegalHoldDataClass =
  | 'esign_record'
  | 'invoice'
  | 'medical_record'
  | 'tax_record'
  | 'contact'
  | 'deal'
  | 'activity'
  | 'form_submission'
  | string

export interface LegalHoldDecision {
  skip: boolean
  reason?: string
}

/**
 * Decides if `dataClass` for `agencyId` must be retained under legal hold.
 *
 * Implementation note: this function reads the per-agency rules from a callback
 * the worker provides (so we don't take a hard dependency on Payload bootstrap
 * within this package — the worker already has a Payload client).
 */
export async function shouldHonorLegalHold(
  agencyId: string,
  dataClass: LegalHoldDataClass,
  loadRules: (agencyId: string) => Promise<LegalHoldRules | null>,
): Promise<LegalHoldDecision> {
  const rules = (await loadRules(agencyId)) ?? {}

  if (dataClass === 'esign_record') {
    const years = rules.esign_retention_years ?? 7
    if (years > 0) {
      return { skip: true, reason: `ESIGN Act ${years}-year retention` }
    }
  }
  if (dataClass === 'medical_record' && rules.hipaa_required) {
    return { skip: true, reason: 'HIPAA retention requirement' }
  }
  if (dataClass === 'tax_record') {
    const years = rules.tax_retention_years ?? 0
    if (years > 0) {
      return { skip: true, reason: `Tax record ${years}-year retention` }
    }
  }
  return { skip: false }
}
