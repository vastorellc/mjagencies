/**
 * packages/db/src/schema/index.ts
 *
 * Barrel re-export of every schema module.
 * Single import point for the migration runner + application code.
 *
 * Import pattern:
 *   import * as schema from '@mjagency/db/schema'  — for drizzle({ schema })
 *   import { users, sessions, ... } from '@mjagency/db'  — for query builders
 */

export * from './base.js'
export * from './agencies.js'
export * from './users.js'
export * from './sessions.js'
export * from './permissions-vault.js'
export * from './audit-log.js'
export * from './seed-state.js'
export * from './mfa-config.js'
