/**
 * packages/db/src/index.ts
 *
 * Main export barrel for @mjagency/db.
 *
 * Exports:
 *   - Connection helpers (from Plan 01-02)
 *   - Schema modules (Plan 02-01)
 *   - Drizzle client factory + transaction wrapper (Plan 02-01)
 *
 * Consumers:
 *   - Applications: import { createAgencyDb, withAgencyContext } from '@mjagency/db'
 *   - Migration runner: import * as schema from '@mjagency/db' (via schema re-export)
 *   - Health checks: import { allAgencyConnections } from '@mjagency/db'
 */

export type { AgencyConnection } from './connection.js'
export { agencyConnection, buildDatabaseUrl, allAgencyConnections } from './connection.js'
export * as schema from './schema/index.js'
export { createAgencyDb, withAgencyContext } from './client.js'
export type { AgencyDb } from './client.js'
export * as migrate from './migrate/index.js'
