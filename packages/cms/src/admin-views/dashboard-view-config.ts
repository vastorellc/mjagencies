/**
 * packages/cms/src/admin-views/dashboard-view-config.ts
 *
 * Plan 11-04 — registers the Surface 1 + Surface 2 dashboard as a custom
 * Payload admin view at /admin/dashboard (D-13). Wired into Payload via
 * admin.components.views in build-payload-config.ts.
 *
 * The Component path is resolved by Payload's importMap (importMap.baseDir is
 * set to the calling app's dirname in build-payload-config). We use the
 * '@mjagency/cms/admin-views/DashboardView' module specifier so the view is
 * served from the cms package — same pattern as Plan 05's SeoPanel.
 */
import type { AdminViewConfig } from 'payload'

export const dashboardView: AdminViewConfig = {
  Component: '@mjagency/cms/admin-views/DashboardView#default',
  path: '/dashboard',
  exact: true,
}
