# Phase 1: Backend + Auth Foundation — Research

**Researched:** 2026-05-01
**Domain:** Express 5 + TypeScript + Drizzle ORM + Supabase (Auth + PostgreSQL + Realtime) + pg-boss v12 + React 19 + Vite 6 + Tailwind CSS 4
**Confidence:** HIGH — all critical stack choices verified against npm registry and official docs

---

## RESEARCH COMPLETE

---

## Summary

Phase 1 builds the auth-gated scaffold the entire platform runs on. The stack is
Supabase (Auth + PostgreSQL), Drizzle ORM for schema and migrations, pg-boss v12 for
the job queue, Express 5 + TypeScript for the backend API, and React 19 + Vite 6 +
Tailwind CSS 4 for the login screen frontend. No Redis, no BullMQ — the stale
phase1-research.md covers a superseded architecture.

The three highest-risk items for Phase 1 are: (1) **Supabase new API key format** —
projects created after May 2025 use `sb_publishable_xxx` and `sb_secret_xxx` instead of
`anon` and `service_role` JWT strings, requiring a different `createClient` call and a
different backend auth approach; (2) **pg-boss v12 ESM import syntax change** — the
named export `{ PgBoss }` is required instead of the default export used in all v10/v11
examples; and (3) **Drizzle with Supabase transaction pooler** — the `postgres.js` driver
must have `{ prepare: false }` if the transaction pooler (port 6543) is used; for a
persistent VPS backend server use the direct or session-mode connection (port 5432) to
avoid this constraint entirely.

The stale research file is useful for: Express 5 breaking changes, COOP/COEP Vite plugin
pattern, Drizzle `generate + migrate` workflow, AES-256-GCM encryption pattern, and the
Nginx COOP/COEP config. All of those patterns are still correct. What changed is
**everything Supabase and pg-boss related**.

**Primary recommendation:** Use the Supabase direct connection (non-pooled, port 5432) for
the VPS backend. This avoids the prepared-statements constraint and works correctly with
both Drizzle and pg-boss. If the Supabase dashboard only shows pooler URLs, switch to the
"Direct" tab in the Connect panel.

---

## Project Constraints (from CLAUDE.md)

### Auth (ENFORCE ON EVERY ROUTE)
- No public signup. Accounts created by admin only in Supabase dashboard.
- Every route is auth-gated. `supabase.auth.getUser(token)` on every Express route except `/health`.
- Admin routes require `app_metadata.role === 'admin'` — enforce in middleware AND frontend guard.
- Never store tokens in localStorage. OAuth tokens go to DB (encrypted). Supabase session handled by SDK.

### Per-User Data Isolation
- All DB tables have `user_id UUID REFERENCES auth.users(id)`.
- RLS is enabled on all tables — `USING (user_id = auth.uid())`.
- Never add manual `WHERE user_id =` as the only protection — RLS is the enforcement layer.
- Admin can see system-level data only — never individual users' API keys, tokens, or content.

### Stack (LOCKED)
- Frontend: React 19 + Vite 6 + TypeScript + Tailwind CSS 4
- Backend: Node.js 22 + Express 5.2.1 + TypeScript
- Database: Supabase PostgreSQL + Drizzle ORM
- Auth: Supabase Auth (anon/publishable key on frontend, service role/secret key on backend only)
- Queue: pg-boss (PostgreSQL-backed — NO Redis, NO BullMQ)
- File storage: VPS local disk `/var/uploads/{user_id}/{uuid}.ext` (NOT Supabase Storage)
- Realtime: Supabase Realtime (no polling)

### Database Rules
- Use `drizzle-kit generate + migrate` — NEVER `drizzle-kit push`.
- JSONB partial update: `sql\`${col} || ${JSON.stringify(patch)}::jsonb\`` — never replace whole column.
- View logging and learning signal writes: always in a single `db.transaction()`.

### Security Rules
- API keys: AES-256-GCM, `randomBytes(12)` IV (12 bytes), `scryptSync` key derivation.
- Never expose decrypted API keys in API responses — return `{ masked: '****last4' }` only.
- COOP/COEP: `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` on every response.
- Vite COOP/COEP: use `configureServer` plugin (NOT `server.headers`).
- OAuth: server-side redirect flow only — no popups.

### Frontend Rules
- No routing library — `useState` screen switching.
- No UI component library — Tailwind CSS only.
- `h-[100dvh]` not `h-screen` (iOS Safari viewport bug).
- `viewport-fit=cover` in meta viewport tag.

### Content Rules
- NEVER generate placeholder text, "TODO", "Coming soon", or "Lorem ipsum".
- All copy must be real and complete.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Admin-only account creation — no public signup | Supabase dashboard disable signup toggle |
| AUTH-02 | Every screen/route auth-gated | Express middleware + frontend onAuthStateChange |
| AUTH-03 | Email/password login, persistent session, logout | Supabase Auth signInWithPassword + onAuthStateChange |
| AUTH-04 | All DB tables have user_id UUID FK + RLS | Drizzle authUsers import + pgPolicy + migration entities.roles |
| AUTH-05 | Admin role as JWT claim `role: 'admin'` via service role key | supabase.auth.admin.updateUserById + app_metadata |
| AUTH-06 | Admin panel routes inaccessible to non-admin | Express adminMiddleware + frontend guard |
| AUTH-07 | Password reset via Supabase email link | Supabase dashboard + resetPasswordForEmail |
| STORE-01 | VPS file storage `/var/uploads/{user_id}/{uuid}.ext` | mkdir -p + chown + multer destination function |
| STORE-02 | Nginx serves /uploads/ at VPS_PUBLIC_URL | Nginx location block config |
| STORE-03 | Files deleted after successful upload | fs.unlink (Phase 6 implementation) |
| STORE-04 | pg-boss cleanup job deletes files older than 1 hour | pg-boss schedule() + fs.readdir + stat |
| UI-06 | Auth screen is entry point for unauthenticated users | React onAuthStateChange screen switcher |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User login / session | Frontend (Supabase SDK) | Backend (JWT verify) | Supabase Auth handles session; backend verifies on each request |
| Route auth enforcement | API / Backend | Frontend guard | Backend is the enforcement layer; frontend guard is UX only |
| Admin role check | API / Backend | Frontend guard | JWT app_metadata read at both tiers; backend is authoritative |
| DB schema + RLS | Database / Storage | — | RLS enforced at PostgreSQL layer; always on regardless of app code |
| Job queue bootstrap | API / Backend | — | pg-boss runs in same Node process, schema in Supabase DB |
| File storage directory | VPS OS | — | mkdir -p /var/uploads; Nginx serves static path |
| COOP/COEP headers | Frontend Server (Vite dev) | CDN/Nginx (prod) | Must be set at HTTP layer before browser parses page |
| Supabase client | Frontend (anon/publishable) | Backend (secret/service role) | Anon key safe in browser; secret key never in browser |

---

## Issues Found (must fix in plan)

### ISSUE 1 [HIGH RISK]: Supabase new API key format for projects created May 2025+

**What changed:** Projects created after May 2025 use `sb_publishable_xxx` (replaces `anon` key)
and `sb_secret_xxx` (replaces `service_role` JWT string). These are NOT JWTs — they are
opaque API key strings.

**Impact on frontend `createClient`:** The call signature is unchanged:
```typescript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
```
`sb_publishable_xxx` works wherever `anon` key worked. [CITED: supabase.com/docs/guides/api/api-keys]

**Impact on backend Express middleware:** `supabase.auth.getUser(token)` still works
correctly — it validates the user's access JWT against the Supabase Auth server.
The key used to initialize the backend Supabase client should be `sb_secret_xxx`
(service role equivalent) for admin operations. [CITED: supabase.com/docs/reference/javascript/auth-getuser]

**What to put in `.env`:**
```bash
# Old projects (created before May 2025)
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# New projects (May 2025+) — use these names in code
SUPABASE_ANON_KEY=sb_publishable_xxx   # same env var name, different value format
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
```

The code pattern is identical either way — `createClient(url, key)` and
`supabase.auth.getUser(token)` work with both key formats. No code change needed,
only awareness that the value is no longer a JWT string.

**Action for planner:** Note in Wave 0 setup task that the new key format is expected.
Env var names remain the same; values look different from older docs.

---

### ISSUE 2 [HIGH RISK]: pg-boss v12 requires named ESM import

**What changed in v12.0.0:** The package was rewritten in ESM with TypeScript.
Import syntax changed completely.

```typescript
// WRONG (v9/v10/v11 pattern — found in all older docs/blog posts)
import PgBoss from 'pg-boss'
const boss = new PgBoss(connectionString)

// CORRECT for v12.18.1 [VERIFIED: npm view pg-boss version = 12.18.1]
import { PgBoss } from 'pg-boss'
const boss = new PgBoss({ connectionString: process.env.DATABASE_URL })
```

**Node version requirement:** pg-boss v12 requires Node 22.12+ to support `require(esm)`.
This machine runs Node 24.15.0. [VERIFIED: node --version]

**Queue names must now be validated:** Only letters, numbers, hyphens, underscores,
and periods are allowed. Queue name `cleanup-stale-files` is valid.

**Schema auto-created on `boss.start()`:** Calling `await boss.start()` creates the
`pgboss` schema and all required tables in the connected database automatically.
No manual migration needed. [CITED: logsnag.com/blog/deep-dive-into-background-jobs-with-pg-boss-and-typescript]

**Action for planner:** Use named import `{ PgBoss }`. Use `{ connectionString }` object
form, not bare string constructor.

---

### ISSUE 3 [HIGH RISK]: Supabase connection string — direct vs pooler for VPS backend

**The choice:** Supabase provides three connection strings in the Connect panel:
1. **Direct** (non-pooled): `postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres`
2. **Session pooler** (port 5432): Routes through Supavisor, supports prepared statements
3. **Transaction pooler** (port 6543): Does NOT support prepared statements

**For a persistent VPS Node.js backend:** Use the **direct connection**.
[CITED: supabase.com/docs/guides/database/connecting-to-postgres]

**Why the transaction pooler breaks things:** Drizzle ORM's `node-postgres` driver uses
prepared statements by default. pg-boss also uses prepared statements. Transaction pooler
(port 6543) will throw errors for both. [CITED: supabase.com/docs/guides/database/connecting-to-postgres]

**Workaround if direct not available:** Use `postgres.js` driver with `{ prepare: false }`:
```typescript
import postgres from 'postgres'
const client = postgres(process.env.DATABASE_URL, { prepare: false })
const db = drizzle({ client })
```
But for pg-boss, there is no such flag — pg-boss uses its own internal pg client. So
pg-boss MUST use a direct or session-mode connection.

**Action for planner:** DATABASE_URL must point to the direct connection string from
Supabase dashboard (non-pooled). Document this explicitly in the setup task.

---

### ISSUE 4 [HIGH RISK]: Vite COOP/COEP configureServer plugin (confirmed for Vite 6)

**Status:** The stale research file is correct. Use `configureServer` middleware plugin,
not `server.headers`. The GitHub issue vitejs/vite#16536 confirms the HMR WebSocket
problem with `server.headers` COEP. The Vite docs say `server.headers` is supported,
but do not address the HMR WebSocket race condition.

**Confirmed safe pattern for Vite 6:** [VERIFIED: github.com/vitejs/vite/issues/16536]

```typescript
// vite.config.ts
{
  name: 'cross-origin-isolation',
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      next()
    })
  },
  configurePreviewServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      next()
    })
  },
}
```

**Verify:** `self.crossOriginIsolated === true` in browser DevTools console.

---

### ISSUE 5 [MEDIUM RISK]: Drizzle with Supabase — `auth.users` FK and RLS generation

**The challenge:** Supabase's `auth.users` table is in the `auth` schema, not `public`.
Drizzle cannot cross-schema-reference this table with a regular import. It provides a
special import for this case.

**Correct pattern:** [CITED: orm.drizzle.team/docs/rls]

```typescript
import { uuid, text, boolean, timestamp, jsonb, pgTable, index, foreignKey } from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'
import { pgPolicy } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  // ... other columns
}, (table) => [
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [authUsers.id],
    name: 'posts_user_id_fk',
  }).onDelete('cascade'),
  pgPolicy('posts_user_own', {
    for: 'all',
    to: authenticatedRole,
    using: sql`(select auth.uid()) = user_id`,
    withCheck: sql`(select auth.uid()) = user_id`,
  }),
])
```

**drizzle.config.ts must have `entities.roles`** to generate RLS SQL in migrations:
```typescript
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  entities: {
    roles: {
      provider: 'supabase',
    },
  },
})
```

**drizzle-kit push does NOT apply RLS policies correctly** (bug confirmed Nov 2024,
GitHub issue drizzle-team/drizzle-orm#3504). Must use `generate + migrate`.
[CITED: github.com/drizzle-team/drizzle-orm/issues/3504]

---

### ISSUE 6 [MEDIUM RISK]: Schema design — UUID PKs vs serial for Supabase

**The stale schema uses `serial` primary keys.** Supabase Auth produces UUIDs for `auth.users.id`.
The FK `user_id` must be `uuid`. For consistency and join simplicity, all tables should
use UUID PKs (not serial integers). Drizzle provides `.defaultRandom()` for UUID generation.

```typescript
// CORRECT for Supabase
id: uuid('id').primaryKey().defaultRandom(),
user_id: uuid('user_id').notNull(),

// WRONG for Supabase (breaks FK to auth.users)
id: serial('id').primaryKey(),
user_id: integer('user_id').notNull(),
```

**Impact:** Every table in the schema (posts, platform_posts, learning_signals, settings)
must use UUID PKs. The stale research schema has all `serial` IDs — do not copy that schema.

---

### ISSUE 7 [MEDIUM RISK]: Express 5 TypeScript type pinning

**From stale research (still correct):**
- Pin `@types/express` to exactly `5.0.6`. [VERIFIED: npm view @types/express version = 5.0.6]
- Wildcards must be named: `/*splat` not `/*`
- `res.redirect(301, '/url')` not `res.redirect('/url', 301)`
- Async route handlers forward errors natively — no `express-async-errors` wrapper needed

---

### ISSUE 8 [LOW RISK]: Tailwind CSS v4 + Vite 6 — confirmed working pattern

**Verified current approach:** [VERIFIED: tailwindcss.com + npm registry]

```bash
npm install tailwindcss @tailwindcss/vite
# Do NOT install postcss or autoprefixer
```

`@tailwindcss/vite` version 4.2.4 is the latest. [VERIFIED: npm view @tailwindcss/vite version]

No `tailwind.config.js`. All config in CSS:
```css
@import "tailwindcss";
@theme {
  /* custom tokens here */
}
```

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 5.2.1 | HTTP server | LOCKED in CLAUDE.md |
| @types/express | 5.0.6 | Express TypeScript types | Must pin exactly — 4.x breaks with 5.x |
| @supabase/supabase-js | 2.105.1 | Auth + DB client | LOCKED — Supabase official SDK |
| drizzle-orm | 0.45.2 | ORM for PostgreSQL | LOCKED in CLAUDE.md |
| drizzle-kit | 0.31.10 | Schema generation + migration | LOCKED |
| pg-boss | 12.18.1 | PostgreSQL job queue | LOCKED — replaces BullMQ |
| pg | 8.20.0 | node-postgres driver | Drizzle peer dependency |
| @types/pg | 8.20.0 | pg TypeScript types | Dev dependency |
| react | 19.2.5 | Frontend framework | LOCKED |
| react-dom | 19.2.5 | React DOM renderer | LOCKED |
| vite | ^6.4.2 | Frontend build tool (latest 6.x) | LOCKED at v6 |
| @vitejs/plugin-react | 6.0.1 | React fast refresh plugin | Official Vite plugin |
| tailwindcss | 4.2.4 | CSS framework | LOCKED in CLAUDE.md |
| @tailwindcss/vite | 4.2.4 | Tailwind Vite integration | Required for v4 |
| typescript | 6.0.3 | Type system | Strict mode required |

> Vite 6 latest at research time is 6.4.2 (not 6.0.10 as listed in stale research — npm view vite@6 confirms). [VERIFIED: npm registry 2026-05-01]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cors | 2.8.6 | CORS middleware | Every Express app |
| @types/cors | 2.8.19 | CORS TypeScript types | Dev |
| tsx | 4.21.0 | TypeScript execution (dev) | Dev server and scripts |
| pino | 10.3.1 | Structured JSON logging | All log output |
| multer | 1.x | Multipart file upload parsing | Phase 1 scaffold only |

### Installation

**Backend:**
```bash
npm install express @supabase/supabase-js drizzle-orm pg pg-boss cors pino
npm install -D @types/express @types/pg @types/cors typescript tsx drizzle-kit
```

**Frontend:**
```bash
npm install react react-dom @supabase/supabase-js tailwindcss @tailwindcss/vite
npm install -D vite @vitejs/plugin-react typescript
```

---

## Architecture Patterns

### System Architecture Diagram

```
BROWSER                    VPS (Node.js backend)         SUPABASE (hosted)
   |                              |                              |
   |-- POST /auth/login -->       |                              |
   |                              |-- supabase.auth.getUser() -->|
   |                              |<-- { user, app_metadata } --|
   |<-- Set-Cookie: session  <----|                              |
   |                              |                              |
   |-- GET /api/posts       ----> |                              |
   |                    [authMiddleware]                         |
   |                              |-- supabase.auth.getUser() -->|
   |                       [403 if no session]                   |
   |                              |-- db.select().from(posts) -->|
   |                              |   [RLS: user_id = auth.uid()]|
   |<-- 200 { posts }       <-----|<-- rows (only this user's)  |
   |                              |                              |
   |                              |-- pgboss.start() ---------->|
   |                              |   [creates pgboss.* tables] |
   |                              |                              |

VITE DEV SERVER (frontend)
   |
   [configureServer plugin]
   [COOP: same-origin]
   [COEP: require-corp]
   |
   [onAuthStateChange]
   [SIGNED_IN  -> show app]
   [SIGNED_OUT -> show login]
```

### Recommended Project Structure

```
viral-copy-generator/
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx              # onAuthStateChange screen switcher
│       ├── styles.css           # @import "tailwindcss" + @theme {}
│       ├── pages/
│       │   └── LoginPage.tsx    # email/password form, signInWithPassword
│       └── lib/
│           └── supabase.ts      # createClient(SUPABASE_URL, ANON_KEY)
├── backend/
│   ├── src/
│   │   ├── index.ts             # runMigrations() then boss.start() then app.listen()
│   │   ├── app.ts               # Express app, middleware, routes
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle table definitions (UUID PKs, authUsers FK, pgPolicy)
│   │   │   ├── index.ts         # drizzle(pool) singleton
│   │   │   └── migrate.ts       # runMigrations()
│   │   ├── lib/
│   │   │   ├── boss.ts          # pg-boss instance + job definitions
│   │   │   ├── supabase.ts      # createClient with SERVICE_ROLE key (admin ops)
│   │   │   └── storage.ts       # VPS file dir init + cleanup
│   │   ├── middleware/
│   │   │   ├── auth.ts          # supabase.auth.getUser(token) → 401 if no user
│   │   │   └── admin.ts         # app_metadata.role === 'admin' → 403 if not
│   │   └── routes/
│   │       ├── health.ts        # GET /health — public, no auth
│   │       └── posts.ts         # GET /api/posts — auth required (stub)
│   ├── drizzle/                 # Generated migration SQL files
│   ├── drizzle.config.ts
│   └── package.json
└── .env                         # SUPABASE_URL, SUPABASE_ANON_KEY, etc.
```

---

## Implementation Notes — Critical Code Patterns

### Pattern 1: Backend Supabase Auth Middleware

```typescript
// backend/src/middleware/auth.ts
import { createClient } from '@supabase/supabase-js'
import type { Request, Response, NextFunction } from 'express'

// Backend client uses SERVICE ROLE key (or sb_secret_xxx for new projects)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Attach user to request for downstream handlers
  res.locals.user = user
  res.locals.userId = user.id
  next()
}
// Source: supabase.com/docs/reference/javascript/auth-getuser
```

### Pattern 2: Admin Role Middleware

```typescript
// backend/src/middleware/admin.ts
import type { Request, Response, NextFunction } from 'express'

export function adminMiddleware(_req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user
  if (user?.app_metadata?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  next()
}
// app_metadata.role set via supabaseAdmin.auth.admin.updateUserById(uid, { app_metadata: { role: 'admin' } })
// Source: supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
```

### Pattern 3: Setting Admin JWT Claim (one-time setup script)

```typescript
// scripts/make-admin.ts — run once after creating admin account
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function makeAdmin(userEmail: string) {
  // Step 1: look up the user
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === userEmail)
  if (!user) throw new Error(`User not found: ${userEmail}`)

  // Step 2: set role in app_metadata (immutable by the user, only admin API can change)
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { role: 'admin' },
  })
  if (error) throw error
  console.log(`Admin role set for ${userEmail}`)
}
// Source: supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
```

### Pattern 4: pg-boss v12 Initialization

```typescript
// backend/src/lib/boss.ts
import { PgBoss } from 'pg-boss'  // NAMED import — not default import

let boss: PgBoss | null = null

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss
  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    // pg-boss creates pgboss.* schema automatically on start()
  })

  boss.on('error', (err) => {
    console.error('[pg-boss error]', err)
  })

  await boss.start()
  console.log('[pg-boss] started')
  return boss
}

// Stale files cleanup job — registered once at startup
export async function registerCleanupJob(boss: PgBoss) {
  // Runs every hour
  await boss.schedule('cleanup-stale-files', '0 * * * *', {})

  await boss.work('cleanup-stale-files', async (_job) => {
    const { cleanupStaleFiles } = await import('./storage.js')
    await cleanupStaleFiles()
  })
}
// Source: logsnag.com/blog/deep-dive-into-background-jobs-with-pg-boss-and-typescript
// Source: github.com/timgit/pg-boss/releases/tag/12.0.0
```

### Pattern 5: Drizzle Schema with UUID PKs and Supabase authUsers FK

```typescript
// backend/src/db/schema.ts
import {
  pgTable, uuid, text, integer, boolean, timestamp, jsonb,
  index, foreignKey
} from 'drizzle-orm/pg-core'
import { pgPolicy } from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'
import { sql } from 'drizzle-orm'

// RLS helper — current user's UUID
const authUid = sql`(select auth.uid())`

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  title: text('title').notNull(),
  niche: text('niche').notNull(),
  virality_score: integer('virality_score').notNull().default(0),
  engine_signals: jsonb('engine_signals').$type<Record<string, unknown>>().notNull().default({}),
  ai_output: jsonb('ai_output').$type<Record<string, unknown>>().notNull().default({}),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [authUsers.id],
    name: 'posts_user_id_fk',
  }).onDelete('cascade'),
  pgPolicy('posts_user_own', {
    for: 'all',
    to: authenticatedRole,
    using: sql`${authUid} = user_id`,
    withCheck: sql`${authUid} = user_id`,
  }),
  index('posts_niche_created_idx').on(table.niche, table.created_at),
])

export const platform_posts = pgTable('platform_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  post_id: uuid('post_id').notNull(),
  platform: text('platform').notNull(),
  upload_status: text('upload_status').notNull().default('idle'),
  platform_post_id: text('platform_post_id'),
  actual_views: integer('actual_views'),
  predicted_low: integer('predicted_low'),
  predicted_high: integer('predicted_high'),
  error_message: text('error_message'),
  posted_at: timestamp('posted_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [authUsers.id],
    name: 'platform_posts_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.post_id],
    foreignColumns: [posts.id],
    name: 'platform_posts_post_id_fk',
  }).onDelete('cascade'),
  pgPolicy('platform_posts_user_own', {
    for: 'all',
    to: authenticatedRole,
    using: sql`${authUid} = user_id`,
    withCheck: sql`${authUid} = user_id`,
  }),
  index('platform_posts_post_id_idx').on(table.post_id),
])

export const learning_signals = pgTable('learning_signals', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  post_id: uuid('post_id').notNull(),         // FK to posts(id) ON DELETE CASCADE
  platform: text('platform').notNull(),
  niche: text('niche').notNull(),
  hook_text: text('hook_text').notNull(),
  hashtags: text('hashtags').array().notNull().default([]),
  actual_views: integer('actual_views'),
  overperformed: boolean('overperformed'),
  signal_weights: jsonb('signal_weights').$type<Record<string, number>>(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [authUsers.id],
    name: 'learning_signals_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.post_id],
    foreignColumns: [posts.id],
    name: 'learning_signals_post_id_fk',
  }).onDelete('cascade'),
  pgPolicy('learning_signals_user_own', {
    for: 'all',
    to: authenticatedRole,
    using: sql`${authUid} = user_id`,
    withCheck: sql`${authUid} = user_id`,
  }),
])

export type PlatformConfig = {
  youtube?: { access_token: string; refresh_token: string; expiry: number } | null
  instagram?: { access_token: string; expiry: number } | null
  facebook?: { access_token: string; page_id: string; expiry: number } | null
}

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().unique(),   // one row per user
  ai_provider: text('ai_provider').notNull().default('gemini'),
  api_key_encrypted: text('api_key_encrypted'),
  default_niche: text('default_niche').notNull().default('travel'),
  enabled_platforms: text('enabled_platforms').array().notNull().default(['youtube', 'instagram', 'facebook']),
  platform_config: jsonb('platform_config').$type<PlatformConfig>().notNull().default({}),
  learned_weights: jsonb('learned_weights').$type<Record<string, number>>(),   // EMA weights — NULL until 10 data points
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [authUsers.id],
    name: 'settings_user_id_fk',
  }).onDelete('cascade'),
  pgPolicy('settings_user_own', {
    for: 'all',
    to: authenticatedRole,
    using: sql`${authUid} = user_id`,
    withCheck: sql`${authUid} = user_id`,
  }),
])
// Source: orm.drizzle.team/docs/rls — authUsers, authenticatedRole, pgPolicy
```

### Pattern 6: Drizzle Config with RLS Migration Support

```typescript
// backend/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  entities: {
    roles: {
      provider: 'supabase',  // Prevents Supabase's own roles from being re-created
    },
  },
})
```

### Pattern 7: Drizzle DB Connection (direct connection for VPS backend)

```typescript
// backend/src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

// DATABASE_URL must be the DIRECT connection string (non-pooled, port 5432)
// NOT the transaction pooler (port 6543) — prepared statements not supported there
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema })
// Source: orm.drizzle.team/docs/get-started-postgresql
```

### Pattern 8: Frontend Supabase Client + Auth Screen

```typescript
// frontend/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// Use VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend env vars
// Value is either anon JWT (old projects) or sb_publishable_xxx (new projects)
// Either works with createClient identically
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

```typescript
// frontend/src/App.tsx
import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import GeneratorPage from './pages/GeneratorPage'  // Phase 3+

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes across tabs
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return null   // or a spinner

  if (!session) return <LoginPage />

  // Phase 2+: screen switcher by useState
  return <GeneratorPage />   // placeholder for Phase 3+
}
// Source: supabase.com/docs/guides/auth/quickstarts/react
```

```typescript
// frontend/src/pages/LoginPage.tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
    // On success, onAuthStateChange fires SIGNED_IN → App re-renders with session
  }

  return (
    <div className="flex h-[100dvh] items-center justify-center bg-zinc-950 px-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-white">Viral Copy Generator</h1>
        {error && (
          <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-purple-500"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
```

### Pattern 9: VPS File Storage Init

```typescript
// backend/src/lib/storage.ts
import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'

const UPLOADS_ROOT = process.env.UPLOADS_PATH ?? '/var/uploads'

export async function initStorage(): Promise<void> {
  await mkdir(UPLOADS_ROOT, { recursive: true })
  console.log(`[storage] uploads directory: ${UPLOADS_ROOT}`)
}

export async function cleanupStaleFiles(maxAgeMs = 60 * 60 * 1000): Promise<void> {
  const now = Date.now()
  const userDirs = await readdir(UPLOADS_ROOT)
  for (const userDir of userDirs) {
    const userPath = path.join(UPLOADS_ROOT, userDir)
    const files = await readdir(userPath)
    for (const file of files) {
      const filePath = path.join(userPath, file)
      const stats = await stat(filePath)
      if (now - stats.mtimeMs > maxAgeMs) {
        await unlink(filePath)
      }
    }
  }
}
```

### Pattern 10: Express App Entry — Startup Order

```typescript
// backend/src/index.ts
import { runMigrations } from './db/migrate.js'
import { getBoss, registerCleanupJob } from './lib/boss.js'
import { initStorage } from './lib/storage.js'
import { app } from './app.js'

async function main() {
  // 1. Run Drizzle migrations (fast, idempotent)
  await runMigrations()

  // 2. Init VPS storage directory
  await initStorage()

  // 3. Start pg-boss (creates pgboss schema if not exists)
  const boss = await getBoss()
  await registerCleanupJob(boss)

  // 4. Start Express server
  const PORT = process.env.PORT ?? 3001
  app.listen(PORT, () => console.log(`[server] listening on :${PORT}`))
}

main().catch(err => {
  console.error('[startup error]', err)
  process.exit(1)
})
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT verification on backend | Custom JWT decode/verify | `supabase.auth.getUser(token)` | Validates against Auth server, handles revocation |
| Admin role storage | Custom users table | `app_metadata` via Supabase admin API | Cannot be modified by the user; survives token refresh |
| Job queue scheduling | Cron daemon + custom table | `pg-boss.schedule()` | Handles retries, dead letter, concurrent workers |
| DB schema migration | Raw SQL scripts | `drizzle-kit generate + migrate` | Type-safe, reversible, audit trail |
| RLS enforcement | `WHERE user_id = $1` everywhere | PostgreSQL RLS policies | Enforced at DB layer regardless of app code bugs |
| File UUID naming | Custom UUID generation | `crypto.randomUUID()` or `uuid` npm package | Collision-free, no lookup needed |
| AES encryption | Any other pattern | `createCipheriv('aes-256-gcm', key, iv)` per crypto.ts pattern | GCM provides authenticated encryption |

---

## Common Pitfalls

### Pitfall 1: Using serial IDs instead of UUID for Supabase tables
**What goes wrong:** `user_id INTEGER` cannot reference `auth.users.id` which is UUID.
FK creation fails at migration time with a type mismatch error.
**Why it happens:** Copy-pasting non-Supabase Drizzle examples.
**How to avoid:** All tables use `uuid('id').primaryKey().defaultRandom()` and `uuid('user_id').notNull()`.
**Warning signs:** Migration fails with "incompatible data types" on FK constraint.

### Pitfall 2: Using pg-boss with the transaction pooler (port 6543)
**What goes wrong:** pg-boss uses prepared statements internally. Transaction pooler rejects them.
Error: `prepared statement "pgboss_xxx" already exists` or `prepared statements not supported`.
**Why it happens:** Copying the pooler URL from Supabase dashboard without checking the port.
**How to avoid:** `DATABASE_URL` must use the direct connection (non-pooled) from Supabase Connect panel.
**Warning signs:** pg-boss throws on `boss.start()` with a prepared statement error.

### Pitfall 3: Default import `PgBoss` from pg-boss v12
**What goes wrong:** `import PgBoss from 'pg-boss'` — TypeScript error or runtime `PgBoss is not a constructor`.
**Why it happens:** All blog posts, npm readme examples, and older docs use the default import (v9/v10/v11 pattern).
**How to avoid:** `import { PgBoss } from 'pg-boss'` (named export, v12 ESM).
**Warning signs:** TS2305 error at compile time, or runtime TypeError.

### Pitfall 4: drizzle-kit push silently drops RLS policies
**What goes wrong:** RLS policies not applied when using `drizzle-kit push`. Data becomes readable cross-user.
**Why it happens:** Known drizzle-kit bug (issue #3504, confirmed Nov 2024).
**How to avoid:** Always use `drizzle-kit generate` + `drizzle-kit migrate`. Never `push`.
**Warning signs:** RLS policies missing from `pg_policies` after schema changes.

### Pitfall 5: COOP/COEP via server.headers in vite.config.ts breaks HMR
**What goes wrong:** After any server restart, Vite HMR stops reconnecting.
Console shows `Failed to fetch` for the HMR WebSocket polling endpoint.
**Why it happens:** COEP `require-corp` blocks the HMR polling request which lacks a CORP header.
**How to avoid:** Use `configureServer(server)` plugin middleware pattern, not `server.headers`.
**Warning signs:** Hot reload works once, then stops after `Ctrl+C` and restart.

### Pitfall 6: No `entities.roles` in drizzle.config.ts — RLS policies not in migrations
**What goes wrong:** `drizzle-kit generate` produces SQL with `CREATE TABLE` but no `CREATE POLICY` statements.
RLS enabled but no policies — all rows blocked for authenticated users.
**Why it happens:** `entities.roles` defaults to off; Supabase roles must be declared explicitly.
**How to avoid:** Add `entities: { roles: { provider: 'supabase' } }` to `drizzle.config.ts`.
**Warning signs:** Auth users cannot read their own rows despite correct RLS setup in schema.

### Pitfall 7: Supabase new project publishable key format surprises
**What goes wrong:** Code that calls `jose` `jwtVerify` on the publishable key (`sb_publishable_xxx`) fails —
it is not a JWT, it is an opaque string.
**Why it happens:** Old docs show `anon` key as a JWT that can be decoded.
**How to avoid:** Never verify the Supabase client key. Only verify the user's access token
(the JWT returned by `signInWithPassword`). Use `supabase.auth.getUser(token)` to verify.
**Warning signs:** jose throws `JWTInvalid` when trying to decode the publishable key.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22+ | Backend runtime | Yes | v24.15.0 | — |
| npm 9+ | Package manager | Yes | v11.12.1 | — |
| Supabase project | Auth + DB | Needs creation | — | None — blocking |
| PostgreSQL (Supabase) | DB | Via Supabase | Latest PG 17 | None — blocking |
| Redis | Queue | Not needed | — | pg-boss (already chosen) |
| Nginx | Prod file serving | VPS target only | n/a locally | dev: Vite serves static |
| Supabase CLI | Local DB testing | Not found | — | Use hosted Supabase project |
| Docker | Local Supabase | Not found | — | Use hosted Supabase project |

**Missing dependencies with no fallback:**
- Supabase project must be created before Phase 1 execution begins. The Supabase dashboard is a manual step that cannot be automated. All three keys (URL, ANON/PUBLISHABLE, SERVICE_ROLE/SECRET) must be in `.env` before `npm run dev` works.

**Missing dependencies with fallback:**
- Nginx: only needed for production Nginx config. Vite dev server handles COOP/COEP during development.
- Supabase CLI: nice to have for local testing but not required — use hosted Supabase free tier.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (to be installed) |
| Config file | `vitest.config.ts` — Wave 0 gap |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-02 | GET /api/posts without token → 401 | Integration | `npx vitest run tests/auth.test.ts` | Wave 0 |
| AUTH-02 | GET /api/posts with valid token → 200 | Integration | `npx vitest run tests/auth.test.ts` | Wave 0 |
| AUTH-04 | RLS: user A cannot read user B posts | Integration | `npx vitest run tests/rls.test.ts` | Wave 0 |
| AUTH-05 | Admin middleware: non-admin → 403 | Unit | `npx vitest run tests/admin.test.ts` | Wave 0 |
| AUTH-06 | Admin route: admin JWT → 200 | Integration | `npx vitest run tests/admin.test.ts` | Wave 0 |
| STORE-01 | /var/uploads dir created on startup | Unit | `npx vitest run tests/storage.test.ts` | Wave 0 |
| UI-06 | Login screen renders (no session) | Manual smoke | Manual browser check | — |
| COOP/COEP | self.crossOriginIsolated === true | Manual smoke | Manual DevTools check | — |

### Wave 0 Gaps
- [ ] `backend/tests/auth.test.ts` — covers AUTH-02
- [ ] `backend/tests/rls.test.ts` — covers AUTH-04 (needs test Supabase users)
- [ ] `backend/tests/admin.test.ts` — covers AUTH-05, AUTH-06
- [ ] `backend/tests/storage.test.ts` — covers STORE-01
- [ ] `backend/vitest.config.ts` — test framework config
- [ ] Framework install: `npm install -D vitest` in backend

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth `signInWithPassword` + `getUser` |
| V3 Session Management | Yes | Supabase session SDK + httpOnly cookies (Supabase handles) |
| V4 Access Control | Yes | RLS at DB layer + Express authMiddleware + adminMiddleware |
| V5 Input Validation | Yes | TypeScript strict mode + Express body parser |
| V6 Cryptography | Yes | AES-256-GCM with `randomBytes(12)` IV |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated API access | Elevation of Privilege | `authMiddleware` on every route except `/health` |
| Cross-user data read (RLS bypass) | Information Disclosure | PostgreSQL RLS `USING (user_id = auth.uid())` |
| Admin role self-assignment | Elevation of Privilege | `app_metadata` writable only via service role key |
| API key exposure in response | Information Disclosure | Return `{ masked: '****last4' }` only |
| Secret key in frontend bundle | Credential Exposure | `SUPABASE_SERVICE_ROLE_KEY` never in VITE_ env vars |
| CSRF via cross-origin request | Tampering | COOP `same-origin` + SameSite cookies |
| JWT replay after logout | Elevation of Privilege | `supabase.auth.getUser(token)` validates against server |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `supabase.auth.getUser(token)` works identically with both old JWT service_role key and new `sb_secret_xxx` format | Pattern 1 | Backend auth middleware fails silently — all requests get 401 |
| A2 | Direct Supabase connection (non-pooled, port 5432) is available for all Supabase tiers including free | Issue 3 | pg-boss and Drizzle both need a connection string for startup |
| A3 | pg-boss v12 creates `pgboss.*` schema on `boss.start()` in Supabase PostgreSQL without manual grants | Pattern 4 | boss.start() throws permission error in Supabase managed PostgreSQL |

---

## Open Questions

1. **Supabase free tier connection limits**
   - What we know: Free tier has 2 direct connections and 200 pooler connections
   - What's unclear: Whether pg-boss + Drizzle can share the 2 direct connection slots, or if session-mode pooler is needed
   - Recommendation: Start with direct connection. If pg-boss or Drizzle shows "too many clients", switch to session-mode pooler for Drizzle (with `{ prepare: false }` on postgres.js) while pg-boss keeps the direct connection.

2. **pg-boss schema permission on Supabase**
   - What we know: pg-boss creates its own `pgboss` schema on start(). Supabase uses a managed Postgres instance.
   - What's unclear: Whether the DATABASE_URL user has permission to CREATE SCHEMA in Supabase's managed instance.
   - Recommendation: Test `boss.start()` immediately in Wave 1. If schema creation fails, the fix is to run `CREATE SCHEMA pgboss AUTHORIZATION postgres` manually via the Supabase SQL editor, then restart.

---

## State of the Art

| Old Approach (stale research) | Current Approach | Changed | Impact |
|-------------------------------|------------------|---------|--------|
| BullMQ + Redis | pg-boss v12 on Supabase DB | Architecture decision | No Redis needed; different API |
| `import PgBoss from 'pg-boss'` (default) | `import { PgBoss } from 'pg-boss'` (named) | v12.0.0 (2024) | Runtime crash if using old import |
| `serial` PKs for all tables | `uuid().defaultRandom()` PKs | Supabase FK requirement | Schema must use UUID |
| `drizzle-orm/node-postgres` plain | `drizzle-orm/supabase` authUsers import for RLS | Drizzle 0.36+ | Required for auth.users FK + pgPolicy |
| `anon` + `service_role` keys (JWT strings) | `sb_publishable_xxx` + `sb_secret_xxx` (new projects) | May 2025 | Key format changed; code pattern identical |
| `server.headers` for COOP/COEP in Vite | `configureServer` middleware plugin | Vite 5.4+ (but issue persists in some builds) | HMR breaks without plugin pattern |

---

## Sources

### Primary (HIGH confidence)
- npm registry (2026-05-01) — all package versions verified with `npm view`
- supabase.com/docs/guides/api/api-keys — new key format for May 2025+ projects
- supabase.com/docs/guides/database/connecting-to-postgres — direct vs pooler connection guidance
- supabase.com/docs/reference/javascript/auth-getuser — getUser(token) method
- orm.drizzle.team/docs/rls — pgPolicy, authUsers, authenticatedRole, entities.roles
- orm.drizzle.team/docs/connect-supabase — postgres.js driver with { prepare: false }
- github.com/timgit/pg-boss/releases/tag/12.0.0 — v12 ESM named import breaking change
- logsnag.com/blog/deep-dive-into-background-jobs-with-pg-boss-and-typescript — pg-boss TypeScript patterns

### Secondary (MEDIUM confidence)
- github.com/orgs/supabase/discussions/40853 — publishable key + Express backend discussion
- github.com/drizzle-team/drizzle-orm/issues/3504 — RLS not applied with push (Nov 2024 bug)
- github.com/vitejs/vite/issues/16536 — COOP/COEP HMR bug + configureServer fix
- dev.to/kvetoslavnovak/supabase-auth-itroduces-asymmetric-jwts — new key timeline

### Tertiary (LOW confidence — flagged in Assumptions Log)
- Supabase free tier connection count behavior with pg-boss + Drizzle sharing
- pg-boss schema creation permissions on managed Supabase PostgreSQL

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all versions verified via npm registry
- Architecture: HIGH — directly derived from ROADMAP locked decisions + official docs
- Auth patterns: HIGH — verified against Supabase official docs
- pg-boss v12 patterns: HIGH — verified against release notes and official readme
- Drizzle + Supabase RLS: HIGH — verified against official Drizzle docs
- Supabase new key format: MEDIUM — confirmed via official docs but runtime behavior [A1] assumed

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (30 days for stable stack)

**Note on stale research file:** `phase1-research.md` covers BullMQ+Redis (superseded).
Extract useful patterns: Express 5 breaking changes (ISSUE 7), COOP/COEP plugin (ISSUE 4),
AES-256-GCM encryption (Pattern D in stale file), Nginx COOP/COEP config (Pattern K in stale file).
Do NOT use: BullMQ/Redis config, serial ID schema, Drizzle schema without authUsers import.
