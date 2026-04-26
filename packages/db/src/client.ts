/**
 * packages/db/src/client.ts
 *
 * Drizzle client factory + transaction wrapper for per-agency databases.
 *
 * CRITICAL PATTERNS:
 *
 * 1. prepare: false (pitfall 3.3)
 *    PgBouncer transaction mode does not support server-side prepared statements.
 *    Without prepare:false, Drizzle sends PREPARE/EXECUTE across different physical
 *    connections in the pool, causing "prepared statement does not exist" errors.
 *    Reference: pganalyze.com/blog/prepared-transactions-pgbouncer
 *
 * 2. withAgencyContext — SET LOCAL via set_config (pitfall 8.1)
 *    PgBouncer in transaction mode reuses physical connections across transactions.
 *    Session-level SET app.agency_id leaks to the NEXT transaction on the same
 *    physical connection. The fix is set_config('app.agency_id', id, true) where
 *    the third parameter true = SET LOCAL (reverted at transaction end).
 *    NEVER use: await db.execute(sql`SET app.agency_id = ${agencyId}`)
 *    ALWAYS use: withAgencyContext(db, agencyId, async (tx) => { ... })
 *
 * 3. db.transaction wrapper (pitfall 8.3)
 *    withAgencyContext wraps the callback in db.transaction() so:
 *    a) set_config is always transaction-scoped (not session-scoped)
 *    b) the caller's operations are atomic with the context-setting step
 *    c) no gap between set_config and the first query
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import { buildDatabaseUrl } from './connection.js'
import type { AGENCIES } from '@mjagency/config'

/**
 * Creates a Drizzle database client for a specific agency.
 *
 * Always uses PgBouncer port by default.
 * Migrations use a separate client constructed with the direct Postgres port
 * (see Plan 02-03 migration runner — bypasses PgBouncer for DDL).
 */
export function createAgencyDb(slug: (typeof AGENCIES)[number], password: string) {
  const url = buildDatabaseUrl(slug, password)
  const client = postgres(url, {
    prepare: false, // pitfall 3.3 carry-over — PgBouncer tx mode requires this
    max: 10, // per-agency connection ceiling; PgBouncer default_pool_size=20 is the real cap
  })
  return drizzle({ client })
}

export type AgencyDb = ReturnType<typeof createAgencyDb>

/**
 * Wraps a callback in a Postgres transaction with transaction-local RLS context.
 *
 * This is the ONLY approved path for running agency-scoped queries.
 * See CLAUDE.md §8 (Agency Isolation) and RESEARCH §1.3.
 *
 * The set_config third parameter `true` means SET LOCAL — the setting is
 * automatically reverted when the transaction ends, preventing cross-tenant
 * data leakage via stale session state on PgBouncer-multiplexed connections.
 *
 * Usage:
 *   const rows = await withAgencyContext(db, agencyId, async (tx) => {
 *     return tx.select().from(users)
 *   })
 */
export async function withAgencyContext<T>(
  db: AgencyDb,
  agencyId: string,
  callback: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // set_config(setting_name, new_value, is_local)
    // is_local=true => SET LOCAL (reverted at transaction end — pitfall 8.1 mitigation)
    await tx.execute(sql`SELECT set_config('app.agency_id', ${agencyId}, true)`)
    return callback(tx)
  })
}
