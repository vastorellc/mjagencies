# Vault + Audit Log Runbook

Operator runbook for the permissions vault (AES-GCM-256 application-layer encryption) and the
hash-chained audit log (SHA-256 per-stream, append-only). Both primitives share the same
`encryptVaultValue` / `decryptVaultValue` AES-GCM-256 core in `packages/db/src/vault/crypto.ts`.

---

## Overview

| Primitive | Implementation | Key requirement |
|-----------|---------------|-----------------|
| Permissions vault | `packages/db/src/vault/` — 3 modules | `VAULT_ENCRYPTION_KEY` (Doppler) |
| Audit log triggers | `packages/db/src/migrations/custom/003_audit_triggers.sql` | none (Postgres trigger) |
| Audit log partitioning | `packages/db/src/migrations/custom/004_partition_audit_log.sql` | none (DDL migration) |
| BullMQ payload encryption | `packages/queue/src/encrypted-queue.ts` | `BULLMQ_ENCRYPTION_KEY` (Doppler) |

---

## Vault Usage

### Storing a Secret

```typescript
import { createAgencyDb, vault } from '@mjagency/db'

const db = createAgencyDb(slug, process.env[`${slug.toUpperCase()}_DB_PASSWORD`]!)

// Store a Cloudflare API token for an agency
await vault.putVaultValue(db, agencyId, 'cloudflare_api_token', token)

// With expiry (REQ-407 — asset permission expiry)
await vault.putVaultValue(db, agencyId, 'temp_upload_credential', cred, {
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
})
```

### Retrieving a Secret

```typescript
// Get active (non-expired, non-revoked) value
const token = await vault.getActiveVaultValue(db, agencyId, 'cloudflare_api_token')
if (!token) {
  throw new Error('cloudflare_api_token expired or not configured')
}

// Get value regardless of expiry/revocation (audit/admin use only)
const raw = await vault.getVaultValue(db, agencyId, 'cloudflare_api_token')
```

### Revoking a Secret

```typescript
// Soft-delete — preserves audit trail, getActiveVaultValue returns null
await vault.revokeVaultValue(db, agencyId, 'old_stripe_webhook_secret')
```

### Registered Permission Keys (as of Plan 02-06)

| Key | Description |
|-----|-------------|
| `cloudflare_api_token` | Cloudflare API token for Images/Stream/R2/Workers |
| `stripe_webhook_secret` | Stripe webhook signing secret |
| `r2_access_key` | Per-agency R2 access key (if agency-scoped) |
| `r2_secret_key` | Per-agency R2 secret key (if agency-scoped) |
| `cal_api_key` | Cal.com self-hosted API key for booking management |

Future phases register additional keys as needed.

---

## Vault Key Rotation (SEC-10)

The current implementation uses `keyVersion: 1` for all vault rows. Phase 11 ships
the background re-encryption job. Until then, the manual rotation procedure is:

### Step-by-Step

1. **Add new key to Doppler.** Add `VAULT_ENCRYPTION_KEY_V2` alongside the existing
   `VAULT_ENCRYPTION_KEY` in the shared Doppler project. Do not remove the old key yet.

2. **Deploy code that writes v2.** Update `packages/db/src/vault/key.ts` to export
   `getVaultKeyV2()` using `VAULT_ENCRYPTION_KEY_V2` with the same scrypt KDF salt.
   Update `putVaultValue` to use v2 key and `keyVersion: 2` for new writes.
   Update `getVaultValue` / `getActiveVaultValue` to try v2 first, fall back to v1.

3. **Run batch re-encryption.** Run a migration script that reads all `keyVersion = 1`
   rows, decrypts with v1 key, re-encrypts with v2 key, updates the row in a transaction.
   Verify no `keyVersion = 1` rows remain.

4. **Retire v1 key.** Remove `VAULT_ENCRYPTION_KEY` from Doppler after confirming all
   rows are `keyVersion = 2` and the application no longer references v1.

5. **Clean up code.** Remove the v1 fallback path from vault helpers.

### Key Derivation Detail

Both vault and queue keys are derived via `scryptSync` with per-domain salts:

```
vault key  = scryptSync(VAULT_ENCRYPTION_KEY,  'mjagency-vault-kdf-salt-v1', 32)
queue key  = scryptSync(BULLMQ_ENCRYPTION_KEY, 'mjagency-queue-kdf-salt-v1', 32)
```

The distinct salts ensure that even if the same raw secret is accidentally shared
between `VAULT_ENCRYPTION_KEY` and `BULLMQ_ENCRYPTION_KEY`, they produce
cryptographically distinct 256-bit keys — preventing cross-domain key reuse.

---

## Audit Log Overview

Every DML (INSERT, UPDATE, DELETE) on the following tables writes an `audit_log` row
via a `SECURITY DEFINER` Postgres trigger (`capture_audit_row()`):

- `users`
- `sessions`
- `permissions_vault`
- `agencies` (super_admin actions)

Future phases extend this list (Phase 5 — collections; Phase 9 — CRM tables).
The trigger fires as `migrations_runner` (SECURITY DEFINER), so it always has
INSERT privilege on `audit_log` regardless of the invoking app role's privileges.

### Per-Stream Hash Chain

Each `audit_log` row's `row_hash` is `sha256(canonical_string)` where
`canonical_string` includes the previous row's `row_hash` in the same stream.

**Stream key:** `(table_name, agency_id)` — rows in the `users` stream for agency A
chain independently from rows in the `sessions` stream for the same agency.

This prevents forks under concurrent writes: the trigger uses
`SELECT ... FOR UPDATE` keyed on the stream head to serialise hash computation.

```
Stream 1: users / agency-A
  row_hash[1] = sha256("...|genesis")
  row_hash[2] = sha256("...|row_hash[1]")
  row_hash[3] = sha256("...|row_hash[2]")

Stream 2: sessions / agency-A  (independent)
  row_hash[1] = sha256("...|genesis")
  row_hash[2] = sha256("...|row_hash[1]")
```

---

## actor_id Semantics

The `actor_id` column in `audit_log` records who caused the mutation.

| Source | When |
|--------|------|
| `set_config('app.actor_id', $uuid, true)` | Application sets this before any mutation in `withAgencyContext` |
| `SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001'` | Fallback when `app.actor_id` is not set (migrations, cron jobs, seeder) |

**Application code example:**

```typescript
await withAgencyContext(db, agencyId, async (tx) => {
  await tx.execute(sql`SELECT set_config('app.actor_id', ${session.userId}, true)`)
  await tx.update(users).set({ email: newEmail }).where(eq(users.id, userId))
  // Audit log row will have actor_id = session.userId
})
```

---

## Chain Verification

Run the verification script weekly (and on every deploy via CI gate):

```bash
# Verify all 12 agencies
pnpm tsx scripts/verify-audit-chain.ts --all

# Verify a single agency
pnpm tsx scripts/verify-audit-chain.ts --agency=ecommerce

# Exit codes: 0 = all intact, 1 = broken rows detected
```

Add to CI pipeline after deployment:

```yaml
- name: Verify audit chain integrity
  run: pnpm tsx scripts/verify-audit-chain.ts --all
  env:
    MIGRATIONS_DB_PASSWORD: ${{ secrets.MIGRATIONS_DB_PASSWORD }}
```

---

## Partition Maintenance

The initial `004_partition_audit_log.sql` migration creates 14 monthly partitions
(2026-04 through 2027-05). New partitions must be added monthly.

**Manual partition creation (until Phase 11 cron ships):**

```sql
-- Run as migrations_runner against each agency DB
CREATE TABLE IF NOT EXISTS audit_log_2027_06 PARTITION OF audit_log
  FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');
```

Phase 11 ships a `pg_partman`-based or custom plpgsql cron function that
creates the next 3 months of partitions on the 1st of each month.

---

## 7-Year Retention (REQ-018)

Postgres partitions older than 7 years are **detached** (not dropped):

```sql
-- Detach partition (data preserved as standalone table)
ALTER TABLE audit_log DETACH PARTITION audit_log_2026_04;

-- Rename to archival table
ALTER TABLE audit_log_2026_04 RENAME TO audit_log_archive_2026_04;
```

The archival table remains in the database in read-only state.
pgBackRest full backups (Plan 02-05) include it in the `pg_basebackup` snapshot.
Quarterly DR drills verify backup restoration of archival data.

---

## Broken Chain Incident Response

**DO NOT auto-repair a broken chain.** The break is evidence of either tampering
or an operational error and must be investigated.

### Root Causes

| Cause | Description |
|-------|-------------|
| Direct UPDATE by migrations_runner | Accidental or deliberate; `migrations_runner` is the only role with UPDATE on `audit_log`. Check Doppler — restrict the password to ops-only. |
| Migration that recreated audit_log | If `audit_log` was dropped and recreated without preserving rows + hashes, the chain resets. Always use `ALTER TABLE` for schema changes; never `DROP + CREATE` on audit_log. |
| Clock skew on `occurred_at` | Extreme NTP drift can cause `occurred_at` to differ from what the canonical string was computed with. Rare. |
| Chain fork under high concurrency | Should be impossible due to `FOR UPDATE` lock. If it occurs, investigate Postgres upgrade or lock behaviour changes. |

### Incident Steps

1. **Stop all writes** to the affected table/agency if possible (maintenance mode).
2. **Identify the break** using `verify-audit-chain.ts --agency=<slug>` — note the first broken row ID.
3. **Check Postgres logs** for UPDATE/DELETE on `audit_log` around the break timestamp.
4. **Check Doppler audit log** for recent `migrations_runner` password access.
5. **Escalate** to security team if tampering is suspected.
6. **Do not DELETE or UPDATE** any audit_log rows — even to "fix" the chain. Append a signed incident report row instead.
7. **Post-incident:** rotate `migrations_runner` password in Doppler.
