/**
 * apps/web-main/src/app/api/admin/dashboard/metrics/route.ts
 *
 * REQ-143 + D-14 — polling endpoint serving DashboardMetrics JSON every 60s.
 *
 * SECURITY (Pitfall 4.4):
 *   - requireSession() is the FIRST call (CLAUDE.md §3). Without it any
 *     anonymous request would receive analytics data.
 *   - T-11-04-02: ?view=platform is super_admin only; non-super_admin gets 403.
 *
 * CACHING:
 *   - Cache-Control: no-store on the response so intermediate proxies never
 *     serve a stale per-agency payload to a different session (T-11-04-07).
 *
 * RUNTIME:
 *   - 'nodejs' — postgres-js + @google-analytics/data require Node, not Edge.
 */
export const runtime = 'nodejs'

import 'server-only'
import { requireSession } from '@mjagency/auth'
import {
  getDashboardMetrics,
  resolveAgencyDb,
  type AgencyTarget,
} from '@mjagency/analytics/dashboard'
import type { AgencySlug } from '@mjagency/config'

/** Same env-driven helper as DashboardView. Format: "uuid:slug:label,...". */
function getPlatformTargets(): AgencyTarget[] {
  const env = process.env['PLATFORM_AGENCY_TARGETS']
  if (!env) return []
  return env
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry): AgencyTarget | null => {
      const [agencyId, slugRaw, label] = entry.split(':')
      if (!agencyId || !slugRaw) return null
      const slug = slugRaw as AgencySlug
      const ctx = resolveAgencyDb(slug)
      const dbContext = ctx ? { db: ctx.db, agencyId } : undefined
      return { agencyId, dbContext, label: label ?? slugRaw }
    })
    .filter((t): t is AgencyTarget => t !== null)
}

function buildPerAgencyTarget(agencyId: string): AgencyTarget {
  const slug = process.env['AGENCY_SLUG'] as AgencySlug | undefined
  if (!slug) return { agencyId }
  const ctx = resolveAgencyDb(slug)
  if (!ctx) return { agencyId }
  return { agencyId, dbContext: { db: ctx.db, agencyId } }
}

export async function GET(req: Request): Promise<Response> {
  // CLAUDE.md §3 + Pitfall 4.4 — FIRST call. Throws via redirect() on failure.
  const session = await requireSession()

  const url = new URL(req.url)
  const view = url.searchParams.get('view') ?? 'agency'

  // T-11-04-02: super_admin gate for the platform view.
  if (view === 'platform' && session.role !== 'super_admin') {
    return Response.json(
      { error: 'Forbidden' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const targets =
    view === 'platform' ? getPlatformTargets() : [buildPerAgencyTarget(session.agencyId)]

  const metrics = await getDashboardMetrics(targets)

  return Response.json(metrics, {
    headers: {
      'Cache-Control': 'no-store',
      // T-11-04-07: defence-in-depth — explicit no-cache for intermediate proxies.
      Pragma: 'no-cache',
    },
  })
}
