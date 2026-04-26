/**
 * packages/db/src/migrate/index.ts
 *
 * Public API barrel for @mjagency/db/migrate subpath.
 *
 * Consumed by:
 *   - scripts/migrate-runner.ts (runAllMigrations, runMigration)
 *   - scripts/migrate-rollback.ts (snapshotAgency)
 *   - Plan 02-04 (seed runner) — reads runMigration to ensure schema is applied
 *
 * Note: snapshotAgency is exported here and will be added in Task 3.2.
 */

export { runMigration, runAllMigrations } from './runner.js'
export type { RunAllOptions } from './runner.js'
export { applyCustomDdl, CUSTOM_FILES } from './apply-custom.js'
export { dryRun } from './dry-run.js'
export type { DryRunResult } from './dry-run.js'
