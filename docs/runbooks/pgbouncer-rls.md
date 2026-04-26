# PgBouncer + RLS Runbook

**Audience:** On-call engineers, backend developers writing DB code.
**Last updated:** 2026-04-25 (Plan 02-02)
**Related files:** `packages/db/src/client.ts`, `packages/db/src/lint/no-session-set.ts`, `scripts/verify-pgbouncer-rls.ts`

---

## Why This Matters

MJAgency runs 12 PgBouncer instances (one per agency, ports 6432-6443) in **transaction mode**. In transaction mode, PgBouncer reuses physical Postgres connections across multiple client transactions — a physical connection can serve hundreds of different application-level transactions over its lifetime. This is intentional and desirable for connection efficiency.

The danger is **session-level state**. When a Postgres transaction sets a session variable with `SET app.agency_id = '<uuid>'`, that setting remains on the physical connection even after the transaction commits. The next client transaction that lands on the same physical connection inherits the stale `app.agency_id`, causing RLS policies to evaluate against the wrong agency UUID. The result is **cross-tenant data leakage** — Agency A can read Agency B's rows.

This is Pitfall 8.1 in the MJAgency research notes (RESEARCH §1.3) and is classified as a **critical** severity threat (T-02-001). The mitigation requires that `app.agency_id` is always set in transaction-local scope, not session scope. The three layers of defense are: (1) `withAgencyContext` always uses `set_config(..., true)` — SET LOCAL; (2) the `no-session-set` ESLint rule blocks the forbidden `SET app.agency_id` pattern at compile time; (3) `scripts/verify-pgbouncer-rls.ts` validates end-to-end behavior at runtime under concurrency.

---

## The Locked Pattern

### Correct — always use `withAgencyContext`

```ts
// packages/db/src/client.ts — the ONLY approved path for agency-scoped queries
import { withAgencyContext, createAgencyDb } from '@mjagency/db'

const db = createAgencyDb('brand', process.env.BRAND_DB_PASSWORD!)

const rows = await withAgencyContext(db, agencyId, async (tx) => {
  return tx.select().from(users)
})
```

`withAgencyContext` calls `set_config('app.agency_id', id, true)` inside a `db.transaction()` block. The third argument `true` means **SET LOCAL** — the setting is scoped to the current transaction and is automatically reverted when the transaction ends (on COMMIT or ROLLBACK).

### Wrong — session-scoped SET leaks across PgBouncer pool connections

```ts
// WRONG — DO NOT USE — session-scoped SET leaks via PgBouncer transaction mode
await db.execute(sql`SET app.agency_id = ${agencyId}`)

// Also WRONG — string literal version
await db.execute('SET app.agency_id = "abc123"')
```

Both forms above set `app.agency_id` at **session scope**. The setting survives beyond the transaction boundary. Under PgBouncer transaction mode, this means any subsequent transaction on the same physical connection inherits the stale value, regardless of which application client issued it.

The `no-session-set` ESLint rule (wired in `packages/config/eslint/index.js`) will report an error at compile time if any `.ts` or `.tsx` file under `packages/*/src/**` or `apps/*/src/**` contains the literal `SET app.agency_id`. Use `withAgencyContext` and let it call `set_config('app.agency_id', id, true)`.

---

## Why `set_config('app.agency_id', id, true)` Works

PostgreSQL's `set_config(setting_name, new_value, is_local)` function sets a configuration parameter for the current session. When `is_local` is `true`, the setting is **local to the current transaction** — it is automatically rolled back at the end of the transaction (either COMMIT or ROLLBACK), exactly as if you had written `SET LOCAL app.agency_id = '...'`.

From the Postgres documentation:
> If `is_local` is `true`, the effect lasts only till the end of the current transaction, whether or not it is committed.

This means:
- Inside `withAgencyContext`, RLS evaluates `current_setting('app.agency_id', true)::uuid` — returns the correct agency ID.
- After `withAgencyContext` returns (transaction committed), the setting reverts to its pre-transaction value (NULL / empty string).
- The physical connection returned to PgBouncer's pool carries no stale `app.agency_id`.
- The next transaction on the same physical connection starts with a clean state.

The `true` (missing value OK) second argument to `current_setting` in the RLS policy is equally important: if `app.agency_id` is not set (e.g. in a migration context), `current_setting('app.agency_id', true)` returns `NULL` rather than throwing an error — which causes the RLS `USING` clause to evaluate to `NULL`, correctly blocking access to all rows.

---

## `server_reset_query` Notes

PgBouncer's default `server_reset_query` is `DISCARD ALL`. When a server connection is returned to the pool (end of transaction in transaction mode), PgBouncer **does not** run `DISCARD ALL` — that only runs in session mode between client sessions.

In **transaction mode**, `server_reset_query` is not executed at all between transactions. This is correct behavior for our setup because:

1. `set_config(..., true)` already handles the `app.agency_id` cleanup via SET LOCAL semantics.
2. `DISCARD ALL` would add overhead and is unnecessary when SET LOCAL is used correctly.
3. Running `DISCARD ALL` between every transaction in a high-throughput pool would be catastrophic for performance.

Do not change `server_reset_query` in `infra/pgbouncer/pgbouncer.*.ini`. The default (no explicit value = PgBouncer default) is correct.

---

## `max_prepared_statements = 100`

All 12 PgBouncer `.ini` files contain `max_prepared_statements = 100`. This is **mandatory** (Pitfall 3.3).

In PgBouncer transaction mode, multiple client connections share a single physical Postgres connection. When Drizzle (or any postgres-js client) sends a prepared statement (`PREPARE foo AS SELECT ...`), PgBouncer must route both the `PREPARE` and the subsequent `EXECUTE foo` to the same physical connection. Without `max_prepared_statements`, PgBouncer falls back to protocol-level behavior that can fail with:

```
ERROR: prepared statement "drizzle_stmt_0" does not exist
```

The `max_prepared_statements = 100` setting tells PgBouncer to track up to 100 prepared statements per physical connection and transparently remap them across client connections. Additionally, `packages/db/src/client.ts` sets `prepare: false` in the postgres-js constructor as a belt-and-suspenders measure — Drizzle will not attempt server-side prepared statements, relying instead on extended query protocol.

**Do not remove `max_prepared_statements = 100` from any `.ini` file.**

---

## Diagnosing a Suspected Leak

If you observe rows from Agency A appearing in queries scoped to Agency B, follow this checklist in order:

1. **Check `audit_log` for mismatched `db_user` vs `agency_id`.** The `audit_log` table records `db_user` (the Postgres role used) alongside `agency_id`. A row where `db_user = 'brand_user'` but `agency_id` is an ecommerce UUID is a strong indicator of a SET LOCAL violation.

   ```sql
   SELECT db_user, agency_id, op, table_name, occurred_at
   FROM audit_log
   WHERE db_user != CONCAT(LEFT(agency_id::text, 4), '%')  -- rough mismatch check
   ORDER BY occurred_at DESC
   LIMIT 50;
   ```

2. **Grep for `SET app.agency_id` in source code.** Run the ESLint rule manually against the entire workspace to catch any recently introduced violations:

   ```bash
   pnpm turbo run lint
   # or targeted:
   pnpm --filter=@mjagency/db lint
   ```

   Any `mjagency-db/no-session-set` error indicates a source file that writes `SET app.agency_id` directly. The offending commit should be reverted immediately.

3. **Run `verify-pgbouncer-rls.ts` against the live DB.** This script fires 50 concurrent `withAgencyContext` transactions across all 12 agencies and checks every returned row for cross-agency contamination:

   ```bash
   BRAND_DB_PASSWORD=... ECOMMERCE_DB_PASSWORD=... \
   GROWTH_DB_PASSWORD=... WEBDEV_DB_PASSWORD=... \
   AI_DB_PASSWORD=... BRANDING_DB_PASSWORD=... \
   STRATEGY_DB_PASSWORD=... FINANCE_DB_PASSWORD=... \
   ENGINEERING_DB_PASSWORD=... PRODUCT_DB_PASSWORD=... \
   VIDEO_DB_PASSWORD=... GRAPHIC_DB_PASSWORD=... \
   pnpm tsx scripts/verify-pgbouncer-rls.ts
   ```

   Exit code 0 = clean. Exit code 1 = leak detected (details printed to stderr). Exit code 2 = skipped (no credentials).

4. **If leaks are confirmed, file a P0 incident immediately.** Steps:
   - Identify the offending commit via `git log --oneline | head -20` and `git show <hash>` for recent changes.
   - Revert the offending commit: `git revert <hash>`.
   - Restart the affected PgBouncer instance to flush any stale physical connections: `pm2 restart pgbouncer-<slug>`.
   - Re-run `verify-pgbouncer-rls.ts` to confirm clean state.
   - Audit `audit_log` for affected time window; notify impacted agencies.

---

## CI Gate

The `no-session-set` ESLint rule is wired into `packages/config/eslint/index.js` and runs as part of `pnpm turbo run lint`. Any `.ts` or `.tsx` file under `packages/*/src/**` or `apps/*/src/**` that contains the literal `SET app.agency_id` (case-insensitive) will fail the lint check with:

```
mjagency-db/no-session-set: Use `set_config('app.agency_id', id, true)` (SET LOCAL) inside withAgencyContext — session-scoped SET leaks across PgBouncer pool connections.
```

This blocks the PR pipeline before any cross-tenant leak can reach production. The rule fires at AST level — it matches string `Literal` nodes and `TemplateElement` nodes, not comments. It does NOT match `set_config('app.agency_id', ...)` which is the correct pattern.

---

## Validation Steps for Engineers

Run these commands to verify the full stack is working correctly:

```bash
# 1. Run the ESLint rule unit tests (no DB required)
pnpm --filter=@mjagency/db vitest run src/lint/no-session-set.test.ts

# 2. Run the SET LOCAL integration tests (skips without DB)
INTEGRATION_DATABASE_URL=<url> \
INTEGRATION_BRAND_AGENCY_ID=<uuid> \
INTEGRATION_ECOMMERCE_AGENCY_ID=<uuid> \
BRAND_DB_PASSWORD=<pw> \
pnpm --filter=@mjagency/db vitest run src/__tests__/pgbouncer-set-local.integration.test.ts

# 3. Run the end-to-end concurrent verifier (skips without DB credentials)
BRAND_DB_PASSWORD=<pw> ECOMMERCE_DB_PASSWORD=<pw> \
pnpm tsx scripts/verify-pgbouncer-rls.ts

# 4. Run full workspace lint to confirm no-session-set has no false positives
pnpm turbo run lint

# 5. Typecheck packages/db
pnpm --filter=@mjagency/db typecheck
```

Expected outcomes (without a live PgBouncer-fronted DB):
- Step 1: `6 passed` (RuleTester cases)
- Step 2: `3 skipped` (no INTEGRATION_DATABASE_URL)
- Step 3: exit code 2, message `SKIPPED — no integration DB credentials found`
- Step 4: exit 0 (no errors)
- Step 5: exit 0 (no type errors)
