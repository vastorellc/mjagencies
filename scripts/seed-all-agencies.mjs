#!/usr/bin/env node
/**
 * scripts/seed-all-agencies.mjs
 * Master seed orchestrator for all 12 MJAgency agencies.
 * Usage: node scripts/seed-all-agencies.mjs [--agency=<slug>] [--dry-run] [--help]
 * Exit codes: 0 = success, 1 = one or more failures
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const STATUS_DIR = join(REPO_ROOT, '.planning', 'seed-status')

const AGENCY_SLUGS = [
  'web-ai', 'web-branding', 'web-ecommerce', 'web-engineering',
  'web-finance', 'web-graphic', 'web-growth', 'web-main',
  'web-product', 'web-strategy', 'web-video', 'web-webdev',
]

const HELP = `
seed-all-agencies.mjs — Complete seed run for all 12 MJAgency agencies

Usage:
  node scripts/seed-all-agencies.mjs [options]

Options:
  --agency=<slug>  Seed a single agency only (e.g., --agency=web-dental)
  --dry-run        Log what would be seeded without making HTTP calls
  --help           Show this help message

Environment variables:
  PAYLOAD_URL       Base URL of running Payload CMS (default: http://localhost:3000)
  SEED_JWT_TOKEN    Super admin JWT for Payload REST API auth (required for live run)

Valid agency slugs: ${AGENCY_SLUGS.join(', ')}
`.trim()

function parseArgs(argv) {
  const args = argv.slice(2)
  const agencyArg = args.find(a => a.startsWith('--agency='))
  return {
    help: args.includes('--help'),
    dryRun: args.includes('--dry-run'),
    agency: agencyArg ? agencyArg.split('=')[1] : null,
  }
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) { console.log(HELP); process.exit(0) }

  if (args.agency && !AGENCY_SLUGS.includes(args.agency)) {
    console.error(`Unknown agency: "${args.agency}"`)
    console.error(`Valid slugs: ${AGENCY_SLUGS.join(', ')}`)
    process.exit(1)
  }

  if (!args.dryRun && !process.env['SEED_JWT_TOKEN']) {
    console.error('SEED_JWT_TOKEN env var is required for live seed run. Use --dry-run to preview.')
    process.exit(1)
  }

  if (!existsSync(STATUS_DIR)) mkdirSync(STATUS_DIR, { recursive: true })

  const slugsToSeed = args.agency ? [args.agency] : AGENCY_SLUGS
  const failures = []

  for (const slug of slugsToSeed) {
    const doneFile = join(STATUS_DIR, `${slug}.done`)

    if (existsSync(doneFile) && !args.dryRun) {
      console.log(`SKIP ${slug} (already seeded — delete .planning/seed-status/${slug}.done to re-seed)`)
      continue
    }

    if (args.dryRun) {
      console.log(`DRY-RUN SEEDING ${slug}: pages, services, tools, team, testimonials, faqs, blog-posts, case-studies`)
      continue
    }

    console.log(`SEEDING ${slug}...`)
    try {
      execSync(
        `npx tsx packages/db/src/seeds/seed-payload-collections.ts --agency=${slug}`,
        { stdio: 'inherit', cwd: REPO_ROOT, env: { ...process.env } }
      )
      writeFileSync(doneFile, new Date().toISOString())
      console.log(`OK ${slug}`)
    } catch (err) {
      console.error(`FAILED ${slug}: ${err.message}`)
      failures.push(slug)
    }
  }

  if (args.dryRun) {
    console.log(`\nDry run complete. ${slugsToSeed.length} agencies would be seeded.`)
    process.exit(0)
  }

  if (failures.length > 0) {
    console.error(`\nFAILED: ${failures.join(', ')}`)
    process.exit(1)
  }

  console.log(`\nAll ${slugsToSeed.length} agencies seeded successfully.`)
  process.exit(0)
}

main().catch(err => {
  console.error('seed-all-agencies: unexpected error:', err)
  process.exit(1)
})
