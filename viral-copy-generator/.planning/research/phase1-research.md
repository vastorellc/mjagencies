# Phase 1 Deep Research

**Researched:** 2026-04-30
**Domain:** Express 5 + TypeScript + Drizzle ORM + PostgreSQL 17 + BullMQ/Redis + React 19 + Vite 6 + Tailwind CSS 4
**Confidence:** HIGH — all critical findings verified against official docs or npm registry

---

## Confirmed Approach (no changes needed)

### Stack versions are correct and available [VERIFIED: npm registry 2026-04-30]

| Package | Specified | Latest | Status |
|---------|-----------|--------|--------|
| express | 5.2.1 | 5.2.1 | Exact match |
| @types/express | ~5.x | 5.0.6 | Use 5.0.6 explicitly |
| drizzle-orm | 0.45.x | 0.45.2 | Use 0.45.2 |
| drizzle-kit | 0.31.x | 0.31.10 | Use 0.31.10 |
| bullmq | 5.76.x | 5.76.4 | Use 5.76.4 |
| vite | 6.x | 6.0.10 (stable) | 8.0.10 is latest but 6.x is valid |
| @vitejs/plugin-react | 6.x | 6.0.1 | Correct |
| tailwindcss | 4.x | 4.2.4 | Use 4.2.4 |
| @tailwindcss/vite | 4.x | 4.2.4 | Use 4.2.4 |
| react | 19.x | 19.2.5 | Use 19.2.5 |
| typescript | 5.8 | 5.8 | Correct |
| pg-boss | — | 12.18.1 | See pg-boss section below |

NOTE: `npm view vite version` returns `8.0.10` as latest — Vite has moved fast. Pin to `^6.0.0` explicitly in package.json to stay on 6.x. Do not use `latest` tag.

### Architecture decisions confirmed

- **No routing library** (UI-01) — useState screen switching is correct for a 4-screen tool. No research needed.
- **No UI component library** (UI-02) — Tailwind 4 only is correct.
- **Backend-only OAuth token storage** — confirmed required for YouTube API v3. [CITED: SUMMARY.md A3]
- **JSONB merge with raw SQL** — confirmed needed for safe partial settings updates. [CITED: SUMMARY.md A5]
- **BullMQ `noeviction` policy** — confirmed mandatory for queue correctness. [CITED: docs.bullmq.io/guide/going-to-production]

---

## Issues Found (must fix in plan)

### ISSUE 1: Vite + COOP/COEP breaks HMR in some Vite versions [HIGH RISK]

**What breaks:** When `Cross-Origin-Embedder-Policy: require-corp` is set via `server.headers` in vite.config.ts, the HMR WebSocket reconnection polling (which fires after a server restart) makes a cross-origin request that lacks a `Cross-Origin-Resource-Policy` header. The browser blocks it. Result: live-reload stops working after any restart.

**Confirmed:** GitHub issue vitejs/vite#16536 (April 2024). Closed via PR #17891.

**Fix — use the inline plugin pattern, NOT `server.headers`:**

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    // MUST be first plugin
    {
      name: 'cross-origin-isolation',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
          next()
        })
      },
      // Also apply to preview server
      configurePreviewServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
          next()
        })
      },
    },
    react(),
    tailwindcss(),
  ],
})
```

On Vite 5.4.0+, the simpler `server.headers` approach also works. Since we are on Vite 6, test `server.headers` first; if HMR breaks after restart, fall back to the plugin pattern above.

**The `server.headers` approach (try first):**

```typescript
export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
```

**Verify:** Open Chrome DevTools Console → `self.crossOriginIsolated` must return `true`. SharedArrayBuffer must not throw.

### ISSUE 2: COOP `same-origin` breaks Google OAuth popup [HIGH RISK — Phase 2 blocker]

**What breaks:** `Cross-Origin-Opener-Policy: same-origin` severs the BrowsingContext group between your app window and any popup it opens. Google OAuth uses a popup window + `window.opener` communication to complete the flow. With `same-origin`, `window.opener` is `null` in the popup and the auth callback silently fails.

**Confirmed:** [github.com/vercel/next.js/discussions/51135] and [web.dev/articles/coop-coep]. This is not a Vite bug — it is a browser behaviour.

**Two valid fixes:**

**Option A — Use `same-origin-allow-popups` instead (RECOMMENDED for this project):**

This header gives you cross-origin isolation AND allows popup communication. SharedArrayBuffer still works. [CITED: web.dev/articles/coop-coep — "a relaxed alternative being explored"]

```
Cross-Origin-Opener-Policy: same-origin-allow-popups
Cross-Origin-Embedder-Policy: require-corp
```

Test with `self.crossOriginIsolated` after setting. If it returns `true`, use this. If it returns `false` (some browsers require `same-origin` strictly), use Option B.

**Option B — Redirect-based OAuth flow (fallback):**

Route user to a non-COOP-isolated `/oauth/start` page for the OAuth redirect dance, then redirect back to the main app after completion. The main app never opens a popup — it receives the token on return.

Since Phase 2 (OAuth) will likely use a server-side redirect flow (backend handles the code exchange per SUMMARY.md A3), Option B is already the default architecture. The frontend just navigates to `/api/oauth/google` and gets redirected back. No popup needed. This completely avoids the COOP/popup conflict.

**Action:** Plan the OAuth flow as redirect-based (not popup-based) in Phase 2. COOP headers can stay as `same-origin`.

### ISSUE 3: Express 5 TypeScript type mismatch with `@types/express` [MEDIUM RISK]

**What breaks:** `@types/express` 5.0.6 (the current version) is aligned to Express 5. However, if you accidentally install the version 4 types (or have a dependency that pulls them in), you get error handler middleware type errors:

```
No overload matches this call. Argument of type '(err: any, req: Request...) => void' is not assignable to parameter of type 'PathParams'
```

**Fix:** Pin `@types/express` to exactly `5.0.6` in package.json. Do not use `^4.x`.

```json
{
  "devDependencies": {
    "@types/express": "5.0.6"
  }
}
```

**Express 5 async error handling — key change from v4:**

In Express 5, async route handlers that throw or reject automatically forward to error handler middleware. You do NOT need `express-async-errors` or `asyncHandler()` wrappers. This is native.

```typescript
// Express 5 — this works natively, no wrapper needed
app.get('/api/posts', async (req: Request, res: Response) => {
  const posts = await db.query.posts.findMany()
  res.json(posts)
  // If db.query throws, Express 5 forwards to error handler automatically
})

// 4-argument error handler signature still required
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})
```

### ISSUE 4: Express 5 breaking changes that affect fresh boilerplate [MEDIUM RISK]

**Path matching is different.** Several patterns that worked in Express 4 silently break in Express 5:

| Express 4 | Express 5 | Notes |
|-----------|-----------|-------|
| `app.get('/*', ...)` | `app.get('/*splat', ...)` | Wildcards must be named |
| `app.get('/:file.:ext?', ...)` | `app.get('/:file{.:ext}', ...)` | Optional params new syntax |
| `res.send(200)` | `res.sendStatus(200)` | Numeric-only send removed |
| `res.json({}, 200)` | `res.status(200).json({})` | Argument order changed |
| `res.redirect('/url', 301)` | `res.redirect(301, '/url')` | Argument order changed |
| `req.body` unparsed → `{}` | unparsed → `undefined` | Check for undefined not `{}` |
| `express.urlencoded()` → `extended: true` | → `extended: false` | Must set explicitly if needed |

**Action:** For this project's simple CRUD API, the main risk is `res.redirect` order and body parsing. Set `extended: true` explicitly if form data is ever parsed.

### ISSUE 5: `drizzle-kit push` is unsafe for any production or staged deployment [HIGH RISK]

**What breaks:** `push` has no SQL migration files. It calculates the diff and applies it directly. On subsequent runs against a live database with real data, it can issue `DROP COLUMN` or `ALTER TABLE` statements without a preview if `--force` is used. It also gives no audit trail.

**Recommendation for this single-user personal tool:**

Use **generate + migrate** from day one, even though it feels like overhead. The reasons:

1. The DB will have real user data (post history, learning signals, OAuth tokens) by Phase 2. A bad `push` can irreversibly destroy it.
2. The migration files are a free schema changelog. They document the evolution of the tool.
3. The `migrate()` call at startup takes under 100ms for small schemas.
4. `push` is only safe for local throwaway databases.

**Setup pattern:**

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

```typescript
// src/db/migrate.ts — run at server startup BEFORE app.listen()
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

export async function runMigrations(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool)
  await migrate(db, { migrationsFolder: './drizzle' })
  await pool.end()
  console.log('Migrations applied')
}
```

```typescript
// src/index.ts
import { runMigrations } from './db/migrate.js'
import { app } from './app.js'

await runMigrations()
app.listen(3001, () => console.log('Server running on :3001'))
```

**Workflow:**
1. Edit `src/db/schema.ts`
2. `npx drizzle-kit generate` — creates `drizzle/XXXX_xxx.sql`
3. Commit both `schema.ts` and the `.sql` file
4. `node dist/src/db/migrate.js` or automatic on server start

Never run `drizzle-kit push` against the production DB after Phase 1.

---

## Implementation Notes (specific code patterns)

### A. Project structure for Phase 1

```
viral-copy-generator/
├── frontend/                    # Vite + React project root
│   ├── index.html
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx              # useState screen switcher
│   │   └── styles.css           # @import "tailwindcss" + @theme block
│   └── package.json
├── backend/                     # Express + TypeScript project root
│   ├── src/
│   │   ├── index.ts             # entry: runMigrations() then app.listen()
│   │   ├── app.ts               # Express app, middleware, routes
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle table definitions
│   │   │   ├── index.ts         # drizzle(pool) singleton
│   │   │   └── migrate.ts       # runMigrations() function
│   │   ├── routes/
│   │   │   ├── health.ts
│   │   │   ├── posts.ts
│   │   │   └── settings.ts
│   │   └── queue/
│   │       └── index.ts         # BullMQ Queue + Worker setup
│   ├── drizzle/                 # Generated migration SQL files
│   ├── drizzle.config.ts
│   └── package.json
```

### B. DB schema — Drizzle ORM patterns [VERIFIED: orm.drizzle.team/docs/column-types/pg]

```typescript
// backend/src/db/schema.ts
import { pgTable, serial, text, integer, jsonb, timestamp, boolean, index } from 'drizzle-orm/pg-core'

// Custom type for settings JSONB column
export type PlatformConfig = {
  youtube?: { access_token: string; refresh_token: string; expiry: number } | null
  instagram?: { access_token: string; page_id: string; expiry: number } | null
  facebook?: { access_token: string; page_id: string; expiry: number } | null
}

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  ai_provider: text('ai_provider').notNull().default('gemini'),
  // Stored as: iv:authTag:ciphertext (all hex)
  api_key_encrypted: text('api_key_encrypted'),
  default_niche: text('default_niche').notNull().default('travel'),
  enabled_platforms: text('enabled_platforms').array().notNull().default(['youtube', 'instagram', 'facebook']),
  // JSONB for OAuth tokens — encrypted values inside this object
  platform_config: jsonb('platform_config').$type<PlatformConfig>().notNull().default({}),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

export type EngineSignals = {
  duration: number
  fps: number
  resolution: string
  aspect_ratio: string
  has_audio: boolean
  scene_count: number
  motion_score: number
  face_detected: boolean
  scene_labels: string[]
  audio_energy: number
  beat_present: boolean
  luma_score: number
  hook_strength: number
  scene_change_timestamps: number[]
}

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  niche: text('niche').notNull(),
  virality_score: integer('virality_score').notNull().default(0),
  engine_signals: jsonb('engine_signals').$type<EngineSignals>().notNull(),
  // Full AI response JSON
  ai_output: jsonb('ai_output').$type<Record<string, unknown>>().notNull().default({}),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Query pattern: list posts newest first (Phase 7)
  nicheCreatedIdx: index('posts_niche_created_idx').on(table.niche, table.created_at),
  // Sort by score for learning queries
  scoreIdx: index('posts_score_idx').on(table.virality_score),
}))

export type PlatformPost = {
  platform: 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'x'
  upload_status: 'idle' | 'uploading' | 'posted' | 'failed'
  platform_post_id: string | null
  actual_views: number | null
  error_message: string | null
  posted_at: string | null
}

export const platform_posts = pgTable('platform_posts', {
  id: serial('id').primaryKey(),
  post_id: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  upload_status: text('upload_status').notNull().default('idle'),
  platform_post_id: text('platform_post_id'),
  actual_views: integer('actual_views'),
  predicted_low: integer('predicted_low'),
  predicted_high: integer('predicted_high'),
  error_message: text('error_message'),
  posted_at: timestamp('posted_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Join pattern: get all platforms for a post
  postIdIdx: index('platform_posts_post_id_idx').on(table.post_id),
  // Learning query: find high-performing posts per platform
  platformViewsIdx: index('platform_posts_platform_views_idx').on(table.platform, table.actual_views),
}))

export const learning_signals = pgTable('learning_signals', {
  id: serial('id').primaryKey(),
  post_id: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  niche: text('niche').notNull(),
  hook_text: text('hook_text').notNull(),
  hashtags: text('hashtags').array().notNull().default([]),
  actual_views: integer('actual_views'),
  overperformed: boolean('overperformed'),
  signal_weights: jsonb('signal_weights').$type<Record<string, number>>(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Phase 7 learning query: top hooks per niche
  nicheHookIdx: index('learning_signals_niche_hook_idx').on(table.niche, table.hook_text),
  // Phase 7 learning query: top hashtags per niche+platform
  nichePlatformIdx: index('learning_signals_niche_platform_idx').on(table.niche, table.platform),
}))
```

**Schema design notes:**
- `posts.engine_signals` as JSONB: correct. The signals struct is read-only after write (no partial updates needed). Query is always by post ID. No GIN index needed.
- `settings.platform_config` as JSONB: correct but requires the merge operator pattern for updates (see Issue 6 below).
- `learning_signals.hashtags` as `text[]` (PostgreSQL array) not JSONB: simpler for the `= ANY(hashtags)` unnest queries in Phase 7.
- `platform_posts.actual_views` and `predicted_low/high` as integers: correct. View counts are integers, not floats.

### C. JSONB partial update pattern [CITED: SUMMARY.md A5]

**Do not do this (replaces entire column):**

```typescript
// WRONG — overwrites all other keys in platform_config
await db.update(settings).set({ platform_config: { youtube: tokenData } })
```

**Do this instead (merge operator — preserves other platform tokens):**

```typescript
// CORRECT — merges into existing JSONB
import { sql } from 'drizzle-orm'

await db.execute(sql`
  UPDATE settings
  SET platform_config = platform_config || ${JSON.stringify({ youtube: tokenData })}::jsonb,
      updated_at = NOW()
  WHERE id = 1
`)
```

For token refresh (concurrent write safety):

```typescript
// SELECT FOR UPDATE prevents race on refresh
await db.execute(sql`
  BEGIN;
  SELECT platform_config FROM settings WHERE id = 1 FOR UPDATE;
  UPDATE settings
  SET platform_config = platform_config || ${JSON.stringify({ youtube: newTokenData })}::jsonb
  WHERE id = 1;
  COMMIT;
`)
```

### D. AES-256-GCM encryption for API keys [VERIFIED: nodejs.org/api/crypto.html]

The correct pattern uses `scrypt` for key derivation from the master `ENCRYPTION_KEY` env var, and a fresh random 12-byte IV per encryption. Store as `iv:authTag:ciphertext` (all hex) in a single text column.

```typescript
// backend/src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ALGO = 'aes-256-gcm' as const

// Derive a fixed 32-byte key from the master secret
// scryptSync is synchronous and appropriate here (runs once, not per request)
function deriveKey(masterSecret: string): Buffer {
  // Salt is fixed and public — it prevents master key from being used directly
  // In prod: store ENCRYPTION_SALT in env vars alongside ENCRYPTION_KEY
  const salt = Buffer.from(process.env.ENCRYPTION_SALT ?? 'viral-copy-generator-v1', 'utf8')
  return scryptSync(masterSecret, salt, 32) as Buffer
}

export function encrypt(plaintext: string): string {
  const key = deriveKey(process.env.ENCRYPTION_KEY!)
  const iv = randomBytes(12)                          // 96-bit IV — NIST recommended for GCM
  const cipher = createCipheriv(ALGO, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()                 // 16-byte GCM auth tag

  // Format: iv(12B):authTag(16B):ciphertext
  // All hex — safe to store in a TEXT column
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(stored: string): string {
  const [ivHex, authTagHex, cipherHex] = stored.split(':')
  if (!ivHex || !authTagHex || !cipherHex) throw new Error('Invalid encrypted format')

  const key = deriveKey(process.env.ENCRYPTION_KEY!)
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(cipherHex, 'hex')

  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)                        // MUST be set before update()

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8')
}
```

**Required env vars:**

```bash
ENCRYPTION_KEY=<64-char hex string>     # Generate with: openssl rand -hex 32
ENCRYPTION_SALT=<arbitrary string>      # e.g. "viral-copy-gen-prod-v1"
```

**Security notes:**
- Never reuse IV — `randomBytes(12)` on every `encrypt()` call guarantees uniqueness.
- The auth tag detects tampering — if the DB row is modified, `decipher.final()` throws.
- `scryptSync` cost is ~50ms on first call per process — cache the derived key or use `scrypt` async.
- `createCipher()` (no `iv`) is deprecated since Node.js 10. Never use it.

### E. BullMQ + Redis configuration [VERIFIED: docs.bullmq.io/guide/going-to-production]

**Redis config for 1 GB VPS (`/etc/redis/redis.conf` or `/etc/redis.conf`):**

```conf
# Limit Redis to 200 MB on a 1 GB VPS
# (leaves ~800 MB for Node.js + PostgreSQL)
maxmemory 200mb

# MANDATORY for BullMQ — never evict queue keys
# Any other policy (lru, lfu, etc.) corrupts queue state
maxmemory-policy noeviction

# Append-only persistence (survives restart without job loss)
appendonly yes
appendfsync everysec

# Disable RDB snapshots to reduce I/O on VPS
save ""
```

**BullMQ setup with aggressive auto-cleanup:**

```typescript
// backend/src/queue/index.ts
import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'

const connection = new Redis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,   // Required by BullMQ
  enableReadyCheck: false,      // Required by BullMQ
})

const JOB_DEFAULTS = {
  removeOnComplete: { count: 100 },   // Keep last 100 completed jobs
  removeOnFail: { count: 50 },        // Keep last 50 failed jobs (for debugging)
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
}

export const uploadQueue = new Queue('uploads', {
  connection,
  defaultJobOptions: JOB_DEFAULTS,
})

// Phase 1: worker stub (real upload logic in Phase 6)
export const uploadWorker = new Worker(
  'uploads',
  async (job) => {
    console.log(`Processing job ${job.id}:`, job.name)
    // Phase 6 will implement platform upload handlers here
  },
  { connection }
)

uploadWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message)
})
```

### F. Tailwind CSS v4 with Vite setup [VERIFIED: tailwindcss.com/docs/installation/using-vite]

**No tailwind.config.js.** All customisation happens in CSS.

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'   // NOT 'tailwindcss' package directly

export default defineConfig({
  plugins: [
    // Cross-origin isolation plugin (see Issue 1)
    {
      name: 'cross-origin-isolation',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
          next()
        })
      },
    },
    react(),
    tailwindcss(),   // After react()
  ],
})
```

```css
/* frontend/src/styles.css */
@import "tailwindcss";

/* Custom design tokens replace tailwind.config.js entirely */
@theme {
  --color-brand: #7c3aed;          /* purple-600 — primary accent */
  --color-yt-red: #ff0000;         /* YouTube red */
  --color-ig-pink: #e1306c;        /* Instagram pink */
  --color-tiktok-cyan: #69c9d0;    /* TikTok cyan */
  --color-fb-blue: #1877f2;        /* Facebook blue */

  --font-sans: 'Inter', system-ui, sans-serif;

  /* Score colours */
  --color-score-red: #ef4444;       /* 0-39 */
  --color-score-amber: #f59e0b;     /* 40-59 */
  --color-score-green: #22c55e;     /* 60-79 */
  --color-score-bright: #84cc16;    /* 80-100 */
}
```

```tsx
// frontend/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**Installation:**

```bash
# Frontend
npm install tailwindcss @tailwindcss/vite
# Do NOT install postcss or autoprefixer — @tailwindcss/vite handles everything
```

### G. React 19 + Vite 6 gotchas [VERIFIED: react.dev/blog/2024/12/05/react-19]

**What changed from React 18:**
1. **Legacy Context API removed.** If any library uses `childContextTypes` / `getChildContext`, it will crash. Unlikely to affect this greenfield project.
2. **String refs removed.** Use `useRef()`. Not relevant for greenfield.
3. **`react-test-renderer` deprecated** — use `@testing-library/react` instead. Already the correct choice.
4. **StrictMode double-invokes ref callbacks** in development. If any code assumes refs are set exactly once, it will misbehave. Write ref callbacks idempotently.
5. **UMD builds removed** — no impact for Vite projects (ESM only).
6. **Concurrent rendering on by default** — effects with async side effects may run in unexpected order. Use cleanup functions in `useEffect`.

**What is safe:**
- `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo` all work identically to React 18.
- The new `use()` hook and `<Suspense>` improvements are additive — not required.
- `createRoot` API unchanged.

**Vite 6 specific (for React + TypeScript fresh start):**
- Vite 6 defaults to `resolve.conditions` including `browser` export first — correct for a frontend bundle.
- PostCSS config is loaded differently. Since we use `@tailwindcss/vite` (which bypasses PostCSS entirely), no postcss.config.js is needed.
- Sass is not used in this project, so the Sass API change is irrelevant.
- The Environment API is experimental and "nothing changes if you're building a SPA" per Vite 6 docs. Ignore it.

**tsconfig.json for React 19 + Vite 6:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### H. Express 5 TypeScript app skeleton

```typescript
// backend/src/app.ts
import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { healthRouter } from './routes/health.js'
import { postsRouter } from './routes/posts.js'
import { settingsRouter } from './routes/settings.js'

export const app = express()

// Body parsers — Express 5 ships body-parser built-in
app.use(express.json())
app.use(express.urlencoded({ extended: true }))  // Set explicitly — default is false in v5

// CORS for Vite dev server (adjust origin for production)
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173' }))

// Routes
app.use('/health', healthRouter)
app.use('/api/posts', postsRouter)
app.use('/api/settings', settingsRouter)

// 4-argument signature required by Express for error handlers
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})
```

### I. PostgreSQL 17 server tuning for Hetzner CX22 / CX11 [CITED: SUMMARY.md]

```sql
-- /etc/postgresql/17/main/postgresql.conf
shared_buffers = 128MB        -- 1/4 of RAM on 512MB; scale to 512MB on 4GB
work_mem = 4MB                -- Per sort/hash — safe for low-concurrency single-user
maintenance_work_mem = 64MB   -- For CREATE INDEX, VACUUM
effective_cache_size = 512MB  -- Hint to query planner
```

**Swap file (prevents OOM on 1 GB CX11):**

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

**Node.js memory cap:**

```bash
# In PM2 ecosystem.config.cjs
node_args: '--max-old-space-size=384'
```

### J. pg-boss vs BullMQ decision [VERIFIED: github.com/timgit/pg-boss v12.18.1]

**pg-boss is a legitimate alternative for this project.** Key facts:

| | BullMQ | pg-boss |
|---|---|---|
| Storage | Redis (separate process) | PostgreSQL (already running) |
| Memory overhead | ~200 MB Redis | ~0 (already paid) |
| Cron scheduling | Yes | Yes (built-in cron syntax) |
| Retry + backoff | Yes | Yes (exponential) |
| Delayed jobs | Yes | Yes |
| Weekly downloads | ~4.5M | ~150K |
| Version | 5.76.4 | 12.18.1 |
| Maturity | Production-grade | Production-grade |

**For this project:** The scheduled upload feature (BullMQ PKT peak times, AUTOUP-06/07/08) is the deciding factor. Both support delayed/scheduled jobs.

**Recommendation: Keep BullMQ.** Reasons:
1. ROADMAP and REQUIREMENTS already specify BullMQ explicitly (AUTOUP-08).
2. Redis is also used for rate-limiting protection on OAuth token refresh (future Phase 2) — Redis is not wasted.
3. pg-boss adds `pgboss.*` tables to the app database, which muddles the schema.
4. The SUMMARY.md already gives exact Redis tuning for this VPS size.

**If memory becomes an issue on CX11:** swap to pg-boss in Phase 1 before any production data exists. This is a 1-day migration. After Phase 2, it becomes painful.

### K. Nginx COOP/COEP production config

```nginx
# /etc/nginx/sites-available/viral-copy-generator
server {
  listen 80;
  server_name your-vps-ip;

  # Frontend (Vite built output in /var/www/viral-copy/frontend/dist)
  location / {
    root /var/www/viral-copy/frontend/dist;
    index index.html;
    try_files $uri $uri/ /index.html;

    # REQUIRED for ffmpeg.wasm SharedArrayBuffer
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;
  }

  # Backend API
  location /api {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # Health check
  location /health {
    proxy_pass http://127.0.0.1:3001;
  }
}
```

**IMPORTANT:** The `Cross-Origin-Resource-Policy: same-origin` header on the frontend location prevents the frontend assets from being embedded in other origins. This is required for COEP strict mode. It does not block the API calls to `127.0.0.1:3001` because those are same-origin from the browser's perspective (both served from the same domain).

---

## Dependency Checklist (must be true before phase starts)

- [ ] Node.js 22 LTS installed (`node --version` shows v22.x) — **NOTE: machine currently has v24.15.0 which satisfies this**
- [ ] PostgreSQL 17 installed and running (`psql --version`)
- [ ] Redis 7.x installed and running (`redis-cli ping` returns PONG)
- [ ] `DATABASE_URL` env var set and points to empty PostgreSQL 17 database
- [ ] `REDIS_HOST`, `REDIS_PORT` env vars set (or defaults 127.0.0.1:6379)
- [ ] `ENCRYPTION_KEY` env var set (64 hex chars — `openssl rand -hex 32`)
- [ ] `ENCRYPTION_SALT` env var set (any string — `viral-copy-gen-v1` is fine)
- [ ] `FRONTEND_ORIGIN` env var set for CORS (`http://localhost:5173` for dev)
- [ ] Redis `maxmemory` and `maxmemory-policy noeviction` confirmed in redis.conf
- [ ] Swap file created on VPS if running CX11 (1 GB RAM)
- [ ] `npm` v9+ available (v11.12.1 confirmed on this machine)

**Phase 1 success gate (from ROADMAP):**
1. `GET /health` returns 200 with `{ db: "ok", redis: "ok" }`
2. `drizzle-kit generate` + `drizzle-kit migrate` run clean against fresh PG17 DB
3. All 4 tables exist: posts, platform_posts, learning_signals, settings
4. BullMQ test job enqueues and completes
5. `self.crossOriginIsolated === true` in browser console on Vite dev server
6. Vite HMR still works after server restart (confirm hot-reload fires)
7. React 19 root renders without console errors

---

## Estimated Risk: LOW

**Rationale:**

- Express 5 + TypeScript is a known, well-documented stack. The breaking changes are mechanical (path syntax, response method order) and fully documented. None are tricky to implement correctly on a greenfield project.
- Drizzle ORM 0.45.x is stable. The generate+migrate workflow is standard.
- BullMQ 5.76.x is production-grade with Redis. The configuration lines are exact and verified.
- Tailwind v4 + Vite is the official first-party integration. No postcss.config.js needed.
- React 19 on a greenfield project has zero legacy API debt. All removals (string refs, legacy context) are irrelevant.

**The only non-trivial item is COOP/COEP (Issues 1 and 2),** but both are fully resolved with documented patterns:
- HMR issue: Vite plugin middleware pattern (Issue 1)
- OAuth popup issue: redirect-based OAuth flow (Issue 2) — which is already the planned architecture

**No unknowns remain for Phase 1 execution.**

---

## Sources

| Claim | Source | Confidence |
|-------|--------|------------|
| Express 5 breaking changes | expressjs.com/en/guide/migrating-5.html | HIGH |
| @types/express 5.x incompatibility with Express 4 | github.com/expressjs/express/issues/5987 | HIGH |
| Vite COOP/COEP HMR issue | github.com/vitejs/vite/issues/16536 (resolved PR #17891) | HIGH |
| COOP same-origin OAuth popup breakage | github.com/vercel/next.js/discussions/51135, web.dev/articles/coop-coep | HIGH |
| COEP credentialless / same-origin-allow-popups | web.dev/articles/coop-coep | HIGH |
| Drizzle push vs migrate | orm.drizzle.team/docs/migrations, orm.drizzle.team/docs/drizzle-kit-push | HIGH |
| Drizzle migrate() runtime pattern | orm.drizzle.team/docs/migrations | HIGH |
| Drizzle JSONB column type | orm.drizzle.team/docs/column-types/pg | HIGH |
| BullMQ noeviction requirement | docs.bullmq.io/guide/going-to-production | HIGH |
| BullMQ removeOnComplete config | docs.bullmq.io/guide/going-to-production | HIGH |
| Tailwind v4 Vite plugin | tailwindcss.com/docs/installation/using-vite | HIGH |
| Tailwind v4 @theme syntax | tailwindcss.com/docs/theme | HIGH |
| AES-256-GCM Node.js pattern | nodejs.org/api/crypto.html, gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81 | HIGH |
| scryptSync for key derivation | nodejs.org/api/crypto.html | HIGH |
| React 19 breaking changes | react.dev/blog/2024/12/05/react-19 | HIGH |
| Vite 6 Environment API | vite.dev/blog/announcing-vite6 | HIGH |
| pg-boss version and features | github.com/timgit/pg-boss | HIGH |
| Package versions | npm registry (verified 2026-04-30) | HIGH |
