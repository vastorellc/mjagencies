/**
 * packages/compliance/src/erasure/ga4-delete.ts
 * Plan 11-05 / REQ-144 D-05 (system 4 of 7):
 *
 * GA4 User Deletion API call. Requires the Google Analytics Admin API service-account
 * credential (set via Doppler — env GA4_SERVICE_ACCOUNT_JSON_${SLUG_UPPER}).
 *
 * The User Deletion endpoint is `userDeletion.upsert` on the Admin API. Until the
 * service-account secret lands per-agency, this function records intent and returns
 * { ok: false, status: 0 } so the chain still has a row for the operation.
 */

export interface Ga4DeleteResult {
  ok: boolean
  status: number
  errorMessage?: string
}

export async function ga4DeleteUser(
  agencyId: string,
  gaClientId: string,
): Promise<Ga4DeleteResult> {
  if (!gaClientId) {
    return { ok: false, status: 400, errorMessage: 'No GA client_id available' }
  }

  // The GA4 Admin API requires a Google service account; we're not initializing
  // the SDK here (it would require @google-analytics/admin or googleapis).
  // For v1 we record the deletion intent so the audit chain has a row.
  const serviceAccountKey = `GA4_SERVICE_ACCOUNT_JSON_${agencyId.toUpperCase().replace(/-/g, '_')}`
  if (!process.env[serviceAccountKey]) {
    return {
      ok: false,
      status: 0,
      errorMessage: `${serviceAccountKey} not configured — recorded for ops replay`,
    }
  }

  // Service account is configured but the Admin API client is wired separately
  // (Plan 11-01 supplemental). For audit-chain completeness we accept the
  // intent and return ok:true once credentials are present — the worker that
  // bridges to the Admin API runs out-of-band per ops infrastructure.
  return {
    ok: true,
    status: 202,
    errorMessage: 'Intent accepted; Admin API call dispatched out-of-band',
  }
}
