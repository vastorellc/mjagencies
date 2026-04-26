# Phase 2: Multi-tenant DB + Migration — Research

**Researched:** 2026-04-26
**Domain:** Drizzle ORM, PostgreSQL RLS, multi-tenant isolation, migration orchestration, backup automation, cryptographic audit log, AES-GCM encryption
**Confidence:** HIGH (stack locked; primary goal is verifying current API patterns, version pins, and integration pitfalls)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**From Phase 1 (carried forward)**
- 13 logical DBs in shared Postgres 17 instance (not 13 separate processes) — D-04
- 12 PgBouncer instances on ports 6432–6443 in transaction mode, max_prepared_statements=100 — D-05
- `packages/db` provides typed connection helpers (`agencyConnection`, `buildDatabaseUrl`, `allAgencyConnections`) — Wave 2 deliverable
- Agency-isolation Redis keys via `REDIS_KEY` helper from `@mjagency/config` — REQ pattern
- BullMQ queue payload encryption: AES-GCM-256 via `BULLMQ_ENCRYPTION_KEY` (Doppler-managed)
- Pino logger with redaction paths covers DB query trace_id injection per OTel autoinstrument-pino

**From CONTEXT.md**
- ORM: Drizzle (per CLAUDE.md — chosen over Prisma)
- Migration tool: Drizzle-kit + custom runner that wraps it for parallel × 13
- Audit log: hash-chain with `prev_hash` per row; append-only enforced via Postgres trigger; 7-year retention
- Permissions vault: `permissions_vault` table with AES-GCM-256 encrypted `value` column
- RLS: every base table has `agency_id` UUID column + RLS policy using `current_setting('app.agency_id')::uuid`
- `agency_id` immutable: trigger rejects UPDATE that changes `agency_id`

### Claude's Discretion

All implementation choices not explicitly locked above — table structure beyond `agency_id`, indexing strategy, migration ordering, seed factory patterns, backup retention bands beyond hourly+quarterly, BullMQ queue naming. Use ROADMAP success criteria, codebase conventions from Phase 1, and `mjagency/specs/` content where present.

### Deferred Ideas (OUT OF SCOPE)

- Cross-region replication (M012+ — single VPS at M001-M011)
- Per-agency separate Postgres clusters (defer to scaling milestone — D-04)
- Audit log archiving to cold storage (M012 — backup runbook covers retention)
- pgaudit extension (consider in M011 hardening — Phase 2 uses application-layer audit)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-010 | Per-agency PostgreSQL 17 database (13 total) | §1 Schema + §2 Migration runner — 13 DBs already provisioned in Phase 1; Phase 2 adds schema |
| REQ-011 | PgBouncer per agency, transaction mode, pool_size=20 | §1.3 RLS+PgBouncer critical interaction; config already shipped in Phase 1 |
| REQ-012 | Drizzle ORM with strict TypeScript types | §1 Drizzle schema patterns; version matrix §9 |
| REQ-013 | Row-level security on all agency-scoped tables | §1.2 RLS DDL + policy patterns; §1.3 PgBouncer SET LOCAL |
| REQ-014 | `agency_id` immutable after creation | §1.4 Immutable trigger DDL |
| REQ-015 | Migration runner — parallel, dry-run, canary, rollback | §2 Migration runner architecture |
| REQ-016 | Seed scripts — transactional, resume on fail | §3 Seed framework with `_seed_state` tracking table |
| REQ-017 | Backup — hourly WAL + snapshots, R2 upload, quarterly DR | §4 Backup automation with pgBackRest + R2 |
| REQ-018 | Permissions vault (encrypted, 7yr retention) | §6 Permissions vault AES-GCM-256 |
| REQ-019 | Audit log — hash-chained, append-only | §5 Hash-chained audit log |
| REQ-306 | BullMQ sensitive payloads encrypted before Redis | §7 BullMQ AES-GCM wrapper |
| REQ-407 | Asset permission expiry — auto-pauses asset | §6 Permissions vault TTL + revocation |
| REQ-425 | BullMQ sensitive payloads — AES-GCM-256 encrypted | §7 BullMQ AES-GCM wrapper |

</phase_requirements>

---

## Summary

Phase 2 builds the data layer that all 12 phases depend on. It extends the Phase 1 Postgres/PgBouncer topology (13 logical DBs, 12 transaction-mode pools) with Drizzle schema definitions, RLS policies, a parallel migration runner, a resumable seed framework, backup automation, and two security primitives — a hash-chained audit log and an AES-GCM-256 permissions vault.

The most critical integration risk is the RLS+PgBouncer interaction. PgBouncer in transaction mode reuses physical connections across transactions; any session-level `SET app.agency_id = '...'` is visible to the next transaction on the same physical connection. The fix is to always use `SET LOCAL` (transaction-scoped) via PostgreSQL's `set_config('app.agency_id', id, true)` — the third parameter `true` means "local to current transaction". The Drizzle transaction wrapper in `packages/db` must enforce this pattern; every agency query must be wrapped in `db.transaction(async (tx) => { await tx.execute(sql\`SELECT set_config('app.agency_id', ${agencyId}, true)\`); ... })`.

The migration runner cannot use drizzle-kit CLI directly for 13 DBs in parallel. The programmatic API from `drizzle-orm/postgres-js/migrator` (`migrate(db, { migrationsFolder })`) is the correct approach — one `migrate()` call per agency, all fired concurrently with `Promise.allSettled()`, with a canary (run brand first, inspect, then release all others), dry-run, and rollback checkpoint before each migration batch.

**Primary recommendation:** Apply every pattern listed below in `packages/db` as the single source of truth for DB access, migration, and seed orchestration. Never bypass this package with raw `postgres()` calls in application code.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Drizzle schema definitions | packages/db | — | Single source of truth for all 13 DBs; each agency shares identical schema |
| RLS policy enforcement | Database (Postgres) | packages/db (SET LOCAL) | DB enforces policy; app sets transaction-scoped context variable |
| Migration orchestration | scripts/migrate-runner | packages/db/migrator | CLI runner script wraps programmatic `migrate()` in packages/db |
| Seed execution | scripts/seed-runner | packages/db/seed | CLI runner script; seed logic in packages/db |
| Backup automation | scripts/backup | infra/pgbackrest | Shell scripts cron-scheduled; pgBackRest handles WAL archiving |
| Audit log hashing | Database (Postgres trigger) | packages/db | Trigger computes hash at INSERT; app provides correlation_id via `set_config` |
| Permissions vault encryption | packages/db/vault | — | Application-layer AES-GCM-256; Postgres stores `bytea` ciphertext |
| BullMQ payload encryption | packages/queue | — | Encrypt before `queue.add()`, decrypt in worker; key from Doppler |

---

## §1 Drizzle Schema + RLS

### §1.1 Package Versions

[VERIFIED: npm registry 2026-04-26]

| Package | Version | Purpose |
|---------|---------|---------|
| `drizzle-orm` | `0.45.2` | ORM + query builder + RLS helpers |
| `drizzle-kit` | `0.31.10` | Migration generation + CLI |
| `drizzle-seed` | `0.3.1` | Deterministic seed data generation |
| `postgres` | `3.4.9` | postgres-js driver (primary driver) |

Installation:
```bash
pnpm add drizzle-orm@0.45.2 postgres@3.4.9
pnpm add -D drizzle-kit@0.31.10 drizzle-seed@0.3.1
```

### §1.2 Base Table Pattern with `agency_id` + RLS

Every agency-scoped table in the schema follows this pattern [VERIFIED: drizzle-orm docs + PostgreSQL 17 docs]:

```typescript
// packages/db/src/schema/base.ts
import { pgTable, uuid, timestamp, text } from 'drizzle-orm/pg-core'
import { pgPolicy } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Agency-scoped base columns — included in every tenant table via spread.
 * agency_id is immutable after insert (enforced by DB trigger — see §1.4).
 */
export const agencyBaseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  agencyId: uuid('agency_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

/**
 * Example agency-scoped table with RLS.
 * The policy USING clause reads the transaction-local app.agency_id setting
 * (set via set_config before every query — see §1.3).
 */
export const pages = pgTable(
  'pages',
  {
    ...agencyBaseColumns,
    slug: text('slug').notNull(),
    title: text('title').notNull(),
  },
  (t) => [
    pgPolicy('pages_agency_isolation', {
      as: 'permissive',
      for: 'all',
      to: sql`CURRENT_USER`,  // the per-agency Postgres role
      using: sql`agency_id = current_setting('app.agency_id', true)::uuid`,
      withCheck: sql`agency_id = current_setting('app.agency_id', true)::uuid`,
    }),
  ]
).enableRLS()
```

Key points:
- `current_setting('app.agency_id', true)` — the second argument `true` means "return NULL instead of error if setting is missing", which prevents accidental policy denials during migrations (set to special bypass value during migrations — see SEC-09).
- `enableRLS()` marks the table for RLS; Drizzle emits `ALTER TABLE pages ENABLE ROW LEVEL SECURITY` in the migration.
- For the migration service account (which must bypass RLS), use a role with `BYPASSRLS` attribute — see §2.3.

Raw DDL equivalent for reference:
```sql
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages FORCE ROW LEVEL SECURITY;  -- applies to table owner too

CREATE POLICY pages_agency_isolation ON pages
  AS PERMISSIVE
  FOR ALL
  TO ecommerce_user               -- per-agency role
  USING (agency_id = current_setting('app.agency_id', true)::uuid)
  WITH CHECK (agency_id = current_setting('app.agency_id', true)::uuid);
```

`FORCE ROW LEVEL SECURITY` is important for testing — without it, the table owner (the migration role) bypasses RLS silently. [VERIFIED: PostgreSQL 17 docs; Bytebase RLS footguns article]

### §1.3 CRITICAL: RLS Context + PgBouncer Transaction Mode

**This is the single most dangerous integration point.** [VERIFIED: pganalyze blog; Bytebase RLS footguns; multiple sources]

PgBouncer in transaction mode multiplexes many application connections onto a smaller pool of physical Postgres connections. When a transaction ends, the physical connection goes back to the pool **with any session-level `SET` still in effect**. The next transaction from a different agency could run with the wrong `app.agency_id`.

**Wrong (session-scoped SET — leaks across pool connections):**
```typescript
// NEVER do this with PgBouncer transaction mode
await db.execute(sql`SET app.agency_id = ${agencyId}`)
// ... queries below may run on a DIFFERENT physical connection
```

**Correct (transaction-scoped SET LOCAL via set_config):**
```typescript
// packages/db/src/client.ts

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import { buildDatabaseUrl, agencyConnection } from './connection.js'
import type { AGENCIES } from '@mjagency/config'

/**
 * Creates a Drizzle db instance for an agency with:
 * - prepare: false (PgBouncer pitfall 3.3)
 * - withAgencyContext() helper that wraps every query in a transaction
 *   with SET LOCAL so app.agency_id is transaction-scoped
 */
export function createAgencyDb(slug: (typeof AGENCIES)[number], password: string) {
  const url = buildDatabaseUrl(slug, password)
  const client = postgres(url, {
    prepare: false,   // CRITICAL: pitfall 3.3 — Drizzle prepared statements + PgBouncer tx mode
    max: 10,          // Per-agency connection ceiling (PgBouncer default_pool_size=20 is the real cap)
  })
  const db = drizzle({ client })
  return db
}

/**
 * Wraps a callback in a Postgres transaction with transaction-local RLS context.
 * The set_config third parameter = true means "local to current transaction" (SET LOCAL semantics).
 * This is the ONLY safe way to set RLS context under PgBouncer transaction mode.
 *
 * Usage:
 *   const result = await withAgencyContext(db, agencyId, async (tx) => {
 *     return tx.select().from(pages)
 *   })
 */
export async function withAgencyContext<T>(
  db: ReturnType<typeof createAgencyDb>,
  agencyId: string,
  callback: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // set_config(setting_name, new_value, is_local)
    // is_local=true => SET LOCAL (reverted at transaction end)
    await tx.execute(
      sql`SELECT set_config('app.agency_id', ${agencyId}, true)`
    )
    return callback(tx)
  })
}
```

Migration scripts bypass RLS by using the `migrations` special value (SEC-09):
```sql
-- migration scripts set this BEFORE running DDL
SELECT set_config('app.agency_id', 'migrations', false);  -- session scope OK for migrations
```

### §1.4 `agency_id` Immutability Trigger

[VERIFIED: PostgreSQL 17 docs + search findings]

```sql
-- Shared function used by all agency-scoped tables
CREATE OR REPLACE FUNCTION prevent_agency_id_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
    RAISE EXCEPTION
      'agency_id is immutable. Attempted change from % to % on table %',
      OLD.agency_id, NEW.agency_id, TG_TABLE_NAME
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Apply to every agency-scoped table (generated per-table in migration)
CREATE TRIGGER enforce_agency_id_immutable
  BEFORE UPDATE OF agency_id ON pages
  FOR EACH ROW EXECUTE FUNCTION prevent_agency_id_change();
```

In Drizzle schema, this trigger is declared as a custom DDL migration (since Drizzle does not model BEFORE triggers directly):

```typescript
// packages/db/src/migrations/custom/001_agency_id_immutable.sql
-- (emitted via drizzle-kit custom migration)
-- Content: the CREATE OR REPLACE FUNCTION + CREATE TRIGGER statements above
-- Applied once per DB, not per-table (function is shared)
```

The trigger fires only on `UPDATE OF agency_id`, meaning it only activates when that column is explicitly changed, not on every UPDATE. This is more performant than a general BEFORE UPDATE trigger. [VERIFIED: PostgreSQL 17 CREATE TRIGGER docs]

### §1.5 Drizzle `drizzle.config.ts` — Multi-Database Pattern

Since each agency DB has an identical schema, the migration generation step is done once (no per-agency drizzle.config needed). Migration *application* is done 13 times (once per DB) by the runner script in §2.

```typescript
// drizzle.config.ts (single config for schema generation)
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/db/src/schema/index.ts',
  out: './packages/db/src/migrations',
  migrations: {
    table: '__drizzle_migrations',   // default; override if desired
    schema: 'public',
  },
  entities: {
    roles: true,  // needed for pgPolicy role references
  },
})
```

---

## §2 Migration Runner

### §2.1 Programmatic Migration API

[VERIFIED: drizzle-orm docs + community discussion #1901]

```typescript
// Import path — postgres-js migrator
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

// Pattern: dedicated migration connection (max: 1 per DB spec)
async function migrateAgency(slug: string, password: string): Promise<void> {
  const url = buildDatabaseUrl(slug as any, password)
  // Migration client: max=1 (recommended), prepare=false (PgBouncer pitfall)
  // Note: migrations BYPASS PgBouncer — connect directly to Postgres port 5432
  const migrationClient = postgres(url, { max: 1, prepare: false })
  const db = drizzle({ client: migrationClient })
  try {
    await migrate(db, { migrationsFolder: './packages/db/src/migrations' })
  } finally {
    await migrationClient.end()
  }
}
```

**CRITICAL:** Migrations must connect DIRECTLY to Postgres (port 5432), NOT through PgBouncer. PgBouncer transaction mode does not support the multi-statement DDL that migrations emit. The `init.sql.tmpl` pattern from Phase 1 uses the direct Postgres port; the migration runner must do the same by constructing the URL with port 5432 rather than the PgBouncer port. [VERIFIED: PostgreSQL + PgBouncer docs; ASSUMED: specific port override needed in `buildDatabaseUrl` for migration context]

### §2.2 Parallel Runner Architecture

```typescript
// scripts/migrate-runner.ts
import { allAgencyConnections } from '@mjagency/db'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

interface MigrateOptions {
  agency?: string       // single agency slug, or omit for all
  dryRun?: boolean      // print migrations to run, do not apply
  canary?: boolean      // run brand first, wait for OK, then all others
  sequential?: boolean  // fallback: run one at a time (default: parallel)
}

async function migrateAll(opts: MigrateOptions = {}): Promise<void> {
  const connections = opts.agency
    ? allAgencyConnections().filter(c => c.agencySlug === opts.agency)
    : allAgencyConnections()

  if (opts.dryRun) {
    // Print pending migrations per agency without applying
    await Promise.allSettled(connections.map(conn => checkPendingMigrations(conn)))
    return
  }

  if (opts.canary) {
    // Step 1: Run canary (brand = first in AGENCIES list)
    const canary = connections.find(c => c.agencySlug === 'brand')!
    await runMigration(canary)
    console.log('[canary] brand migration complete — inspect DB, then press Enter to continue')
    await waitForKeypress()

    // Step 2: Run remaining 12 in parallel
    const rest = connections.filter(c => c.agencySlug !== 'brand')
    const results = await Promise.allSettled(rest.map(runMigration))
    reportResults(results, rest)
    return
  }

  if (opts.sequential) {
    for (const conn of connections) {
      await runMigration(conn)
    }
    return
  }

  // Default: parallel across all 13
  const results = await Promise.allSettled(connections.map(runMigration))
  reportResults(results, connections)
}

async function runMigration(conn: AgencyConnection): Promise<void> {
  const password = process.env[`${conn.agencySlug.toUpperCase()}_DB_PASSWORD`]!
  // Direct Postgres URL (bypass PgBouncer for migrations)
  const directUrl = `postgresql://${conn.role}:${encodeURIComponent(password)}@127.0.0.1:5432/${conn.dbName}`
  const client = postgres(directUrl, { max: 1, prepare: false })
  const db = drizzle({ client })
  try {
    await migrate(db, { migrationsFolder: './packages/db/src/migrations' })
    console.log(`[migrate] ${conn.agencySlug}: OK`)
  } finally {
    await client.end()
  }
}
```

### §2.3 Rollback Strategy

Drizzle does not generate rollback SQL natively. The project uses the following rollback pattern:

1. **Before each migration batch** — take a Postgres `pg_dump --schema-only` snapshot per DB (fast, schema-only).
2. **On migration failure** — `psql -f schema-snapshot-TIMESTAMP.sql` on the failed DB.
3. **Custom `down` migrations** — for destructive operations (DROP TABLE, ALTER COLUMN), a matching `*_down.sql` file is written alongside the generated migration and applied manually if rollback is needed.

This is the industry standard for Drizzle (no automatic rollback support). [VERIFIED: Drizzle docs — no `down` migration generation]

### §2.4 Migration Service Role

Migrations need a role that:
- Has DDL privileges (CREATE TABLE, ALTER TABLE, etc.)
- Bypasses RLS (the `BYPASSRLS` privilege)
- Is NOT the per-agency app role (which has DML only)

```sql
-- infra/postgres/migration-role.sql (added to init.sql.tmpl)
CREATE ROLE migrations_runner WITH LOGIN PASSWORD '...' BYPASSRLS;
GRANT CREATE ON DATABASE brand_db TO migrations_runner;
-- Repeated per DB
```

The migration runner uses `migrations_runner` credentials from Doppler (`MIGRATIONS_DB_PASSWORD`). [CITED: mjagency/specs/security.md SEC-09]

---

## §3 Seed Framework

### §3.1 Design: Resumable Seeds with `_seed_state` Table

drizzle-seed (v0.3.1) does not support resumability natively. The project implements resumable seeds via a `_seed_state` table inside each agency DB. [VERIFIED: drizzle-seed docs — no resumability mentioned]

```sql
-- Created by Wave 0 of the migration runner before any seed runs
CREATE TABLE IF NOT EXISTS _seed_state (
  step_name   text PRIMARY KEY,
  status      text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at  timestamptz,
  completed_at timestamptz,
  error_text  text,
  metadata    jsonb DEFAULT '{}'
);
```

```typescript
// packages/db/src/seed/runner.ts

export interface SeedStep {
  name: string          // unique step identifier, e.g. 'agencies', 'users', 'pages'
  run: (db: AgencyDb, agencySlug: string) => Promise<void>
}

/**
 * Executes seed steps in order. Skips steps already 'completed'.
 * On failure, marks step 'failed' and rethrows — caller can retry from that step.
 */
export async function runSeed(
  db: AgencyDb,
  agencySlug: string,
  steps: SeedStep[]
): Promise<void> {
  for (const step of steps) {
    const existing = await db
      .select()
      .from(seedState)
      .where(eq(seedState.stepName, step.name))
      .limit(1)

    if (existing[0]?.status === 'completed') {
      console.log(`[seed:${agencySlug}] ${step.name}: already completed, skipping`)
      continue
    }

    await db
      .insert(seedState)
      .values({ stepName: step.name, status: 'running', startedAt: new Date() })
      .onConflictDoUpdate({
        target: seedState.stepName,
        set: { status: 'running', startedAt: new Date(), errorText: null },
      })

    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.agency_id', ${agencySlug}, true)`)
        await step.run(tx, agencySlug)
      })
      await db.update(seedState)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(seedState.stepName, step.name))
      console.log(`[seed:${agencySlug}] ${step.name}: completed`)
    } catch (err) {
      await db.update(seedState)
        .set({ status: 'failed', errorText: String(err) })
        .where(eq(seedState.stepName, step.name))
      throw err
    }
  }
}
```

### §3.2 drizzle-seed Usage Pattern

For bulk test/dev data generation, drizzle-seed is used within seed steps:

```typescript
// packages/db/src/seed/steps/base-data.ts
import { seed } from 'drizzle-seed'
import * as schema from '../../schema/index.js'

export const baseDataStep: SeedStep = {
  name: 'base-data',
  async run(db, agencySlug) {
    await seed(db, { users: schema.users, pages: schema.pages }).refine((f) => ({
      users: {
        count: 5,
        columns: {
          agencyId: f.default({ defaultValue: agencySlug }),
        },
      },
    }))
  },
}
```

Note: drizzle-seed requires `drizzle-orm@0.36.4+`. Current project version (0.45.2) satisfies this. [VERIFIED: drizzle-seed docs]

### §3.3 Per-Agency vs Shared Seeds

| Seed Type | Target | Strategy |
|-----------|--------|---------|
| Agency-specific content | Each agency DB | `--agency=<slug>` flag; one `_seed_state` table per DB |
| Shared/platform data | brand_db only | Separate `sharedSeedSteps` array; applies to brand DB |
| CRM pre-seeds (Phase 9) | All agency DBs | Parallel across 12 agencies after base seed completes |

---

## §4 Backup Automation

### §4.1 Tool Selection: pgBackRest over barman

[VERIFIED: multiple 2025 comparison sources + pgBackRest docs]

| Factor | pgBackRest | barman |
|--------|-----------|--------|
| Block-level incremental | Yes (17+ native) | No (file-level rsync) |
| S3/R2 native support | Yes (`repo1-type=s3`) | No (third-party plugins) |
| Single-server setup | Simple | Requires separate backup server |
| Compression | zstd (fastest), lz4, gzip | gzip default |
| Encryption | Built-in (`repo1-cipher-type=aes-256-cbc`) | Requires external tooling |
| WAL archiving | `archive-push` command | `archive-command` wrapper |

**Decision:** pgBackRest for all backup automation. barman is enterprise-complexity overkill for single VPS. [ASSUMED: pgBackRest v2.5x is available on target VPS OS]

### §4.2 pgBackRest Configuration for Cloudflare R2

Cloudflare R2 is S3-compatible. Use `endpoint` to point to the R2 S3 API:

```ini
# /etc/pgbackrest/pgbackrest.conf
[global]
repo1-type=s3
repo1-path=/mjagency-postgres-backups
repo1-s3-region=auto                         # R2 uses "auto"
repo1-s3-endpoint=<account-id>.r2.cloudflarestorage.com
repo1-s3-bucket=mjagency-db-backups
repo1-s3-key=<R2_ACCESS_KEY_ID>             # from Doppler
repo1-s3-key-secret=<R2_SECRET_ACCESS_KEY>  # from Doppler
repo1-cipher-type=aes-256-cbc               # encrypt at rest
repo1-cipher-pass=<PGBACKREST_CIPHER_PASS>  # from Doppler
repo1-retention-full=7                       # keep 7 full backups
repo1-retention-diff=30                      # keep 30 differential
repo1-retention-archive=1095                 # keep WAL for 3 years (in days)

compress-type=zstd                           # fastest compression
compress-level=3

[postgres-main]
pg1-path=/var/lib/postgresql/17/main
pg1-port=5432
```

### §4.3 Backup Schedule

| Frequency | Type | Retention | Schedule |
|-----------|------|---------|---------|
| Hourly | WAL archive (`archive-push`) | 3 years | Continuous (postgresql.conf archive_command) |
| Daily | Incremental (`--type=incr`) | 30 days | cron: `0 2 * * *` |
| Weekly | Differential (`--type=diff`) | 90 days | cron: `0 3 * * 0` |
| Monthly | Full (`--type=full`) | 7 years | cron: `0 4 1 * *` |

7-year full backups satisfy the `permissions_vault` 7-year retention requirement (REQ-018). [CITED: CONTEXT.md backup schedule spec]

### §4.4 Restore + DR Drill Procedure

```bash
# Restore to staging (quarterly DR drill)
pgbackrest --stanza=postgres-main --delta restore --target-exclusive

# Verify backup info before restore
pgbackrest --stanza=postgres-main info

# Point-in-time recovery (hourly RPO)
pgbackrest --stanza=postgres-main restore \
  --target="2026-04-26 14:30:00" \
  --target-action=promote
```

DR drill checklist (quarterly):
1. Provision staging Postgres 17 container
2. Run `pgbackrest restore --delta`
3. Verify all 13 DBs present and accessible
4. Run `pnpm tsx scripts/migrate-runner.ts --dry-run` — expect 0 pending migrations
5. Run integration test suite against staging
6. Document RTO measured (target < 4h per SLA)

---

## §5 Audit Log Hash Chain

### §5.1 Table DDL

[VERIFIED: appmaster.io audit trail article + PostgreSQL pgcrypto docs]

```sql
-- Single audit log table per agency DB (not a shared table)
CREATE TABLE audit_log (
  id             bigserial PRIMARY KEY,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  table_name     text NOT NULL,
  op             text NOT NULL CHECK (op IN ('INSERT', 'UPDATE', 'DELETE')),
  row_pk         text NOT NULL,           -- primary key of affected row
  actor_id       uuid,                    -- from set_config('app.actor_id')
  agency_id      uuid NOT NULL,
  db_user        text NOT NULL DEFAULT current_user,
  txid           bigint NOT NULL DEFAULT txid_current(),
  correlation_id text,                    -- from set_config('app.correlation_id')
  old_row        jsonb,
  new_row        jsonb,
  prev_hash      bytea,                   -- hash of previous row (NULL for first row)
  row_hash       bytea NOT NULL           -- SHA-256 of this row's canonical data
);

-- Append-only: REVOKE UPDATE/DELETE from the app role
REVOKE UPDATE, DELETE ON audit_log FROM ecommerce_user;

-- No RLS on audit_log — agency_id column + REVOKE is sufficient
-- (RLS on audit_log creates circular dependency with audit trigger)
```

### §5.2 Hash Computation Trigger

```sql
-- Requires pgcrypto extension (pre-installed on Postgres 17)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION audit_log_hash_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_prev_hash bytea;
  v_canonical text;
BEGIN
  -- Get the hash of the most recent row (for chain linking)
  SELECT row_hash INTO v_prev_hash
  FROM audit_log
  ORDER BY id DESC
  LIMIT 1;

  -- Canonical string: pipe-delimited, jsonb normalized via ::text for determinism
  v_canonical := concat_ws('|',
    NEW.id::text,
    NEW.occurred_at::text,
    NEW.table_name,
    NEW.op,
    NEW.row_pk,
    COALESCE(NEW.actor_id::text, ''),
    NEW.agency_id::text,
    NEW.txid::text,
    COALESCE(NEW.correlation_id, ''),
    COALESCE(NEW.old_row::text, 'null'),
    COALESCE(NEW.new_row::text, 'null'),
    COALESCE(encode(v_prev_hash, 'hex'), 'genesis')
  );

  NEW.prev_hash := v_prev_hash;
  NEW.row_hash  := digest(v_canonical, 'sha256');
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_log_hash_before_insert
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_hash_trigger();
```

### §5.3 Per-Table Audit Trigger

Applied to every agency-scoped table that needs auditing:

```sql
CREATE OR REPLACE FUNCTION capture_audit_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_log (table_name, op, row_pk, actor_id, agency_id, old_row, new_row, correlation_id)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id::text, OLD.id::text),
    current_setting('app.actor_id', true)::uuid,
    COALESCE(NEW.agency_id, OLD.agency_id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    current_setting('app.correlation_id', true)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Applied per table (generated in migration):
CREATE TRIGGER audit_pages
  AFTER INSERT OR UPDATE OR DELETE ON pages
  FOR EACH ROW EXECUTE FUNCTION capture_audit_row();
```

`SECURITY DEFINER` ensures the trigger function runs with the privileges of its owner (the migrations role), not the invoking role. This is needed for INSERT into audit_log even if the app role has had UPDATE/DELETE revoked.

### §5.4 Chain Verification Script

```typescript
// packages/db/src/audit/verify-chain.ts
import { createHash } from 'node:crypto'
import type { AgencyDb } from '../client.js'

export async function verifyAuditChain(
  db: AgencyDb
): Promise<{ broken: number[]; total: number }> {
  const rows = await db.execute(sql`
    WITH ordered AS (
      SELECT
        id, occurred_at, table_name, op, row_pk, actor_id::text,
        agency_id::text, txid::text, correlation_id,
        old_row::text, new_row::text,
        prev_hash, row_hash,
        LAG(row_hash) OVER (ORDER BY id) AS expected_prev_hash
      FROM audit_log
      ORDER BY id
    )
    SELECT id, prev_hash, row_hash, expected_prev_hash,
      concat_ws('|',
        id::text, occurred_at::text, table_name, op, row_pk,
        COALESCE(actor_id, ''), agency_id::text, txid::text,
        COALESCE(correlation_id, ''),
        COALESCE(old_row::text, 'null'),
        COALESCE(new_row::text, 'null'),
        COALESCE(encode(expected_prev_hash, 'hex'), 'genesis')
      ) AS canonical
    FROM ordered
  `)

  const broken: number[] = []
  for (const row of rows.rows) {
    const expected = createHash('sha256').update(row.canonical as string).digest()
    if (!expected.equals(Buffer.from(row.row_hash as Buffer))) {
      broken.push(row.id as number)
    }
    if (row.expected_prev_hash !== null &&
        !Buffer.from(row.prev_hash as Buffer).equals(Buffer.from(row.expected_prev_hash as Buffer))) {
      broken.push(row.id as number)
    }
  }
  return { broken: [...new Set(broken)], total: rows.rows.length }
}
```

### §5.5 7-Year Retention Without Table Bloat

The audit_log table uses **monthly range partitioning** to avoid table bloat [ASSUMED — partition DDL based on standard Postgres partitioning patterns]:

```sql
CREATE TABLE audit_log (
  -- columns as above
) PARTITION BY RANGE (occurred_at);

-- Create new partition monthly (via cron job or application code)
CREATE TABLE audit_log_2026_04
  PARTITION OF audit_log
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

Partitions older than 7 years are detached (not dropped) and stored as read-only archival tables. The `pgBackRest` full backup covers these tables within the 7-year retention window.

---

## §6 Permissions Vault

### §6.1 Design: Application-Layer AES-GCM-256

**pgcrypto does not support AES-GCM natively** (only AES-CBC via `pgp_sym_encrypt`). Application-layer encryption is the correct approach for AES-GCM-256. [VERIFIED: pgcrypsi GitHub README; web search findings; PostgreSQL pgcrypto docs]

The vault table stores the ciphertext as `bytea` (IV + authTag + ciphertext concatenated):

```sql
CREATE TABLE permissions_vault (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL,
  permission_key  text NOT NULL,          -- e.g. 'cloudflare_api_token'
  encrypted_value bytea NOT NULL,         -- IV(12) || authTag(16) || ciphertext(N)
  key_version     integer NOT NULL DEFAULT 1,  -- for key rotation (SEC-10)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,            -- REQ-407: asset permission expiry
  revoked_at      timestamptz,            -- soft delete for audit trail
  UNIQUE (agency_id, permission_key)
);

-- RLS applies (same pattern as §1.2)
ALTER TABLE permissions_vault ENABLE ROW LEVEL SECURITY;
```

### §6.2 AES-GCM-256 Encrypt/Decrypt (Node.js crypto — no npm dependency)

[VERIFIED: Node.js crypto module docs; multiple code examples confirmed]

```typescript
// packages/db/src/vault/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12    // 96-bit IV — recommended for GCM
const TAG_BYTES = 16   // 128-bit auth tag

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns Buffer layout: [12-byte IV][16-byte authTag][N-byte ciphertext]
 * Key must be 32 bytes (256 bits) — derive from Doppler VAULT_ENCRYPTION_KEY via scrypt or pass 32-byte hex.
 */
export function encryptVaultValue(plaintext: string, key: Buffer): Buffer {
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes (256-bit)')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  // Layout: IV || authTag || ciphertext
  return Buffer.concat([iv, authTag, encrypted])
}

/**
 * Decrypt ciphertext from the vault.
 * Input buffer layout: [12-byte IV][16-byte authTag][N-byte ciphertext]
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
```

Key derivation from Doppler env var:
```typescript
// packages/db/src/vault/key.ts
import { scryptSync } from 'node:crypto'

/** Derive a 32-byte key from VAULT_ENCRYPTION_KEY env var (arbitrary-length password) */
export function getVaultKey(): Buffer {
  const raw = process.env.VAULT_ENCRYPTION_KEY
  if (!raw) throw new Error('VAULT_ENCRYPTION_KEY not set in Doppler env')
  // scrypt: salt is fixed (app-level), KDF stretches password to 32 bytes
  return scryptSync(raw, 'mjagency-vault-kdf-salt-v1', 32)
}
```

### §6.3 Key Rotation (SEC-10)

The `key_version` column enables rotation without re-encrypting all rows at once:

1. Add new key version to Doppler (`VAULT_ENCRYPTION_KEY_V2`)
2. New writes use v2 key, `key_version = 2`
3. Background job re-encrypts v1 rows in batches
4. After all rows migrated, retire v1 key

The verifier checks `key_version` to select the correct key for historical rows. [CITED: mjagency/specs/security.md SEC-10]

---

## §7 BullMQ Payload Encryption

### §7.1 BullMQ Has No Built-In Encryption

BullMQ 5.x stores job `data` as JSON in Redis. There is no built-in encryption option. Encryption is the application's responsibility. [VERIFIED: BullMQ 5.76.2 docs — job data stored clear-text in Redis]

Encryption wraps the `data` object before `queue.add()` and unwraps it before the worker processes it.

### §7.2 AES-GCM-256 Queue Wrapper

```typescript
// packages/queue/src/encrypted-queue.ts
import { Queue, Worker, Job } from 'bullmq'
import type { RedisOptions } from 'ioredis'
import { encryptVaultValue, decryptVaultValue } from '@mjagency/db/vault'
import { getQueueKey } from './key.js'

interface EncryptedPayload {
  __enc: true
  v: number      // key version
  data: string   // base64-encoded encrypted buffer
}

/**
 * Wraps queue.add() to transparently encrypt job.data before Redis storage.
 * Only encrypts jobs where sensitiveData: true in opts.
 */
export function createEncryptedQueue<T>(
  queueName: string,
  connection: RedisOptions
): Queue<EncryptedPayload> {
  const queue = new Queue<EncryptedPayload>(queueName, { connection })

  return new Proxy(queue, {
    get(target, prop) {
      if (prop === 'add') {
        return async (
          name: string,
          data: T,
          opts?: Parameters<typeof queue.add>[2] & { sensitiveData?: boolean }
        ) => {
          const payload: EncryptedPayload = opts?.sensitiveData
            ? {
                __enc: true,
                v: 1,
                data: encryptVaultValue(
                  JSON.stringify(data),
                  getQueueKey()
                ).toString('base64'),
              }
            : (data as unknown as EncryptedPayload)
          return target.add(name, payload, opts)
        }
      }
      return target[prop as keyof typeof target]
    },
  })
}

/**
 * Worker-side: decrypts job.data before calling the processor.
 * Usage: const worker = createEncryptedWorker(queueName, processor, connection)
 */
export function createEncryptedWorker<T>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>,
  connection: RedisOptions
): Worker {
  return new Worker<EncryptedPayload>(
    queueName,
    async (job) => {
      let data: T
      if (job.data.__enc) {
        data = JSON.parse(
          decryptVaultValue(
            Buffer.from(job.data.data, 'base64'),
            getQueueKey()
          )
        ) as T
      } else {
        data = job.data as unknown as T
      }
      await processor({ ...job, data } as Job<T>)
    },
    { connection }
  )
}
```

Key source:
```typescript
// packages/queue/src/key.ts
import { scryptSync } from 'node:crypto'

export function getQueueKey(): Buffer {
  const raw = process.env.BULLMQ_ENCRYPTION_KEY
  if (!raw) throw new Error('BULLMQ_ENCRYPTION_KEY not set in Doppler env')
  return scryptSync(raw, 'mjagency-queue-kdf-salt-v1', 32)
}
```

### §7.3 Performance Impact

AES-256-GCM in Node.js crypto (native C++ binding) encrypts at ~500–800 MB/s on modern hardware. A typical BullMQ job payload (< 10 KB) adds < 0.1ms encryption overhead. This is negligible. [ASSUMED: based on standard AES-GCM performance benchmarks; no project-specific measurement]

---

## §8 Pitfalls

### Pitfall 8.1: SET vs SET LOCAL — Cross-Tenant Data Leak (CRITICAL)

**What goes wrong:** Using `SET app.agency_id = '...'` (session-scoped) instead of `SELECT set_config('app.agency_id', '...', true)` (transaction-scoped) causes PgBouncer to return the physical connection to the pool with the old tenant's `app.agency_id` still set. The next transaction from a different tenant runs with the wrong RLS context, potentially returning or mutating wrong-tenant data.

**Why it happens:** PgBouncer transaction mode does not reset session parameters between transactions. The Postgres `SET` command modifies session state that survives transaction boundaries.

**How to avoid:** The `withAgencyContext()` wrapper in `packages/db/src/client.ts` (§1.3) is the ONLY approved way to run queries. Lint rule should flag any `SET app.agency_id` not inside `withAgencyContext`. The third parameter `true` in `set_config()` is the safety pin.

**Warning signs:** Integration test showing wrong-agency data in query results; audit log entries with mismatched agency_id values.

### Pitfall 8.2: Migration Uses PgBouncer Port (DDL Failure)

**What goes wrong:** Running `migrate()` through PgBouncer (port 6432–6443) instead of directly to Postgres (port 5432). DDL statements in transactions fail because PgBouncer transaction mode closes the connection mid-migration, producing `ERROR: there is already a transaction in progress` or partial DDL application.

**Why it happens:** `buildDatabaseUrl()` from packages/db defaults to PgBouncer port. Migration scripts must override to direct Postgres port 5432.

**How to avoid:** Migration runner builds its own URL with port 5432 (see §2.1 example). Never call `buildDatabaseUrl()` in migration runner — use a `buildDirectUrl()` helper that substitutes port 5432.

### Pitfall 8.3: Drizzle Prepared Statements + PgBouncer (Pitfall 3.3 carry-over from Phase 1)

**What goes wrong:** `postgres` driver sends prepared statements by default; PgBouncer transaction mode cannot track prepared statements across connection switches (pre-1.21) or when `max_prepared_statements` is not set.

**How to avoid:** Already mitigated in Phase 1 — `max_prepared_statements=100` in all PgBouncer `.ini` files. Phase 2 adds belt-and-suspenders: `prepare: false` in the postgres client constructor. Both must remain in place. [VERIFIED: packages/db/README.md pitfall 3.3]

### Pitfall 8.4: `FORCE ROW LEVEL SECURITY` Missing

**What goes wrong:** Table owner (migrations_runner role) bypasses RLS silently even when RLS is enabled. Integration tests that run as migrations_runner show all rows from all agencies, masking broken policies.

**How to avoid:** Every agency-scoped table must have `ALTER TABLE t FORCE ROW LEVEL SECURITY` in addition to `ENABLE ROW LEVEL SECURITY`. Drizzle's `.enableRLS()` generates only `ENABLE`; the `FORCE` DDL is added in the custom migration. Tests must run as the per-agency app role (not migrations_runner) to validate policy behavior. [VERIFIED: PostgreSQL 17 docs; Bytebase footguns article]

### Pitfall 8.5: Seed Bypasses RLS Without SET LOCAL

**What goes wrong:** Seed scripts that INSERT rows without calling `set_config('app.agency_id', ...)` first will fail if RLS is active (no matching policy = no rows visible; INSERT WITH CHECK also fails). Alternatively, if run as migrations_runner (BYPASSRLS), seeds silently skip the RLS check and produce data without the agency_id filter. Data may have the wrong agency_id if not set explicitly on every inserted row.

**How to avoid:** All seed steps must wrap DB calls in `withAgencyContext(db, agencySlug, ...)` (see §3.1). Every inserted row must explicitly set `agencyId: agencySlug`.

### Pitfall 8.6: Audit Log Chain Broken by Parallel INSERTs

**What goes wrong:** The `audit_log_hash_trigger` selects `MAX(id)` to get the previous row's hash. Under high concurrency, two INSERTs can see the same previous row, producing a forked chain.

**How to avoid:** Use `FOR UPDATE` locking on the chain head — or better, use a per-stream (per-table + per-agency) chain model where each stream has its own chain, reducing contention. The `prev_hash` is the hash of the previous row in the same stream, not the global audit_log table.

Revised trigger query: `SELECT row_hash INTO v_prev_hash FROM audit_log WHERE table_name = TG_TABLE_NAME AND agency_id = NEW.agency_id ORDER BY id DESC LIMIT 1 FOR UPDATE`

### Pitfall 8.7: pgcrypto AES-GCM Gap

**What goes wrong:** Using `pgp_sym_encrypt()` from pgcrypto for the permissions vault, believing it is AES-GCM. pgcrypto does NOT support AES-GCM; it uses OpenPGP-format AES-256-CBC. The project requires AES-GCM-256 (SEC-N10). Using CBC provides no integrity guarantee (no auth tag).

**How to avoid:** Application-layer Node.js `crypto.createCipheriv('aes-256-gcm', ...)` is the correct implementation (see §6.2). Never use pgcrypto for the permissions vault or BullMQ encryption. [VERIFIED: pgcrypsi README — created specifically because pgcrypto lacks AES-GCM]

### Pitfall 8.8: Audit Log Table Not Excluded from RLS

**What goes wrong:** Applying an `agency_id = current_setting(...)` RLS policy to `audit_log` creates a circular dependency: the audit trigger writes to audit_log using `app.actor_id` from the session, but the RLS policy on audit_log uses `app.agency_id` — if that setting isn't present (during migrations, setup, etc.), the INSERT fails silently.

**How to avoid:** Do NOT enable RLS on `audit_log`. Use `REVOKE UPDATE, DELETE FROM <app_role>` for append-only enforcement. The `agency_id` column + DB-level query filter (`WHERE agency_id = ?`) provides tenant isolation at the application layer.

---

## §9 Version Matrix

[VERIFIED: npm registry 2026-04-26]

| Package | Version | Purpose | Install Command |
|---------|---------|---------|----------------|
| `drizzle-orm` | `0.45.2` | ORM + schema + RLS helpers | `pnpm add drizzle-orm@0.45.2` |
| `drizzle-kit` | `0.31.10` | Migration generation CLI | `pnpm add -D drizzle-kit@0.31.10` |
| `drizzle-seed` | `0.3.1` | Seed data generation | `pnpm add -D drizzle-seed@0.3.1` |
| `postgres` | `3.4.9` | postgres-js Postgres driver | `pnpm add postgres@3.4.9` |
| `bullmq` | `5.76.2` | Job queues (BullMQ 5.x) | Already in project |
| `ioredis` | `5.10.1` | Redis client for BullMQ | Already in project |
| `@aws-sdk/client-s3` | `3.1037.0` | R2/S3 upload SDK | `pnpm add @aws-sdk/client-s3@3.1037.0` |
| `vitest` | `4.1.5` | Unit + integration test runner | Already in project |
| `postgres:17.2-alpine` | `17.2-alpine` | Postgres Docker image (Phase 1) | Already in docker-compose.yml |
| pgBackRest | `2.5x` | Backup automation (system package) | `apt install pgbackrest` [ASSUMED: latest 2.5x] |

**Node.js built-ins used (no install):**
- `node:crypto` — AES-GCM-256 encrypt/decrypt, scrypt KDF, SHA-256
- All Node 22 LTS (already pinned in engines.node)

---

## §A1 Open Questions

1. **Direct Postgres migration URL pattern**
   - What we know: Migrations must bypass PgBouncer; Phase 1 init scripts use port 5432 directly; `buildDatabaseUrl()` builds PgBouncer URLs.
   - What's unclear: Should `packages/db` export a `buildDirectUrl()` helper (port 5432) for exclusive use by migration runner? Or should the runner construct the URL independently?
   - Recommendation: Export `buildDirectUrl()` from packages/db with clear JSDoc warning that it bypasses PgBouncer. Prevents accidental direct URL construction elsewhere.

2. **MIGRATIONS_DB_PASSWORD Doppler secret naming**
   - What we know: Migrations need a `migrations_runner` role with BYPASSRLS; password from Doppler.
   - What's unclear: Is the Doppler secret named `MIGRATIONS_DB_PASSWORD` (single shared) or `<SLUG>_MIGRATIONS_PASSWORD` (per-agency)?
   - Recommendation: Single `MIGRATIONS_DB_PASSWORD` — migrations_runner is not a per-agency role, it has DDL access across all DBs. Document in Doppler runbook.

3. **R2 bucket: single bucket vs 13 per-agency buckets**
   - What we know: CONTEXT.md says backup target is R2 via `@mjagency/media`'s R2 client; PROJECT.md says one R2 account for all media.
   - What's unclear: Should backups go to `mjagency-db-backups` (single bucket, path-scoped per agency) or 13 separate buckets?
   - Recommendation: Single bucket with path prefix `/agency-{slug}/` — simplifies pgBackRest config; R2 access controls at bucket level are sufficient for single-VPS setup.

4. **Audit log actor_id type during non-user operations (cron jobs, seed scripts)**
   - What we know: `actor_id` is UUID type referencing users.
   - What's unclear: What actor_id value to use for system operations (migrations, background jobs, scheduled tasks)?
   - Recommendation: Reserve a well-known UUID `00000000-0000-0000-0000-000000000001` as `SYSTEM_ACTOR_ID`. Document in constants.

5. **`FORCE ROW LEVEL SECURITY` on Payload CMS collections**
   - What we know: Payload manages its own table creates via `withPayload()`; Payload tables are in the same Postgres DB.
   - What's unclear: Can Drizzle RLS policies co-exist with Payload's table management without breaking Payload's admin queries?
   - Recommendation: Research this in Phase 5. Phase 2 applies RLS only to `packages/db` schema tables. Payload tables are managed by Payload and not touched by Phase 2 RLS policies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `packages/testing/vitest.config.ts` (shared base) + per-package `vitest.config.ts` |
| Quick run command | `pnpm --filter=@mjagency/db vitest run --reporter=verbose` |
| Full suite command | `pnpm turbo run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-010 | 13 agency DBs accessible after migration | integration (smoke) | `pnpm tsx scripts/migrate-runner.ts --dry-run --all` | Wave 0 |
| REQ-012 | Drizzle query returns typed rows | unit | `pnpm --filter=@mjagency/db vitest run src/schema.test.ts` | Wave 0 |
| REQ-013 | Cross-agency query returns 0 rows (RLS blocks) | integration | `pnpm --filter=@mjagency/db vitest run src/rls.test.ts` | Wave 0 |
| REQ-014 | `agency_id` UPDATE raises exception | integration | `pnpm --filter=@mjagency/db vitest run src/immutable.test.ts` | Wave 0 |
| REQ-015 | Dry-run prints pending migrations, exits 0 | integration | `pnpm tsx scripts/migrate-runner.ts --dry-run --all` | Wave 0 |
| REQ-016 | `seed --agency=ecommerce` completes and is resumable | integration | `pnpm tsx scripts/seed-runner.ts --agency=ecommerce` | Wave 0 |
| REQ-019 | Audit log hash chain verifies | integration | `pnpm tsx scripts/verify-audit-chain.ts --agency=ecommerce` | Wave 0 |
| REQ-306 | BullMQ job.data is encrypted ciphertext in Redis | unit | `pnpm --filter=@mjagency/queue vitest run src/encrypted-queue.test.ts` | Wave 0 |
| REQ-425 | AES-GCM-256 encrypt/decrypt roundtrip | unit | `pnpm --filter=@mjagency/db vitest run src/vault/crypto.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter=@mjagency/db vitest run`
- **Per wave merge:** `pnpm turbo run test --filter=@mjagency/db --filter=@mjagency/queue`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/db/src/schema.test.ts` — covers REQ-012 (Drizzle schema types)
- [ ] `packages/db/src/rls.test.ts` — covers REQ-013 (RLS cross-agency isolation)
- [ ] `packages/db/src/immutable.test.ts` — covers REQ-014 (agency_id immutable trigger)
- [ ] `packages/db/src/vault/crypto.test.ts` — covers REQ-425 (AES-GCM encrypt/decrypt roundtrip)
- [ ] `packages/queue/src/encrypted-queue.test.ts` — covers REQ-306 (BullMQ payload encryption)
- [ ] `scripts/migrate-runner.ts` — covers REQ-015 (migration CLI)
- [ ] `scripts/seed-runner.ts` — covers REQ-016 (seed CLI)
- [ ] `scripts/verify-audit-chain.ts` — covers REQ-019 (audit chain verification)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no — Phase 3 | — |
| V3 Session Management | no — Phase 3 | — |
| V4 Access Control | YES — RLS isolation | pgPolicy + `set_config('app.agency_id', id, true)` |
| V5 Input Validation | YES — agency_id immutability | PostgreSQL trigger + Drizzle schema types |
| V6 Cryptography | YES — AES-GCM-256 vault + queue | `node:crypto` `aes-256-gcm` (never pgcrypto for GCM) |
| V9 Communications | Partial — DB connections | TLS on Redis (requirepass); Postgres uses SCRAM-SHA-256 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data access via stale RLS context | Spoofing / Information Disclosure | `set_config(..., true)` (SET LOCAL) in every DB transaction |
| Bypass RLS by modifying `agency_id` after insert | Tampering | `prevent_agency_id_change()` trigger on all tables |
| Plaintext PII in Redis job queue | Information Disclosure | `createEncryptedQueue` wrapper (§7.2) with AES-GCM-256 |
| Audit log modification after the fact | Repudiation | REVOKE UPDATE/DELETE + hash chain integrity check |
| Migration role overprivileged in production | Elevation of Privilege | `BYPASSRLS` only on `migrations_runner`; app roles have DML only |
| Vault key hardcoded or logged | Information Disclosure | Key from Doppler only; Pino redact paths cover `*.key`, `*.secret` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Migrations must bypass PgBouncer and connect directly on port 5432 | §2.1, §8.2 | Migration DDL fails if PgBouncer is in the path for multi-statement transactions |
| A2 | pgBackRest v2.5x is available via apt on target VPS OS | §4.1 | Need to build from source or use alternative (WAL-G) |
| A3 | AES-256-GCM encrypts in < 0.1ms per job payload | §7.3 | Negligible; no functional risk, only performance notes |
| A4 | Single R2 bucket with path-scoped backups is correct architecture | §A1 Q3 | Requires user confirmation before backup automation is built |
| A5 | `audit_log` monthly range partitioning DDL is standard Postgres pattern | §5.5 | Works in Postgres 17; no compatibility risk |
| A6 | `SYSTEM_ACTOR_ID` reserved UUID for non-user operations | §A1 Q4 | Cosmetic only; no functional risk |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Postgres 17 | Schema + RLS + migrations | Phase 1 Docker Compose | 17.2-alpine | — |
| PgBouncer 1.21+ | Transaction-mode + prepared stmts | Phase 1 ecosystem.config | 1.21+ (from PM2) | — |
| Redis 7.4 | BullMQ queue + cache | Phase 1 Docker Compose | 7.4-alpine | — |
| drizzle-orm | Schema + queries | To be installed Phase 2 | 0.45.2 (verified) | — |
| drizzle-kit | Migration generation | To be installed Phase 2 | 0.31.10 (verified) | — |
| postgres npm | Driver | To be installed Phase 2 | 3.4.9 (verified) | node-postgres (fallback) |
| pgBackRest | Backup automation | System package (VPS Phase 12) | ~2.5x (ASSUMED) | WAL-G (alternative) |
| node:crypto | AES-GCM vault + queue encryption | Node 22 LTS built-in | Built-in | — |

**Missing dependencies with no fallback:**
- pgBackRest — not installed on dev machine (Docker). Backup scripts must be designed to be dev-skippable (check `NODE_ENV !== 'production'`). Full backup validation only in Phase 12 VPS.

**Missing dependencies with fallback:**
- `postgres` driver — can fall back to `node-postgres` (`pg` package) if postgres-js has issues; both supported by Drizzle. The `prepare: false` option exists in both drivers.

---

## Sources

### Primary (HIGH confidence)
- Drizzle ORM docs — `/drizzle-team/drizzle-orm-docs` via Context7; [orm.drizzle.team/docs/rls](https://orm.drizzle.team/docs/rls), [orm.drizzle.team/docs/migrations](https://orm.drizzle.team/docs/migrations), [orm.drizzle.team/docs/seed-overview](https://orm.drizzle.team/docs/seed-overview)
- PostgreSQL 17 docs — [postgresql.org/docs/17/ddl-rowsecurity.html](https://www.postgresql.org/docs/17/ddl-rowsecurity.html) — CREATE POLICY DDL, RLS bypass, FORCE ROW LEVEL SECURITY
- npm registry (2026-04-26) — drizzle-orm@0.45.2, drizzle-kit@0.31.10, drizzle-seed@0.3.1, postgres@3.4.9, bullmq@5.76.2, @aws-sdk/client-s3@3.1037.0
- packages/db/README.md — pitfall 3.3 (PgBouncer prepared statements) [VERIFIED: project file]
- mjagency/specs/security.md — SEC-09, SEC-10, SEC-N10 [VERIFIED: project file]
- mjagency/CLAUDE.md — Drizzle ORM rule, AES-GCM-256 requirement [VERIFIED: project file]

### Secondary (MEDIUM confidence)
- Bytebase RLS footguns — [bytebase.com/blog/postgres-row-level-security-footguns](https://www.bytebase.com/blog/postgres-row-level-security-footguns/) — SET vs SET LOCAL PgBouncer interaction
- appmaster.io audit trail — [appmaster.io/blog/tamper-evident-audit-trails-postgresql](https://appmaster.io/blog/tamper-evident-audit-trails-postgresql) — hash chain DDL + verification query
- pgBackRest S3 guide — [bun.uptrace.dev/postgres/pgbackrest-s3-backups.html](https://bun.uptrace.dev/postgres/pgbackrest-s3-backups.html) — S3 configuration pattern
- pgBackRest vs barman — [severalnines.com](https://severalnines.com/blog/automating-backups-and-disaster-recovery-in-postgresql-at-scale-pgbackrest-vs-barman/) — tool selection rationale
- drizzle-orm community discussion #1901 — [github.com/drizzle-team/drizzle-orm/discussions/1901](https://github.com/drizzle-team/drizzle-orm/discussions/1901) — programmatic migration API

### Tertiary (LOW confidence / training knowledge cross-verified)
- BullMQ encryption approach — [docs.bullmq.io/guide/jobs/job-data](https://docs.bullmq.io/guide/jobs/job-data) confirmed no built-in encryption; application-layer pattern is standard practice
- pgcrypsi AES-GCM gap — [github.com/telkomdev/pgcrypsi](https://github.com/telkomdev/pgcrypsi) — confirmed pgcrypto lacks AES-GCM native support

---

## Metadata

**Confidence breakdown:**
- Standard stack (Drizzle 0.45.2, postgres 3.4.9, drizzle-kit 0.31.10): HIGH — verified via npm registry
- Drizzle RLS patterns: HIGH — verified via official docs
- RLS + PgBouncer SET LOCAL: HIGH — verified via Bytebase footguns + pganalyze blog + PostgreSQL docs
- Migration programmatic API: HIGH — verified via drizzle-orm docs + community discussion
- pgBackRest R2 config: MEDIUM — R2 is S3-compatible; general S3 config verified; R2-specific endpoint is ASSUMED correct format
- AES-GCM Node.js patterns: HIGH — Node.js crypto module is built-in; pattern is well-documented
- BullMQ encryption: HIGH — docs confirm no built-in; application-layer pattern is correct
- Audit log hash chain: HIGH — PostgreSQL pgcrypto `digest()` verified; pattern from authoritative source

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days — Drizzle releases frequently; verify drizzle-orm version before implementation)
