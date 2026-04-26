/**
 * packages/queue/src/key.ts
 *
 * Derives the 32-byte AES-GCM-256 key for BullMQ payload encryption
 * from the `BULLMQ_ENCRYPTION_KEY` environment variable using `scryptSync`.
 *
 * Key derivation (RESEARCH §6.2):
 *   The queue domain salt `'mjagency-queue-kdf-salt-v1'` is DIFFERENT from the
 *   vault domain salt `'mjagency-vault-kdf-salt-v1'`. This ensures that even if
 *   both `VAULT_ENCRYPTION_KEY` and `BULLMQ_ENCRYPTION_KEY` hold the same raw
 *   secret material, they produce cryptographically distinct 256-bit keys —
 *   preventing cross-domain key reuse (T-02-019 mitigation).
 *
 * Doppler injection:
 *   `BULLMQ_ENCRYPTION_KEY` is managed in the shared Doppler project.
 *   Never set it via NEXT_PUBLIC_ or in .env files committed to git.
 *   See docs/runbooks/vault-audit.md for key management procedures.
 */

import { scryptSync } from 'node:crypto'

/**
 * Returns a 32-byte Buffer for use with `encryptVaultValue` / `decryptVaultValue`.
 *
 * Reads `BULLMQ_ENCRYPTION_KEY` from the environment (Doppler-injected in production).
 * The key uses queue-domain salt — distinct from the vault domain salt.
 *
 * @throws if `BULLMQ_ENCRYPTION_KEY` is not set
 */
export function getQueueKey(): Buffer {
  const raw = process.env.BULLMQ_ENCRYPTION_KEY
  if (!raw) throw new Error('BULLMQ_ENCRYPTION_KEY not set in Doppler env')
  return scryptSync(raw, 'mjagency-queue-kdf-salt-v1', 32) as Buffer
}
