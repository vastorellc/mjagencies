# Auth Audit Events Runbook

**Last updated:** 2026-04-25
**Plans:** Phase 3 Plan 03-06
**Requirements:** REQ-027, REQ-308, REQ-400, REQ-424
**Related runbooks:** `vault-audit.md`, `server-action-pattern.md`

---

## Where Audit Rows Come From

Auth events that modify the database produce audit rows automatically via the Phase 2 02-06 `capture_audit_row()` trigger. This trigger is registered on the following tables:

| Table | Trigger Name | Applied In |
|-------|-------------|------------|
| `users` | `audit_users` | `003_audit_triggers.sql` |
| `sessions` | `audit_sessions` | `003_audit_triggers.sql` |
| `permissions_vault` | `audit_permissions_vault` | `003_audit_triggers.sql` |
| `agencies` | `audit_agencies` | `003_audit_triggers.sql` |
| `mfa_config` | `audit_mfa_config` | `005_audit_mfa_config.sql` |

### How capture_audit_row() Works

1. Every INSERT/UPDATE/DELETE on a watched table fires `capture_audit_row()` AFTER the operation.
2. The trigger reads `current_setting('app.actor_id', true)` to determine who performed the action.
3. If `app.actor_id` is not set, the trigger falls back to `SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001'`.
4. An `audit_log` row is created with: `table_name`, `operation`, `old_data` (JSONB), `new_data` (JSONB), `actor_id`, `agency_id`, `occurred_at`, `row_hash` (SHA-256 hash chain).

The hash chain: `row_hash = SHA-256(agency_id || table_name || operation || new_data || prev_hash)`. This makes the log tamper-evident — any modification to a past row breaks the chain (detectable via `scripts/verify-audit-chain.ts`).

### Setting app.actor_id — setAppActor()

Authentication code that performs DB writes must call `setAppActor(tx, userId)` inside `withAgencyContext` so the captured audit row attributes to the real actor:

```typescript
import { withAgencyContext } from '@mjagency/db'
import { setAppActor } from '@mjagency/auth'

await withAgencyContext(db, agencyId, async (tx) => {
  await setAppActor(tx, session.userId)   // SET LOCAL — reverts at tx end
  // ... DB writes below will attribute to session.userId in audit_log
  await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId))
})
```

**Critical:** `set_config('app.actor_id', userId, true)` uses `true` (SET LOCAL) — the value is automatically cleared when the transaction ends. This prevents cross-tenant actor attribution leaks via PgBouncer pool reuse (pitfall 8.1). See `packages/db/src/client.ts` for the same pattern on `app.agency_id`.

---

## Auth Event Catalog

`emitAuthAudit(eventName, payload)` is the **off-DB observability** helper. It writes a Pino log entry to Loki for SOC dashboards. It is NOT the audit log of record.

| Event Name | DB Write? | Table Modified | Pino Event Field | Notes |
|-----------|-----------|----------------|------------------|-------|
| `login.success` | Yes | `sessions` (INSERT) | `auth.login.success` | Session row created; audit trigger captures |
| `login.failure` | No | — | `auth.login.failure` | No DB write; Pino only for failed auth rate monitoring |
| `logout` | Yes | `sessions` (UPDATE revokedAt) | `auth.logout` | Audit row captures session revocation |
| `refresh.success` | No | — (Redis only) | `auth.refresh.success` | Token rotation in Redis; no DB write at Phase 3 |
| `refresh.replay-revoke` | No | — (Redis only) | `auth.refresh.replay-revoke` | Family revocation; SOC flag for credential theft |
| `mfa.verify.success` | Yes | `mfa_config` (UPDATE lastVerifiedAt) | `auth.mfa.verify.success` | Audit row captures MFA verification |
| `mfa.verify.failure` | No | — | `auth.mfa.verify.failure` | No DB write; Pino only; monitor for brute force |
| `mfa.recovery-code.used` | Yes | `mfa_config` (UPDATE recovery_hashes) | `auth.mfa.recovery-code.used` | Audit row captures code invalidation |
| `mfa.lockout` | Yes | `mfa_config` (UPDATE lockout columns) | `auth.mfa.lockout` | Audit row captures lockout state |
| `session.regenerate` | Yes | `sessions` (INSERT new row) | `auth.session.regenerate` | Called on privilege escalation (REQ-027) |
| `sso.code.created` | No | — (Redis only) | `auth.sso.code.created` | Opaque SSO code in Redis; no DB audit row |
| `sso.code.redeemed` | No | — (Redis key deleted) | `auth.sso.code.redeemed` | Redis key deletion is not captured by DB audit |
| `sso.exchange.forbidden` | No | — | `auth.sso.exchange.forbidden` | SOC flag — cross-agency SSO attempt |
| `session.last-admin-delete-blocked` | No | — | `auth.session.last-admin-delete-blocked` | DB trigger raises BEFORE the delete; Pino for SOC |

### Emitting Auth Events

```typescript
import { emitAuthAudit } from '@mjagency/auth'

// After a successful login
emitAuthAudit('login.success', { agencyId, userId })

// After MFA lockout
emitAuthAudit('mfa.lockout', { agencyId, userId, failedAttempts: 5 })

// After detecting a replay attack
emitAuthAudit('refresh.replay-revoke', { agencyId, userId, familyId })
```

---

## How to Query the Audit Log

The `audit_log` table is RANGE-partitioned by `occurred_at` (monthly partitions, 2026-04 to 2027-05). Queries must include `occurred_at` in the WHERE clause to leverage partition pruning.

### Recent login failures by user

```sql
SELECT actor_id, occurred_at, new_data->>'email' AS email
FROM audit_log
WHERE table_name = 'sessions'
  AND operation = 'INSERT'
  AND occurred_at >= NOW() - INTERVAL '7 days'
ORDER BY occurred_at DESC
LIMIT 100;
```

### Replay revocations by agency (last 30 days)

Replay revocations revoke entire token families in Redis. The associated `sessions` row is updated with `revoked_at`. Query for bulk revocations:

```sql
SELECT agency_id, COUNT(*) AS revoked_sessions, MIN(occurred_at) AS first_revoke
FROM audit_log
WHERE table_name = 'sessions'
  AND operation = 'UPDATE'
  AND old_data->>'revoked_at' IS NULL
  AND new_data->>'revoked_at' IS NOT NULL
  AND occurred_at >= NOW() - INTERVAL '30 days'
GROUP BY agency_id
ORDER BY revoked_sessions DESC;
```

### Last admin delete attempts (DB trigger blocked)

The `prevent_last_admin_delete()` trigger raises BEFORE the DELETE — no audit row is written for the blocked attempt. Monitor via Pino logs (event `auth.session.last-admin-delete-blocked`).

If the guard was bypassed and a DELETE succeeded, it would appear as:

```sql
SELECT actor_id, agency_id, old_data->>'role' AS deleted_role, occurred_at
FROM audit_log
WHERE table_name = 'users'
  AND operation = 'DELETE'
  AND old_data->>'role' = 'admin'
  AND occurred_at >= NOW() - INTERVAL '30 days'
ORDER BY occurred_at DESC;
```

### Verify audit chain integrity for an agency

```bash
# Single agency
pnpm tsx scripts/verify-audit-chain.ts --agency=brand

# All agencies
pnpm tsx scripts/verify-audit-chain.ts --all
```

Exit 0 = chain intact. Exit 1 = broken rows detected (tamper evidence).

### MFA recovery code usage

```sql
SELECT actor_id, agency_id, occurred_at,
       old_data->'recovery_hashes' AS before_hashes,
       new_data->'recovery_hashes' AS after_hashes
FROM audit_log
WHERE table_name = 'mfa_config'
  AND operation = 'UPDATE'
  AND occurred_at >= NOW() - INTERVAL '90 days'
ORDER BY occurred_at DESC;
```

---

## emitAuthAudit vs DB Audit Log

| Dimension | DB audit_log | emitAuthAudit (Pino) |
|-----------|-------------|----------------------|
| Authority | **System of record** — compliance | **Observability** — SOC dashboards, alerting |
| Integrity | SHA-256 hash chain (tamper-evident) | Loki retention only |
| Scope | Only DB writes (INSERT/UPDATE/DELETE on watched tables) | All auth events, including Redis-only events |
| Latency | Synchronous with transaction | Synchronous (Pino is non-blocking) |
| Format | JSONB in Postgres | JSON in Loki |
| Use for compliance | Yes — authoritative | No |
| Use for live alerting | Possible via pg_notify (future) | Yes — primary path |

**Both mechanisms run in parallel.** For any auth event that writes to DB, you get both a hash-chained audit row AND a Pino log. For Redis-only events (SSO codes, token refresh), you only get the Pino log.

---

## Pino Redact Paths

Phase 1 configures Pino with redact paths in `packages/config/src/logger.ts`. The following fields are automatically scrubbed from all log entries including `emitAuthAudit` output:

```
*.password, *.token, *.secret, *.apiKey, *.api_key
*.email, *.phone, *.creditCard, *.ssn
*.refreshToken, *.accessToken, *.jti
*.stripeKey, *.stripeSecret
*.payload.email, *.payload.phone
req.headers.authorization, req.headers.cookie, res.headers["set-cookie"]
```

This means calling `emitAuthAudit('login.success', { email })` will log the email as `[REDACTED]`. Pass `userId` (UUID) instead of `email` when the user identity is needed in the log.

---

## Phase 3 CVE-2025-29927 Three-Layer Defense

CVE-2025-29927 is a Next.js middleware authentication bypass. The three-layer defense:

| Layer | Implementation | Plan |
|-------|---------------|------|
| 1. CF WAF | Cloudflare rule blocks requests with `x-middleware-subrequest` header | 03-04 runbook |
| 2. Next.js >= 15.2.3 | CI gate `check-next-version.ts` fails PR if any package < 15.2.3 | **03-06 (this plan)** |
| 3. requireSession() | Every server action calls `requireSession()` as first line — middleware bypass cannot skip server-action auth | 03-05 |

If all three layers are active, an attacker who bypasses middleware still hits the server-action auth check, and the Cloudflare WAF drops the malformed request before it reaches Next.js.
