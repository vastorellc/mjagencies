/**
 * apps/web-healthcare/src/app/api/rum/route.ts
 *
 * Public POST endpoint receiving navigator.sendBeacon RUM events from WebVitalsReporter
 * (packages/ui/src/rum/web-vitals.tsx). Inserts to per-agency web_vitals table with RLS
 * enforced via app.agency_id session variable (Phase 2 pattern).
 *
 * Public/anonymous endpoint — no auth. Plan 11-06 will add Cloudflare rate limit (100/min/IP).
 *
 * Validation:
 *   - metric_name must be one of LCP, INP, CLS, FCP, TTFB (matches web_vitals CHECK constraint)
 *   - value must be a finite number
 *   - page_path must be a string ≤ 500 chars
 *
 * REQ-145 supplementary / Plan 11-07.
 */
export const runtime = 'nodejs' // postgres-js requires Node, not Edge

import 'server-only'
import { createAgencyDb, withAgencyContext, webVitals } from '@mjagency/db'

const AGENCY_SLUG = 'web-healthcare'
/** Per-app DB agency slug (matches packages/config AGENCIES). web-healthcare → 'brand'. */
const DB_AGENCY: 'brand' = 'brand'

interface RumPayload {
  metric_name: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB'
  value: number
  rating?: string | null
  navigation_type?: string | null
  page_path: string
}

const ALLOWED_METRICS = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB'])

export async function POST(req: Request): Promise<Response> {
  let payload: RumPayload
  try {
    payload = (await req.json()) as RumPayload
  } catch {
    return new Response(null, { status: 204 })
  }

  if (!payload || typeof payload !== 'object') {
    return new Response(null, { status: 204 })
  }
  if (!ALLOWED_METRICS.has(payload.metric_name)) {
    return new Response(null, { status: 204 })
  }
  if (typeof payload.value !== 'number' || !Number.isFinite(payload.value)) {
    return new Response(null, { status: 204 })
  }
  if (typeof payload.page_path !== 'string' || payload.page_path.length === 0 || payload.page_path.length > 500) {
    return new Response(null, { status: 204 })
  }

  try {
    const password = process.env['DB_APP_PASSWORD']
    const agencyId = process.env['NEXT_PUBLIC_AGENCY_ID'] ?? process.env['AGENCY_ID']
    if (!password || !agencyId) {
      // No DB / no agency context — silently drop (best-effort RUM sink).
      return new Response(null, { status: 204 })
    }
    const db = createAgencyDb(DB_AGENCY, password)
    // RLS: set app.agency_id session var so the policy applies on insert (transaction-local).
    await withAgencyContext(db, agencyId, async (tx) => {
      await tx.insert(webVitals).values({
        agencyId,
        pagePath: payload.page_path,
        metricName: payload.metric_name,
        value: payload.value,
        rating: payload.rating ?? null,
        navigationType: payload.navigation_type ?? null,
      })
    })
  } catch {
    // Never surface DB errors to the public endpoint — RUM is best-effort.
  }

  // Tag (suppress unused warning when tree-shaken)
  void AGENCY_SLUG

  return new Response(null, { status: 204 })
}
