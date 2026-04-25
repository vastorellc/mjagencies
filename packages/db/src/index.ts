/**
 * @mjagency/db — Database access layer for the MJAgency multi-tenant platform.
 *
 * At M001 this package exports:
 *   - Connection-string helpers (agencyConnection, buildDatabaseUrl, allAgencyConnections)
 *   - Agency → port → role mapping for all 12 agency databases
 *
 * The Drizzle ORM wrapper, schema definitions, RLS hooks, and trace_id query-comment
 * middleware land in M002 (Phase 2). See README.md for the full roadmap and the
 * CRITICAL prepared-statement pitfall warning.
 */

export type { AgencyConnection } from './connection.js'
export { agencyConnection, buildDatabaseUrl, allAgencyConnections } from './connection.js'
