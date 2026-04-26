/**
 * packages/db/src/migrate/runner.ts
 *
 * Programmatic migration API for multi-tenant fan-out across all 13 agency DBs.
 *
 * Architecture:
 *   - runMigration(slug, password) — single-agency apply; used by canary mode and fan-out
 *   - runAllMigrations(opts) — orchestrator that handles all run modes
 *
 * Connection requirements (pitfall 8.2 + pitfall 8.3):
 *   - Always connects via buildDirectUrl (port 5432, NOT PgBouncer 6432-6443)
 *   - Always passes max:1, prepare:false to the postgres-js client
 *   - Each agency gets its own dedicated postgres-js client (no sharing)
 *
 * Migration apply order per agency DB:
 *   1. drizzle-kit generated files via migrate(db, { migrationsFolder }) — 0000_initial.sql etc.
 *   2. custom/001_agency_id_immutable.sql
 *   3. custom/002_force_rls_and_app_role.sql (with :'app_role' → <slug>_user substitution)
 *
 * Security note (T-02-003 mitigated):
 *   buildDirectUrl is ringfenced here and in JSDoc. Application code uses buildDatabaseUrl
 *   (PgBouncer port 6432-6443) via createAgencyDb. The lint rule (Plan 02-02) prevents
 *   accidental session-scoped SET; this module adds the directional privilege separation.
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'
import { AGENCIES } from '@mjagency/config'
import { buildDirectUrl } from '../connection.js'
import { applyCustomDdl } from './apply-custom.js'
import { dryRun, type DryRunResult } from './dry-run.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Path to drizzle-kit generated migration files — resolved from this module's location.
// This module: packages/db/src/migrate/runner.ts
// Migrations:  packages/db/src/migrations/
const MIGRATIONS_FOLDER = path.resolve(__dirname, '../migrations')

export interface RunAllOptions {
  /** Run for a single agency only. Defaults to all if not set. */
  agency?: string
  /** Print pending migrations without applying. Exits 0 if no connection errors. */
  dryRun?: boolean
  /** Run 'brand' first, prompt for confirmation, then fan out remaining 12. */
  canary?: boolean
  /** Run one DB at a time sequentially (no parallelism). For diagnostics only. */
  sequential?: boolean
  /** pg_dump --schema-only per agency before applying (snapshot for rollback). */
  snapshotBefore?: boolean
  /** Snapshot output directory (only used when snapshotBefore is true). */
  snapshotDir?: string
}

/**
 * Applies all pending migrations to a single agency database.
 *
 * Apply order:
 *   1. drizzle-kit generated migrations (via drizzle-orm/postgres-js/migrator)
 *   2. custom/001_agency_id_immutable.sql
 *   3. custom/002_force_rls_and_app_role.sql (app_role substituted)
 *
 * @param slug - agency slug (must be in AGENCIES)
 * @param password - migrations_runner password
 */
export async function runMigration(
  slug: (typeof AGENCIES)[number],
  password: string
): Promise<void> {
  const url = buildDirectUrl(slug, password)
  const client = postgres(url, { max: 1, prepare: false }) // pitfall 8.3
  const db = drizzle({ client })
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
    // After drizzle-kit generated migrations: apply custom DDL in order
    await applyCustomDdl(client, slug)
  } finally {
    await client.end()
  }
}

/**
 * Reads MIGRATIONS_DB_PASSWORD from process.env.
 * Throws a clear error if unset to fail fast with a diagnostic message.
 */
function requirePassword(): string {
  const pw = process.env.MIGRATIONS_DB_PASSWORD
  if (!pw) {
    throw new Error(
      'MIGRATIONS_DB_PASSWORD is not set.\n' +
        'This is a Doppler shared-project secret. Set it via:\n' +
        '  doppler run --project=mjagency-shared -- pnpm tsx scripts/migrate-runner.ts\n' +
        'Or export it manually for local dev:\n' +
        '  export MIGRATIONS_DB_PASSWORD=<value>'
    )
  }
  return pw
}

/**
 * Validates that a slug is in the canonical AGENCIES list.
 * Throws with a clear message if not.
 */
function requireValidSlug(slug: string): (typeof AGENCIES)[number] {
  if (!AGENCIES.includes(slug as (typeof AGENCIES)[number])) {
    throw new Error(
      `Unknown agency slug: "${slug}". Valid slugs: ${AGENCIES.join(', ')}`
    )
  }
  return slug as (typeof AGENCIES)[number]
}

/**
 * Prompts the user for confirmation via stdin.
 * Returns true if the user typed ENTER (empty input) or 'y'/'yes'.
 */
async function promptConfirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close()
      const trimmed = answer.trim().toLowerCase()
      resolve(trimmed === '' || trimmed === 'y' || trimmed === 'yes')
    })
  })
}

/**
 * Orchestrates migrations across all or a subset of agency databases.
 *
 * Modes (applied in priority order):
 *   1. dryRun: list pending without applying
 *   2. agency (single): run for one agency only
 *   3. canary: run 'brand' first, confirm, then fan out remaining 12
 *   4. sequential: for...of loop (no parallelism)
 *   5. default (--all): Promise.allSettled parallel fan-out across all 13
 *
 * @returns Promise that resolves when all migrations complete (or rejects on error in dryRun mode)
 */
export async function runAllMigrations(opts: RunAllOptions = {}): Promise<void> {
  const password = requirePassword()

  // -------------------------------------------------------------------------
  // dry-run mode — list pending migrations, no apply
  // -------------------------------------------------------------------------
  if (opts.dryRun) {
    const slugs: Array<(typeof AGENCIES)[number]> = opts.agency
      ? [requireValidSlug(opts.agency)]
      : [...AGENCIES]

    const results = await Promise.allSettled(
      slugs.map((slug) => dryRun(slug, password))
    )

    let hasError = false
    const dryResults: DryRunResult[] = []

    for (const result of results) {
      if (result.status === 'fulfilled') {
        dryResults.push(result.value)
      } else {
        console.error('[migrate-runner] Connection error during dry-run:', result.reason)
        hasError = true
      }
    }

    // Print per-agency dry-run summary
    for (const r of dryResults) {
      if (r.pending.length === 0) {
        console.log(`  ${r.slug}: 0 pending (${r.appliedCount} applied)`)
      } else {
        console.log(`  ${r.slug}: ${r.pending.length} pending:`)
        for (const f of r.pending) {
          console.log(`    - ${f}`)
        }
      }
    }

    if (hasError) {
      process.exitCode = 1
    }
    return
  }

  // -------------------------------------------------------------------------
  // Single-agency mode
  // -------------------------------------------------------------------------
  if (opts.agency) {
    const slug = requireValidSlug(opts.agency)
    await runMigration(slug, password)
    console.log(`[migrate-runner] ${slug}: OK`)
    return
  }

  // -------------------------------------------------------------------------
  // Canary mode — brand first, confirm, then remaining 12 in parallel
  // -------------------------------------------------------------------------
  if (opts.canary) {
    console.log('[migrate-runner] canary: applying migrations to brand_db first...')
    await runMigration('brand', password)
    console.log('[migrate-runner] canary: brand OK')

    const confirmed = await promptConfirm(
      '\n[migrate-runner] canary: Brand migration succeeded. Proceed with remaining 12 agencies? [Y/n] '
    )
    if (!confirmed) {
      console.log('[migrate-runner] canary: aborted by operator.')
      process.exitCode = 1
      return
    }

    const remaining = AGENCIES.filter((s) => s !== 'brand') as Array<
      (typeof AGENCIES)[number]
    >
    const results = await Promise.allSettled(
      remaining.map((slug) => runMigration(slug, password))
    )
    printAllSettledSummary(results, remaining)
    return
  }

  // -------------------------------------------------------------------------
  // Sequential mode — for diagnostics
  // -------------------------------------------------------------------------
  if (opts.sequential) {
    for (const slug of AGENCIES) {
      try {
        await runMigration(slug, password)
        console.log(`[migrate-runner] ${slug}: OK`)
      } catch (err) {
        console.error(`[migrate-runner] ${slug}: FAILED —`, err)
        process.exitCode = 1
      }
    }
    return
  }

  // -------------------------------------------------------------------------
  // Default: parallel fan-out across all 13 agencies
  // -------------------------------------------------------------------------
  const results = await Promise.allSettled(
    AGENCIES.map((slug) => runMigration(slug, password))
  )
  printAllSettledSummary(results, [...AGENCIES])
}

/**
 * Logs per-agency success/failure from Promise.allSettled results.
 * Sets process.exitCode = 1 if any agency failed.
 */
function printAllSettledSummary(
  results: PromiseSettledResult<void>[],
  slugs: string[]
): void {
  let failed = 0
  for (let i = 0; i < results.length; i++) {
    const result = results[i] as PromiseSettledResult<void>
    const slug = slugs[i] ?? `agency-${i}`
    if (result.status === 'fulfilled') {
      console.log(`[migrate-runner] ${slug}: OK`)
    } else if (result.status === 'rejected') {
      console.error(`[migrate-runner] ${slug}: FAILED —`, (result as PromiseRejectedResult).reason)
      failed++
    }
  }
  const total = slugs.length
  console.log(`\n[migrate-runner] ${total - failed}/${total} OK`)
  if (failed > 0) {
    process.exitCode = 1
  }
}
