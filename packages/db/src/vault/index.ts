/**
 * packages/db/src/vault/index.ts
 *
 * Barrel export for the @mjagency/db vault namespace.
 *
 * Consumers:
 *   - Application code: import { vault } from '@mjagency/db'
 *     vault.putVaultValue(db, agencyId, 'cloudflare_api_token', token)
 *   - BullMQ encrypted queue (Task 6.3): import { encryptVaultValue, decryptVaultValue } from '@mjagency/db'
 */

export { encryptVaultValue, decryptVaultValue } from './crypto.js'
export { getVaultKey } from './key.js'
export { putVaultValue, getVaultValue, getActiveVaultValue, revokeVaultValue } from './store.js'
