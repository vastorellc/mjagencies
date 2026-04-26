#!/usr/bin/env tsx
/**
 * scripts/seed-runner.ts
 *
 * CLI entry point for the per-agency seed framework.
 *
 * Usage:
 *   pnpm tsx scripts/seed-runner.ts [flags]
 *
 * Flags:
 *   --agency=<slug>     Run for one agency only
 *   --all               Run for all 12 agencies in parallel (Promise.allSettled)
 *   --steps=a,b,c       Restrict to a subset of steps (comma-separated names)
 *   --reset             TRUNCATE _seed_state BEFORE running (DEV ONLY — irreversible)
 *   --help              Print help text and exit 0
 *
 * Environment variables (per agency):
 *   SEED_<SLUG>_DB_PASSWORD  Password for <slug>_user Postgres role
 *   SEED_DB_PASSWORD          Fallback password applied to all agencies
 *
 * Exit codes:
 *   0 — all targeted agencies seeded successfully
 *   1 — one or more agencies failed
 *
 * Examples:
 *   pnpm tsx scripts/seed-runner.ts --agency=ecommerce
 *   pnpm tsx scripts/seed-runner.ts --all
 *   pnpm tsx scripts/seed-runner.ts --agency=brand --steps=agencies,admin-users
 *   pnpm tsx scripts/seed-runner.ts --agency=ecommerce --reset
 *
 * See docs/runbooks/seed.md for full operational guidance.
 */

import { AGENCIES } from '@mjagency/config'
import type { AgencySlug } from '@mjagency/config'
import { createAgencyDb } from '../packages/db/src/client.js'
import {
  runSeed,
  runSeedAllAgencies,
  allSteps,
  agencyUuid,
} from '../packages/db/src/seed/index.js'
import type { SeedStep } from '../packages/db/src/seed/index.js'
import { eq } from 'drizzle-orm'
import { seedState } from '../packages/db/src/schema/seed-state.js'
import { sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

const HELP = `
seed-runner — per-agency seed framework CLI

USAGE
  pnpm tsx scripts/seed-runner.ts [flags]

FLAGS
  --agency=<slug>     Run for one agency only
  --all               Run for all 12 agencies in parallel (Promise.allSettled)
  --steps=a,b,c       Restrict to a subset of steps (comma-separated names)
  --reset             TRUNCATE _seed_state BEFORE running (DEV ONLY — data loss)
  --help              Print this help text and exit 0

ENVIRONMENT VARIABLES
  SEED_<SLUG>_DB_PASSWORD   Password for <slug>_user Postgres role (e.g. SEED_ECOMMERCE_DB_PASSWORD)
  SEED_DB_PASSWORD           Fallback password for all agencies if per-agency var is unset
  INTEGRATION_<SLUG>_DB_PASSWORD  Alternative prefix (same fallback chain)

EXAMPLES
  pnpm tsx scripts/seed-runner.ts --agency=ecommerce
  pnpm tsx scripts/seed-runner.ts --all
  pnpm tsx scripts/seed-runner.ts --agency=brand --steps=agencies,admin-users
  pnpm tsx scripts/seed-runner.ts --agency=ecommerce --reset

EXIT CODES
  0   All targeted agencies seeded successfully
  1   One or more agencies failed

NOTES
  - --reset is DEV ONLY and irreversible. Never run in production.
  - For production seeding, ensure Phase 3 (auth) is deployed first
    (the admin-users step uses a placeholder password until then).
  - See docs/runbooks/seed.md for full operational guidance.
`.trim()

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  help: boolean
  all: boolean
  reset: boolean
  agency: string | null
  steps: string[] | null
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2) // skip 'node' and script name
  const result: ParsedArgs = {
    help: false,
    all: false,
    reset: false,
    agency: null,
    steps: null,
  }

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      result.help = true
    } else if (arg === '--all') {
      result.all = true
    } else if (arg === '--reset') {
      result.reset = true
    } else if (arg.startsWith('--agency=')) {
      result.agency = arg.slice('--agency='.length)
    } else if (arg.startsWith('--steps=')) {
      result.steps = arg
        .slice('--steps='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    } else {
      console.error(`seed-runner: unknown flag: ${arg}`)
      console.error('Run with --help for usage.')
      process.exit(1)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Password resolution
// ---------------------------------------------------------------------------

function resolvePassword(slug: string): string {
  const upper = slug.toUpperCase().replace(/-/g, '_')
  // Try SEED_<SLUG>_DB_PASSWORD first, then INTEGRATION_<SLUG>_DB_PASSWORD,
  // then fall back to SEED_DB_PASSWORD
  const pw =
    process.env[`SEED_${upper}_DB_PASSWORD`] ??
    process.env[`INTEGRATION_${upper}_DB_PASSWORD`] ??
    process.env['SEED_DB_PASSWORD']

  if (!pw) {
    throw new Error(
      `seed-runner: no password found for agency "${slug}".\n` +
        `Set SEED_${upper}_DB_PASSWORD or SEED_DB_PASSWORD in your environment.\n` +
        'For Doppler-managed environments: doppler run -- pnpm tsx scripts/seed-runner.ts ...'
    )
  }
  return pw
}

// ---------------------------------------------------------------------------
// Step filtering
// ---------------------------------------------------------------------------

function filterSteps(steps: SeedStep[], names: string[] | null): SeedStep[] {
  if (!names || names.length === 0) return steps
  const filtered = steps.filter((s) => names.includes(s.name))
  const unknown = names.filter((n) => !steps.some((s) => s.name === n))
  if (unknown.length > 0) {
    console.warn(`seed-runner: warning — unknown step names: ${unknown.join(', ')}`)
    console.warn(`Available steps: ${steps.map((s) => s.name).join(', ')}`)
  }
  return filtered
}

// ---------------------------------------------------------------------------
// Reset _seed_state
// ---------------------------------------------------------------------------

async function resetSeedState(db: ReturnType<typeof createAgencyDb>): Promise<void> {
  console.log('seed-runner: --reset: truncating _seed_state ...')
  await db.execute(sql`TRUNCATE _seed_state`)
  console.log('seed-runner: --reset: done.')
}

// ---------------------------------------------------------------------------
// Validate agency slug
// ---------------------------------------------------------------------------

function requireValidSlug(slug: string): AgencySlug {
  if (!AGENCIES.includes(slug as AgencySlug)) {
    throw new Error(
      `seed-runner: unknown agency slug "${slug}".\nValid slugs: ${AGENCIES.join(', ')}`
    )
  }
  return slug as AgencySlug
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv)

  if (args.help) {
    console.log(HELP)
    process.exit(0)
  }

  if (!args.agency && !args.all) {
    console.error('seed-runner: must specify --agency=<slug> or --all.')
    console.error('Run with --help for usage.')
    process.exit(1)
  }

  if (args.agency && args.all) {
    console.error('seed-runner: --agency and --all are mutually exclusive.')
    process.exit(1)
  }

  const steps = filterSteps(allSteps, args.steps)

  if (steps.length === 0) {
    console.warn('seed-runner: no steps to run (filtered list is empty). Exiting 0.')
    process.exit(0)
  }

  // -------------------------------------------------------------------------
  // Single-agency mode
  // -------------------------------------------------------------------------
  if (args.agency) {
    const slug = requireValidSlug(args.agency)
    const password = resolvePassword(slug)
    const db = createAgencyDb(slug, password)
    const agencyId = agencyUuid(slug)

    if (args.reset) {
      await resetSeedState(db)
    }

    await runSeed(db, slug, agencyId, steps)
    console.log(`\nseed-runner: 1/1 OK (${slug})`)
    process.exit(0)
  }

  // -------------------------------------------------------------------------
  // All-agencies mode
  // -------------------------------------------------------------------------
  const targets = AGENCIES.map((slug) => {
    const password = resolvePassword(slug)
    const db = createAgencyDb(slug, password)
    return { slug, db, agencyId: agencyUuid(slug) }
  })

  // Apply --reset to each agency before running seeds
  if (args.reset) {
    console.log('seed-runner: --reset: truncating _seed_state on all agencies ...')
    await Promise.allSettled(targets.map(({ db }) => resetSeedState(db)))
  }

  const results = await runSeedAllAgencies(targets, steps)

  const failed = results.filter((r) => r.status === 'failed')
  if (failed.length > 0) {
    console.error('\nseed-runner: failed agencies:')
    for (const r of failed) {
      console.error(`  ${r.slug}: ${r.error}`)
    }
    process.exit(1)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('seed-runner: unexpected error:', err)
  process.exit(1)
})
