/**
 * packages/analytics/src/clarity-delete.ts
 * REQ-141 + REQ-144 (D-03/D-05): Microsoft Clarity Delete API client.
 *
 * Used by Plan 11-05:
 *   1. CCPA opt-out fan-out worker — deletes any Clarity-tracked sessions for the user
 *   2. CCPA erasure worker — same Delete API call, plus hash-chain audit row
 *
 * The Delete API requires Clarity's INTERNAL user ID (Pitfall 2.1 from RESEARCH item 2).
 * That ID is captured client-side via Clarity.identify(sha256(email)) on session start
 * (see ClarityInit customId prop). Plan 11-05 stores the (email → clarityUserId) mapping
 * in the consent_log so the Delete API can be invoked server-side.
 *
 * Threat mitigation:
 *   T-11-02-03: Bearer token is server-only via getAgencySecret('CLARITY_API_TOKEN', agencyId).
 *   T-11-02-07: Delete requires bearer token + opaque clarityUserId (not email/PII).
 */
import { getAgencySecret } from '@mjagency/config'

const CLARITY_DELETE_ENDPOINT = 'https://www.clarity.ms/api/v3/delete'

export interface ClarityDeleteResult {
  ok: boolean
  status: number
  errorMessage?: string
}

/**
 * Calls the Microsoft Clarity Delete API for a given user's session data.
 *
 * @param agencyId - Agency slug (e.g., 'web-ecommerce') — used to look up per-agency token.
 * @param clarityUserId - Clarity's internal user ID captured via Clarity.identify().
 * @returns ok:true on 2xx; ok:false with status + errorMessage on validation/API error.
 *
 * @throws Error if CLARITY_API_TOKEN_${SLUG_UPPER} env var is missing (fail-fast — no silent fallback).
 */
export async function clarityDeleteUser(
  agencyId: string,
  clarityUserId: string,
): Promise<ClarityDeleteResult> {
  if (!clarityUserId || clarityUserId.length < 4) {
    return { ok: false, status: 400, errorMessage: 'Missing clarityUserId' }
  }

  // Throws if the per-agency token is not configured (T-11-02-03)
  const token = getAgencySecret('CLARITY_API_TOKEN', agencyId)

  const res = await fetch(CLARITY_DELETE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId: clarityUserId }),
  })

  if (!res.ok) {
    const errorMessage = await res.text().catch(() => '')
    return { ok: false, status: res.status, errorMessage }
  }

  return { ok: true, status: res.status }
}
