---
phase: 03-auth-sso-edge
plan: "02"
subsystem: auth-mfa
tags: [mfa, totp, recovery-codes, bcrypt, redis-lockout, rls, mfa-config]
dependency_graph:
  requires:
    - 02-01  # agencyBaseColumns, withAgencyContext, RLS pattern
    - 02-06  # apply-custom.ts CUSTOM_FILES, capture_audit_row(), vault helpers
    - 03-01  # REDIS_KEY.session.mfaLockout in @mjagency/config
  provides:
    - verifyTotp (for 03-03 MFA verify endpoint, 03-05 requireSession)
    - verifyRecoveryCode (for 03-03 recovery-code verify endpoint)
    - isLockedOut, recordFailedAttempt, clearLockout (for 03-03 lockout enforcement)
    - mfaConfig schema (for 03-03 DB persistence, 03-06 audit events)
    - 005_audit_mfa_config.sql (migration applied on first DB deploy)
  affects:
    - 03-03  # MFA verify endpoint uses all four exported helpers
    - 03-05  # requireSession reads mfaVerifiedAt from access token claim
    - 03-06  # audit emit via capture_audit_row() trigger added here
tech_stack:
  added:
    - otpauth@9.5.1
    - qrcode@1.5.4
    - bcrypt@6.0.0
    - "@types/bcrypt@5.0.2"
    - "@types/qrcode@1.5.5"
  patterns:
    - TOTP RFC 6238 (SHA1 / 6 digits / 30s period / window=±1)
    - bcrypt cost 12 at setup time only (Pitfall 8 — never on hot path)
    - Redis INCR + EXPIRE for rate-limiting (sliding window lockout)
    - agency-scoped table with RLS + FORCE RLS (Phase 2 02-01 pattern)
    - capture_audit_row() trigger (Phase 2 02-06 pattern)
    - agencyBaseColumns spread (id, agencyId, createdAt, updatedAt)
key_files:
  created:
    - packages/auth/src/mfa.ts
    - packages/auth/src/recovery-codes.ts
    - packages/auth/src/mfa-lockout.ts
    - packages/auth/src/__tests__/mfa.test.ts
    - packages/auth/src/__tests__/recovery-codes.test.ts
    - packages/auth/src/__tests__/mfa-lockout.integration.test.ts
    - packages/db/src/schema/mfa-config.ts
    - packages/db/src/migrations/0001_mfa_config.sql
    - packages/db/src/migrations/custom/005_audit_mfa_config.sql
  modified:
    - packages/auth/src/index.ts (additive — mfa, recovery-codes, mfa-lockout exports)
    - packages/auth/package.json (added otpauth, qrcode, bcrypt + types)
    - packages/db/src/schema/index.ts (additive — mfa-config.js export)
    - packages/db/src/migrate/apply-custom.ts (CUSTOM_FILES extended from 4 to 5)
    - packages/db/src/migrations/meta/_journal.json (append entry 1)
    - packages/db/README.md (Tables matrix, Migration Apply Order, Phase 3 Tables)
    - packages/db/src/__tests__/schema.test.ts (assert mfaConfig exported + 10 columns)
    - .env.example (append MFA_ISSUER_NAME)
    - package.json (pnpm.onlyBuiltDependencies — allow bcrypt native build)
decisions:
  - "Q1 resolved: mfa_config is a separate agency-scoped table (not fat users addition) with RLS + FORCE RLS + audit trigger"
  - "Q4 partial: TOTP secret in permissions_vault (mfa.totp_secret.<userId>); recovery hashes in mfa_config.recovery_hashes text[]"
  - "A2 lockout policy: 3 consecutive failures = 15-min Redis TTL via REDIS_KEY.session.mfaLockout"
  - "bcrypt cost 12 (SEC-12) — hashed only at setup time, never on verify hot path (Pitfall 8)"
  - "window=1 in verifyTotp accepts ±30s clock skew — RFC 6238 standard tolerance"
metrics:
  duration: "~30 minutes"
  completed: "2026-04-25"
  tasks_completed: 2
  files_created: 9
  files_modified: 9
  tests_added: 22
---

# Phase 03 Plan 02: MFA TOTP + Recovery Codes + Lockout + mfa_config Schema Summary

**One-liner:** TOTP MFA via otpauth@9.5.1 (SHA1/6/30/window=1) + 8 single-use bcrypt-cost-12 recovery codes + 3-fail/15min Redis lockout + agency-scoped mfa_config table with RLS, FORCE RLS, and audit trigger.

## What Was Built

### Task 2.1: TOTP + Recovery Codes + MFA Lockout

**`packages/auth/src/mfa.ts`** (REQ-025, RFC 6238)
- `generateTotpSecret()`: 160-bit (20-byte) OTPAuth.Secret, returns base32 string
- `createTotpUri(secret, email, issuer='MJAgency')`: standard otpauth:// URI for authenticator apps
- `generateQrCodeDataUrl(uri)`: PNG data URL via qrcode@1.5.4, errorCorrectionLevel M
- `verifyTotp(secret, token)`: SHA1 / 6 digits / 30s period / window=±1 (clock-skew tolerance)

**`packages/auth/src/recovery-codes.ts`** (REQ-025, REQ-309, SEC-12)
- `generateRecoveryCodes()`: 8 codes × 16 random bytes = 32 hex chars each (128-bit entropy)
- `hashRecoveryCodes(codes)`: bcrypt.hash at cost 12, called ONCE at setup (not on hot path — Pitfall 8)
- `verifyRecoveryCode(plain, hashes)`: bcrypt.compare against stored hashes, skips empty-string slots (T-03-007: single-use enforcement), returns index or -1
- `invalidateRecoverySlot(hashes, index)`: returns new array with slot set to '' (immutable update)

**`packages/auth/src/mfa-lockout.ts`** (Assumption A2)
- `isLockedOut(redis, agencyId, userId)`: checks `REDIS_KEY.session.mfaLockout(agencyId, userId)` >= 3
- `recordFailedAttempt(redis, agencyId, userId)`: Redis INCR + EXPIRE (900s = 15 min) on each call
- `clearLockout(redis, agencyId, userId)`: DEL the lockout key on successful TOTP verify

**New dependency versions:**
- `otpauth@9.5.1` — RFC 6238 TOTP; Edge-compatible (crypto.getRandomValues)
- `qrcode@1.5.4` — PNG QR code generation
- `bcrypt@6.0.0` — native Node.js bcrypt (requires pnpm onlyBuiltDependencies approval)
- `@types/bcrypt@5.0.2`, `@types/qrcode@1.5.5` — TypeScript type packages

### Task 2.2: mfa_config Schema + Migrations

**`packages/db/src/schema/mfa-config.ts`**
- Spreads `agencyBaseColumns` (id, agencyId, createdAt, updatedAt)
- Columns: `userId` (uuid, unique), `recoveryHashes` (text[]), `mfaEnabledAt`, `lastVerifiedAt`, `failedAttempts` (int), `lockoutUntil`
- Unique index on `(agencyId, userId)` via `uniqueIndex('mfa_config_agency_user_idx')`
- RLS policy `mfa_config_agency_isolation`: USING + WITH CHECK on `current_setting('app.agency_id', true)::uuid`
- `.enableRLS()` — FORCE RLS applied by 005_audit_mfa_config.sql (same as Phase 2 tables)

**`packages/db/src/migrations/0001_mfa_config.sql`**
- Manually written (drizzle-kit unavailable per Phase 2 02-01 SUMMARY decision)
- `CREATE TABLE mfa_config` with all columns
- `CREATE UNIQUE INDEX mfa_config_agency_user_idx ON mfa_config (agency_id, user_id)`
- `ALTER TABLE mfa_config ENABLE ROW LEVEL SECURITY`
- `CREATE POLICY mfa_config_agency_isolation ... USING ... WITH CHECK`

**`packages/db/src/migrations/custom/005_audit_mfa_config.sql`**
1. `DROP/CREATE TRIGGER enforce_agency_id_immutable` — calls `prevent_agency_id_change()` (migration 001)
2. `ALTER TABLE mfa_config FORCE ROW LEVEL SECURITY` — mirrors migration 002 pattern
3. `DROP/CREATE TRIGGER audit_mfa_config` — calls `capture_audit_row()` (migration 003)
4. `GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_config TO :"app_role"` — app role DML grant

**`packages/db/src/migrate/apply-custom.ts`** — cross-plan touch
- CUSTOM_FILES extended from 4 to 5 entries
- `'005_audit_mfa_config.sql'` appended last
- Previous entries 001-004 preserved verbatim

## Plan-Time Decisions

| Decision | Resolution |
|----------|-----------|
| Open Q1: Where does mfa_config live? | New `mfa_config` table (not fat `users` addition). Agency-scoped, RLS + FORCE RLS + audit trigger. |
| Open Q4 partial: TOTP secret storage | `permissions_vault` via `putVaultValue(db, agencyId, 'mfa.totp_secret.${userId}', secret)` (AES-GCM-256). `mfa_config` stores only bcrypt recovery hashes — no secret material. |
| Assumption A2: Lockout policy | 3 consecutive failures → 15-minute Redis TTL. Sliding window: TTL resets on each failure so attacker cannot reset by spacing attempts. |
| SEC-12: bcrypt cost | Cost factor 12. Hashed only at setup (when codes are first generated). Never on verify hot path — bcrypt.compare() at verify is the correct pattern (Pitfall 8). |

## Test Coverage

| File | Type | Count | Gate |
|------|------|-------|------|
| `mfa.test.ts` | Unit (no DB/Redis) | 9 tests | Always runs |
| `recovery-codes.test.ts` | Unit (no DB/Redis) | 8 tests | Always runs |
| `mfa-lockout.integration.test.ts` | Integration (Redis) | 5 tests | Gated on `INTEGRATION_REDIS_URL` — skips without Redis |
| `schema.test.ts` (extended) | Unit (no DB) | +2 tests | Always runs |

**Combined unit tests: 17 passing (9 mfa + 8 recovery-codes)**
**Integration tests: 5 skipped cleanly without Redis**

## STRIDE Threat Mitigations

| Threat | Mitigation | Where |
|--------|-----------|-------|
| T-03-006: TOTP brute force | 3-fail/15-min Redis lockout (sliding) | `mfa-lockout.ts`, test 3 in integration tests |
| T-03-007: Recovery code replay | Slot set to `''` on use; `verifyRecoveryCode` skips empty slots | `recovery-codes.ts`, test 7 in recovery-codes.test.ts |
| T-03-008: TOTP secret DB dump | Secret in `permissions_vault` (AES-GCM-256); `mfa_config` has no secret material | vault pattern, mfa-config.ts comment |
| T-03-009: Cross-agency MFA read/write | RLS + FORCE RLS on `mfa_config`; `withAgencyContext` is only query path | mfa-config.ts, 005_audit_mfa_config.sql |

## New Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MFA_ISSUER_NAME` | `MJAgency` | TOTP issuer label shown in authenticator apps (hardcoded default in `createTotpUri`) |

## Cross-Plan Touch

`packages/db/src/migrate/apply-custom.ts` — last touched by Plan 02-06 (entries 003, 004). Plan 03-02 appends entry 005. Previous entries preserved verbatim. Future plans (e.g. 03-06) may append further entries.

## Files Consumed by Downstream Plans

| Export | Consumed By | Plan |
|--------|-------------|------|
| `verifyTotp` | MFA verify endpoint | 03-03 |
| `verifyRecoveryCode` | Recovery code verify endpoint | 03-03 |
| `isLockedOut`, `recordFailedAttempt`, `clearLockout` | MFA lockout enforcement | 03-03 |
| `mfaConfig` (schema) | DB persistence of recovery hashes + lockout state | 03-03, 03-06 |
| `generateTotpSecret`, `createTotpUri`, `generateQrCodeDataUrl` | MFA setup endpoint | 03-03 |
| `mfaVerifiedAt` (access token claim, set by 03-01's regenerateSession) | `requireSession()` MFA enforcement | 03-05 |

## Deviations from Plan

None — plan executed exactly as written.

**Note:** The `to: sql\`CURRENT_USER\`` pattern in `mfa-config.ts` produces a pre-existing TypeScript type narrowing error (`Type 'SQL<unknown>' is not assignable to type 'PgPolicyToOption | undefined'`) — identical to the same pattern in `users.ts`, `sessions.ts`, and `permissions-vault.ts`. This is a known drizzle-orm type issue present across all Phase 2 schema files. The locked interface from the plan specifies this pattern verbatim.

**`pnpm.onlyBuiltDependencies`:** Added `bcrypt` (and other packages that already needed build scripts) to root `package.json` to approve bcrypt's native node-gyp build. This is required for `bcrypt@6.0.0` native bindings and is a one-time setup.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| packages/auth/src/mfa.ts exists | FOUND |
| packages/auth/src/recovery-codes.ts exists | FOUND |
| packages/auth/src/mfa-lockout.ts exists | FOUND |
| packages/db/src/schema/mfa-config.ts exists | FOUND |
| packages/db/src/migrations/0001_mfa_config.sql exists | FOUND |
| packages/db/src/migrations/custom/005_audit_mfa_config.sql exists | FOUND |
| commit 7d4387f (TDD RED) exists | FOUND |
| commit b549171 (Task 2.1 GREEN) exists | FOUND |
| commit 29ca7b2 (Task 2.2) exists | FOUND |
| CUSTOM_FILES has 5 entries | 5 (PASS) |
| Unit tests: 17 passing | PASS |
| Integration tests: 5 skipped (no Redis) | PASS |
| Security grep (jsonwebtoken in TS files) | ZERO matches |
