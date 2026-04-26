#!/usr/bin/env tsx
/**
 * scripts/verify-audit-chain.ts
 *
 * CLI: walks the audit_log hash chain across all 12 agencies (or a specified one),
 * reports broken row IDs, and exits 1 if any chain breaks are detected.
 *
 * Usage:
 *   pnpm tsx scripts/verify-audit-chain.ts --all
 *   pnpm tsx scripts/verify-audit-chain.ts --agency=ecommerce
 *   pnpm tsx scripts/verify-audit-chain.ts --help
 *
 * Requires:
 *   MIGRATIONS_DB_PASSWORD — set in Doppler (migrations_runner role, port 5432)
 *
 * Exit codes:
 *   0 — all chains intact
 *   1 — one or more broken rows detected (or unrecoverable error)
 *
 * CI gate integration:
 *   Add to CI pipeline (see docs/runbooks/vault-audit.md):
 *     pnpm tsx scripts/verify-audit-chain.ts --all
 *
 * Runs as migrations_runner (BYPASSRLS) so it can see all audit_log rows
 * regardless of agency_id. Do NOT use the app role for this script.
 */

import { AGENCIES } from '@mjagency/config'
import { createAgencyDb } from '@mjagency/db'
import { verifyAuditChain } from '@mjagency/db'

const args = process.argv.slice(2)

function printHelp(): void {
  console.log(`
verify-audit-chain — validate audit_log SHA-256 hash chain integrity

Usage:
  pnpm tsx scripts/verify-audit-chain.ts [--all | --agency=<slug>] [--help]

Flags:
  --all              Check all 12 agency databases (default)
  --agency=<slug>    Check a single agency database by slug
  --help             Print this help and exit 0

Examples:
  pnpm tsx scripts/verify-audit-chain.ts --all
  pnpm tsx scripts/verify-audit-chain.ts --agency=ecommerce

Exit codes:
  0  All chains intact
  1  Broken rows detected or unrecoverable error

Required env vars (Doppler-injected):
  MIGRATIONS_DB_PASSWORD  — password for migrations_runner Postgres role
`.trim())
}

if (args.includes('--help') || args.includes('-h')) {
  printHelp()
  process.exit(0)
}

const agencyArg = args.find((a) => a.startsWith('--agency='))
const isAll = args.includes('--all') || !agencyArg

const password = process.env.MIGRATIONS_DB_PASSWORD
if (!password) {
  console.error('[verify-audit-chain] ERROR: MIGRATIONS_DB_PASSWORD not set in environment')
  process.exit(1)
}

const targetAgencies: (typeof AGENCIES)[number][] = isAll
  ? [...AGENCIES]
  : (() => {
      const slug = agencyArg?.split('=')[1] as (typeof AGENCIES)[number] | undefined
      if (!slug || !AGENCIES.includes(slug)) {
        console.error(`[verify-audit-chain] ERROR: Unknown agency slug "${slug ?? ''}". Valid slugs: ${AGENCIES.join(', ')}`)
        process.exit(1)
      }
      return [slug]
    })()

let anyBroken = false

async function main(): Promise<void> {
  console.log(`[verify-audit-chain] Checking ${targetAgencies.length} agenc${targetAgencies.length === 1 ? 'y' : 'ies'}...`)

  const results: Array<{ agency: string; broken: number[]; total: number; error?: string }> = []

  await Promise.allSettled(
    targetAgencies.map(async (agency) => {
      try {
        const db = createAgencyDb(agency, password!)
        const result = await verifyAuditChain(db)
        results.push({ agency, ...result })
      } catch (err) {
        results.push({ agency, broken: [], total: 0, error: String(err) })
      }
    })
  )

  // Sort results by agency name for deterministic output
  results.sort((a, b) => a.agency.localeCompare(b.agency))

  for (const { agency, broken, total, error } of results) {
    if (error) {
      console.error(`[verify-audit-chain] ${agency}: ERROR — ${error}`)
      anyBroken = true
    } else if (broken.length > 0) {
      console.error(`[verify-audit-chain] ${agency}: BROKEN ${broken.length}/${total} rows — broken IDs: ${broken.join(', ')}`)
      anyBroken = true
    } else {
      console.log(`[verify-audit-chain] ${agency}: OK ${total} rows`)
    }
  }

  if (anyBroken) {
    console.error('\n[verify-audit-chain] RESULT: Chain integrity FAILED — see above for broken row IDs')
    console.error('[verify-audit-chain] DO NOT auto-repair. Follow incident response in docs/runbooks/vault-audit.md')
    process.exit(1)
  } else {
    console.log('\n[verify-audit-chain] RESULT: All chains intact')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('[verify-audit-chain] Unhandled error:', err)
  process.exit(1)
})
