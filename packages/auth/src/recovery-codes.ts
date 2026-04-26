/**
 * packages/auth/src/recovery-codes.ts
 *
 * MFA recovery codes — 8 single-use bcrypt-hashed codes.
 * REQ-025, REQ-309: 8 one-time codes, bcrypt stored.
 * SEC-12: bcrypt cost factor 12.
 *
 * Pitfall 8: bcrypt hashing MUST only happen at SETUP time (when codes are first generated).
 * NEVER call bcrypt.hash() on the verification hot path — it is intentionally slow.
 * verifyRecoveryCode uses bcrypt.compare() with the ALREADY-hashed stored values.
 *
 * Slot invalidation: used slots are set to '' (empty string), not removed from the array.
 * This preserves the 8-element structure for the mfa_config.recovery_hashes column
 * and prevents double-use without requiring a DB array shrink operation.
 *
 * Once all 8 slots are empty (''), the MFA reset workflow generates a fresh batch.
 */

import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'

const BCRYPT_COST = 12 // SEC-12
const CODE_COUNT = 8 // REQ-025, REQ-309
const CODE_BYTES = 16 // 128-bit random → 32 hex chars

/**
 * Generate 8 cryptographically secure recovery codes.
 * Each code is 16 random bytes encoded as a 32-character lowercase hex string.
 *
 * REQ-025, REQ-309: 8 one-time codes, each with 128 bits of entropy.
 */
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: CODE_COUNT }, () => randomBytes(CODE_BYTES).toString('hex'))
}

/**
 * Hash all recovery codes with bcrypt at cost factor 12.
 * Called ONCE at setup time — NEVER during verification (Pitfall 8).
 *
 * SEC-12: cost factor 12 provides offline-attack resistance.
 * Each code is hashed individually (parallel via Promise.all for speed at setup).
 */
export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  // Hashed once at SETUP time — never on the verification hot path (Pitfall 8)
  return Promise.all(codes.map((code) => bcrypt.hash(code, BCRYPT_COST)))
}

/**
 * Verify a recovery code attempt against the user's stored hashes.
 * Returns the matching slot index for invalidation, or -1 if none match.
 *
 * Empty-string slots are skipped (already-used codes — slot is invalidated by setting hash to '').
 *
 * T-03-007: empty-slot skip prevents reuse of a previously consumed code.
 */
export async function verifyRecoveryCode(
  plainCode: string,
  storedHashes: string[],
): Promise<number> {
  for (let i = 0; i < storedHashes.length; i++) {
    const hash = storedHashes[i]
    if (hash && hash !== '' && (await bcrypt.compare(plainCode, hash))) {
      return i
    }
  }
  return -1
}

/**
 * Returns a copy of `storedHashes` with `index` set to '' (single-use invalidation).
 * Caller persists the new array via withAgencyContext + UPDATE on mfa_config.recovery_hashes.
 *
 * Does NOT mutate the input array — returns a new array (immutable update pattern).
 */
export function invalidateRecoverySlot(storedHashes: string[], index: number): string[] {
  const next = [...storedHashes]
  next[index] = ''
  return next
}
