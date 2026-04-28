/**
 * packages/db/src/schema/index.ts
 *
 * Barrel re-export of every schema module.
 * Single import point for the migration runner + application code.
 *
 * Import pattern:
 *   import * as schema from '@mjagency/db/schema'  — for drizzle({ schema })
 *   import { users, sessions, ... } from '@mjagency/db'  — for query builders
 */

export * from './base.js'
export * from './agencies.js'
export * from './users.js'
export * from './sessions.js'
export * from './permissions-vault.js'
export * from './audit-log.js'
export * from './seed-state.js'
export * from './mfa-config.js'
export { crmContacts, crmAccounts, crmDeals, crmActivities, crmTasks, crmRlsSql } from './crm.js'
export { proposals, proposalViews, proposalsRlsSql } from './proposals.js'
export { invoices, invoicesRlsSql } from './invoices.js'
export { esignRecords, esignRlsSql } from './esign.js'
export { cspReports } from './csp-reports.js'
export { webVitals, webVitalsRlsSql } from './web-vitals.js'
export { ccpaErasureRecords, ccpaErasureRecordsRlsSql } from './ccpa-erasure-records.js'
export { consentLog, consentLogRlsSql } from './consent-log.js'
