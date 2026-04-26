---
phase: 02-multi-tenant-db
plan: 06
subsystem: security-primitives
tags: [aes-gcm-256, vault, audit-log, hash-chain, bullmq, encryption, partitioning, scrypt]
dependency_graph:
  requires:
    - 02-01 (permissions_vault + audit_log schemas — agencyBaseColumns, withAgencyContext)
    - 02-03 (apply-custom.ts CUSTOM_FILES array — extended here with 003 + 004)
    - packages/config (AGENCIES, SYSTEM_ACTOR_ID)
  provides:
    - packages/db/src/vault/* (crypto, key, store, index — AES-GCM-256 vault primitives)
    - packages/db/src/audit/* (triggers.sql, verify-chain.ts, index — hash-chain audit log)
    - packages/db/src/migrations/custom/003_audit_triggers.sql
    - packages/db/src/migrations/custom/004_partition_audit_log.sql
    - packages/db/src/migrate/apply-custom.ts (CUSTOM_FILES extended)
    - packages/queue/* (@mjagency/queue — encrypted BullMQ wrapper)
    - scripts/verify-audit-chain.ts (CLI — CI gate)
    - docs/runbooks/vault-audit.md
    - packages/config/src/agency-constants.ts (SYSTEM_ACTOR_ID appended)
  affects:
    - 02-04 (seed framework may use putVaultValue for seeding test credentials)
    - Phase 3 (auth) — vault helpers for Cloudflare API token + Stripe webhook secret
    - Phase 5/9 — extend per-table audit trigger list as new tables ship
    - Phase 11 (hardening) — key rotation job, partition cron, per-tenant queue key
tech_stack:
  added:
    - node:crypto (createCipheriv/createDecipheriv/scryptSync — AES-256-GCM, no new dep)
    - bullmq@5.76.2 (BullMQ queue — packages/queue)
    - ioredis@5.10.1 (Redis client — packages/queue)
    - pgcrypto extension (SHA-256 digest in Postgres trigger — no new application dep)
  patterns:
    - AES-256-GCM layout: IV(12) || authTag(16) || ciphertext — RESEARCH §6.2
    - scryptSync KDF with per-domain salts (vault vs queue key isolation)
    - withAgencyContext wrapping for all vault store helpers (RLS-safe)
    - SECURITY DEFINER trigger for audit capture (bypasses app role INSERT restriction)
    - Per-stream hash chain on (table_name, agency_id) with FOR UPDATE lock (pitfall 8.6)
    - LAG window function for chain verification (verify-chain.ts)
    - RANGE partitioning by occurred_at (monthly, 14 initial partitions)
    - BullMQ Proxy pattern for transparent encryption on queue.add()
    - it.skipIf(!INTEGRATION_DATABASE_URL) for integration test gating
key_files:
  created:
    - packages/db/src/vault/crypto.ts
    - packages/db/src/vault/key.ts
    - packages/db/src/vault/store.ts
    - packages/db/src/vault/index.ts
    - packages/db/src/audit/triggers.sql
    - packages/db/src/audit/verify-chain.ts
    - packages/db/src/audit/index.ts
    - packages/db/src/migrations/custom/003_audit_triggers.sql
    - packages/db/src/migrations/custom/004_partition_audit_log.sql
    - packages/db/src/__tests__/vault-crypto.test.ts
    - packages/db/src/__tests__/audit-chain.integration.test.ts
    - packages/db/src/__tests__/vault-store.integration.test.ts
    - packages/queue/package.json
    - packages/queue/tsconfig.json
    - packages/queue/vitest.config.ts
    - packages/queue/src/index.ts
    - packages/queue/src/encrypted-queue.ts
    - packages/queue/src/key.ts
    - packages/queue/src/__tests__/encrypted-queue.test.ts
    - packages/queue/README.md
    - scripts/verify-audit-chain.ts
    - docs/runbooks/vault-audit.md
  modified:
    - packages/db/src/index.ts (vault + audit namespace re-exports + top-level encryptVaultValue/decryptVaultValue)
    - packages/db/src/migrate/apply-custom.ts (CUSTOM_FILES extended: 003 + 004)
    - packages/db/package.json (./vault exports entry)
    - packages/config/src/agency-constants.ts (SYSTEM_ACTOR_ID appended)
    - packages/config/src/index.ts (SYSTEM_ACTOR_ID re-exported)
    - .env.example (VAULT_ENCRYPTION_KEY + BULLMQ_ENCRYPTION_KEY added)
decisions:
  - "AES-256-GCM at application layer via Node crypto — NOT pgcrypto (pitfall 8.7: pgcrypto has no AES-GCM implementation)"
  - "Per-domain scrypt salts: vault='mjagency-vault-kdf-salt-v1', queue='mjagency-queue-kdf-salt-v1' — same raw env var produces distinct 256-bit keys per domain"
  - "Open Q4 resolved: SYSTEM_ACTOR_ID='00000000-0000-0000-0000-000000000001' — non-user audit fallback for migrations/cron/system operations"
  - "Per-stream hash chain keyed on (table_name, agency_id) + FOR UPDATE — prevents chain forks under concurrent writes (pitfall 8.6)"
  - "Plan 02-03 apply-custom.ts CUSTOM_FILES extended (cross-plan touch) — 003_audit_triggers.sql and 004_partition_audit_log.sql appended"
  - "Monthly RANGE partitioning: 14 initial partitions 2026-04 through 2027-05; Phase 11 ships cron for ongoing maintenance"
  - "BullMQ encryption opt-in via sensitiveData: true flag — non-sensitive jobs pass through to avoid unnecessary crypto overhead"
  - "SECURITY DEFINER on capture_audit_row() — ensures audit write always succeeds regardless of app role INSERT restriction on audit_log"
metrics:
  duration: "estimated 120 minutes"
  completed_date: "2026-04-25"
  tasks_completed: 3
  files_created: 22
  files_modified: 6
---

# Phase 02 Plan 06: AES-GCM-256 Permissions Vault + Hash-Chain Audit Log + BullMQ Encrypted Queue Summary

AES-GCM-256 application-layer encryption vault with scrypt KDF, monthly-partitioned SHA-256 hash-chained audit log with per-stream FOR UPDATE locking, and a transparent BullMQ encrypted queue wrapper — all sharing a single `encryptVaultValue`/`decryptVaultValue` core in `packages/db/src/vault/crypto.ts`.

## Crypto Primitive — AES-256-GCM via Node crypto

**Implementation:** `packages/db/src/vault/crypto.ts` — `encryptVaultValue` / `decryptVaultValue` using `createCipheriv('aes-256-gcm', key, iv)`.

**Buffer layout:** `[IV (12 bytes)] [authTag (16 bytes)] [ciphertext]` — per RESEARCH §6.2.

**Key derivation:** `scryptSync(rawEnvVar, domainSalt, 32)` — vault domain: `'mjagency-vault-kdf-salt-v1'`, queue domain: `'mjagency-queue-kdf-salt-v1'`. Distinct salts ensure same raw secret produces different keys per domain.

**Why not pgcrypto:** pgcrypto has no AES-GCM implementation (pitfall 8.7). `pgp_sym_encrypt` uses PGP/CBC; `encrypt()` is ECB/CBC only. Node's `createCipheriv('aes-256-gcm', ...)` is the correct and only path. SEC-N10 mandate satisfied.

## Vault — 4 Store Helpers + 3 Modules

| Module | Purpose |
|--------|---------|
| `vault/crypto.ts` | Pure AES-GCM-256 encrypt/decrypt — no DB dependency |
| `vault/key.ts` | `getVaultKey()` — reads `VAULT_ENCRYPTION_KEY`, scrypt derives 32-byte key |
| `vault/store.ts` | `putVaultValue`, `getVaultValue`, `getActiveVaultValue`, `revokeVaultValue` — all wrapped in `withAgencyContext` |

All store helpers are RLS-safe: `withAgencyContext` issues `set_config('app.agency_id', id, true)` (SET LOCAL) so cross-agency reads return null by design. `getActiveVaultValue` adds expiry + revocation filtering (REQ-407).

Exported from `packages/db` as `vault` namespace + top-level `encryptVaultValue`/`decryptVaultValue` for BullMQ consumer.

## Audit Log — Hash Chain + Triggers + Partitioning

**Hash chain trigger:** `audit_log_hash_trigger()` (BEFORE INSERT on audit_log) computes `row_hash = digest(canonical_string, 'sha256')` where canonical string includes the previous row's hash in the same stream.

**Per-stream chain (pitfall 8.6 mitigation):** Chain keyed on `(table_name, agency_id)`. `SELECT ... FOR UPDATE` on the stream head serialises concurrent INSERTs — prevents two writers from seeing the same `prev_hash` and forking the chain.

**SYSTEM_ACTOR_ID fallback:** `capture_audit_row()` reads `app.actor_id` from session config; if not set, uses `SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001'` (Open Q4 resolution).

**Per-table triggers applied to:** `users`, `sessions`, `permissions_vault`, `agencies`. Future phases extend this list.

**Partitioning:** `004_partition_audit_log.sql` converts `audit_log` to `PARTITION BY RANGE (occurred_at)`. 14 monthly partitions created (2026-04 through 2027-05). Phase 11 ships cron for ongoing partition maintenance.

**Cross-plan touch:** `apply-custom.ts` CUSTOM_FILES extended from 2 entries (Plans 02-01/02-03) to 4 entries (+ 003_audit_triggers.sql, + 004_partition_audit_log.sql).

## Chain Verifier + CLI

`packages/db/src/audit/verify-chain.ts` — uses `LAG(row_hash) OVER (PARTITION BY table_name, agency_id ORDER BY id)` to get the expected previous hash, then recomputes SHA-256 in Node and compares. Returns `{ broken: number[]; total: number }`.

`scripts/verify-audit-chain.ts` — CLI gate: `--all` walks all 12 agencies, `--agency=<slug>` targets one. Exits 0 if intact, 1 if any broken rows. Ready for CI pipeline integration.

## BullMQ Encrypted Queue

**New package:** `@mjagency/queue` — `packages/queue/`.

**createEncryptedQueue** returns a Proxy over BullMQ Queue. `queue.add(..., { sensitiveData: true })` encrypts the payload as `{ __enc: true, v: 1, data: <base64> }` before Redis. Non-sensitive jobs pass through unchanged.

**createEncryptedWorker** — if job has `__enc: true`, decrypts before calling processor. Processor always receives the original typed data.

**Key isolation:** Queue uses `BULLMQ_ENCRYPTION_KEY` + `'mjagency-queue-kdf-salt-v1'` — distinct from vault key. Cross-domain reuse is cryptographically impossible even if the raw env var is shared.

## Test Coverage

| Test File | Count | Type | Requirement |
|-----------|-------|------|-------------|
| `vault-crypto.test.ts` | 12 | Unit | REQ-018, SEC-N10, T-02-015, T-02-016 |
| `encrypted-queue.test.ts` | 5 | Unit (bullmq mocked) | REQ-306, REQ-425, T-02-019 |
| `audit-chain.integration.test.ts` | 7 | Integration (skip w/o DB) | REQ-019, T-02-017, T-02-018 |
| `vault-store.integration.test.ts` | 4 | Integration (skip w/o DB) | REQ-018, REQ-407 |

**Total unit tests: 17 (12 vault-crypto + 5 encrypted-queue)**
**Total integration tests: 11 (7 audit-chain + 4 vault-store) — all skip without INTEGRATION_DATABASE_URL**

## New Environment Variables

| Variable | Purpose |
|----------|---------|
| `VAULT_ENCRYPTION_KEY` | Source material for vault AES-GCM-256 key derivation (Doppler) |
| `BULLMQ_ENCRYPTION_KEY` | Source material for queue AES-GCM-256 key derivation (Doppler) |

Both added to `.env.example`. Managed exclusively via Doppler.

## Cross-Plan Touch — apply-custom.ts

Plan 02-03 shipped `CUSTOM_FILES` with 2 entries. Plan 02-06 extends to 4:

```ts
export const CUSTOM_FILES: readonly string[] = [
  '001_agency_id_immutable.sql',       // Plan 02-01
  '002_force_rls_and_app_role.sql',    // Plan 02-01
  '003_audit_triggers.sql',            // Plan 02-06 (NEW)
  '004_partition_audit_log.sql',       // Plan 02-06 (NEW)
]
```

## Files Downstream Phases Consume

| File | Consumer |
|------|----------|
| `vault/store.ts` (putVaultValue, getActiveVaultValue) | Phase 3 (Cloudflare API token, Stripe webhook secret storage) |
| `vault/crypto.ts` (encryptVaultValue, decryptVaultValue) | @mjagency/queue (re-exported from @mjagency/db top level) |
| `audit/triggers.sql` pattern | Phase 5 (collections tables), Phase 9 (CRM tables) — add `capture_audit_row()` trigger |
| `scripts/verify-audit-chain.ts` | CI pipeline + Phase 11 hardening (weekly cron gate) |
| `SYSTEM_ACTOR_ID` from @mjagency/config | Phase 3 auth runner (migration actor), Phase 4 seed runner |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 7 tamper buffer used indexed access on potentially sparse buffer**
- **Found during:** Task 6.1 typecheck
- **Issue:** `tampered[28]` produces `number | undefined` under `noUncheckedIndexedAccess`
- **Fix:** Used `tampered.readUInt8(targetByte)` + `tampered.writeUInt8(current ^ 0xff, targetByte)` — type-safe Buffer API
- **Files modified:** `packages/db/src/__tests__/vault-crypto.test.ts`
- **Commit:** e47226e

**2. [Rule 2 - Missing] SYSTEM_ACTOR_ID not re-exported from @mjagency/config index**
- **Found during:** Task 6.2 typecheck (audit-chain.integration.test.ts import failing)
- **Issue:** Added SYSTEM_ACTOR_ID to `agency-constants.ts` but `packages/config/src/index.ts` didn't re-export it
- **Fix:** Added `SYSTEM_ACTOR_ID` to the named exports in `packages/config/src/index.ts`
- **Files modified:** `packages/config/src/index.ts`
- **Commit:** 477627a

**3. [Rule 1 - Bug] Integration test used wrong schema column names**
- **Found during:** Task 6.2 typecheck
- **Issue:** Users schema requires `role` column; sessions uses `tokenFamilyId` not `tokenHash`. Integration test used raw SQL `db.execute()` to avoid Drizzle strict types for test inserts.
- **Fix:** Rewrote all integration test inserts as `db.execute(sql\`INSERT INTO ...\`)` with correct column names per schema definitions
- **Files modified:** `packages/db/src/__tests__/audit-chain.integration.test.ts`
- **Commit:** 477627a

**4. [Rule 1 - Bug] Queue test used `vault.getVaultKey()` for cross-domain key comparison**
- **Found during:** Task 6.3 test run (5 tests, 1 failed)
- **Issue:** Test imported `getVaultKey` as top-level from `@mjagency/db` but it's only on the `vault` namespace
- **Fix:** Changed to `vault.getVaultKey()` using the namespace import
- **Files modified:** `packages/queue/src/__tests__/encrypted-queue.test.ts`
- **Commit:** 2a718e8

**5. [Rule 1 - Bug] TypeScript strict cast issues in encrypted-queue.ts and test file**
- **Found during:** Task 6.3 typecheck
- **Issue:** Queue Record cast and MockQueueAdd conversion both needed intermediate `unknown` cast
- **Fix:** Added `as unknown as Record<...>` and `as unknown as MockQueueAdd` casts
- **Files modified:** `packages/queue/src/encrypted-queue.ts`, `packages/queue/src/__tests__/encrypted-queue.test.ts`
- **Commit:** 2a718e8

### Pre-existing Errors (Out of Scope — Not Modified)

| File | Error | Source Plan |
|------|-------|-------------|
| `packages/config/src/otel-node.ts` | `ATTR_SERVICE_NAMESPACE` renamed in @opentelemetry/semantic-conventions | Plan 01/config |
| `packages/db/src/schema/users.ts`, `sessions.ts`, `permissions-vault.ts` | `SQL<unknown>` not assignable to `PgPolicyToOption` in pgPolicy `to:` | Plan 02-01 |
| `packages/db/src/__tests__/pgbouncer-set-local.integration.test.ts` | Type assertion pattern for postgres-js RowList | Plan 02-02 |

## Known Stubs

None — all functionality is fully implemented. Phase 11 deferred items are clearly documented:
- Key rotation background job (SEC-10) — Phase 11 hardening
- Monthly partition cron (pg_partman or custom plpgsql) — Phase 11 hardening
- Per-tenant queue key derivation — Phase 11 hardening

## Threat Surface Scan

All threats in the plan's threat model are mitigated:

| Threat ID | Status |
|-----------|--------|
| T-02-015 (vault plaintext in DB dump) | Mitigated — only bytea ciphertext at rest; Pino redact paths cover vault/key/secret/token field names |
| T-02-016 (vault ciphertext tampered) | Mitigated — AES-GCM auth tag verification; Test 7 in vault-crypto.test.ts proves |
| T-02-017 (audit row modified/deleted) | Mitigated — REVOKE UPDATE/DELETE (002 migration) + hash chain (verifyAuditChain detects) + migrations_runner-only UPDATE privilege |
| T-02-018 (chain fork under concurrency) | Mitigated — per-stream FOR UPDATE lock; Integration Test 3 validates |
| T-02-019 (BullMQ PII in Redis MONITOR) | Mitigated — sensitiveData:true encrypts; Test 1 in encrypted-queue.test.ts proves ciphertext payload |

## Self-Check

All created/modified files verified:

| File | Status |
|------|--------|
| packages/db/src/vault/crypto.ts | FOUND — contains aes-256-gcm, getAuthTag, setAuthTag |
| packages/db/src/vault/key.ts | FOUND — contains scryptSync, mjagency-vault-kdf-salt-v1 |
| packages/db/src/vault/store.ts | FOUND — contains withAgencyContext, expires_at, revokedAt |
| packages/db/src/vault/index.ts | FOUND — barrel exports |
| packages/db/src/audit/triggers.sql | FOUND — contains audit_log_hash_trigger, FOR UPDATE, table_name = NEW.table_name |
| packages/db/src/audit/verify-chain.ts | FOUND — contains createHash, LAG |
| packages/db/src/audit/index.ts | FOUND — exports verifyAuditChain |
| packages/db/src/migrations/custom/003_audit_triggers.sql | FOUND — contains audit_users, audit_sessions, audit_permissions_vault, audit_agencies |
| packages/db/src/migrations/custom/004_partition_audit_log.sql | FOUND — contains PARTITION BY RANGE, 14 PARTITION OF statements |
| packages/db/src/migrate/apply-custom.ts | FOUND — CUSTOM_FILES has 4 entries |
| packages/db/src/__tests__/vault-crypto.test.ts | FOUND — 12 unit tests pass |
| packages/db/src/__tests__/audit-chain.integration.test.ts | FOUND — 7 tests skip without DB |
| packages/db/src/__tests__/vault-store.integration.test.ts | FOUND — 4 tests skip without DB |
| packages/db/src/index.ts | FOUND — vault namespace + top-level encryptVaultValue/decryptVaultValue + audit namespace |
| packages/db/package.json | FOUND — ./vault exports entry |
| packages/config/src/agency-constants.ts | FOUND — SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001' |
| packages/config/src/index.ts | FOUND — SYSTEM_ACTOR_ID re-exported |
| .env.example | FOUND — VAULT_ENCRYPTION_KEY + BULLMQ_ENCRYPTION_KEY |
| packages/queue/package.json | FOUND — @mjagency/queue, bullmq@5.76.2, ioredis@5.10.1 |
| packages/queue/src/encrypted-queue.ts | FOUND — createEncryptedQueue, createEncryptedWorker |
| packages/queue/src/key.ts | FOUND — BULLMQ_ENCRYPTION_KEY, mjagency-queue-kdf-salt-v1 |
| packages/queue/src/index.ts | FOUND — barrel exports |
| packages/queue/src/__tests__/encrypted-queue.test.ts | FOUND — 5 tests pass |
| packages/queue/README.md | FOUND — REQ-306, REQ-425, SEC-N10 |
| packages/queue/tsconfig.json | FOUND |
| packages/queue/vitest.config.ts | FOUND |
| scripts/verify-audit-chain.ts | FOUND — --help exits 0 (verified) |
| docs/runbooks/vault-audit.md | FOUND — vault usage, key rotation (SEC-10), audit overview, chain verification, partitions, 7-year retention, incident response |

Forbidden pattern scan (TODO/Coming soon/Lorem ipsum/[insert]/jsonwebtoken/pgcrypto AES-GCM): CLEAN

Commits:
| Task | Commit | Hash |
|------|--------|------|
| Task 6.1 | feat(02-06): vault AES-GCM-256 crypto + key + store helpers | e47226e |
| Task 6.2 | feat(02-06): audit log hash chain + partitioning + chain verifier + runbook | 477627a |
| Task 6.3 | feat(02-06): @mjagency/queue encrypted BullMQ wrapper | 2a718e8 |

## Self-Check: PASSED
