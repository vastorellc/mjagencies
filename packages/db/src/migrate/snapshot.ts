/**
 * packages/db/src/migrate/snapshot.ts
 *
 * pg_dump --schema-only wrapper for per-agency snapshot before migration.
 * Used by --snapshot-before mode in scripts/migrate-runner.ts.
 *
 * Each agency's schema is dumped to <outDir>/<slug>.sql.
 * The dump connects directly to Postgres on port 5432 as migrations_runner —
 * same direct connection path as the migration runner (bypasses PgBouncer).
 *
 * Rollback: use scripts/migrate-rollback.ts <snapshot-dir> to re-apply.
 *
 * Limitation: schema-only snapshot — data is NOT included.
 * A destructive migration (DROP TABLE, ALTER COLUMN with data loss) that needs
 * data rollback requires a separate data backup (see Plan 02-05 backup runbook).
 */

import { spawn } from 'node:child_process'
import path from 'node:path'

/**
 * Runs `pg_dump --schema-only` for a single agency database.
 * Writes to <outDir>/<slug>.sql.
 *
 * @param slug     - agency slug (e.g. 'ecommerce')
 * @param password - migrations_runner password (MIGRATIONS_DB_PASSWORD)
 * @param outDir   - directory to write the snapshot file into
 * @returns        - absolute path to the written snapshot file
 * @throws         - Error with diagnostic message if pg_dump exits non-zero
 */
export async function snapshotAgency(
  slug: string,
  password: string,
  outDir: string
): Promise<string> {
  const file = path.join(outDir, `${slug}.sql`)

  const args = [
    '--host=127.0.0.1',
    '--port=5432',
    '--username=migrations_runner',
    '--schema-only',
    '--no-owner',
    '--no-privileges',
    `--dbname=${slug}_db`,
    `--file=${file}`,
  ]

  const env = { ...process.env, PGPASSWORD: password }

  await new Promise<void>((resolve, reject) => {
    const p = spawn('pg_dump', args, { env, stdio: 'inherit' })
    p.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(
          new Error(
            `pg_dump failed for ${slug} with exit code ${code}.\n` +
              `Check that pg_dump is in PATH, port 5432 is accessible, ` +
              `migrations_runner role exists, and MIGRATIONS_DB_PASSWORD is correct.`
          )
        )
      }
    })
    p.on('error', (err) => {
      reject(
        new Error(
          `Failed to start pg_dump for ${slug}: ${err.message}\n` +
            `Ensure pg_dump is installed (part of postgresql-client package).`
        )
      )
    })
  })

  return file
}
