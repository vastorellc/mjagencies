/**
 * packages/cms/src/admin-views/qa-report-view-config.ts
 *
 * Plan 12-01 — registers the QA Report matrix as a custom Payload admin view
 * at /admin/qa-report (REQ-150, REQ-151, REQ-157). Wired into Payload via
 * admin.components.views in build-payload-config.ts.
 *
 * The Component path is resolved by Payload's importMap (importMap.baseDir is
 * set to the calling app's dirname in build-payload-config). We use the
 * '@mjagency/cms/admin-views/QaReportView' module specifier so the view is
 * served from the cms package — same pattern as Plan 11-04 DashboardView and
 * Plan 12-07 BrandSetupView.
 */
import type { AdminViewConfig } from 'payload'

export const qaReportView: AdminViewConfig = {
  Component: '@mjagency/cms/admin-views/QaReportView#default',
  path: '/qa-report',
  exact: true,
}
