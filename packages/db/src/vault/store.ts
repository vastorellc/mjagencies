/**
 * packages/db/src/vault/store.ts
 *
 * Database-aware vault helpers — wrap `withAgencyContext` so RLS enforces
 * per-agency isolation for all vault reads and writes.
 *
 * Every helper:
 *   1. Wraps the DB call in `withAgencyContext` (RLS context + transaction-scoped SET LOCAL)
 *   2. Uses `getVaultKey()` to derive the encryption key from env at call time
 *   3. Uses `keyVersion: 1` (SEC-10 rotation lands in Phase 11 hardening)
 *
 * Soft delete pattern:
 *   `revokeVaultValue` sets `revokedAt = now()` instead of hard-deleting, preserving
 *   the audit trail. `getActiveVaultValue` filters revoked + expired rows (REQ-407).
 *
 * RLS enforcement:
 *   `withAgencyContext` issues `set_config('app.agency_id', agencyId, true)` inside a
 *   transaction. The permissions_vault RLS policy uses this setting. Any row belonging
 *   to a different agency is invisible to the current transaction.
 */

import { eq, and, isNull, gt, or } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import type { AgencyDb } from '../client.js'
import { withAgencyContext } from '../client.js'
import { permissionsVault } from '../schema/permissions-vault.js'
import { encryptVaultValue, decryptVaultValue } from './crypto.js'
import { getVaultKey } from './key.js'

/**
 * Inserts or updates an encrypted vault entry for the given agency + permission key.
 *
 * Uses INSERT ... ON CONFLICT (agency_id, permission_key) DO UPDATE to provide
 * upsert semantics — safe to call multiple times with new values.
 *
 * @param db - AgencyDb instance (PgBouncer transaction mode)
 * @param agencyId - UUID of the agency that owns this secret
 * @param permissionKey - Logical name (e.g. 'cloudflare_api_token', 'stripe_webhook_secret')
 * @param plaintext - Secret value to encrypt and store
 * @param opts.expiresAt - Optional expiry date (REQ-407 asset permission expiry)
 */
export async function putVaultValue(
  db: AgencyDb,
  agencyId: string,
  permissionKey: string,
  plaintext: string,
  opts?: { expiresAt?: Date }
): Promise<void> {
  const key = getVaultKey()
  const encrypted = encryptVaultValue(plaintext, key)
  await withAgencyContext(db, agencyId, async (tx) => {
    await tx
      .insert(permissionsVault)
      .values({
        agencyId,
        permissionKey,
        encryptedValue: encrypted,
        keyVersion: 1,
        expiresAt: opts?.expiresAt ?? null,
        revokedAt: null,
      })
      .onConflictDoUpdate({
        target: [permissionsVault.agencyId, permissionsVault.permissionKey],
        set: {
          encryptedValue: encrypted,
          keyVersion: 1,
          expiresAt: opts?.expiresAt ?? null,
          revokedAt: null,
          updatedAt: sql`now()`,
        },
      })
  })
}

/**
 * Retrieves and decrypts a vault value regardless of expiry or revocation status.
 * Returns null if no row is found for the given agency + permission key.
 *
 * For active-only checks, use `getActiveVaultValue` instead.
 */
export async function getVaultValue(
  db: AgencyDb,
  agencyId: string,
  permissionKey: string
): Promise<string | null> {
  const key = getVaultKey()
  const row = await withAgencyContext(db, agencyId, async (tx) => {
    const rows = await tx
      .select()
      .from(permissionsVault)
      .where(
        and(
          eq(permissionsVault.agencyId, agencyId),
          eq(permissionsVault.permissionKey, permissionKey)
        )
      )
      .limit(1)
    return rows[0] ?? null
  })
  if (!row) return null
  return decryptVaultValue(row.encryptedValue as Buffer, key)
}

/**
 * Retrieves and decrypts an active (non-expired, non-revoked) vault value.
 *
 * Returns null if:
 *   - No row exists
 *   - Row has expiresAt < now() (REQ-407)
 *   - Row has revokedAt set (soft-deleted)
 */
export async function getActiveVaultValue(
  db: AgencyDb,
  agencyId: string,
  permissionKey: string
): Promise<string | null> {
  const key = getVaultKey()
  const row = await withAgencyContext(db, agencyId, async (tx) => {
    const rows = await tx
      .select()
      .from(permissionsVault)
      .where(
        and(
          eq(permissionsVault.agencyId, agencyId),
          eq(permissionsVault.permissionKey, permissionKey),
          isNull(permissionsVault.revokedAt),
          or(
            isNull(permissionsVault.expiresAt),
            gt(permissionsVault.expiresAt, sql`now()`)
          )
        )
      )
      .limit(1)
    return rows[0] ?? null
  })
  if (!row) return null
  return decryptVaultValue(row.encryptedValue as Buffer, key)
}

/**
 * Soft-deletes a vault entry by setting `revokedAt = now()`.
 *
 * The row is preserved for audit trail purposes. `getActiveVaultValue`
 * will return null for revoked entries. Hard-delete is intentionally unsupported.
 */
export async function revokeVaultValue(
  db: AgencyDb,
  agencyId: string,
  permissionKey: string
): Promise<void> {
  await withAgencyContext(db, agencyId, async (tx) => {
    await tx
      .update(permissionsVault)
      .set({ revokedAt: sql`now()`, updatedAt: sql`now()` })
      .where(
        and(
          eq(permissionsVault.agencyId, agencyId),
          eq(permissionsVault.permissionKey, permissionKey)
        )
      )
  })
}
