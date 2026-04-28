/**
 * packages/cms/src/admin-views/DashboardView.tsx
 *
 * REQ-143 — Surface 1 (per-agency) and Surface 2 (platform overview) Payload
 * custom admin view. D-13: registered via admin.components.views (Phase 5
 * pattern reuse).
 *
 * SECURITY:
 *   - CLAUDE.md rule 3 (Pitfall 4.4): requireSession() is the FIRST call. Payload
 *     custom admin views do NOT auto-authenticate — without this, any browser
 *     could load the view.
 *   - T-11-04-02: platform view is super_admin only; non-super_admin users
 *     attempting ?view=platform are redirected to the per-agency view.
 *   - T-11-04-03: per-agency view fetches metrics scoped to session.agencyId
 *     only; the data layer applies SET LOCAL app.agency_id RLS.
 *
 * NEXT.JS 15 (Pitfall 4.1):
 *   - searchParams is a Promise; `await searchParams` then read fields.
 *
 * SERVER RENDERING:
 *   - This view is a React Server Component — initial KPI grid paints via
 *     getDashboardMetrics. The DashboardPolling client child takes over
 *     refresh duties (60s polling per D-14).
 */
import 'server-only'
import type * as React from 'react'
import { redirect } from 'next/navigation'
import { requireSession } from '@mjagency/auth'
import {
  getDashboardMetrics,
  resolveAgencyDb,
  type AgencyTarget,
  type DashboardMetrics,
} from '@mjagency/analytics/dashboard'
import {
  DashboardTabs,
  DataSourcesFooter,
  DashboardPolling,
} from '@mjagency/ui/dashboard'
import type { AgencySlug } from '@mjagency/config'

/**
 * Comma-separated list of agency UUIDs the super_admin platform view rolls up.
 * Provided via env so deployment can flip the set without a code change.
 *
 * Format: "AGENCY_UUID:slug,AGENCY_UUID:slug" — slug is a packages/config
 * AGENCIES name and is required because the dashboard data layer needs the
 * Drizzle client built from createAgencyDb(slug, password).
 *
 * Example:
 *   PLATFORM_AGENCY_TARGETS="00000000-...-0001:ecommerce,00000000-...-0002:webdev"
 */
function getPlatformTargets(): AgencyTarget[] {
  const env = process.env['PLATFORM_AGENCY_TARGETS']
  if (!env) return []
  const password = process.env['DB_APP_PASSWORD']
  return env
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry): AgencyTarget | null => {
      const [agencyId, slugRaw, label] = entry.split(':')
      if (!agencyId || !slugRaw) return null
      const slug = slugRaw as AgencySlug
      if (!password) {
        return { agencyId, label: label ?? slugRaw }
      }
      const ctx = resolveAgencyDbForSlug(slug, agencyId, password)
      return { agencyId, dbContext: ctx ?? undefined, label: label ?? slugRaw }
    })
    .filter((t): t is AgencyTarget => t !== null)
}

/** Build a per-agency DB context against an explicit slug + agencyId. */
function resolveAgencyDbForSlug(slug: AgencySlug, agencyId: string, _password: string) {
  // Reuse the public helper — but we already have agencyId in hand, so we
  // override the env-derived value. We still rely on resolveAgencyDb for
  // password + db client construction; the helper returns null if password
  // is missing.
  const ctx = resolveAgencyDb(slug)
  if (!ctx) return null
  return { db: ctx.db, agencyId }
}

interface DashboardViewProps {
  searchParams?: Promise<{ view?: string }>
}

export default async function DashboardView(
  props: DashboardViewProps,
): Promise<React.ReactElement> {
  // CLAUDE.md §3 + Pitfall 4.4: requireSession FIRST. Throws via redirect()
  // for unauthenticated requests (handled by Next.js).
  const session = await requireSession()

  const params = (await props.searchParams) ?? {}
  const isPlatformRequested = params.view === 'platform'

  // T-11-04-02: only super_admin may view the platform rollup.
  if (isPlatformRequested && session.role !== 'super_admin') {
    redirect('/admin/dashboard')
  }

  const isPlatform = isPlatformRequested && session.role === 'super_admin'

  const targets: AgencyTarget[] = isPlatform
    ? getPlatformTargets()
    : [buildPerAgencyTarget(session.agencyId)]

  const initialMetrics: DashboardMetrics = await getDashboardMetrics(targets)

  return (
    <main className="dashboard-page" aria-label="Analytics dashboard">
      <header className="dashboard-page__header">
        <h1 className="dashboard-page__title">
          {isPlatform ? 'Platform overview' : 'Dashboard'}
        </h1>
      </header>

      <DashboardTabs
        active={isPlatform ? 'platform' : 'agency'}
        canSeeAll={session.role === 'super_admin'}
      />

      <DashboardPolling
        initial={initialMetrics}
        viewMode={isPlatform ? 'platform' : 'agency'}
      />

      <DataSourcesFooter />
    </main>
  )
}

/**
 * Build a per-agency target from the current session. The slug is read from
 * AGENCY_SLUG env (per-app), and the DB context is created from
 * NEXT_PUBLIC_AGENCY_ID + DB_APP_PASSWORD.
 */
function buildPerAgencyTarget(agencyId: string): AgencyTarget {
  const slug = process.env['AGENCY_SLUG'] as AgencySlug | undefined
  if (!slug) {
    return { agencyId }
  }
  const ctx = resolveAgencyDb(slug)
  if (!ctx) {
    return { agencyId }
  }
  // Override agencyId with session's value so RLS uses the authenticated subject,
  // not the server's process env (defence-in-depth — env could drift).
  return { agencyId, dbContext: { db: ctx.db, agencyId } }
}
