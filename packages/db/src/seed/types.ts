/**
 * packages/db/src/seed/types.ts
 *
 * SeedStep contract for the resumable per-agency seed framework.
 *
 * PITFALL 8.5: Every step's run body executes inside db.transaction() with
 * set_config('app.agency_id', agencyId, true) set BEFORE step.run is called.
 * This ensures RLS policies are active for all queries inside the step.
 * NEVER call step.run outside a transaction with RLS context set — doing so
 * will either fail visibility checks or silently insert wrong-tenant data.
 *
 * Contract for idempotency:
 *   - If a step partially completed before failing, a re-run MUST produce the
 *     same final state (use ON CONFLICT DO NOTHING or SELECT-then-INSERT).
 *   - The runner marks a step 'running' before calling step.run, so partial
 *     completion shows up as 'running' in _seed_state after a crash. On the
 *     next run, the step is treated as pending (same as 'failed') and retried.
 */

import type { AgencyDb } from '../client.js'

/** Drizzle transaction type extracted from AgencyDb — avoids hard-coding the internal type. */
export type AgencyTx = Parameters<Parameters<AgencyDb['transaction']>[0]>[0]

export interface SeedStep {
  /** Unique step identifier — becomes _seed_state.step_name (primary key). */
  name: string

  /**
   * Step body. Runs inside a transaction where set_config('app.agency_id', id, true)
   * has already been called (pitfall 8.5 mitigation in runner.ts).
   *
   * The tx argument is the Drizzle transaction — use it for all queries so they
   * participate in the transaction and see the RLS context.
   *
   * Must be idempotent: if the step throws mid-way and is retried, the final
   * DB state must be the same as if it succeeded on the first attempt.
   *
   * @param tx - Drizzle transaction with RLS context already set
   * @param agencySlug - agency slug (e.g. 'ecommerce'), useful for constructing
   *   derived values like email addresses or display names
   */
  run: (tx: AgencyTx, agencySlug: string) => Promise<void>
}
