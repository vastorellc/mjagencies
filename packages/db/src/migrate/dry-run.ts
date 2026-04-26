/**
 * packages/db/src/migrate/dry-run.ts
 *
 * Inspects the __drizzle_migrations table and lists pending migration files
 * without applying anything. Used as an operator confidence gate before
 * running the actual migration.
 *
 * Note: This is a best-effort dry-run — drizzle-kit's hash-based tracking means
 * the perfect implementation requires reading the same migrations journal that
 * migrate() reads. This implementation provides sufficient operator confidence;
 * a hash-aware implementation can be added in M002+ if needed.
 */

import postgres from 'postgres'
import { buildDirectUrl } from '../connection.js'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AGENCIES } from '@mjagency/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Path to drizzle-kit generated migration files (the non-custom ones)
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations')

export interface DryRunResult {
  slug: string
  appliedCount: number
  pending: string[] // filenames of unapplied .sql files (drizzle-kit generated only)
}

/**
 * Connects to the agency DB, reads the __drizzle_migrations table to count applied
 * migrations, and compares against migration files on disk to derive pending list.
 *
 * Exits without applying any DDL.
 *
 * @param slug - agency slug
 * @param password - migrations_runner password (MIGRATIONS_DB_PASSWORD)
 */
export async function dryRun(
  slug: (typeof AGENCIES)[number],
  password: string
): Promise<DryRunResult> {
  const client = postgres(buildDirectUrl(slug, password), { max: 1, prepare: false })
  try {
    // List drizzle-kit migration files on disk (non-custom, sorted)
    const allFiles = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort()

    // Read __drizzle_migrations to find how many have been applied.
    // .catch(() => []) handles the case where the table doesn't exist yet.
    const applied = await client`SELECT hash FROM __drizzle_migrations ORDER BY created_at`.catch(
      () => []
    )
    const appliedCount = applied.length

    // Naive ordering: assume applied in sorted file order (matches drizzle-kit default)
    const pending = allFiles.slice(appliedCount)

    return { slug, appliedCount, pending }
  } finally {
    await client.end()
  }
}
