/**
 * packages/meta-capi/src/meta-capi.ts
 *
 * REQ-142: Meta Conversions API direct fetch client.
 *
 * D-10 (Phase 11 decision): server-side ONLY.
 *   No browser pixel. CSP allowlist (packages/auth/src/middleware.ts +
 *   packages/auth/src/security-headers.ts) intentionally OMITS facebook.com
 *   and connect.facebook.net. All Meta tracking flows through this module.
 *
 * Why direct fetch (not facebook-nodejs-business-sdk):
 *   - SDK is ~3MB and bundles AWS Lambda transports we do not use.
 *   - SDK is incompatible with Next.js Edge runtime (uses Node APIs unconditionally).
 *   - Meta CAPI is a single REST endpoint — fetch is sufficient and audit-friendly.
 *
 * Pitfalls mitigated (RESEARCH §3, threat register T-11-03-01..10):
 *   3.2 — Phone normalization: E.164 without `+` prefix, US country code 1.
 *         '14155551234' (NOT '+14155551234' or '4155551234').
 *   3.3 — event_time MUST be Unix seconds, not milliseconds. Off-by-1000× rejected by Meta.
 *   3.4 — test_event_code only sent when env var present (dev/staging). Production env never sets it.
 *   3.5 — At least one of (em, ph, ip+ua, external_id) is required. Throws otherwise.
 *
 * PII handling:
 *   user_data.em / user_data.ph are SHA-256 hashed before send per Meta spec.
 *   redactPii() is applied to non-identifier fields (custom_data) as defense in depth
 *   (Phase 7 PII discipline).
 */

import { createHash } from 'node:crypto'
import { redactPii } from '@mjagency/ai'
import { getAgencySecret, getAgencySecretOptional } from './per-agency-env.js'

export interface CapiUserData {
  /** Plain email — will be SHA-256 hashed (lowercase + trim) before send */
  em?: string
  /** Plain phone — will be normalized to '1XXXXXXXXXX' then SHA-256 hashed */
  ph?: string
  /** Client IP (e.g. CF-Connecting-IP). Sent unhashed per Meta spec. */
  client_ip_address?: string
  /** Browser User-Agent. Sent unhashed per Meta spec. */
  client_user_agent?: string
  /** Stable per-user identifier (e.g. agency CRM contact id). Hashed before send. */
  external_id?: string
}

export interface CapiEvent {
  event_name: 'Lead' | 'Purchase' | 'CompleteRegistration' | 'Subscribe' | 'DeleteUser' | string
  /** Per-call dedup id. Generated when omitted. Doubles as BullMQ jobId. */
  event_id?: string
  /** Unix SECONDS (not ms). Defaults to now. Pitfall 3.3. */
  event_time?: number
  /** Raw inputs; em/ph/external_id hashed inside sendCapiEvent */
  user_data: CapiUserData
  /** Free-form custom data (value, currency, content_name, etc.) */
  custom_data?: Record<string, unknown>
}

// Endpoint: https://graph.facebook.com/v22.0/{pixel_id}/events
// Pinned API version. Bumping requires re-validation of the request schema.
const META_GRAPH_API_VERSION = 'v22.0'

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function normalizeEmail(email: string): string {
  return sha256Hex(email.trim().toLowerCase())
}

function normalizePhone(phone: string): string {
  // Pitfall 3.2 — strip all non-digits, drop leading US country code 1, prepend 1, hash.
  // Result is the SHA-256 of '1XXXXXXXXXX' (E.164 without the '+' prefix).
  const digits = phone.replace(/\D/g, '').replace(/^1/, '')
  return sha256Hex('1' + digits)
}

function normalizeExternalId(externalId: string): string {
  // Meta accepts hashed external_id — apply same SHA-256 normalization for consistency.
  return sha256Hex(externalId.trim().toLowerCase())
}

/**
 * Redacts any PII inadvertently placed in custom_data (defense in depth).
 *
 * user_data.em/ph are already SHA-256 hashed by this function, but custom_data
 * is free-form. If a caller stuffs a raw email into custom_data.note, redactPii()
 * tokenizes it before we send to Meta.
 */
function redactCustomData(custom?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!custom) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(custom)) {
    if (typeof v === 'string') {
      out[k] = redactPii(v).redacted
    } else {
      out[k] = v
    }
  }
  return out
}

/**
 * Posts a single Meta Conversions API event.
 *
 * Throws on:
 *   - Missing per-agency env (META_PIXEL_ID_${SLUG_UPPER} or META_ACCESS_TOKEN_${SLUG_UPPER})
 *   - Missing user identifier (Pitfall 3.5)
 *   - Non-2xx response from graph.facebook.com
 */
export async function sendCapiEvent(agencyId: string, event: CapiEvent): Promise<void> {
  const pixelId = getAgencySecret('META_PIXEL_ID', agencyId)
  const accessToken = getAgencySecret('META_ACCESS_TOKEN', agencyId)
  const testEventCode = getAgencySecretOptional('META_TEST_EVENT_CODE', agencyId)

  // Hash user_data per Meta normalization spec.
  const hashed: CapiUserData = {}
  if (event.user_data.em) hashed.em = normalizeEmail(event.user_data.em)
  if (event.user_data.ph) hashed.ph = normalizePhone(event.user_data.ph)
  if (event.user_data.external_id) hashed.external_id = normalizeExternalId(event.user_data.external_id)
  if (event.user_data.client_ip_address) hashed.client_ip_address = event.user_data.client_ip_address
  if (event.user_data.client_user_agent) hashed.client_user_agent = event.user_data.client_user_agent

  // Pitfall 3.5: at least one identifier required.
  const hasIpAndUa = Boolean(hashed.client_ip_address && hashed.client_user_agent)
  if (!hashed.em && !hashed.ph && !hashed.external_id && !hasIpAndUa) {
    throw new Error('CAPI event requires at least one of: em, ph, ip+ua, external_id')
  }

  const customData = redactCustomData(event.custom_data)

  const body = {
    data: [
      {
        event_name: event.event_name,
        // Pitfall 3.3 — Unix SECONDS, not milliseconds.
        event_time: event.event_time ?? Math.floor(Date.now() / 1000),
        // Each event gets a UUID. Meta dedups against any matching event_id within 7 days.
        event_id: event.event_id ?? crypto.randomUUID(),
        action_source: 'website' as const,
        user_data: hashed,
        ...(customData && { custom_data: customData }),
      },
    ],
    access_token: accessToken,
    // Pitfall 3.4 — only included when env var present. Production never sets the var.
    ...(testEventCode && { test_event_code: testEventCode }),
  }

  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${pixelId}/events`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    // Do NOT echo the access_token (in body) back into the error — only safe details.
    throw new Error(`Meta CAPI failed ${res.status}: ${text.slice(0, 500)}`)
  }
}
