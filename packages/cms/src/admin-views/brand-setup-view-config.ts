/**
 * packages/cms/src/admin-views/brand-setup-view-config.ts
 *
 * Plan 12-07 — registers the Brand Setup Wizard as a custom Payload admin view
 * at /admin/brand-setup. Wired into Payload via admin.components.views in
 * build-payload-config.ts.
 *
 * The Component path is resolved by Payload's importMap (importMap.baseDir is
 * set to the calling app's dirname in build-payload-config). Uses the
 * '@mjagency/cms/admin-views/BrandSetupView' module specifier consistent with
 * the DashboardView pattern established in Plan 11-04.
 */
import type { AdminViewConfig } from 'payload'

export const brandSetupView: AdminViewConfig = {
  Component: '@mjagency/cms/admin-views/BrandSetupView#default',
  path: '/brand-setup',
  exact: true,
}
