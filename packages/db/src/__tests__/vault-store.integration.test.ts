/**
 * packages/db/src/__tests__/vault-store.integration.test.ts
 *
 * Integration tests for vault store helpers (putVaultValue, getVaultValue,
 * getActiveVaultValue, revokeVaultValue).
 *
 * All tests gated on INTEGRATION_DATABASE_URL + VAULT_ENCRYPTION_KEY.
 * Skip gracefully when neither is available.
 *
 * Tests cover:
 *   - Encrypt-decrypt roundtrip via DB (REQ-018)
 *   - Expiry filtering (REQ-407)
 *   - Revocation filtering
 *   - Cross-agency RLS isolation (T-02-015)
 */

import { describe, it, expect } from 'vitest'

const INTEGRATION_DATABASE_URL = process.env.INTEGRATION_DATABASE_URL

describe('vault store helpers (integration)', () => {
  // Test 1: putVaultValue + getVaultValue roundtrip
  it.skipIf(!INTEGRATION_DATABASE_URL)(
    'putVaultValue stores and getVaultValue retrieves the decrypted plaintext',
    async () => {
      process.env.VAULT_ENCRYPTION_KEY = 'integration-test-vault-key'
      const { createAgencyDb } = await import('../index.js')
      const { putVaultValue, getVaultValue } = await import('../vault/store.js')
      const db = createAgencyDb('brand', process.env.INTEGRATION_DB_PASSWORD ?? '')
      const agencyId = crypto.randomUUID()
      const secret = 'sk_live_test_' + Date.now()
      await putVaultValue(db, agencyId, 'stripe_webhook_secret', secret)
      const retrieved = await getVaultValue(db, agencyId, 'stripe_webhook_secret')
      expect(retrieved).toBe(secret)
    }
  )

  // Test 2: getActiveVaultValue returns null when row is expired
  it.skipIf(!INTEGRATION_DATABASE_URL)(
    'getActiveVaultValue returns null when expires_at is in the past',
    async () => {
      process.env.VAULT_ENCRYPTION_KEY = 'integration-test-vault-key'
      const { createAgencyDb } = await import('../index.js')
      const { putVaultValue, getActiveVaultValue } = await import('../vault/store.js')
      const db = createAgencyDb('brand', process.env.INTEGRATION_DB_PASSWORD ?? '')
      const agencyId = crypto.randomUUID()
      // Set expiresAt to 1 second in the past
      const pastDate = new Date(Date.now() - 1000)
      await putVaultValue(db, agencyId, 'expired_token', 'some-value', { expiresAt: pastDate })
      const result = await getActiveVaultValue(db, agencyId, 'expired_token')
      expect(result).toBeNull()
    }
  )

  // Test 3: getActiveVaultValue returns null when row is revoked
  it.skipIf(!INTEGRATION_DATABASE_URL)(
    'getActiveVaultValue returns null after revokeVaultValue',
    async () => {
      process.env.VAULT_ENCRYPTION_KEY = 'integration-test-vault-key'
      const { createAgencyDb } = await import('../index.js')
      const { putVaultValue, getActiveVaultValue, revokeVaultValue } = await import('../vault/store.js')
      const db = createAgencyDb('brand', process.env.INTEGRATION_DB_PASSWORD ?? '')
      const agencyId = crypto.randomUUID()
      await putVaultValue(db, agencyId, 'revocable_token', 'token-value')
      await revokeVaultValue(db, agencyId, 'revocable_token')
      const result = await getActiveVaultValue(db, agencyId, 'revocable_token')
      expect(result).toBeNull()
    }
  )

  // Test 4: Cross-agency RLS — putVaultValue as agencyA, getVaultValue as agencyB returns null
  it.skipIf(!INTEGRATION_DATABASE_URL)(
    'getVaultValue returns null when different agencyId (RLS cross-agency isolation)',
    async () => {
      process.env.VAULT_ENCRYPTION_KEY = 'integration-test-vault-key'
      const { createAgencyDb } = await import('../index.js')
      const { putVaultValue, getVaultValue } = await import('../vault/store.js')
      const db = createAgencyDb('brand', process.env.INTEGRATION_DB_PASSWORD ?? '')
      const agencyA = crypto.randomUUID()
      const agencyB = crypto.randomUUID()
      await putVaultValue(db, agencyA, 'cross_agency_secret', 'agency-a-secret')
      // Attempt to read agencyA's secret as agencyB — RLS should prevent this
      const result = await getVaultValue(db, agencyB, 'cross_agency_secret')
      expect(result).toBeNull()
    }
  )
})
