/**
 * packages/db/src/seed/steps/admin-users.ts
 *
 * Seed step: create one super_admin user per agency.
 *
 * This is step 2 in allSteps. It runs after the agencies step so the
 * agency row referenced by agency_id already exists.
 *
 * Idempotency: Uses SELECT-then-INSERT to avoid requiring a UNIQUE constraint
 * on users.email. The users table has a composite unique index on (agency_id, email)
 * (Plan 02-01) but no single-column unique constraint on email alone. An
 * ON CONFLICT (email) clause would require a single-column unique index —
 * adding that would be an out-of-scope schema change. The SELECT-then-INSERT
 * approach is equivalent in correctness and keeps Plan 02-01 schema unchanged.
 * (Decision documented in SUMMARY.md.)
 *
 * NOTE — T-02-011 placeholder password:
 *   The seeded super_admin gets a placeholder bcrypt hash for 'changeme'.
 *   Phase 3 (auth plan 03-xx) replaces this step with a real onboarding
 *   token flow before launch. Search codebase for TODO_PHASE3 to find all
 *   replacement points.
 *
 * DEV ONLY: The placeholder password MUST NOT reach production. Production
 * seed runs are gated by the Phase 12 launch checklist which requires
 * Phase 3 auth to be deployed first.
 *
 * T-02-010 mitigation: SELECT-then-INSERT prevents duplicate rows.
 */

import type { SeedStep } from '../types.js'
import { agencyUuid } from '../uuid.js'
import { sql } from 'drizzle-orm'

/**
 * Step 2: create one super_admin user per agency.
 *
 * Email convention: super_admin@<slug>.brand.local
 * (resolves via local /etc/hosts for dev; external domain for prod Phase 3)
 *
 * TODO_PHASE3: replace placeholder password hash with real onboarding token flow.
 * The bcrypt hash below is for 'changeme' at cost factor 4 (fast for dev, not secure).
 * Phase 3 must regenerate all super_admin credentials via the onboarding token API.
 */
export const adminUsersStep: SeedStep = {
  name: 'admin-users',
  async run(tx, slug) {
    const agencyId = agencyUuid(slug)
    const email = `super_admin@${slug}.brand.local`

    // SELECT-then-INSERT: check for existing email first to maintain idempotency
    // without requiring a single-column unique constraint on users.email.
    // The RLS context (set_config) is already active in this transaction.
    const existing = await tx.execute(
      sql`SELECT 1 FROM users WHERE email = ${email} LIMIT 1`
    )

    // existing.rows may be an array; treat empty array as "not found"
    const rows = (existing as { rows?: unknown[] }).rows ?? []
    if (rows.length === 0) {
      // TODO_PHASE3: replace with onboarding token flow — this placeholder
      // bcrypt hash is for 'changeme' (cost 4, dev-only).
      await tx.execute(
        sql`INSERT INTO users (id, agency_id, email, role)
            VALUES (gen_random_uuid(), ${agencyId}::uuid, ${email}, 'super_admin')`
      )
    }
  },
}
