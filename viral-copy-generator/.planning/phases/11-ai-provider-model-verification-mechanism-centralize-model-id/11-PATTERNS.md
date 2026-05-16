# Phase 11: AI Provider + Model Verification Mechanism — Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 19 (create + modify)
**Analogs found:** 17 / 19 (one new file has no analog: `backend/shared/model-ids.json`; one is a parity test that mirrors its sibling)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| frontend/src/lib/models.ts | constants module | static lookup | frontend/src/lib/types.ts | role-match (const-export style) |
| backend/src/lib/models.ts | constants module | static lookup | frontend/src/lib/models.ts (its own sibling) + backend/src/lib/encryption.ts | exact (sibling parity) |
| backend/shared/model-ids.json | manifest / single source | static read | (none — no JSON config in repo) | no analog |
| backend/src/db/schema/admin-provider-health.ts (inline in schema.ts) | Drizzle table | DB write/read | backend/src/db/schema.ts `trend_cache` and `platform_viral_patterns` | exact (no-RLS shared table) |
| backend/src/lib/provider-health-check.ts | pg-boss worker | event-driven cron | backend/src/lib/boss.ts `registerResearchRefreshJob` + `research-cache.ts:refreshAllNiches` | exact |
| backend/src/routes/admin.ts (extension — provider-health endpoint) | admin route | request-response (read) | backend/src/routes/admin.ts `GET /stats/platforms` | exact |
| frontend/src/lib/ai.ts (MODIFY — model_not_found discriminant) | utility / error normaliser | transform | itself: existing `parseProviderError` Claude/Gemini/OpenAI/DeepSeek branches | self-extension |
| frontend/src/pages/SettingsPage.tsx (MODIFY — model dropdown + capability badges + model_not_found banner) | page component | request-response | itself: existing `validateApiKey()` + provider dropdown | self-extension |
| frontend/src/pages/AdminPage.tsx (MODIFY — 6th Provider Health tab) | page component | request-response (read) | itself: existing 5-tab pattern (queue/users/health/logs/stats) | self-extension |
| backend/src/routes/ai.ts (MODIFY — replace hardcoded gpt-4.1/deepseek-chat) | proxy route | request-response | itself line 86 (model assignment) | self-replacement |
| backend/src/routes/settings.ts (MODIFY — validate-key returns capabilities + model_not_found) | route | request-response | itself line 386 (existing validate-key handler) | self-extension |
| backend/src/db/schema.ts (MODIFY — add table export) | data layer | n/a | itself: existing tables `platform_viral_patterns`, `trend_cache` | self-extension |
| backend/src/lib/boss.ts (MODIFY — register provider-health-check) | bootstrap | event-driven | itself line 71 `registerResearchRefreshJob` | self-extension |
| backend/src/index.ts (MODIFY — invoke registerProviderHealthCheckJob) | bootstrap | startup | itself line 47-51 (existing register calls) | self-extension |
| backend/package.json (MODIFY — add @google/genai, remove @google/generative-ai) | config | static | n/a | self-modification |
| frontend/src/lib/models.test.ts | test (unit) | n/a | frontend/src/lib/types.test.ts (when present); fallback: existing `engine.parseMeta.test.ts` pattern | role-match |
| backend/tests/lib/models.test.ts | test (unit) | n/a | frontend/src/lib/models.test.ts (parity) | sibling |
| backend/tests/lib/provider-health.test.ts | test (integration, pg-mem) | n/a | backend tests using `PatchedPool` for research-cache (per STATE.md line 114) | role-match |
| frontend/src/pages/AdminProviderHealthTab.test.tsx | test (render, happy-dom) | n/a | existing AdminPage tab render tests | role-match |
| frontend/src/lib/ai.parseProviderError.test.ts | test (unit) | n/a | existing ai.ts test scaffolding from Phase 10 | role-match |

---

## Wave grouping (matches RESEARCH plan-split recommendation)

- **Wave 1 — Constants:** `frontend/src/lib/models.ts`, `backend/src/lib/models.ts`, `backend/shared/model-ids.json`, parity unit tests
- **Wave 2 — Backend route + ai.ts proxy + error parser:** `backend/src/routes/ai.ts` (model bumps), `backend/src/routes/settings.ts` (extend validate-key), `frontend/src/lib/ai.ts` (model bumps + `model_not_found` discriminant), `backend/package.json` (`@google/genai`)
- **Wave 3 — Drizzle schema + migration:** new `admin_provider_health` in `backend/src/db/schema.ts`, `drizzle-kit generate` + `migrate`
- **Wave 4 — pg-boss job:** `backend/src/lib/provider-health-check.ts`, `backend/src/lib/boss.ts` (`registerProviderHealthCheckJob`), `backend/src/index.ts` (call site), env vars in `.env.example`, `GET /api/admin/provider-health` route in `backend/src/routes/admin.ts`
- **Wave 5 — Admin UI tab + Settings UI:** `frontend/src/pages/AdminPage.tsx` (6th tab), `frontend/src/pages/SettingsPage.tsx` (model dropdown + capability badges + `model_not_found` banner), render tests

---

## Pattern Assignments — Wave 1 (Constants)

### `frontend/src/lib/models.ts` (NEW)

**Role:** constants module — single source of truth for AI model IDs + capability matrix
**Closest analog:** `frontend/src/lib/types.ts` (existing const-export style with grouped exports)
**Wave:** 1

**Pattern excerpt** (from `frontend/src/lib/types.ts:1-21`):
```typescript
export type Screen = 'generator' | 'settings' | 'history' | 'learning' | 'admin' | 'research'

export type AIProvider = 'claude' | 'gemini' | 'openai' | 'deepseek'
export const AI_PROVIDERS: AIProvider[] = ['claude', 'gemini', 'openai', 'deepseek']

export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'x'
export const ALL_PLATFORMS: Platform[] = ['youtube', 'instagram', 'tiktok', 'facebook', 'x']

export interface SettingsResponse {
  ai_provider: AIProvider
  api_key_masked: string | null
  default_niche: string
  enabled_platforms: string[]
  available_niches: string[]
  connected: { youtube: boolean; instagram: boolean; facebook: boolean }
  timezone: 'Asia/Karachi'
}
```

**Replication notes:**
- Re-use the existing `AIProvider` union from `types.ts`: `import type { AIProvider } from './types'` (do NOT redefine — would drift the union).
- Mirror the discriminated-record shape from RESEARCH.md §"Capability Matrix Design" lines 215-231: `export const MODELS: Record<string, ModelEntry>` + derived `MODELS_BY_PROVIDER`.
- Per RESEARCH Pitfall 9: a type-only re-export should be available — `export type { ModelEntry, ModelCapabilities }` — so callers that need only types do not pay the ~2 KB const cost.
- All 8 model entries populated verbatim from RESEARCH §"Locked initial values" (lines 246-308). NO placeholder strings (CLAUDE.md content rule).
- Default model selection helper: `export function defaultModelFor(provider: AIProvider): string` — picks first `tier: 'flagship'` entry from `MODELS_BY_PROVIDER[provider]` (per RESEARCH open question 5).

**Wire-up:**
- Imported by: `frontend/src/lib/ai.ts` (replace `'gemini-2.5-flash'` line 219 + `'claude-sonnet-4-5'` line 258), `frontend/src/pages/SettingsPage.tsx` (model dropdown population), `frontend/src/lib/models.test.ts` (parity test)
- Registered in: nowhere (pure module) — but `MODELS` is the import target for every callsite that previously had a hardcoded ID

---

### `backend/src/lib/models.ts` (NEW)

**Role:** parallel constants module (byte-identical exports to frontend sibling)
**Closest analog:** `backend/src/lib/encryption.ts` (a tightly-scoped utility module with explicit named exports + comment on the layout invariant); for sibling parity, `frontend/src/lib/models.ts` itself
**Wave:** 1

**Pattern excerpt** (from `backend/src/lib/encryption.ts:1-18`):
```typescript
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm' as const
const SALT_LEN = 16
const IV_LEN = 12 // CLAUDE.md: 12 bytes / 96-bit NIST standard for GCM
const KEY_LEN = 32
const TAG_LEN = 16

// Layout written to DB column: base64( [salt(16)] [iv(12)] [tag(16)] [ciphertext] )
// Key derivation: scryptSync(masterKey, salt, KEY_LEN)
```

**Replication notes:**
- The "comment block at top documenting the invariant" is the load-bearing pattern — for `models.ts`, the invariant comment should read: `// PARITY: must export identical MODELS keys to frontend/src/lib/models.ts. Enforced by backend/tests/lib/models.test.ts against backend/shared/model-ids.json.`
- Use `.js` extensions in import specifiers (backend is ESM): e.g., `import type { AIProvider } from '../types/index.js'` — NOT the frontend's extensionless style.
- Capability matrix type can be declared once here and re-declared in frontend (acceptable per RESEARCH §"Single Source of Truth Pattern" option A); the parity test only locks the ID set, not the type definitions, so minor type drift is tolerable.

**Wire-up:**
- Imported by: `backend/src/routes/ai.ts` (replace `'gpt-4.1'` + `'deepseek-chat'` line 86), `backend/src/routes/settings.ts` (replace 3 stale IDs at lines 425/438/446), `backend/src/lib/provider-health-check.ts` (iterate `Object.values(MODELS)`), `backend/tests/lib/models.test.ts`
- Registered in: nowhere (pure module)

---

### `backend/shared/model-ids.json` (NEW)

**Role:** manifest — sorted array of model ID strings, the parity oracle
**Closest analog:** **NONE** — no JSON config files in the repo. Use a minimal pattern.
**Wave:** 1

**Pattern excerpt** (synthesized — no analog):
```json
[
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
  "gpt-5.5",
  "gpt-5.5-pro"
]
```

**Replication notes:**
- Bare sorted JSON array — no wrapper object. Keeps the parity test trivially: `expect(Object.keys(MODELS).sort()).toEqual(manifest)`.
- Location `backend/shared/` (NOT inside `src/`) so the frontend test can `import` it via relative path `../../../backend/shared/model-ids.json` per RESEARCH line 333 (or commit it under `.planning/notes/model-ids.json` if cross-package import causes Vite/tsc complaints — confirm in Wave 1 task 1).
- File extension matters for both Vite and tsx: both support `import json from '...json'` out of the box.

**Wire-up:**
- Imported by: `frontend/src/lib/models.test.ts`, `backend/tests/lib/models.test.ts`
- Registered in: nowhere

---

### `frontend/src/lib/models.test.ts` and `backend/tests/lib/models.test.ts` (NEW — parity tests)

**Role:** unit test asserting MODELS ID set matches shared manifest
**Closest analog:** existing Vitest specs under `frontend/src/lib/` (e.g., `engine.parseMeta.test.ts`)
**Wave:** 1

**Pattern excerpt** (synthesized from RESEARCH lines 328-335 + existing Vitest conventions):
```typescript
import { describe, test, expect } from 'vitest'
import { MODELS } from './models'
import manifest from '../../../backend/shared/model-ids.json'

describe('MODELS parity with shared manifest', () => {
  test('frontend MODELS keys equal manifest IDs (sorted)', () => {
    expect(Object.keys(MODELS).sort()).toEqual([...manifest].sort())
  })

  test('every MODEL has non-empty provider + tier + capabilities', () => {
    for (const m of Object.values(MODELS)) {
      expect(m.provider).toMatch(/^(gemini|claude|openai|deepseek)$/)
      expect(m.tier).toMatch(/^(flagship|fast|premium|experimental)$/)
      expect(m.capabilities.text).toBe(true) // every model supports text
    }
  })
})
```

**Replication notes:**
- Backend twin (`backend/tests/lib/models.test.ts`) imports `from '../../shared/model-ids.json'` — different relative depth.
- Per CLAUDE.md content rule: NO placeholder "TODO" tests — assertions must be real.

**Wire-up:**
- Run by: `npm --prefix frontend run test:run` and `npm --prefix backend test` (Vitest auto-discovers)
- Registered in: vitest project config (already discovers `*.test.ts`)

---

## Pattern Assignments — Wave 2 (Routes + Error Parser)

### `frontend/src/lib/ai.ts` (MODIFY — model bumps + `model_not_found` discriminant)

**Role:** utility / error normaliser
**Closest analog:** ITSELF — the existing `parseProviderError` function (lines 321-397) has 4 provider branches; add `model_not_found` to each
**Wave:** 2

**Pattern excerpt** (from `frontend/src/lib/ai.ts:331-342` — Claude branch as template):
```typescript
if (provider === 'claude') {
  const type = errObj?.['type']
  if (type === 'authentication_error') {
    return { kind: 'invalid_key', message: 'API key rejected by Claude. Update it in Settings.', retryable: false }
  }
  if (type === 'rate_limit_error') {
    return { kind: 'rate_limited', message: 'Claude rate limit reached. Wait a moment and retry.', retryable: true }
  }
  if (type === 'overloaded_error') {
    return { kind: 'model_busy', message: 'Claude is busy right now. Try again in a moment.', retryable: true }
  }
}
```

**Replication notes:**
- Add `model_not_found` to the `AIErrorKind` union (line 305) BEFORE the catch-all `'unparseable'`.
- Per RESEARCH Pitfall 3, Claude's nested error shape is `err.error.error.type === 'not_found_error'` (triple nesting) — the existing code only walks one level via `errObj?.['type']`. The new check must walk `(errObj as any)?.['error']?.['type']` OR add a top-level `raw?.['status'] === 404` fallback per RESEARCH §"model_not_found Error Discriminant".
- For OpenAI/DeepSeek branches, key on `code === 'model_not_found'` OR `status === 404` (per RESEARCH Pitfall 4 — do NOT key on `type`).
- For Gemini branch, key on `status === 'NOT_FOUND'` OR `message.match(/model.*not found/i)` (per RESEARCH Pitfall 6 — no typed NotFoundError class).
- The 2 hardcoded model IDs in `callAI` (line 219 `'gemini-2.5-flash'`, line 258 `'claude-sonnet-4-5'`) must be sourced from `MODELS[settings.model_id ?? defaultModelFor(provider)].id` — settings shape change is required (see SettingsPage notes below).
- The DeepSeek branch at line 283 has a `// DeepSeek-chat does not support vision` comment that must be rewritten to reference `MODELS[modelId].capabilities.vision` per RESEARCH lines 683-694.

**Wire-up:**
- Imported by: `frontend/src/pages/GeneratorPage.tsx` (existing — surfaces the kind in the error banner), `frontend/src/pages/SettingsPage.tsx` (NEW — must check `kind === 'model_not_found'` after validate-key call to show distinct UI)
- Registered in: n/a

---

### `backend/src/routes/ai.ts` (MODIFY — replace `gpt-4.1` and `deepseek-chat`)

**Role:** proxy route — OpenAI-compatible AI generation
**Closest analog:** ITSELF — single-line model assignment + baseURL string
**Wave:** 2

**Pattern excerpt** (from `backend/src/routes/ai.ts:66-94`):
```typescript
const isDeepSeek = provider === 'deepseek'
const openai = new OpenAI({
  apiKey,
  ...(isDeepSeek ? { baseURL: 'https://api.deepseek.com/v1' } : {}),
})

// ...

const model = isDeepSeek ? 'deepseek-chat' : 'gpt-4.1'

try {
  const completion = await openai.chat.completions.create({
    model,
    max_tokens: 2048,
    messages: [{ role: 'user', content }],
    response_format: { type: 'json_object' },
  })
```

**Replication notes:**
- Two surgical edits:
  1. Line 70: `'https://api.deepseek.com/v1'` → `'https://api.deepseek.com'` (RESEARCH Pitfall 7).
  2. Line 86: `const model = isDeepSeek ? 'deepseek-chat' : 'gpt-4.1'` → `const model = isDeepSeek ? MODELS['deepseek-v4-flash'].id : MODELS['gpt-5.5'].id` (or `defaultModelFor('deepseek') / defaultModelFor('openai')` if introducing the helper).
- Preserve the existing `OpenAI.APIError` handling block (lines 100-122) verbatim — it already covers `status === 401`, `429`, `5xx`. Optionally extend with `if (status === 404 || (err as any).code === 'model_not_found')` mapping to a `userMessage: 'Selected model unavailable. Update in Settings.'` + `retryable: false` — symmetric with the frontend addition.

**Wire-up:**
- No new import wires; just `import { MODELS } from '../lib/models.js'` at top.
- Registered in: `backend/src/index.ts` (already mounted at `/api/ai` — unchanged)

---

### `backend/src/routes/settings.ts` (MODIFY — extend `validate-key` to verify model + return capabilities)

**Role:** route — POST handler with three SDK branches
**Closest analog:** ITSELF — existing `POST /validate-key` (lines 386-502) already has provider-discriminated branches with try/catch + status-code mapping
**Wave:** 2

**Pattern excerpt** (from `backend/src/routes/settings.ts:417-449`):
```typescript
try {
  if (provider === 'openai' || provider === 'deepseek') {
    const isDeepSeek = provider === 'deepseek'
    const openai = new OpenAI({
      apiKey: key.trim(),
      ...(isDeepSeek ? { baseURL: 'https://api.deepseek.com/v1' } : {}),
    })

    const model = isDeepSeek ? 'deepseek-chat' : 'gpt-4.1'

    // Make a minimal test call with very short timeout expectations
    await openai.chat.completions.create({
      model, max_tokens: 10, messages: [{ role: 'user', content: 'test' }],
    })
    isValid = true
  } else if (provider === 'claude') {
    const anthropic = new Anthropic({ apiKey: key.trim() })
    await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022', max_tokens: 10,
      messages: [{ role: 'user', content: 'test' }],
    })
    isValid = true
  } else if (provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(key.trim())
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    await model.generateContent('test')
    isValid = true
  }
}
```

**Replication notes:**
- Swap from generation probe (`chat.completions.create({ max_tokens: 10 })`) to **`models.retrieve(modelId)`** per RESEARCH §"Extending POST /api/settings/validate-key" — costs $0, distinguishes 401 from 404 cleanly.
- Accept new optional `model_id?: string` in `ValidateKeyBody` (line 381); default to `defaultModelFor(provider)` when omitted.
- Response shape changes from `{ valid, error? }` to the full `ValidateKeyResponse` from RESEARCH lines 356-370 (`valid`, `key_valid`, `model_valid`, `error_kind`, `error_message?`, `capabilities?`, `model_id`). Existing frontend caller at `SettingsPage.tsx:95` reads only `valid` + `error` — backward-compat both fields kept.
- Pitfall 5: replace `import { GoogleGenerativeAI } from '@google/generative-ai'` (line ~3) with `import { GoogleGenAI } from '@google/genai'`. Replace `genAI.getGenerativeModel({ model: ... })` shape with `new GoogleGenAI({ apiKey }).models.get({ model: modelId })`.
- Pitfall 7: change `baseURL: 'https://api.deepseek.com/v1'` to `'https://api.deepseek.com'` (line 422).
- Error discrimination block (lines 456-496): add `if (err instanceof OpenAI.NotFoundError || err.status === 404 || (err as any).code === 'model_not_found')` → set `error_kind: 'model_not_found'`, `key_valid: true`, `model_valid: false`. Symmetric for Anthropic.NotFoundError. For Google: `(err as any).status === 'NOT_FOUND'`.

**Wire-up:**
- Imports added: `MODELS`, `defaultModelFor` from `../lib/models.js`; `GoogleGenAI` from `@google/genai`
- Imports removed: `GoogleGenerativeAI` from `@google/generative-ai` (only if no other callers — verify with grep)
- Registered in: `backend/src/index.ts` (existing — settingsRouter already mounted)

---

### `backend/package.json` (MODIFY — add `@google/genai`)

**Role:** dependency manifest
**Closest analog:** itself
**Wave:** 2 (must precede backend code import)

**Replication notes:**
- Add `"@google/genai": "^1.51.0"` to `dependencies` (mirrors frontend version per RESEARCH line 113).
- After Wave 2 settings.ts edit, grep `@google/generative-ai` in backend; if zero remaining callers, remove the dep. If any caller remains, keep both temporarily and document a Phase 11.5 cleanup task.

**Wire-up:**
- Imported by: `backend/src/routes/settings.ts`, `backend/src/lib/provider-health-check.ts`
- Registered in: lockfile after `npm install`

---

## Pattern Assignments — Wave 3 (Drizzle Schema)

### `backend/src/db/schema.ts` (MODIFY — append `admin_provider_health` table)

**Role:** Drizzle table definition (no RLS — admin-scoped)
**Closest analog:** `backend/src/db/schema.ts` `trend_cache` (lines 188-196 — global cache, no `user_id`, no RLS) and `platform_viral_patterns` (lines 293-304 — no RLS, composite unique + index, integer + jsonb columns)
**Wave:** 3

**Pattern excerpt** (from `backend/src/db/schema.ts:188-196` — `trend_cache` analog for no-RLS shared tables):
```typescript
export const trend_cache = pgTable('trend_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source').notNull(),
  niche: text('niche').notNull(),
  data: jsonb('data').$type<TrendItem[]>().notNull().default([]),
  fetched_at: timestamp('fetched_at').defaultNow().notNull(),
}, (table) => [
  unique('trend_cache_source_niche_unique').on(table.source, table.niche),
])
```

**Pattern excerpt** (from `backend/src/db/schema.ts:293-304` — `platform_viral_patterns` for indexes-only no-RLS):
```typescript
export const platform_viral_patterns = pgTable('platform_viral_patterns', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: text('platform').notNull(),
  niche: text('niche').notNull(),
  related_niches: text('related_niches').array().notNull().default([]),
  view_tier: text('view_tier').notNull(),
  pattern_data: jsonb('pattern_data').$type<PlatformPatternData>().notNull(),
  last_updated: timestamp('last_updated').defaultNow().notNull(),
}, (table) => [
  unique('platform_viral_patterns_unique').on(table.platform, table.niche, table.view_tier),
  index('platform_viral_patterns_platform_niche_idx').on(table.platform, table.niche),
])
```

**Replication notes:**
- Use **inline append to schema.ts** (NOT a separate file under `db/schema/`) — current convention is single-file schema. Append after `platform_viral_patterns` (around line 304).
- Verbatim from RESEARCH §"admin_provider_health Schema" (lines 637-654):
  - 6 columns: `id` uuid PK, `provider` text NOT NULL, `model_id` text NOT NULL, `status` text NOT NULL, `latency_ms` integer NOT NULL, `error_message` text NULL, `checked_at` timestamp default now NOT NULL
  - NO `user_id`, NO `foreignKey` to `authUsers`, NO `pgPolicy` (admin-scoped only — matches `trend_cache` pattern)
  - Two indexes: composite `(provider, model_id, checked_at)` for "latest per model" query; standalone `(checked_at)` for cleanup
- Per CLAUDE.md "Database" rule and RESEARCH Pitfall 2: run `npx drizzle-kit generate` (NOT `push`); inspect generated migration to confirm it only creates the new table and does NOT touch RLS policies on existing tables.

**Wire-up:**
- Imported by: `backend/src/lib/provider-health-check.ts` (`db.insert(admin_provider_health).values(...)`), `backend/src/routes/admin.ts` (the new `GET /provider-health` handler)
- Registered in: schema.ts itself (drizzle-kit auto-discovers exports from this file)

---

## Pattern Assignments — Wave 4 (pg-boss Job + Admin Route)

### `backend/src/lib/provider-health-check.ts` (NEW)

**Role:** pg-boss worker — iterates MODELS, pings each, writes results
**Closest analog:** `backend/src/lib/research-cache.ts:refreshAllNiches` (called by `registerResearchRefreshJob` — same fail-partial + bulk-insert pattern). The registration glue analog is `backend/src/lib/boss.ts:71-91`.
**Wave:** 4

**Pattern excerpt** (from `backend/src/lib/boss.ts:71-91` — `registerResearchRefreshJob` — the registration twin):
```typescript
export async function registerResearchRefreshJob(bossInstance: PgBoss): Promise<void> {
  // CRITICAL: createQueue() BEFORE schedule() — pg-boss v12 FK constraint
  // pgboss.schedule.name has a FK referencing pgboss.queue.name
  await bossInstance.createQueue('refresh-trends')

  try {
    await bossInstance.schedule('refresh-trends', '0 5 * * *', {})
  } catch (err: unknown) {
    const msg = (err as Error).message ?? ''
    if (!msg.includes('duplicate') && !msg.includes('unique')) throw err
  }

  await bossInstance.work<Record<string, never>>('refresh-trends', async (_jobs) => {
    // Lazy import to avoid circular dep: research-cache imports db, boss imports nothing from db
    const { refreshAllNiches } = await import('./research-cache.js')
    await refreshAllNiches()
    console.log('[pg-boss] refresh-trends completed')
  })

  console.log('[pg-boss] refresh-trends job registered')
}
```

**Replication notes:**
- Job logic file `provider-health-check.ts` exports a single `runProviderHealthCheck()` async function — mirrors `refreshAllNiches()`.
- Per RESEARCH §"Weekly Provider Health Check" (lines 504-612): two-stage probe per (provider, model) — `models.retrieve()` ($0) + `chat.completions.create({ max_tokens: 1 })` (~$0.0002).
- Fail-partial isolation: each (provider, model) wrapped in its own try/catch; one failure does not abort the loop. Each result pushed into a `results: HealthResult[]` array, then bulk-inserted in one `db.insert(admin_provider_health).values(results.map(...))`.
- System-level keys from env (RESEARCH §"Service-level vs user keys"): `process.env.HEALTHCHECK_OPENAI_KEY`, `HEALTHCHECK_ANTHROPIC_KEY`, `HEALTHCHECK_GOOGLE_KEY`, `HEALTHCHECK_DEEPSEEK_KEY`. If any is missing, write an `error: 'no key configured'` row (do NOT throw).
- Inline cleanup at end (RESEARCH lines 603-611): raw `db.execute(sql\`DELETE ... WHERE id NOT IN (SELECT ... ROW_NUMBER() OVER (PARTITION BY provider, model_id ORDER BY checked_at DESC) ...\`)\` — keep last 30 rows per (provider, model_id).
- Lazy import in worker callback to avoid circular dep — same pattern as `refresh-trends`: `const { runProviderHealthCheck } = await import('./provider-health-check.js')`.
- Cron schedule per RESEARCH line 484: `'0 7 * * 1'` (Mondays 7am UTC = noon PKT, low-traffic window).

**Wire-up:**
- Imported by: `backend/src/lib/boss.ts` (`registerProviderHealthCheckJob` — new function alongside existing 4)
- Registered in: `backend/src/index.ts` — add `await registerProviderHealthCheckJob(boss)` after line 51 (next to other Phase 11 registrations); pattern mirrors existing 4 calls at lines 47-51.

---

### `backend/src/lib/boss.ts` (MODIFY — add `registerProviderHealthCheckJob`)

**Role:** bootstrap — pg-boss queue + schedule + worker registration
**Closest analog:** ITSELF — three existing identical functions (`registerCleanupJob`, `registerPatternUpdateJob`, `registerResearchRefreshJob`)
**Wave:** 4

See excerpt above (`registerResearchRefreshJob`). Copy this function verbatim, change queue name to `'provider-health-check'`, cron to `'0 7 * * 1'`, and lazy-import target to `./provider-health-check.js`.

**Replication notes:**
- The duplicate-schedule swallow (`if (!msg.includes('duplicate') && !msg.includes('unique')) throw err`) is load-bearing — pg-boss v12 schedule() is non-idempotent on restart. Keep verbatim.
- Per RESEARCH Pitfall 1 (verified twice in STATE.md + boss.ts): `createQueue()` MUST precede `schedule()` — pg-boss v12 FK constraint on `pgboss.schedule.name → pgboss.queue.name`.

**Wire-up:**
- Exported from: `backend/src/lib/boss.ts`
- Invoked at: `backend/src/index.ts:51` (add new line after `registerResearchRefreshJob(boss)`)

---

### `backend/src/index.ts` (MODIFY — register the new job)

**Role:** bootstrap call site
**Closest analog:** ITSELF — lines 47-51 already register 4 jobs in sequence
**Wave:** 4

**Pattern excerpt** (from `backend/src/index.ts:47-51`):
```typescript
await registerCleanupJob(boss)
await registerMetaTokenRefreshJob(boss)  // Phase 2 SETTINGS-07
// ... (one Phase 11 line)
await registerPatternUpdateJob(boss)     // Phase 11: update viral patterns daily
await registerResearchRefreshJob(boss)  // Phase 9 RESEARCH-06
```

**Replication notes:**
- Add: `await registerProviderHealthCheckJob(boss)  // Phase 11 VERIFY-05: weekly provider health probe (Mondays 7am UTC)`
- Import update at line 4: extend the named import from `./lib/boss.js` to include `registerProviderHealthCheckJob`.

**Wire-up:**
- Called at: server startup
- Registered in: n/a (this is the registration site)

---

### `backend/src/routes/admin.ts` (MODIFY — add `GET /api/admin/provider-health`)

**Role:** admin route — read aggregated health table
**Closest analog:** `backend/src/routes/admin.ts` `GET /stats/platforms` (lines 337-405 — aggregates raw SQL, returns shaped JSON)
**Wave:** 4

**Pattern excerpt** (from `backend/src/routes/admin.ts:337-370`):
```typescript
adminRouter.get('/stats/platforms', async (_req, res) => {
  // Aggregate upload stats from platform_posts — group by platform
  const uploadStatsRows = await db.execute<{
    platform: string
    total: string
    succeeded: string
    failed: string
  }>(
    sql`
      SELECT
        platform,
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE upload_status = 'posted')::text AS succeeded,
        COUNT(*) FILTER (WHERE upload_status = 'failed')::text AS failed
      FROM platform_posts
      GROUP BY platform
      ORDER BY total DESC
    `
  )
```

**Replication notes:**
- Inline the new handler in `admin.ts` (DO NOT split into `admin/provider-health.ts` — current convention is single-file admin router with one `adminRouter.get/post/delete` per endpoint).
- Per RESEARCH §"Phase Requirements" VERIFY-06: response shape should include last successful ping per (provider, model), capability matrix (from MODELS), and latency p95 over last 7 days. Two SQL queries (DISTINCT ON for latest + percentile_cont for p95), then merge with `MODELS` for capability data:
  ```typescript
  const latest = await db.execute(sql`
    SELECT DISTINCT ON (provider, model_id) provider, model_id, status, latency_ms, error_message, checked_at
    FROM admin_provider_health
    ORDER BY provider, model_id, checked_at DESC
  `)
  const p95 = await db.execute(sql`
    SELECT provider, model_id,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms
    FROM admin_provider_health
    WHERE checked_at > NOW() - INTERVAL '7 days' AND status = 'ok'
    GROUP BY provider, model_id
  `)
  ```
- Merge: for each entry in `MODELS`, attach matching `latest` row + `p95` + capability matrix. Models with NO row in `admin_provider_health` (never pinged) get `status: 'unknown'`, `latency_ms: null`.
- `adminMiddleware` is already applied to the entire `adminRouter` at line 28 — no per-route auth needed.

**Wire-up:**
- Imports added at top of `admin.ts`: `MODELS` from `../lib/models.js`, `admin_provider_health` from `../db/schema.js`
- Mounted: `/api/admin/provider-health` (router-relative `/provider-health`)
- Frontend caller: NEW `fetchAdminProviderHealth()` in `frontend/src/lib/api.ts` (mirrors `fetchAdminPlatformStats()` shape)

---

### `backend/tests/lib/provider-health.test.ts` (NEW)

**Role:** integration test — pg-mem `PatchedPool` per STATE.md line 114
**Closest analog:** existing backend tests using pg-mem (verify path during planning)
**Wave:** 4

**Pattern notes (no concrete excerpt — analog file not read this pass):**
- Use `PatchedPool` from STATE.md line 114 — same setup as research-cache tests.
- Mock each SDK client (`OpenAI`, `Anthropic`, `GoogleGenAI`) via `vi.mock(...)` — return successful `models.retrieve` for some entries, throw `{ status: 404 }` for others (per RESEARCH VERIFY-05b "fail-partial").
- Assert N rows inserted; assert one provider's failure does not block insertion of others.
- Cleanup test: pre-seed 35 rows per (provider, model), run job, assert exactly 30 remain (RESEARCH VERIFY-05c).

**Wire-up:**
- Run by: `npm --prefix backend test`
- Registered in: vitest project config (already discovers `tests/**/*.test.ts`)

---

## Pattern Assignments — Wave 5 (Admin UI + Settings UI)

### `frontend/src/pages/AdminPage.tsx` (MODIFY — add 6th "Provider Health" tab)

**Role:** page component — add tab to existing 5-tab pattern
**Closest analog:** ITSELF — existing 5 tabs (queue/users/health/logs/stats)
**Wave:** 5

**Pattern excerpt** (from `frontend/src/pages/AdminPage.tsx:18` and lines 183-189):
```typescript
type AdminTab = 'queue' | 'users' | 'health' | 'logs' | 'stats'
// ...
const TABS: { id: AdminTab; label: string }[] = [
  { id: 'queue',  label: 'Queue' },
  { id: 'users',  label: 'Users' },
  { id: 'health', label: 'Health' },
  { id: 'logs',   label: 'Logs' },
  { id: 'stats',  label: 'Stats' },
]
```

**Pattern excerpt** (per-tab data-loading pattern from lines 49-63):
```typescript
const loadJobs = useCallback(async () => {
  setJobsLoading(true)
  setJobsError(null)
  try {
    setJobs(await fetchAdminJobs(showAllJobs))
  } catch {
    setJobsError('Failed to load jobs.')
  } finally {
    setJobsLoading(false)
  }
}, [showAllJobs])

useEffect(() => {
  if (activeTab === 'queue') void loadJobs()
}, [activeTab, loadJobs])
```

**Replication notes:**
- Extend the union: `type AdminTab = 'queue' | 'users' | 'health' | 'logs' | 'stats' | 'providers'`
- Append to TABS array: `{ id: 'providers', label: 'Providers' }`
- Add `providerHealth` state (loading / error / data) following the exact 3-state pattern used by `jobs`/`users`/`stats`.
- Add `loadProviderHealth` useCallback + `useEffect` watching `activeTab === 'providers'`.
- New API client function `fetchAdminProviderHealth()` in `frontend/src/lib/api.ts` (mirrors `fetchAdminPlatformStats()`).
- Render block: list of `ProviderHealthCard` showing provider + model + status badge (reuse `JOB_STATE_STYLES` shape — green for 'ok', red for 'model_not_found'/'invalid_key', amber for 'rate_limited') + latency p95 + capability badges from `MODELS[model_id].capabilities` + `Last updated: X ago` (RESEARCH Pitfall 10 — NO auto-poll, manual Refresh button).
- Render markup style: copy verbatim from the existing `{activeTab === 'queue' && ...}` block (lines 226-305) — same `rounded-lg bg-zinc-900 border border-zinc-800` card style.

**Wire-up:**
- Imports added: `MODELS` from `../lib/models`, `fetchAdminProviderHealth` from `../lib/api`, new `AdminProviderHealth` type from `../lib/types`
- Registered in: itself (App.tsx routes `screen === 'admin'` to AdminPage — unchanged)

---

### `frontend/src/pages/SettingsPage.tsx` (MODIFY — model dropdown + capability badges + `model_not_found` banner)

**Role:** page component
**Closest analog:** ITSELF — existing `validateApiKey()` (lines 73-106) + provider dropdown
**Wave:** 5

**Pattern excerpt** (from `frontend/src/pages/SettingsPage.tsx:80-105` — validate-key call shape):
```typescript
setValidating(true)
setValidationResult(null)
try {
  const res = await apiFetch('/settings/validate-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: data.ai_provider,
      api_key: keyDraft.trim(),
    }),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({} as { error?: string }))
    throw new Error((j as { error?: string }).error ?? `Validation failed (${res.status})`)
  }
  const result = await res.json() as { valid: boolean; error?: string }
  setValidationResult(result)
  if (result.valid) {
    setError(null)
  }
}
```

**Replication notes:**
- Extend `ValidationResult` type to the new `ValidateKeyResponse` shape (RESEARCH lines 356-370): include `key_valid`, `model_valid`, `error_kind`, `capabilities`.
- Add `model_id` to the POST body: `body: JSON.stringify({ provider: data.ai_provider, api_key: keyDraft.trim(), model_id: selectedModelId })`.
- New state: `const [selectedModelId, setSelectedModelId] = useState<string>(defaultModelFor(data.ai_provider))`. Reset when `data.ai_provider` changes.
- Add a `<select>` populated by `MODELS_BY_PROVIDER[data.ai_provider].map(m => <option key={m.id} value={m.id}>{m.displayName}</option>)`, placed adjacent to the existing provider dropdown.
- On validation result with `error_kind === 'model_not_found'`: render distinct red banner "Model unavailable. Pick a different model below." (vs invalid_key: "API key rejected. Re-check the key."). Existing banner styling at line 252 (`bg-red-900/40 px-3 py-2 text-sm text-red-300`) is the template.
- On `valid: true`: render capability badges (small chips "Text · Vision · Video · Audio") from `result.capabilities`. Use existing chip pattern from AdminPage line 336 (`rounded px-1.5 py-0.5 text-xs`).

**Wire-up:**
- Imports added: `MODELS_BY_PROVIDER`, `defaultModelFor` from `../lib/models`
- Registered in: itself

---

### `frontend/src/pages/AdminPage.providerHealth.test.tsx` and `frontend/src/lib/ai.parseProviderError.test.ts` (NEW tests)

**Role:** render + unit tests
**Closest analog:** existing tab tests in AdminPage area + any existing ai.ts test scaffolding
**Wave:** 5

**Replication notes:**
- Render test: mount AdminPage with mocked `fetchAdminProviderHealth` returning a fixture of 8 health rows; assert "Providers" tab clickable; assert capability badges rendered; assert "model_not_found" red badge appears for fixture row with that status.
- ai.parseProviderError test: feed 4 providers × 5 error shapes (401, 404 with model_not_found code, 429, 500, generic) → assert each returns expected kind. Per RESEARCH Pitfall 3, include a specific test for Claude's triple-nested error shape: `{ status: 404, error: { error: { type: 'not_found_error' } } }`.
- Per CLAUDE.md content rule: no placeholder test bodies.

**Wire-up:**
- Run by: `npm --prefix frontend run test:run`
- Registered in: vitest config (auto-discovery)

---

## Shared Patterns

### Pattern: pg-boss job registration (queue + schedule + worker)

**Source:** `backend/src/lib/boss.ts:71-91` (and 4 sibling functions in same file)
**Apply to:** `registerProviderHealthCheckJob` (Wave 4)

```typescript
await bossInstance.createQueue('<queue-name>')   // FK constraint requires this FIRST
try {
  await bossInstance.schedule('<queue-name>', '<cron>', {})
} catch (err: unknown) {
  const msg = (err as Error).message ?? ''
  if (!msg.includes('duplicate') && !msg.includes('unique')) throw err
}
await bossInstance.work<Record<string, never>>('<queue-name>', async (_jobs) => {
  const { runJobBody } = await import('./<job-file>.js')   // lazy — avoid circular dep
  await runJobBody()
  console.log('[pg-boss] <queue-name> completed')
})
```

### Pattern: admin route handler (no per-route auth — middleware applied at router level)

**Source:** `backend/src/routes/admin.ts:28` + any handler (e.g., line 337 `/stats/platforms`)
**Apply to:** `GET /api/admin/provider-health` (Wave 4)

```typescript
adminRouter.use(adminMiddleware)   // line 28 — ALL routes guarded
// ...
adminRouter.get('/<endpoint>', async (_req, res) => {
  const rows = await db.execute<{ /* shape */ }>(sql`...`)
  res.json({ ... })
})
```

### Pattern: error parser — provider-discriminated mapping to `AIErrorKind`

**Source:** `frontend/src/lib/ai.ts:321-397` (existing `parseProviderError`)
**Apply to:** addition of `model_not_found` discriminant (Wave 2)

```typescript
if (provider === '<provider>') {
  const code = errObj?.['code'] /* or type / status */
  if (code === '<discriminator>') {
    return { kind: '<kind>', message: '<user-facing>', retryable: <bool> }
  }
}
```

### Pattern: no-RLS shared admin/global table

**Source:** `backend/src/db/schema.ts:188-196` (`trend_cache`) and `293-304` (`platform_viral_patterns`)
**Apply to:** `admin_provider_health` (Wave 3)

```typescript
export const <table_name> = pgTable('<table_name>', {
  id: uuid('id').primaryKey().defaultRandom(),
  // ... columns, NO user_id, NO foreignKey to authUsers ...
}, (table) => [
  // NO pgPolicy() — access enforced at route layer via adminMiddleware
  unique('<unique_name>').on(...),
  index('<index_name>').on(...),
])
```

### Pattern: Vitest unit test with sibling parity

**Source:** RESEARCH lines 328-335 (synthesized) + Vitest conventions already used in `frontend/src/lib/*.test.ts`
**Apply to:** `models.test.ts` parity tests (Wave 1)

```typescript
import { describe, test, expect } from 'vitest'
import { MODELS } from './models'
import manifest from '<relative-path>/model-ids.json'

test('MODELS keys match shared manifest', () => {
  expect(Object.keys(MODELS).sort()).toEqual([...manifest].sort())
})
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/shared/model-ids.json` | manifest / parity oracle | static read | No JSON config file exists in the repo. Use minimal sorted-array shape per RESEARCH lines 328-335. |

---

## Metadata

**Analog search scope:** `backend/src/lib/`, `backend/src/routes/`, `backend/src/db/`, `backend/src/index.ts`, `frontend/src/lib/`, `frontend/src/pages/`
**Files read for analog extraction:** 8 (`backend/src/lib/boss.ts`, `backend/src/lib/encryption.ts`, `backend/src/routes/admin.ts`, `backend/src/routes/ai.ts`, `backend/src/routes/settings.ts`, `backend/src/db/schema.ts`, `frontend/src/lib/ai.ts`, `frontend/src/lib/types.ts`, `frontend/src/pages/SettingsPage.tsx`, `frontend/src/pages/AdminPage.tsx`)
**Pattern extraction date:** 2026-05-16
