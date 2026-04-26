/**
 * packages/db/src/vault/key.ts
 *
 * Derives the 32-byte AES-GCM-256 vault encryption key from the
 * `VAULT_ENCRYPTION_KEY` environment variable using `scryptSync`.
 *
 * Key derivation rationale (RESEARCH §6.2):
 *   - Raw env vars are rarely exactly 32 bytes and may contain low-entropy strings.
 *   - scryptSync stretches the input to exactly 32 bytes with configurable CPU/memory cost.
 *   - The per-domain salt `'mjagency-vault-kdf-salt-v1'` ensures that even if vault and queue
 *     share the same source secret material, they produce distinct cryptographic keys —
 *     preventing key reuse across security boundaries.
 *
 * SEC-10 Key Rotation Procedure:
 *   Phase 11 ships the background job. Manual procedure until then:
 *   1. Add VAULT_ENCRYPTION_KEY_V2 to Doppler.
 *   2. Deploy code that writes new rows with keyVersion=2, reads by trying v2 then v1.
 *   3. Background job re-encrypts old rows (keyVersion=1) in batches.
 *   4. Once all rows are keyVersion=2, retire the VAULT_ENCRYPTION_KEY_V1 secret in Doppler.
 *   See docs/runbooks/vault-audit.md for the full procedure.
 *
 * Doppler injection:
 *   This function reads the env var at call time (not module load time) so tests
 *   can set/unset it per test case. Never cache the return value across key rotations.
 */

import { scryptSync } from 'node:crypto'

/**
 * Returns a 32-byte Buffer suitable for use with `encryptVaultValue` / `decryptVaultValue`.
 *
 * Reads `VAULT_ENCRYPTION_KEY` from the environment (Doppler-injected in production).
 * The key is derived via scrypt with vault-domain salt to isolate it from other key uses.
 *
 * @throws if `VAULT_ENCRYPTION_KEY` is not set
 */
export function getVaultKey(): Buffer {
  const raw = process.env.VAULT_ENCRYPTION_KEY
  if (!raw) throw new Error('VAULT_ENCRYPTION_KEY not set in Doppler env')
  return scryptSync(raw, 'mjagency-vault-kdf-salt-v1', 32) as Buffer
}
