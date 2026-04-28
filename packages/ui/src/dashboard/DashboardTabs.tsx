import type * as React from 'react'
/**
 * packages/ui/src/dashboard/DashboardTabs.tsx
 *
 * Surface 1 / Surface 2 switcher. Renders two anchor tabs:
 *   - "My agency"  → /admin/dashboard
 *   - "All agencies" → /admin/dashboard?view=platform   (super_admin only)
 *
 * a11y: aria-selected reflects the active view; the tab list uses role="tablist".
 */

export interface DashboardTabsProps {
  active: 'agency' | 'platform'
  /** When true, the platform tab is shown (super_admin only). */
  canSeeAll: boolean
}

export function DashboardTabs({ active, canSeeAll }: DashboardTabsProps): React.ReactElement {
  return (
    <nav className="dashboard-tabs" role="tablist" aria-label="Dashboard view">
      <a
        href="/admin/dashboard"
        role="tab"
        aria-selected={active === 'agency'}
        className="dashboard-tab"
      >
        My agency
      </a>
      {canSeeAll ? (
        <a
          href="/admin/dashboard?view=platform"
          role="tab"
          aria-selected={active === 'platform'}
          className="dashboard-tab"
        >
          All agencies
        </a>
      ) : null}
    </nav>
  )
}
