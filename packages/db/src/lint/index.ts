/**
 * packages/db/src/lint/index.ts
 *
 * Re-exports all custom ESLint rules from @mjagency/db/lint.
 *
 * Usage in packages/config/eslint/index.js:
 *   import { noSessionSet } from '@mjagency/db/lint'
 */

export { noSessionSet } from './no-session-set.js'
