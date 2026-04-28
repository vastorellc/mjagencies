/**
 * packages/db/src/index.ts
 *
 * Main export barrel for @mjagency/db.
 *
 * Exports:
 *   - Connection helpers (from Plan 01-02)
 *   - Schema modules (Plan 02-01)
 *   - Drizzle client factory + transaction wrapper (Plan 02-01)
 *   - Vault namespace + top-level crypto (Plan 02-06)
 *   - Audit namespace (Plan 02-06)
 *
 * Consumers:
 *   - Applications: import { createAgencyDb, withAgencyContext } from '@mjagency/db'
 *   - Migration runner: import * as schema from '@mjagency/db' (via schema re-export)
 *   - Health checks: import { allAgencyConnections } from '@mjagency/db'
 *   - BullMQ queue wrapper: import { encryptVaultValue, decryptVaultValue } from '@mjagency/db'
 */

export type { AgencyConnection } from './connection.js'
export { agencyConnection, buildDatabaseUrl, allAgencyConnections } from './connection.js'
export * as schema from './schema/index.js'
export { createAgencyDb, withAgencyContext } from './client.js'
export type { AgencyDb } from './client.js'
// Plan 11-07: top-level re-exports for API route handlers (csp-report + rum endpoints
// in apps/web-*/src/app/api/) — keeps import path simple: `import { cspReports, webVitals } from '@mjagency/db'`.
export { cspReports } from './schema/csp-reports.js'
export { webVitals, webVitalsRlsSql } from './schema/web-vitals.js'
export * as migrate from './migrate/index.js'
// Vault namespace (Plan 02-06)
export * as vault from './vault/index.js'
// Top-level re-exports for BullMQ encrypted queue consumer (keeps import path simple)
export { encryptVaultValue, decryptVaultValue } from './vault/crypto.js'
// Audit namespace (Plan 02-06)
export * as audit from './audit/index.js'
// Seed framework namespace (Plan 02-04)
export * as seed from './seed/index.js'
