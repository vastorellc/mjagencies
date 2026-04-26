/**
 * packages/db/src/seed/runner.ts
 *
 * Resumable per-agency seed executor.
 *
 * Architecture:
 *   - runSeed(db, agencySlug, agencyId, steps[]) — iterates steps, skips
 *     completed ones, marks running/completed/failed in _seed_state table.
 *   - runSeedAllAgencies(passwords, allSteps) — fans out across all agencies
 *     in parallel via Promise.allSettled, returns a per-agency summary.
 *
 * Resumability contract (RESEARCH §3.1):
 *   - 'completed' steps are skipped on re-run.
 *   - 'failed' steps are retried (not skipped).
 *   - 'running' steps are retried (crash during step leaves it as running).
 *   - Steps run in declared order — _seed_state.step_name is the PK.
 *
 * PITFALL 8.5 mitigation:
 *   - set_config('app.agency_id', agencyId, true) is called as the FIRST
 *     statement inside every step's transaction, BEFORE step.run.
 *   - 'true' = SET LOCAL — reverted at transaction end, preventing RLS context
 *     leakage across PgBouncer-multiplexed connections.
 *
 * T-02-009 mitigation: every step body wrapped in db.transaction() with
 * set_config called first — seeds cannot insert wrong-tenant data.
 *
 * T-02-010 mitigation: steps use idempotent inserts; _seed_state tracks
 * completion status so completed steps are never re-run.
 */

import { eq, sql } from 'drizzle-orm'
import { seedState } from '../schema/seed-state.js'
import type { AgencyDb } from '../client.js'
import type { SeedStep } from './types.js'
import type { AGENCIES } from '@mjagency/config'

/** Simple UUID regex for runtime validation of the agencyId argument. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Runs a list of seed steps against a single agency database.
 *
 * Steps that are already 'completed' in _seed_state are skipped.
 * On failure, the failed step is marked 'failed' with error_text and the
 * error is rethrown — the caller (CLI) handles the exit code. On a subsequent
 * run, the failed step is retried from the beginning (idempotency is the
 * step's responsibility).
 *
 * @param db - AgencyDb for the target agency (PgBouncer-connected)
 * @param agencySlug - human-readable slug used for console output and step context
 * @param agencyId - UUID of the agency (must match agencies.id) — set as RLS context
 * @param steps - ordered list of SeedStep objects to execute
 */
export async function runSeed(
  db: AgencyDb,
  agencySlug: string,
  agencyId: string,
  steps: SeedStep[]
): Promise<void> {
  if (!UUID_RE.test(agencyId)) {
    throw new Error(
      `runSeed: agencyId "${agencyId}" is not a valid UUID. ` +
        'Use agencyUuid(slug) from @mjagency/db/seed to derive it.'
    )
  }

  for (const step of steps) {
    // ------------------------------------------------------------------
    // Check if already completed — skip if so
    // ------------------------------------------------------------------
    const existing = await db
      .select()
      .from(seedState)
      .where(eq(seedState.stepName, step.name))
      .limit(1)

    if (existing[0]?.status === 'completed') {
      console.log(`[seed:${agencySlug}] ${step.name}: already completed, skipping`)
      continue
    }

    // ------------------------------------------------------------------
    // Mark step as running (upsert in case it was previously failed/running)
    // ------------------------------------------------------------------
    await db
      .insert(seedState)
      .values({ stepName: step.name, status: 'running', startedAt: new Date() })
      .onConflictDoUpdate({
        target: seedState.stepName,
        set: { status: 'running', startedAt: new Date(), errorText: null },
      })

    try {
      // ----------------------------------------------------------------
      // Execute step inside a transaction with RLS context set first
      // PITFALL 8.5: set_config MUST be called before step.run
      // ----------------------------------------------------------------
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.agency_id', ${agencyId}, true)`)
        await step.run(tx, agencySlug)
      })

      await db
        .update(seedState)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(seedState.stepName, step.name))

      console.log(`[seed:${agencySlug}] ${step.name}: completed`)
    } catch (err) {
      // Mark failed with diagnostic message
      await db
        .update(seedState)
        .set({ status: 'failed', errorText: String(err) })
        .where(eq(seedState.stepName, step.name))

      console.error(`[seed:${agencySlug}] ${step.name}: FAILED —`, err)
      throw err
    }
  }
}

/** Per-agency result from runSeedAllAgencies. */
export interface SeedAgencyResult {
  slug: (typeof AGENCIES)[number]
  status: 'ok' | 'failed'
  error?: string
}

/**
 * Fans out runSeed across all provided agency databases in parallel.
 *
 * Uses Promise.allSettled so a failure in one agency does not abort the others.
 * Prints a per-agency summary table after all settle.
 *
 * @param agencyTargets - array of { slug, db, agencyId } to seed
 * @param steps - ordered list of SeedStep objects (same list for all agencies)
 * @returns summary array (one entry per agency)
 */
export async function runSeedAllAgencies(
  agencyTargets: Array<{
    slug: (typeof AGENCIES)[number]
    db: AgencyDb
    agencyId: string
  }>,
  steps: SeedStep[]
): Promise<SeedAgencyResult[]> {
  const results = await Promise.allSettled(
    agencyTargets.map(({ slug, db, agencyId }) =>
      runSeed(db, slug, agencyId, steps)
    )
  )

  const summary: SeedAgencyResult[] = []
  let failed = 0

  for (let i = 0; i < results.length; i++) {
    const result = results[i] as PromiseSettledResult<void>
    const slug = (agencyTargets[i] as (typeof agencyTargets)[number]).slug

    if (result.status === 'fulfilled') {
      summary.push({ slug, status: 'ok' })
    } else {
      const rejected = result as PromiseRejectedResult
      summary.push({ slug, status: 'failed', error: String(rejected.reason) })
      failed++
    }
  }

  const total = summary.length
  console.log(`\nseed-runner: ${total - failed}/${total} OK`)

  return summary
}
