#!/usr/bin/env tsx
/**
 * scripts/migrate-runner.ts
 *
 * CLI entry point for the MJAgency parallel migration runner.
 * Fans out schema migrations across all 13 agency databases by default.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-runner.ts [flags]
 *
 * Flags:
 *   --agency=<slug>       Run for one agency only (default: all)
 *   --all                 Run for all 13 agencies (default if --agency not set)
 *   --dry-run             List pending migrations without applying; exits 0 / 1
 *   --canary              Run brand first, confirm, then fan out remaining 12
 *   --sequential          Run one DB at a time (no parallelism); for diagnostics
 *   --snapshot-before     pg_dump --schema-only per agency before applying
 *   --help                Print this help text and exit 0
 *
 * Environment:
 *   MIGRATIONS_DB_PASSWORD  (required) Shared password for migrations_runner Postgres role.
 *                           Injected via Doppler in CI/prod; set manually for local dev.
 *
 * Examples:
 *   # Dry-run across all agencies (CI gate)
 *   pnpm tsx scripts/migrate-runner.ts --dry-run --all
 *
 *   # Canary deploy with snapshot (stage/prod)
 *   pnpm tsx scripts/migrate-runner.ts --canary --snapshot-before
 *
 *   # Apply to a single agency only
 *   pnpm tsx scripts/migrate-runner.ts --agency=ecommerce
 *
 *   # Sequential mode for debugging connection issues
 *   pnpm tsx scripts/migrate-runner.ts --sequential
 */

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AGENCIES } from '@mjagency/config'
import { runAllMigrations, snapshotAgency } from '@mjagency/db/migrate'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

const HELP = `
migrate-runner — MJAgency parallel migration runner
====================================================

Applies Drizzle schema migrations across all 13 agency databases.
Connects directly to Postgres on port 5432 (bypasses PgBouncer — see pitfall 8.2).
Uses migrations_runner Postgres role (BYPASSRLS — provisioned in Plan 02-01 init.sql).

Usage:
  pnpm tsx scripts/migrate-runner.ts [flags]

Flags:
  --agency=<slug>       Run for one agency only (default: all)
                        Valid slugs: ${AGENCIES.join(', ')}
  --all                 Run for all 13 agencies (default if --agency not set)
  --dry-run             List pending migrations without applying
                        Exits 0 if no errors; exits 1 on connection error
  --canary              Apply to brand first, confirm, then fan out remaining 12
                        Always use with --snapshot-before in stage/prod
  --sequential          Run one DB at a time (no parallelism)
                        Use for diagnostics when --all parallelism obscures errors
  --snapshot-before     Run pg_dump --schema-only per agency before applying
                        Writes to .snapshots/<ISO-timestamp>/
                        Required for non-dev environments (see runbook)
  --help                Print this help and exit 0

Environment:
  MIGRATIONS_DB_PASSWORD  (required) migrations_runner password.
                          Inject via: doppler run --project=mjagency-shared -- pnpm tsx ...

Examples:
  # CI gate — check for pending migrations, fail build if connection error
  pnpm tsx scripts/migrate-runner.ts --dry-run --all

  # Dev — apply schema to all 13 local DBs
  pnpm tsx scripts/migrate-runner.ts --all

  # Stage/prod — canary with snapshot (safe default)
  pnpm tsx scripts/migrate-runner.ts --canary --snapshot-before

  # Apply to one agency only
  pnpm tsx scripts/migrate-runner.ts --agency=ecommerce

  # Diagnose a failing agency without parallel noise
  pnpm tsx scripts/migrate-runner.ts --agency=brand --sequential

Runbook: docs/runbooks/migrations.md
`.trim()

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
  agency?: string
  all: boolean
  dryRun: boolean
  canary: boolean
  sequential: boolean
  snapshotBefore: boolean
  help: boolean
} {
  const args = argv.slice(2) // strip node + script path
  const result = {
    agency: undefined as string | undefined,
    all: false,
    dryRun: false,
    canary: false,
    sequential: false,
    snapshotBefore: false,
    help: false,
  }

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      result.help = true
    } else if (arg === '--all') {
      result.all = true
    } else if (arg === '--dry-run') {
      result.dryRun = true
    } else if (arg === '--canary') {
      result.canary = true
    } else if (arg === '--sequential') {
      result.sequential = true
    } else if (arg === '--snapshot-before') {
      result.snapshotBefore = true
    } else if (arg.startsWith('--agency=')) {
      result.agency = arg.slice('--agency='.length)
    } else {
      console.error(`[migrate-runner] Unknown flag: ${arg}`)
      console.error('Run with --help for usage.')
      process.exit(1)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Snapshot helpers
// ---------------------------------------------------------------------------

async function runSnapshots(
  agency: string | undefined,
  password: string,
  snapshotDir: string
): Promise<void> {
  const slugs = agency ? [agency] : [...AGENCIES]
  console.log(`[migrate-runner] Snapshotting ${slugs.length} DB(s) to ${snapshotDir} ...`)
  await mkdir(snapshotDir, { recursive: true })
  const results = await Promise.allSettled(
    slugs.map((slug) => snapshotAgency(slug, password, snapshotDir))
  )
  let failed = 0
  for (let i = 0; i < results.length; i++) {
    const result = results[i] as PromiseSettledResult<string>
    const slug = slugs[i] ?? `agency-${i}`
    if (result.status === 'fulfilled') {
      console.log(`[migrate-runner] snapshot: ${slug} → ${result.value}`)
    } else if (result.status === 'rejected') {
      console.error(`[migrate-runner] snapshot: ${slug} FAILED —`, (result as PromiseRejectedResult).reason)
      failed++
    }
  }
  if (failed > 0) {
    throw new Error(`[migrate-runner] ${failed} snapshot(s) failed. Aborting migration.`)
  }
  console.log(`[migrate-runner] Snapshot saved to ${snapshotDir}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseArgs(process.argv)

  if (flags.help) {
    console.log(HELP)
    process.exit(0)
  }

  // Validate agency slug if provided
  if (flags.agency && !AGENCIES.includes(flags.agency as (typeof AGENCIES)[number])) {
    console.error(
      `[migrate-runner] Unknown agency slug: "${flags.agency}"\n` +
        `Valid slugs: ${AGENCIES.join(', ')}`
    )
    process.exit(1)
  }

  const password = process.env.MIGRATIONS_DB_PASSWORD
  if (!password) {
    console.error(
      '[migrate-runner] MIGRATIONS_DB_PASSWORD is not set.\n' +
        'Set it via Doppler or export it manually for local dev.\n' +
        'Run --help for details.'
    )
    process.exit(1)
  }

  // Snapshot before migrations if requested
  if (flags.snapshotBefore) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const snapshotDir = path.resolve(__dirname, '..', '.snapshots', ts)
    await runSnapshots(flags.agency, password, snapshotDir)
  }

  // Run migrations
  await runAllMigrations({
    agency: flags.agency,
    dryRun: flags.dryRun,
    canary: flags.canary,
    sequential: flags.sequential,
    snapshotBefore: false, // Snapshot already handled above
  })
}

main().catch((err) => {
  console.error('[migrate-runner] Fatal error:', err)
  process.exit(1)
})
