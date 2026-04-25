/**
 * packages/db/src/connection.ts
 *
 * Typed helpers that map agency slugs to PgBouncer connection parameters.
 * Consumed by every agency app's environment bootstrap and by M002+ migration runner.
 *
 * Design:
 *   - Source of truth for the slug → port → role → dbName mapping.
 *   - Mirrors the PgBouncer .ini port assignments in infra/pgbouncer/.
 *   - Passwords are NEVER stored here — sourced from Doppler at runtime (Plan 01-06).
 *
 * PgBouncer port layout (D-05, RESEARCH §2.4):
 *   brand=6432, ecommerce=6433, growth=6434, webdev=6435, ai=6436,
 *   branding=6437, strategy=6438, finance=6439, engineering=6440,
 *   product=6441, video=6442, graphic=6443
 *   Port 6444 reserved for M002 platform-shared admin connection.
 *
 * Transaction-mode pitfall (pitfall 3.3):
 *   PgBouncer runs in transaction mode with pool_size=20 and max_prepared_statements=100.
 *   The Drizzle wrapper (M002) must set prepare=false OR rely on PgBouncer 1.21+
 *   protocol-level prepared statement tracking. See packages/db/README.md for details.
 */

import { AGENCIES } from '@mjagency/config'

/** Base PgBouncer port — brand=6432, ecommerce=6433, ..., graphic=6443 */
const PGBOUNCER_PORT_BASE = 6432

/**
 * Connection metadata for a single agency's PgBouncer pool.
 * Passwords are intentionally absent — source from Doppler at runtime.
 */
export interface AgencyConnection {
  /** Agency slug, e.g. 'ecommerce' */
  agencySlug: (typeof AGENCIES)[number]
  /** PgBouncer port for this agency (transaction mode pool). */
  pgbouncerPort: number
  /** Database name on the underlying Postgres instance, e.g. 'ecommerce_db' */
  dbName: string
  /** Postgres role that owns this database, e.g. 'ecommerce_user' */
  role: string
}

/**
 * Returns connection metadata for the given agency slug.
 * Throws if the slug is not in the canonical AGENCIES list.
 *
 * @example
 *   const conn = agencyConnection('ecommerce')
 *   // { agencySlug: 'ecommerce', pgbouncerPort: 6433, dbName: 'ecommerce_db', role: 'ecommerce_user' }
 */
export function agencyConnection(slug: (typeof AGENCIES)[number]): AgencyConnection {
  const idx = AGENCIES.indexOf(slug)
  if (idx === -1) {
    throw new Error(
      `Unknown agency slug: "${slug}". Valid slugs: ${AGENCIES.join(', ')}`
    )
  }
  return {
    agencySlug: slug,
    pgbouncerPort: PGBOUNCER_PORT_BASE + idx,
    dbName: `${slug}_db`,
    role: `${slug}_user`,
  }
}

/**
 * Builds a DATABASE_URL string targeting the PgBouncer transaction-mode pool for
 * the given agency. Requires the plaintext password (source from Doppler at runtime).
 *
 * The URL targets PgBouncer (not Postgres directly) — this is intentional.
 * Direct Postgres access (bypassing PgBouncer) is only used by admin tooling and init scripts.
 *
 * @example
 *   const url = buildDatabaseUrl('ecommerce', process.env.ECOMMERCE_DB_PASSWORD!)
 *   // 'postgresql://ecommerce_user:***@127.0.0.1:6433/ecommerce_db'
 */
export function buildDatabaseUrl(
  slug: (typeof AGENCIES)[number],
  password: string
): string {
  const conn = agencyConnection(slug)
  return `postgresql://${conn.role}:${encodeURIComponent(password)}@127.0.0.1:${conn.pgbouncerPort}/${conn.dbName}`
}

/**
 * Returns all agency connections as an array — useful for health checks or admin scripts
 * that need to iterate across all agencies.
 */
export function allAgencyConnections(): AgencyConnection[] {
  return AGENCIES.map((slug) => agencyConnection(slug))
}
