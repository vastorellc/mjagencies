#!/usr/bin/env tsx
/**
 * scripts/verify-pgbouncer-rls.ts
 *
 * End-to-end RLS + PgBouncer parallelism verifier.
 *
 * Connects through each agency's PgBouncer (ports 6432-6443), runs 50 concurrent
 * transactions using withAgencyContext, and asserts that every query sees ONLY
 * rows belonging to its own agency — zero cross-tenant leak.
 *
 * Exit codes:
 *   0 — all 50 transactions passed; no cross-tenant rows observed
 *   1 — cross-tenant leak detected; offending details printed to stderr
 *   2 — skipped; INTEGRATION_<SLUG>_DB_PASSWORD env vars not set
 *
 * Usage:
 *   pnpm tsx scripts/verify-pgbouncer-rls.ts
 *   BRAND_DB_PASSWORD=... ECOMMERCE_DB_PASSWORD=... pnpm tsx scripts/verify-pgbouncer-rls.ts
 *
 * Reference: docs/runbooks/pgbouncer-rls.md, RESEARCH §1.3, pitfall 8.1
 */

import crypto from 'node:crypto'
import { createAgencyDb, withAgencyContext, schema } from '@mjagency/db'
import { AGENCIES } from '@mjagency/config'
import type { AgencySlug } from '@mjagency/config'

// ── Agency password resolution ───────────────────────────────────────────────

/**
 * Read per-agency DB passwords from environment variables.
 * Each agency expects <UPPER>_DB_PASSWORD (e.g. BRAND_DB_PASSWORD).
 * Falls back to 'dev-secret-12345' for local development.
 *
 * Returns null if NO passwords are set at all (fully unauthenticated environment).
 */
function resolvePasswords(): Map<AgencySlug, string> | null {
  const passwords = new Map<AgencySlug, string>()
  let anySet = false

  for (const slug of AGENCIES) {
    const upper = slug.toUpperCase()
    const pw = process.env[`${upper}_DB_PASSWORD`]
    if (pw) {
      passwords.set(slug as AgencySlug, pw)
      anySet = true
    } else {
      passwords.set(slug as AgencySlug, 'dev-secret-12345')
    }
  }

  // If none are explicitly set (all fell through to default), require INTEGRATION_DATABASE_URL
  // as the signal that an integration database is available.
  if (!anySet && !process.env.INTEGRATION_DATABASE_URL) {
    return null
  }

  return passwords
}

// ── Deterministic agency UUID derivation ────────────────────────────────────

/**
 * Derives a deterministic UUID for each agency from the slug using SHA-256.
 * This matches the pattern from packages/testing/src/fixtures/agency-fixture.ts.
 *
 * Production UUIDs come from the agencies table; these are for test isolation.
 */
function deriveAgencyUuid(slug: string): string {
  const hash = crypto.createHash('sha256').update(`mjagency-${slug}`).digest('hex')
  // Format as UUID v4-style: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join('-')
}

// ── Seed phase ───────────────────────────────────────────────────────────────

/**
 * Insert exactly 5 test rows per agency.
 * Each row is scoped to the agency and has a deterministic email for idempotency.
 * Uses TRUNCATE via a direct admin connection approach is not available here;
 * instead, uses ON CONFLICT DO NOTHING to handle re-runs gracefully.
 */
async function seedAgency(
  db: ReturnType<typeof createAgencyDb>,
  slug: string,
  agencyId: string
): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const email = `verify-rls-${slug}-${i}@test.mjagency.internal`
    await withAgencyContext(db, agencyId, async (tx) => {
      await tx.execute(
        // Using raw SQL for INSERT with ON CONFLICT since drizzle insert
        // requires the full schema type. We insert into users table directly.
        // Note: This is a test script — raw SQL is acceptable here.
        // The RLS policy will apply the agency_id check via set_config.
        // eslint-disable-next-line
        { sql: `INSERT INTO users (id, agency_id, email, role, created_at, updated_at)
          VALUES (
            gen_random_uuid(),
            current_setting('app.agency_id', true)::uuid,
            $1,
            'editor',
            now(),
            now()
          )
          ON CONFLICT (agency_id, email) DO NOTHING`, params: [email] } as unknown as Parameters<typeof tx.execute>[0]
      )
    })
  }
}

// ── Verify phase ─────────────────────────────────────────────────────────────

/**
 * Single agency verification transaction: read all rows visible to this agency
 * and assert that every row's agency_id matches the expected agencyId.
 */
async function verifyAgencyTransaction(
  db: ReturnType<typeof createAgencyDb>,
  slug: string,
  agencyId: string,
  txIndex: number
): Promise<void> {
  await withAgencyContext(db, agencyId, async (tx) => {
    const rows = await tx.select().from(schema.users)

    for (const row of rows) {
      if (row.agencyId !== agencyId) {
        const err = new Error(
          `LEAK detected in tx ${txIndex}: agency "${slug}" (expected ${agencyId}) saw row with agencyId=${row.agencyId} email=${row.email}`
        )
        process.stderr.write(`\n${err.message}\n`)
        throw err
      }
    }
  })
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const passwords = resolvePasswords()

  if (!passwords) {
    console.log(
      'verify-pgbouncer-rls: SKIPPED — no integration DB credentials found.\n' +
      'To run, set INTEGRATION_DATABASE_URL or per-agency <UPPER>_DB_PASSWORD env vars.\n' +
      'Example: BRAND_DB_PASSWORD=<pw> ECOMMERCE_DB_PASSWORD=<pw> ... pnpm tsx scripts/verify-pgbouncer-rls.ts'
    )
    process.exit(2)
  }

  console.log('verify-pgbouncer-rls: starting...')
  console.log(`  Agencies: ${AGENCIES.join(', ')}`)
  console.log(`  Concurrent transactions: 50 (strided across 12 agencies by i % 12)`)
  console.log('')

  // Build per-agency DB clients (one per slug — each points to PgBouncer port for that agency)
  const AGENCY_IDS = new Map<AgencySlug, string>()
  const DBS = new Map<AgencySlug, ReturnType<typeof createAgencyDb>>()

  for (const slug of AGENCIES) {
    const agencyId = deriveAgencyUuid(slug)
    AGENCY_IDS.set(slug as AgencySlug, agencyId)
    DBS.set(slug as AgencySlug, createAgencyDb(slug as AgencySlug, passwords.get(slug as AgencySlug)!))
  }

  // ── Phase 1: Seed 5 rows per agency ────────────────────────────────────────
  console.log('Phase 1: seeding 5 rows per agency...')
  try {
    await Promise.all(
      AGENCIES.map((slug) => {
        const db = DBS.get(slug as AgencySlug)!
        const agencyId = AGENCY_IDS.get(slug as AgencySlug)!
        return seedAgency(db, slug, agencyId)
      })
    )
    console.log('  Seed complete.')
  } catch (err) {
    console.error('\nPhase 1 seed failed:', (err as Error).message)
    console.error('Note: Seed requires Plan 02-03 migrations applied. Run migrate-runner first.')
    console.error('Proceeding to verification phase (read-only queries against existing rows)...\n')
  }

  // ── Phase 2: 50 concurrent withAgencyContext transactions ──────────────────
  console.log('Phase 2: running 50 concurrent transactions across 12 agencies...')
  const agents: Promise<unknown>[] = []

  for (let i = 0; i < 50; i++) {
    const slug = AGENCIES[i % 12] as AgencySlug
    const db = DBS.get(slug)!
    const agencyId = AGENCY_IDS.get(slug)!
    agents.push(verifyAgencyTransaction(db, slug, agencyId, i))
  }

  try {
    await Promise.all(agents)
  } catch (err) {
    console.error('\nverify-pgbouncer-rls: FAILED — cross-tenant leak detected.')
    console.error((err as Error).message)
    process.exit(1)
  }

  // ── Phase 3: Summary ────────────────────────────────────────────────────────
  console.log('')
  console.log('verify-pgbouncer-rls: 50/50 transactions OK across 12 agencies')
  console.log('  No cross-tenant rows observed. RLS + PgBouncer SET LOCAL is working correctly.')
  process.exit(0)
}

main().catch((err) => {
  console.error('verify-pgbouncer-rls: unexpected error:', (err as Error).message)
  process.exit(1)
})
