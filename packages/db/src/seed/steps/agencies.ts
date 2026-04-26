/**
 * packages/db/src/seed/steps/agencies.ts
 *
 * Seed step: insert the top-level agency record into `agencies`.
 *
 * This is step 1 in allSteps. It runs before admin-users so that the
 * agency row exists (referenced as agency_id by the users table).
 *
 * Idempotency: ON CONFLICT (slug) DO NOTHING — safe to run multiple times.
 * If the agency already exists (e.g. from a prior partial seed), the insert
 * is silently skipped. The _seed_state tracking ensures this step is not
 * re-run once marked 'completed', but the ON CONFLICT guard provides an
 * extra safety net for edge cases (e.g. manual DB manipulation).
 *
 * RLS note: the agencies table has NO RLS (Plan 02-01). The set_config call
 * in the runner is still applied for consistency with all other steps — it
 * does not cause errors on non-RLS tables.
 *
 * T-02-010 mitigation: idempotent insert via onConflictDoNothing.
 */

import type { SeedStep } from '../types.js'
import { agencies } from '../../schema/agencies.js'
import { agencyUuid } from '../uuid.js'

/**
 * Step 1: insert the agency record.
 *
 * Inserts a row into `agencies` with the deterministic UUID derived from
 * the slug (agencyUuid). The display name is derived from the slug for
 * MVP; Phase 7 (settings) will allow renaming via the admin UI.
 */
export const agenciesStep: SeedStep = {
  name: 'agencies',
  async run(tx, slug) {
    const id = agencyUuid(slug)
    // Derive a human-readable name from the slug for MVP display
    // e.g. 'web-dev' → 'Web Dev', 'ecommerce' → 'Ecommerce'
    const name =
      slug.charAt(0).toUpperCase() +
      slug.slice(1).replace(/-/g, ' ')

    await tx
      .insert(agencies)
      .values({ id, slug, name })
      .onConflictDoNothing({ target: agencies.slug })
  },
}
