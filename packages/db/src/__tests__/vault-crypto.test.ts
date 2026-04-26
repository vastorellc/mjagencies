/**
 * packages/db/src/__tests__/vault-crypto.test.ts
 *
 * Unit tests for AES-GCM-256 vault crypto + key derivation.
 * All tests are pure unit tests — no DB required.
 *
 * Tests cover REQ-018 (encrypted vault), SEC-N10 (AES-GCM-256 via Node crypto),
 * and pitfall 8.7 validation (application-layer encryption, not pgcrypto).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { scryptSync } from 'node:crypto'
import { encryptVaultValue, decryptVaultValue } from '../vault/crypto.js'
import { getVaultKey } from '../vault/key.js'

const TEST_KEY = Buffer.alloc(32) // 32 zero bytes — safe for unit tests only

describe('encryptVaultValue / decryptVaultValue', () => {
  // Test 1: Roundtrip plaintext
  it('roundtrip: encrypts and decrypts plaintext correctly', () => {
    const plaintext = 'hello'
    const cipherBuffer = encryptVaultValue(plaintext, TEST_KEY)
    expect(decryptVaultValue(cipherBuffer, TEST_KEY)).toBe(plaintext)
  })

  // Test 2: Roundtrip empty string
  it('roundtrip: handles empty string', () => {
    const plaintext = ''
    const cipherBuffer = encryptVaultValue(plaintext, TEST_KEY)
    expect(decryptVaultValue(cipherBuffer, TEST_KEY)).toBe(plaintext)
  })

  // Test 3: Roundtrip unicode
  it('roundtrip: handles unicode and emoji', () => {
    const plaintext = '秘密 🔐 αβγ'
    const cipherBuffer = encryptVaultValue(plaintext, TEST_KEY)
    expect(decryptVaultValue(cipherBuffer, TEST_KEY)).toBe(plaintext)
  })

  // Test 4: Layout — IV is 12 bytes, authTag is 16 bytes
  it('layout: cipher buffer starts with 12-byte IV then 16-byte authTag', () => {
    const cipherBuffer = encryptVaultValue('test', TEST_KEY)
    // IV: first 12 bytes
    const iv = cipherBuffer.subarray(0, 12)
    // authTag: next 16 bytes
    const authTag = cipherBuffer.subarray(12, 28)
    expect(iv.length).toBe(12)
    expect(authTag.length).toBe(16)
    // Ciphertext starts at byte 28
    expect(cipherBuffer.length).toBeGreaterThanOrEqual(28)
  })

  // Test 5: Different IV per call (randomized IV)
  it('produces different IV for each encryption of same plaintext', () => {
    const cipherA = encryptVaultValue('same plaintext', TEST_KEY)
    const cipherB = encryptVaultValue('same plaintext', TEST_KEY)
    // IV is the first 12 bytes
    const ivA = cipherA.subarray(0, 12)
    const ivB = cipherB.subarray(0, 12)
    // Should be different (probabilistically guaranteed for random 12-byte IV)
    expect(ivA.equals(ivB)).toBe(false)
  })

  // Test 6: Wrong key throws
  it('throws when decrypting with a different key', () => {
    const keyA = Buffer.alloc(32, 0xaa)
    const keyB = Buffer.alloc(32, 0xbb)
    const cipherBuffer = encryptVaultValue('secret', keyA)
    expect(() => decryptVaultValue(cipherBuffer, keyB)).toThrow()
  })

  // Test 7: Tampered ciphertext throws (auth tag verification)
  it('throws when ciphertext portion is tampered (auth tag fails)', () => {
    const cipherBuffer = encryptVaultValue('integrity check', TEST_KEY)
    // Flip a byte in the ciphertext portion (after IV + authTag, i.e. byte 28+)
    const tampered = Buffer.from(cipherBuffer)
    const targetByte = tampered.length > 28 ? 28 : 12
    const current = tampered.readUInt8(targetByte)
    tampered.writeUInt8(current ^ 0xff, targetByte)
    expect(() => decryptVaultValue(tampered, TEST_KEY)).toThrow()
  })

  // Test 8: Invalid key length rejected
  it('throws when encrypting with a 31-byte key (must be 32 bytes)', () => {
    const shortKey = Buffer.alloc(31)
    expect(() => encryptVaultValue('x', shortKey)).toThrow(/32 bytes/)
  })

  it('throws when decrypting with a 31-byte key (must be 32 bytes)', () => {
    const cipherBuffer = encryptVaultValue('x', TEST_KEY)
    const shortKey = Buffer.alloc(31)
    expect(() => decryptVaultValue(cipherBuffer, shortKey)).toThrow(/32 bytes/)
  })
})

describe('getVaultKey', () => {
  const originalEnv = process.env.VAULT_ENCRYPTION_KEY

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.VAULT_ENCRYPTION_KEY
    } else {
      process.env.VAULT_ENCRYPTION_KEY = originalEnv
    }
  })

  // Test 9: getVaultKey reads VAULT_ENCRYPTION_KEY and returns 32 bytes
  it('reads VAULT_ENCRYPTION_KEY and returns a 32-byte Buffer', () => {
    process.env.VAULT_ENCRYPTION_KEY = 'test-password-for-unit-tests'
    const key = getVaultKey()
    expect(key).toBeInstanceOf(Buffer)
    expect(key.length).toBe(32)
  })

  it('throws when VAULT_ENCRYPTION_KEY is not set', () => {
    delete process.env.VAULT_ENCRYPTION_KEY
    expect(() => getVaultKey()).toThrow(/VAULT_ENCRYPTION_KEY/)
  })

  // Test 10: Different domain salts produce different keys
  it('vault salt and queue salt produce different keys for same input password', () => {
    const password = 'shared-secret-material'
    const vaultKey = scryptSync(password, 'mjagency-vault-kdf-salt-v1', 32)
    const queueKey = scryptSync(password, 'mjagency-queue-kdf-salt-v1', 32)
    expect(Buffer.compare(vaultKey, queueKey)).not.toBe(0)
  })
})
