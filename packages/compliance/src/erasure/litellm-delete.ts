/**
 * packages/compliance/src/erasure/litellm-delete.ts
 * Plan 11-05 / REQ-144 D-05 (system 7 of 7):
 *
 * Purges LiteLLM call logs (Phase 7) for the given email. LiteLLM stores call
 * metadata keyed by user-id metadata. We call the `/user/delete` admin endpoint
 * with bearer auth.
 *
 * If LITELLM_BASE_URL or LITELLM_ADMIN_TOKEN is missing in the environment the
 * call is best-effort skipped (records intent for audit chain).
 */

export interface LitellmDeleteResult {
  ok: boolean
  status: number
  errorMessage?: string
}

export async function litellmDeleteCalls(
  _agencyId: string,
  email: string,
): Promise<LitellmDeleteResult> {
  const baseUrl = process.env['LITELLM_BASE_URL']
  const adminToken = process.env['LITELLM_ADMIN_TOKEN']

  if (!baseUrl || !adminToken) {
    return {
      ok: false,
      status: 0,
      errorMessage: 'LITELLM_BASE_URL / LITELLM_ADMIN_TOKEN missing — intent recorded',
    }
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/user/delete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: email }),
    })
    if (!res.ok) {
      const errorMessage = await res.text().catch(() => '')
      return { ok: false, status: res.status, errorMessage }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      errorMessage: err instanceof Error ? err.message : 'Unknown LiteLLM delete error',
    }
  }
}
