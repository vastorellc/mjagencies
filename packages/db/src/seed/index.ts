/**
 * packages/db/src/seed/index.ts
 *
 * Barrel export for @mjagency/db/seed.
 *
 * Consumers:
 *   - scripts/seed-runner.ts — CLI imports runSeed, runSeedAllAgencies, allSteps, agencyUuid
 *   - Phase 5 (content sprint) — imports SeedStep to add content seed steps
 *   - Phase 9 (CRM pre-seeds) — imports SeedStep to add CRM data steps
 *   - Plan 12 (launch) — imports runSeedAllAgencies + allSteps for full fan-out
 */

export type { SeedStep, AgencyTx } from './types.js'
export { runSeed, runSeedAllAgencies } from './runner.js'
export type { SeedAgencyResult } from './runner.js'
export { agencyUuid } from './uuid.js'

// Real seed steps shipped in Plan 02-04
export { agenciesStep } from './steps/agencies.js'
export { adminUsersStep } from './steps/admin-users.js'

import { agenciesStep } from './steps/agencies.js'
import { adminUsersStep } from './steps/admin-users.js'

/**
 * The canonical ordered list of seed steps for all agencies.
 *
 * Order matters — the runner executes steps in array order and tracks
 * each by name in _seed_state. Adding new steps appends to the end;
 * never reorder or rename existing entries (would break resumability
 * for partially-seeded DBs).
 *
 * Phase 5 (content) and Phase 9 (CRM) add their steps via their own
 * phase-local arrays passed to runSeed, OR by extending this list
 * after Phase 12 launch sequencing is confirmed. See runbook for guidance.
 */
export const allSteps = [agenciesStep, adminUsersStep]
