/**
 * packages/db/src/vault/crypto.ts
 *
 * Pure AES-GCM-256 encrypt/decrypt helpers using Node's built-in `node:crypto`.
 *
 * PITFALL 8.7 WARNING: Do NOT use pgcrypto for AES-GCM.
 * pgcrypto's `pgp_sym_encrypt` uses PGP/CBC, not AES-GCM. AES-GCM with
 * authentication tags is only available in pgcrypto via `encrypt`/`decrypt`
 * in ECB/CBC modes — none of which provide authenticated encryption.
 * The correct implementation uses Node's `createCipheriv('aes-256-gcm', ...)`
 * at the application layer (RESEARCH §6, SEC-N10).
 *
 * Cipher buffer layout (per RESEARCH §6.2):
 *   [12-byte IV] [16-byte authTag] [N-byte ciphertext]
 *
 * The auth tag provides tamper detection — any modification to the ciphertext
 * or associated data causes `decipher.final()` to throw (T-02-016 mitigation).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

/**
 * Encrypts a UTF-8 plaintext string using AES-256-GCM.
 *
 * Returns a Buffer with layout: [IV (12 bytes)] [authTag (16 bytes)] [ciphertext].
 * A fresh random IV is generated per call — the same plaintext produces different
 * ciphertext on every invocation (semantic security / IND-CPA).
 *
 * @param plaintext - UTF-8 string to encrypt
 * @param key - exactly 32-byte (256-bit) Buffer; derive via getVaultKey()
 * @throws if key.length !== 32
 */
export function encryptVaultValue(plaintext: string, key: Buffer): Buffer {
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes (256-bit)')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted])
}

/**
 * Decrypts a cipher buffer produced by `encryptVaultValue`.
 *
 * Verifies the GCM auth tag — throws if the ciphertext or tag has been tampered.
 * The buffer layout must be: [IV (12 bytes)] [authTag (16 bytes)] [ciphertext].
 *
 * @param cipherBuffer - Buffer from encryptVaultValue
 * @param key - exactly 32-byte (256-bit) Buffer matching the encrypt key
 * @throws if key.length !== 32
 * @throws if auth tag verification fails (tampered or wrong key)
 */
export function decryptVaultValue(cipherBuffer: Buffer, key: Buffer): string {
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes (256-bit)')
  const iv = cipherBuffer.subarray(0, IV_BYTES)
  const authTag = cipherBuffer.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = cipherBuffer.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext) + decipher.final('utf8')
}
