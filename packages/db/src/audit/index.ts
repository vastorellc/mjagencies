/**
 * packages/db/src/audit/index.ts
 *
 * Barrel export for the @mjagency/db audit namespace.
 * Implements hash-chained audit log verification (Plan 02-06, Task 6.2).
 */

export { verifyAuditChain } from './verify-chain.js'
