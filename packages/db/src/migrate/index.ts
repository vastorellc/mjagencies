/**
 * packages/db/src/migrate/index.ts
 *
 * Public API barrel for @mjagency/db/migrate subpath.
 *
 * Consumed by:
 *   - scripts/migrate-runner.ts (runAllMigrations, runMigration)
 *   - scripts/migrate-rollback.ts (snapshotAgency)
 *   - Plan 02-04 (seed runner) — reads runMigration to ensure schema is applied
 */

export { runMigration, runAllMigrations } from './runner.js'
export type { RunAllOptions } from './runner.js'
export { applyCustomDdl, CUSTOM_FILES } from './apply-custom.js'
export { dryRun } from './dry-run.js'
export type { DryRunResult } from './dry-run.js'
export { snapshotAgency } from './snapshot.js'
