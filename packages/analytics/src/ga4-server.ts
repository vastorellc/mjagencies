/**
 * packages/analytics/src/ga4-server.ts
 * REQ-140: server-side GA4 events via Measurement Protocol.
 * Used by Plan 11-05 (CCPA opt-out fires GA4 User Deletion via this path).
 *
 * Pitfall 1.4 mitigated: event_name regex + client_id presence checks BEFORE send.
 * Measurement Protocol returns 204 even on bad payloads — we validate up-front.
 *
 * Per-agency env vars (server-only — getAgencySecret throws if missing):
 *   GA4_API_SECRET_${SLUG_UPPER}     (server-only api_secret)
 *   GA4_PROPERTY_ID_${SLUG_UPPER}    (numeric property id)
 *
 * Per-agency public env var (browser-exposed by design):
 *   NEXT_PUBLIC_GA4_MEASUREMENT_ID_${SLUG_UPPER}  (e.g., G-ECOM12345)
 *   NEXT_PUBLIC_GA4_MEASUREMENT_ID                (fallback)
 */
import { getAgencySecret, normalizeSlug } from '@mjagency/config'

const EVENT_NAME_RE = /^[a-z][a-z0-9_]{0,39}$/

export interface GA4ServerEventInput {
  eventName: string
  /** Anonymous UUID derived from session (NEVER pass real user id). */
  clientId: string
  params?: Record<string, string | number | boolean>
}

/**
 * Sends a server-side event to GA4 via the Measurement Protocol.
 *
 * @throws Error on validation failure (Pitfall 1.4 — fail loudly, MP silently drops bad events)
 * @throws Error on missing per-agency env vars (fail-fast, no silent fallback)
 * @throws Error on non-2xx response from google-analytics.com/mp/collect
 */
export async function sendServerEvent(
  agencyId: string,
  input: GA4ServerEventInput,
): Promise<void> {
  // Pitfall 1.4: validate event_name + client_id BEFORE network call
  if (!EVENT_NAME_RE.test(input.eventName)) {
    throw new Error(`Invalid event_name: ${input.eventName} (must match [a-z_]{1,40})`)
  }
  if (!input.clientId || input.clientId.length < 8) {
    throw new Error('Missing client_id for Measurement Protocol event')
  }

  const slugUpper = normalizeSlug(agencyId)
  const measurementId =
    process.env[`NEXT_PUBLIC_GA4_MEASUREMENT_ID_${slugUpper}`] ??
    process.env['NEXT_PUBLIC_GA4_MEASUREMENT_ID']
  if (!measurementId) {
    throw new Error(`Missing NEXT_PUBLIC_GA4_MEASUREMENT_ID for ${agencyId}`)
  }
  const apiSecret = getAgencySecret('GA4_API_SECRET', agencyId)

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`
  const body = {
    client_id: input.clientId,
    events: [{ name: input.eventName, params: input.params ?? {} }],
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  // Pitfall 1.4: MP returns 204 even on bad payloads; only non-2xx is a true failure.
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GA4 Measurement Protocol failed ${res.status}: ${text}`)
  }
}
