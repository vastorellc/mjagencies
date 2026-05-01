---
phase: 01-backend-auth-foundation
plan: 02
subsystem: database
tags: [drizzle, schema, rls, supabase, migration]
dependency_graph:
  requires:
    - backend/package.json — drizzle-orm 0.45.2, pg 8.20.0, drizzle-kit 0.31.10 (from Plan 01)
  provides:
    - backend/src/db/schema.ts — complete Drizzle schema with UUID PKs, authUsers FK, pgPolicy RLS
    - backend/src/db/index.ts — Pool + drizzle singleton (session pooler compatible)
    - backend/src/db/migrate.ts — runMigrations() for startup sequence
    - backend/drizzle.config.ts — entities.roles.provider='supabase' for RLS migration generation
    - backend/drizzle/0000_shocking_hercules.sql — SQL migration with CREATE TABLE + CREATE POLICY
  affects:
    - backend/src/index.ts — will import runMigrations() from db/migrate.ts (Plan 03+)
    - All backend routes — will import db from db/index.ts for query execution
tech_stack:
  added:
    - dotenv (required by drizzle.config.ts to load .env for DATABASE_URL)
  patterns:
    - drizzle-orm/supabase authUsers + authenticatedRole for cross-schema FK to auth.users
    - pgPolicy per table with USING + WITH CHECK (both clauses required for INSERT safety)
    - uuid().primaryKey().defaultRandom() — UUID PKs compatible with auth.users.id
    - entities.roles.provider='supabase' in drizzle.config.ts — unlocks CREATE POLICY generation
    - Pool + drizzle(pool, schema) singleton pattern for persistent VPS backend
    - drizzle-kit generate + migrate workflow (never push — Pitfall 4)
key_files:
  created:
    - backend/src/db/schema.ts
    - backend/src/db/index.ts
    - backend/src/db/migrate.ts
    - backend/drizzle.config.ts
    - backend/drizzle/0000_shocking_hercules.sql
    - backend/drizzle/meta/_journal.json
    - backend/drizzle/meta/0000_snapshot.json
  modified:
    - backend/package.json (added dotenv dependency)
    - backend/package-lock.json
decisions:
  - "entities.roles.provider='supabase' is mandatory in drizzle.config.ts — without it drizzle-kit generate produces no CREATE POLICY statements (Pitfall 6)"
  - "session pooler (port 5432) used for DATABASE_URL — direct connection (db.xxx.supabase.co) is IPv6-only and unreachable from this machine; session pooler supports prepared statements"
  - "dotenv added as runtime dependency (not devDependency) — drizzle.config.ts is loaded by drizzle-kit at runtime, not in a compiled build context"
  - "RLS withCheck clause included on all policies — prevents users from inserting rows with other users' user_ids (T-01-04)"
metrics:
  duration: 2 minutes
  completed: "2026-05-01T05:00:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 2
---

# Phase 1 Plan 02: Drizzle Schema + DB Foundation Summary

**One-liner:** Complete Drizzle ORM schema with four UUID-keyed tables, Supabase authUsers FK via drizzle-orm/supabase, per-table RLS policies using pgPolicy + authenticatedRole, and drizzle-kit generated SQL migration containing 4 CREATE TABLE + 4 CREATE POLICY statements.

## What Was Built

### Task 1 — Drizzle schema — all four tables with UUID PKs, authUsers FK, and RLS policies

`backend/src/db/schema.ts` created with the complete production schema:

| Table | Columns | Indexes | FKs | Policy |
|-------|---------|---------|-----|--------|
| posts | 10 (UUID PK, user_id, title, niche, virality_score, engine_signals, ai_output, description, created_at, updated_at) | posts_niche_created_idx | auth.users(id) CASCADE | posts_user_own |
| platform_posts | 12 (UUID PK, user_id, post_id, platform, upload_status, platform_post_id, actual_views, predicted_low, predicted_high, error_message, posted_at, created_at) | platform_posts_post_id_idx | auth.users(id) + posts(id) CASCADE | platform_posts_user_own |
| learning_signals | 11 (UUID PK, user_id, post_id, platform, niche, hook_text, hashtags TEXT[], actual_views, overperformed, signal_weights, created_at) | — | auth.users(id) + posts(id) CASCADE | learning_signals_user_own |
| settings | 10 (UUID PK, user_id UNIQUE, ai_provider, api_key_encrypted, default_niche, enabled_platforms TEXT[], platform_config, learned_weights, created_at, updated_at) | — | auth.users(id) CASCADE | settings_user_own |

Key schema properties:
- All tables use `uuid().primaryKey().defaultRandom()` — UUID v4 generation at DB layer
- All `user_id` columns reference `auth.users(id)` via `foreignKey({ foreignColumns: [authUsers.id] })`
- All FK constraints use `ON DELETE CASCADE` — orphan row cleanup on user deletion
- All pgPolicy declarations include both `using` AND `withCheck` — prevents cross-user INSERT (T-01-04)
- `settings.learned_weights` JSONB for EMA calibration weights (null until 10+ data points)
- `learning_signals.hashtags` TEXT[] array column with `default([])`
- `learning_signals.post_id` FK to posts(id) ON DELETE CASCADE

### Task 2 — Drizzle config + DB connection + migrate runner + drizzle-kit generate

**drizzle.config.ts** — The critical `entities.roles.provider = 'supabase'` field is present. Loads `.env` via dotenv from the parent directory. Schema path: `./src/db/schema.ts`. Output dir: `./drizzle`.

**backend/src/db/index.ts** — Pool-based singleton using `node-postgres`. Comment corrected per plan notes: "NOT the transaction pooler (port 6543)" — session pooler at port 5432 is acceptable for prepared statements. Exports both `db` (Drizzle instance) and `pool` (raw pg.Pool for migrate.ts and pg-boss).

**backend/src/db/migrate.ts** — `runMigrations()` function using `drizzle-orm/node-postgres/migrator`. Resolves migrations folder relative to `__dirname` (`../../drizzle` from `dist/db/`). Called at startup before pg-boss and Express listen.

**drizzle-kit generate output** — `backend/drizzle/0000_shocking_hercules.sql` contains:
- 4 `CREATE TABLE` statements with UUID PKs (`gen_random_uuid()`)
- 4 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- 6 `ALTER TABLE ... ADD CONSTRAINT` (FK constraints including auth.users cross-schema references)
- 2 `CREATE INDEX` statements
- 4 `CREATE POLICY` statements with `USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] dotenv package missing — drizzle-kit generate failed**
- **Found during:** Task 2 drizzle-kit generate run
- **Issue:** `drizzle.config.ts` imports `dotenv` (`import { config } from 'dotenv'`), but `dotenv` was not installed in `backend/package.json`. `drizzle-kit generate` exited with `Cannot find module 'dotenv'`.
- **Fix:** `npm install dotenv` in backend directory. Added to `dependencies` (not devDependencies) since drizzle.config.ts is loaded at runtime by the drizzle-kit CLI.
- **Files modified:** `backend/package.json`, `backend/package-lock.json`
- **Commit:** c50d4d1

## Security Notes (Threat Register Coverage)

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-01-03 | Mitigated | pgPolicy on all 4 tables: `USING ((select auth.uid()) = user_id)` — enforced at PostgreSQL layer regardless of app code |
| T-01-04 | Mitigated | pgPolicy `withCheck` on all 4 tables: prevents INSERT with foreign user_id; FK CASCADE ensures orphan rows cannot exist |
| T-01-05 | Mitigated | drizzle-kit generate + migrate used exclusively — never push (Pitfall 4 confirmed: push silently drops RLS) |

## Threat Flags

No new security-relevant surface introduced. Schema changes are internal to the DB layer — no new network endpoints, auth paths, or file access patterns added.

## Known Stubs

None. All schema columns, constraints, and policies are complete and production-ready.

## Self-Check: PASSED

Files confirmed present:

- backend/src/db/schema.ts — confirmed, contains `authenticatedRole, authUsers` import
- backend/src/db/index.ts — confirmed, contains `drizzle(pool, { schema })`
- backend/src/db/migrate.ts — confirmed, contains `runMigrations`
- backend/drizzle.config.ts — confirmed, contains `provider: 'supabase'`
- backend/drizzle/0000_shocking_hercules.sql — confirmed, 4 CREATE POLICY statements

Commits confirmed:
- 147b76c: feat(01-02): Drizzle schema — four tables with UUID PKs, authUsers FK, and RLS policies
- c50d4d1: feat(01-02): drizzle config, DB connection, migrate runner, and generated SQL migration
