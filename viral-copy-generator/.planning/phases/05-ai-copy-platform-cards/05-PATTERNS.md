# Phase 5: AI Copy + Platform Cards - Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 9 (4 new + 5 extended)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/lib/ai.ts` (NEW) | service | request-response | `frontend/src/lib/score.ts` | role-match (pure lib function) |
| `frontend/src/lib/prompt.ts` (NEW) | utility/transform | transform | `frontend/src/lib/gaps.ts` | role-match (pure transform function) |
| `frontend/src/components/PlatformCopyCard.tsx` (NEW) | component | request-response | `frontend/src/components/PlatformCardGrid.tsx` | exact (platform-aware card component) |
| `backend/src/routes/ai.ts` (NEW) | route/controller | request-response | `backend/src/routes/settings.ts` | exact (auth-gated route + decrypt + external call) |
| `frontend/src/pages/GeneratorPage.tsx` (EXTEND) | page/component | event-driven | itself (existing) | exact |
| `frontend/src/lib/checklist.ts` (EXTEND) | utility/transform | transform | itself (existing) | exact |
| `frontend/src/lib/types.ts` (EXTEND) | types | — | itself (existing) | exact |
| `frontend/src/lib/api.ts` (EXTEND) | utility | request-response | itself (existing) | exact |
| `backend/src/routes/posts.ts` (EXTEND) | route/controller | CRUD | `backend/src/routes/settings.ts` | exact (auth-gated route with DB insert) |
| `backend/src/app.ts` (EXTEND) | config | — | itself (existing) | exact |

---

## Pattern Assignments

### `frontend/src/lib/ai.ts` (NEW — service, request-response)

**Analog:** `frontend/src/lib/score.ts` (pure lib function structure) + `backend/src/routes/settings.ts` (decrypt + external call pattern, mirrored for backend/ai.ts)

**Imports pattern** (`frontend/src/lib/score.ts` lines 1-9):
```typescript
import type {
  Platform,
  EngineSignals,
  BaselineWeights,
  LearnedWeights,
  ColorBand,
  ScoreResult,
  PerPlatformScores,
} from './types'
```
Copy this style: named type imports with `import type`, all from `./types`.

**Core pattern — provider routing function shape** (modeled after score.ts export pattern, lines 207-220):
```typescript
// score.ts shows the pattern: exported named function with explicit typed params + return type
export function computeScore(
  signals: EngineSignals,
  weights: BaselineWeights = BASELINE_WEIGHTS,
): ScoreResult {
  // ...
}
```
`ai.ts` must export a single `callAI(params: AICallParams): Promise<AIOutput>` following this named-export-per-function pattern with explicit return types.

**Provider branch + error pattern** (modeled after `backend/src/routes/settings.ts` lines 42-49 and 76-103):
```typescript
// settings.ts shows early-return guard + structured error handling:
const rows = await db.select().from(settings).where(eq(settings.user_id, userId)).limit(1)
if (rows.length === 0) {
  const fallback: SettingsResponse = { /* ... */ }
  res.json(fallback)
  return
}
// ... then validate each conditional path with typed narrowing
if (body.ai_provider !== undefined && !VALID_PROVIDERS.includes(body.ai_provider as Provider)) {
  res.status(400).json({ error: 'invalid ai_provider' })
  return
}
```
`ai.ts` should use the same `switch(provider)` with typed narrowing and explicit error throws per branch.

**JSON robustness pattern** (from RESEARCH.md Pattern 5 — no existing analog):
```typescript
// No codebase analog — use RESEARCH.md Pattern 5 directly:
function parseAIOutput(raw: string): AIOutput {
  let text = raw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return emptyAIOutput()
  text = text.slice(start, end + 1)
  try {
    const parsed = JSON.parse(text) as Partial<AIOutput>
    return hydrateAIOutput(parsed)
  } catch {
    return emptyAIOutput()
  }
}
```

---

### `frontend/src/lib/prompt.ts` (NEW — utility, transform)

**Analog:** `frontend/src/lib/gaps.ts` (pure transform function over typed inputs)

**Imports pattern** (`frontend/src/lib/gaps.ts` lines 1-2):
```typescript
import type { ChecklistItem, ChecklistCategory } from './types'
```
Copy this style: `import type` only, from `./types`.

**Core pure-function pattern** (`frontend/src/lib/gaps.ts` lines 25-44):
```typescript
export function buildGapAnalysis(checklist: ChecklistItem[]): string[] {
  // Index by category, preserve insertion order within each category.
  const byCat = new Map<ChecklistCategory, string[]>()
  for (const cat of GAP_GROUP_ORDER) byCat.set(cat, [])

  for (const item of checklist) {
    if (item.status !== 'fail') continue
    if (!item.fix) continue
    const bucket = byCat.get(item.category)
    if (!bucket) continue
    bucket.push(item.fix)
  }
  // ...
  return out
}
```
`prompt.ts` must export `buildPrompt(signals: EngineSignals | null, description: string, niche: Niche, ...): string` — same pattern: single named export, pure function, explicit return type.

**Constants pattern** (`frontend/src/lib/score.ts` lines 14-22 — named exported constants):
```typescript
export const BASELINE_WEIGHTS: BaselineWeights = {
  hook: 0.25,
  pacing: 0.20,
  // ...
}
```
`prompt.ts` should export its niche hashtag bank as a typed const `NICHE_HASHTAGS: Record<Niche, string[]>`.

---

### `frontend/src/components/PlatformCopyCard.tsx` (NEW — component, request-response)

**Analog:** `frontend/src/components/PlatformCardGrid.tsx` (platform-aware card component with per-platform metadata)

**Imports pattern** (`frontend/src/components/PlatformCardGrid.tsx` lines 1-3):
```typescript
import { bandForScore } from '../lib/score'
import { viewRangeFor } from '../lib/viewRange'
import type { Platform, PerPlatformScores, ColorBand } from '../lib/types'
```
Copy this style: lib imports first, then `import type` from types.

**Per-platform metadata constant pattern** (`frontend/src/components/PlatformCardGrid.tsx` lines 9-23):
```typescript
interface PlatformMeta {
  letter: string
  label: string
  circleBg: string
  circleText: string
}

const PLATFORM_META: Record<Platform, PlatformMeta> = {
  youtube:   { letter: 'Y', label: 'YouTube',   circleBg: 'bg-red-600',  circleText: 'text-white' },
  instagram: { letter: 'I', label: 'Instagram', circleBg: 'bg-pink-500', circleText: 'text-white' },
  tiktok:    { letter: 'T', label: 'TikTok',    circleBg: 'bg-black',    circleText: 'text-white' },
  facebook:  { letter: 'F', label: 'Facebook',  circleBg: 'bg-blue-600', circleText: 'text-white' },
  x:         { letter: 'X', label: 'X',         circleBg: 'bg-black',    circleText: 'text-white' },
}
```
`PlatformCopyCard.tsx` must define its own per-platform metadata constant with border + bg classes from CONTEXT.md specifics section:
- YouTube: `border-red-500 bg-red-950`
- Instagram: `border-pink-500 bg-pink-950`
- TikTok: `border-cyan-400 bg-zinc-900`
- Facebook: `border-blue-500 bg-blue-950`
- X: `border-zinc-400 bg-zinc-900`

**Full Tailwind class strings rule** (`frontend/src/components/ScorePanel.tsx` lines 6-11):
```typescript
// D-23 palette: bg / text / border tokens per band, copied verbatim from CONTEXT.md.
// Full Tailwind class strings (not dynamic) so the JIT can detect and ship them.
const BAND_CLASSES: Record<ColorBand, string> = {
  'red':          'bg-red-500 text-white border-red-600',
  'amber':        'bg-amber-500 text-white border-amber-600',
  // ...
}
```
Follow the same rule: all platform Tailwind class strings must be written out in full (no string concatenation), and include a comment explaining why.

**Props interface + default export** (`frontend/src/components/PlatformCardGrid.tsx` lines 35-77):
```typescript
export default function PlatformCardGrid({ perPlatform }: Props) {
  return (
    <div
      data-testid="platform-card-grid"
      className="grid grid-cols-2 gap-2 sm:grid-cols-5"
    >
      {PLATFORM_ORDER.map((p) => {
        // ...
        return (
          <div
            key={p}
            data-testid={`platform-card-${p}`}
            data-platform={p}
            data-band={band}
            className="..."
          >
```
Copy `data-testid` and `data-platform` attribute pattern. `PlatformCopyCard.tsx` receives a single `platform: Platform` prop and should include `data-testid={`platform-copy-card-${platform}`}` and `data-platform={platform}`.

**useState copy-flash pattern** (modeled after `frontend/src/components/ChecklistAccordion.tsx` lines 43-48 — local state per component):
```typescript
// ChecklistAccordion.tsx shows local state toggle pattern:
const [expanded, setExpanded] = useState<Record<ChecklistCategory, boolean>>(() => {
  const init: Record<string, boolean> = {}
  for (const s of SECTIONS) init[s.category] = s.defaultExpanded
  return init as Record<ChecklistCategory, boolean>
})
```
`PlatformCopyCard.tsx` uses `useState<string | null>(null)` for `copied` field ID — same local state pattern, simpler shape.

---

### `backend/src/routes/ai.ts` (NEW — route/controller, request-response)

**Analog:** `backend/src/routes/settings.ts` (auth-gated route + decrypt + external operation + validation)

**Imports pattern** (`backend/src/routes/settings.ts` lines 1-6):
```typescript
import { Router, type Request, type Response } from 'express'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings, type PlatformConfig } from '../db/schema.js'
import { encrypt, decrypt, maskKey } from '../lib/encryption.js'
```
Copy this style exactly: `.js` extensions on local imports (ESM Node.js requirement), named imports from `express`, `type` keyword for type-only imports.

**Auth pattern — `res.locals.userId`** (`backend/src/routes/settings.ts` lines 24-26):
```typescript
settingsRouter.get('/', async (_req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const rows = await db.select().from(settings).where(eq(settings.user_id, userId)).limit(1)
```
`ai.ts` must use the same `res.locals.userId as string` pattern on every handler. This is set by `authMiddleware` at the app level.

**Early-return guard for missing data** (`backend/src/routes/settings.ts` lines 27-35):
```typescript
if (rows.length === 0) {
  const fallback: SettingsResponse = {
    ai_provider: 'gemini',
    api_key_masked: null,
    // ...
  }
  res.json(fallback)
  return
}
```
`ai.ts` uses the same pattern: check for missing `api_key_encrypted`, return `400` early:
```typescript
if (!rows[0]?.api_key_encrypted) {
  res.status(400).json({ error: 'no_api_key' })
  return
}
```

**Decrypt pattern** (`backend/src/routes/settings.ts` lines 42-49):
```typescript
let masked: string | null = null
if (row.api_key_encrypted) {
  try {
    masked = maskKey(decrypt(row.api_key_encrypted))
  } catch {
    // Corrupt or wrong-key ciphertext — surface as null rather than 500
    masked = null
  }
}
```
`ai.ts` calls `decrypt(rows[0].api_key_encrypted)` identically — same try/catch around decrypt. Never expose the decrypted key in the response.

**Error handler wiring** (`backend/src/app.ts` lines 72-77):
```typescript
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'unhandled error')
  // Never expose internal error details to clients (CLAUDE.md Security)
  res.status(500).json({ error: 'Internal Server Error' })
})
```
Express 5 forwards async errors natively — `ai.ts` handlers do NOT need `try/catch` for unexpected errors; only need explicit `try/catch` around `decrypt()` for the known-throw case.

---

### `backend/src/routes/posts.ts` (EXTEND — route/controller, CRUD)

**Analog:** `backend/src/routes/settings.ts` (auth-gated route + DB insert/upsert + validation)

**Router + handler signature** (`backend/src/routes/settings.ts` lines 72-74):
```typescript
settingsRouter.patch('/', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const body = req.body as PatchBody
```
`posts.ts` POST handler follows this exact shape: extract `userId` from `res.locals`, cast `req.body` to a typed interface.

**Validation pattern** (`backend/src/routes/settings.ts` lines 76-103):
```typescript
if (body.ai_provider !== undefined && !VALID_PROVIDERS.includes(body.ai_provider as Provider)) {
  res.status(400).json({ error: 'invalid ai_provider' })
  return
}
if (body.enabled_platforms !== undefined) {
  if (
    !Array.isArray(body.enabled_platforms) ||
    body.enabled_platforms.some(
      (p) => !VALID_PLATFORMS.includes(p as (typeof VALID_PLATFORMS)[number]),
    )
  ) {
    res.status(400).json({ error: 'invalid enabled_platforms' })
    return
  }
}
```
`posts.ts` validates `enabled_platforms` array with the same `!Array.isArray` + `.some()` pattern, and validates `niche` against `VALID_NICHES`.

**DB insert + returning** (`backend/src/routes/settings.ts` lines 114-122):
```typescript
await db
  .insert(settings)
  .values({
    user_id: userId,
    ai_provider: (body.ai_provider as Provider) ?? 'gemini',
    // ...
  })
  .onConflictDoUpdate({ target: settings.user_id, set: update })
```
`posts.ts` uses `db.insert(posts).values({...}).returning()` (no conflict, returns inserted row for the `postId`). Then a second `db.insert(platform_posts).values([...])` for each enabled platform.

**Schema columns available** (`backend/src/db/schema.ts` lines 16-40 for posts, lines 45-76 for platform_posts):
- `posts`: `id, user_id, title, niche, virality_score, engine_signals, ai_output, description`
- `platform_posts`: `id, user_id, post_id, platform, upload_status` (default `'idle'`)
- Both tables have RLS: `user_id` is set from `res.locals.userId`, never from `req.body`.

---

### `frontend/src/pages/GeneratorPage.tsx` (EXTEND — page/component, event-driven)

**Analog:** itself (the existing file is the primary pattern source)

**useMemo chained pattern** (`frontend/src/pages/GeneratorPage.tsx` lines 46-63):
```typescript
const scoreResult = useMemo(() => {
  if (!signals) return null
  const effectiveWeights = applyLearnedWeights(BASELINE_WEIGHTS, learnedWeights, dataPoints)
  return computeScore(signals, effectiveWeights)
}, [signals, learnedWeights, dataPoints])

const checklistItems = useMemo(() => {
  if (!signals) return null
  return buildChecklist(signals, {
    niche: DEFAULT_NICHE,
    enabledPlatforms: DEFAULT_ENABLED,
  })
}, [signals])
```
Phase 5 adds `aiOutput` state and extends the `checklistItems` useMemo to `[signals, aiOutput, settings]`:
```typescript
const checklistItems = useMemo(() => {
  if (!signals) return null
  return buildChecklist(signals, {
    niche: settings?.default_niche ?? DEFAULT_NICHE,
    enabledPlatforms: (settings?.enabled_platforms as Platform[]) ?? DEFAULT_ENABLED,
  }, aiOutput ?? undefined)  // NEW third param
}, [signals, aiOutput, settings])
```

**State declarations pattern** (`frontend/src/pages/GeneratorPage.tsx` lines 39-43):
```typescript
const [signals, _setSignals] = useState<EngineSignals | null>(__testSignals ?? null)
const [learnedWeights] = useState<LearnedWeights | null>(null)
const [dataPoints] = useState<number>(0)
```
Add new Phase 5 state vars after the existing block, following the same `useState<T | null>(null)` convention:
```typescript
const [selectedFile, setSelectedFile] = useState<File | null>(null)
const [description, setDescription] = useState<string>('')
const [aiOutput, setAiOutput] = useState<AIOutput | null>(null)
const [settings, setSettings] = useState<SettingsResponse | null>(null)
const [aiLoading, setAiLoading] = useState<boolean>(false)
const [aiError, setAiError] = useState<string | null>(null)
const [postId, setPostId] = useState<string | null>(null)
const [uploadStatuses, setUploadStatuses] = useState<Record<string, string>>({})
```

**Layout pattern — main content area** (`frontend/src/pages/GeneratorPage.tsx` lines 65-100):
```typescript
return (
  <div className="flex h-[100dvh] flex-col bg-zinc-950 text-white">
    <header className="flex items-center justify-between px-4 py-3">
      {/* ... */}
    </header>
    <main className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
      {!signals || !scoreResult || !checklistItems || !gapMessages ? (
        <div className="flex h-full items-center justify-center text-sm text-zinc-400">
          Upload a short-form video to analyse and generate viral copy.
        </div>
      ) : (
        <div data-testid="score-results" className="flex flex-col gap-4 py-4">
```
Phase 5 replaces the conditional empty state with always-rendering the upload area + conditionally rendering copy cards. Keep `h-[100dvh]`, `overflow-y-auto`, `pb-[env(safe-area-inset-bottom)]` unchanged.

**Settings fetch on mount** — modeled after `frontend/src/lib/api.ts` + `useEffect` (no existing analog in GeneratorPage; model after SettingsPage):
```typescript
// Add useEffect import alongside useMemo, useState
useEffect(() => {
  apiFetch('/settings')
    .then(r => r.json())
    .then((data: SettingsResponse) => setSettings(data))
    .catch(() => { /* fall back to Phase 4 defaults — non-blocking */ })
}, [])
```

**Supabase Realtime cleanup pattern** (`frontend/src/pages/GeneratorPage.tsx` uses `supabase` already — line 6):
```typescript
import { supabase } from '../lib/supabase'
```
Realtime setup goes in a `useEffect` that depends on `[postId, userId]` and returns cleanup:
```typescript
useEffect(() => {
  if (!postId || !userId) return
  const channel = supabase
    .channel('platform-posts-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'platform_posts',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      const row = payload.new as { platform: string; upload_status: string }
      setUploadStatuses(prev => ({ ...prev, [row.platform]: row.upload_status }))
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [postId, userId])
```

---

### `frontend/src/lib/checklist.ts` (EXTEND — utility, transform)

**Analog:** itself — the third `aiOutput` param follows the existing two-param pattern

**Existing signature** (lines 38-41):
```typescript
export function buildChecklist(
  signals: EngineSignals,
  options: ChecklistOptions,
): ChecklistItem[] {
```
Extend to:
```typescript
export function buildChecklist(
  signals: EngineSignals,
  options: ChecklistOptions,
  aiOutput?: AIOutput,   // NEW optional third param
): ChecklistItem[] {
```

**Pending block to replace** (lines 118-125 — the 8 MQ `pending()` calls):
```typescript
items.push(pending('caption_length_youtube',     'metadata-quality', 'YouTube caption length'))
items.push(pending('caption_length_instagram',   'metadata-quality', 'Instagram caption length'))
items.push(pending('caption_length_tiktok',      'metadata-quality', 'TikTok caption length'))
items.push(pending('hashtag_count_in_band',      'metadata-quality', 'Hashtag count per platform'))
items.push(pending('hook_in_first_line',         'metadata-quality', 'Hook present in first line'))
items.push(pending('cta_present',                'metadata-quality', 'Call-to-action present'))
items.push(pending('language_match_niche',       'metadata-quality', 'Language matches niche'))
items.push(pending('description_keyword_density','metadata-quality', 'Description keyword density'))
```
When `aiOutput` is defined, replace these 8 `pending()` calls with evaluated `pass()` / `fail()` calls using D-09..D-12 rules. When `aiOutput` is undefined, keep the existing `pending()` calls unchanged (backward-compatible — all Phase 4 tests still pass).

**Evaluation rule pattern** (mirror `fail()` with interpolated message style from lines 59-65):
```typescript
// Existing interpolated fix message style:
items.push(fail(
  'duration_in_band',
  'video-technical',
  'Duration 10-90s',
  `Length is ${fmt1(signals.durationSec)}s; short-form sweet spot is 10-90s.`,
))
// MQ items follow the same style, e.g.:
items.push(fail(
  'caption_length_youtube',
  'metadata-quality',
  'YouTube caption length',
  `Title is ${aiOutput.youtube.title.length} chars; keep ≤60.`,
))
```

---

### `frontend/src/lib/types.ts` (EXTEND — types)

**Analog:** itself — append after the existing `ScoreResult` type (line 102)

**Existing type definition pattern** (lines 35-41):
```typescript
export interface ChecklistItem {
  id: string
  category: ChecklistCategory
  label: string
  status: ChecklistStatus
  fix: string
}
```
Add new Phase 5 types following the same `export interface` pattern with section comment:
```typescript
// ============================================================================
// Phase 5: AI Output + Platform Cards (D-03)
// ============================================================================

export interface YouTubeOutput {
  title: string
  description: string
  tags: string[]
  hook: string
}
export interface InstagramOutput {
  caption: string
  hashtags: string[]
  cover_text: string
}
export interface TikTokOutput {
  hook: string
  caption: string
  hashtags: string[]
}
export interface FacebookOutput {
  caption: string
  cta: string
  hashtags: string[]
}
export interface XOutput {
  tweet: string
  hashtags: string[]
}
export interface AIOutput {
  youtube: YouTubeOutput
  instagram: InstagramOutput
  tiktok: TikTokOutput
  facebook: FacebookOutput
  x: XOutput
  script_outline: string
}

export type UploadStatus = 'idle' | 'uploading' | 'posted' | 'failed'

export interface PostSaveResponse {
  postId: string
}
```

---

### `frontend/src/lib/api.ts` (EXTEND — utility, request-response)

**Analog:** itself — extend with new typed wrapper functions

**Existing apiFetch pattern** (`frontend/src/lib/api.ts` lines 8-13):
```typescript
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(`/api${path}`, { ...init, headers })
}
```
Add new typed wrappers that call `apiFetch` — same pattern as how all backend routes use `res.locals.userId` (single source of auth):
```typescript
export async function fetchSettings(): Promise<SettingsResponse> {
  const res = await apiFetch('/settings')
  if (!res.ok) throw new Error('settings_fetch_failed')
  return res.json() as Promise<SettingsResponse>
}

export async function createPost(body: CreatePostBody): Promise<PostSaveResponse> {
  const res = await apiFetch('/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('post_save_failed')
  return res.json() as Promise<PostSaveResponse>
}

export async function proxyAIGenerate(body: AIProxyBody): Promise<{ text: string }> {
  const res = await apiFetch('/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('ai_proxy_failed')
  return res.json() as Promise<{ text: string }>
}
```

---

### `backend/src/app.ts` (EXTEND — config)

**Analog:** itself — extend the CSP header and add route registration

**Existing CSP string** (`backend/src/app.ts` lines 28-33):
```typescript
res.setHeader(
  'Content-Security-Policy',
  "default-src 'self'; connect-src 'self' https://*.supabase.co; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:;",
)
```
Phase 5 adds two AI provider domains to `connect-src` (Pitfall 8 from RESEARCH.md):
```typescript
"default-src 'self'; connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com https://api.anthropic.com; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:;"
```
Note: OpenAI calls go through the backend proxy — no browser CSP change needed for OpenAI.

**Route registration pattern** (`backend/src/app.ts` lines 60-65):
```typescript
app.use('/api', authMiddleware)
app.use('/api/posts', postsRouter)
app.use('/api/settings', settingsRouter)
```
Add `aiRouter` following the same pattern — after `authMiddleware` line so it inherits auth:
```typescript
import { aiRouter } from './routes/ai.js'
// ...
app.use('/api/ai', aiRouter)
```

---

## Shared Patterns

### Authentication (all backend routes)
**Source:** `backend/src/middleware/auth.ts` (lines 1-27) + `backend/src/routes/settings.ts` (line 25)
**Apply to:** `backend/src/routes/ai.ts`, `backend/src/routes/posts.ts` (the new POST handler)

```typescript
// auth.ts: sets res.locals.userId from Supabase JWT
const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
res.locals.userId = user.id

// Every route handler reads it as:
const userId = res.locals.userId as string
```
`authMiddleware` is applied at the app level (`app.use('/api', authMiddleware)`) — all `/api/*` routes automatically require auth. Route handlers just read `res.locals.userId`.

### Error Handling (backend routes)
**Source:** `backend/src/app.ts` lines 72-77
**Apply to:** `backend/src/routes/ai.ts`, `backend/src/routes/posts.ts`

```typescript
// Express 5 global error handler — catches unhandled async throws
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'unhandled error')
  res.status(500).json({ error: 'Internal Server Error' })
})
```
Async route handlers do NOT need their own `try/catch` for unexpected errors. Only use `try/catch` for expected throws (e.g., `decrypt()`, external API calls where you want a specific error response).

### Decryption Pattern (backend lib)
**Source:** `backend/src/lib/encryption.ts` (lines 30-41) + `backend/src/routes/settings.ts` (lines 42-49)
**Apply to:** `backend/src/routes/ai.ts` (decrypt user API key before forwarding to OpenAI)

```typescript
// encryption.ts: decrypt() returns the plaintext string
export function decrypt(ciphertextB64: string): string {
  const buf = Buffer.from(ciphertextB64, 'base64')
  // AES-256-GCM with scrypt key derivation
  // ...
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

// Usage pattern from settings.ts (wrap in try/catch — corrupt ciphertext throws):
try {
  masked = maskKey(decrypt(row.api_key_encrypted))
} catch {
  masked = null
}
```

### DB Query Pattern (backend routes)
**Source:** `backend/src/routes/settings.ts` lines 26-27
**Apply to:** `backend/src/routes/ai.ts` (fetch settings row), `backend/src/routes/posts.ts` (insert)

```typescript
// Always filter by userId — RLS is enforcement, but query must still be correct:
const rows = await db.select().from(settings).where(eq(settings.user_id, userId)).limit(1)

// Insert with returning():
const [post] = await db.insert(posts).values({ user_id: userId, /* ... */ }).returning()
```
`user_id` is always set from `res.locals.userId`, never from `req.body` (CLAUDE.md Agency Isolation rule).

### Tailwind Full Class Strings (frontend components)
**Source:** `frontend/src/components/ScorePanel.tsx` lines 6-11
**Apply to:** `frontend/src/components/PlatformCopyCard.tsx`

```typescript
// Full Tailwind class strings (not dynamic) so the JIT can detect and ship them.
const BAND_CLASSES: Record<ColorBand, string> = {
  'red':          'bg-red-500 text-white border-red-600',
  'amber':        'bg-amber-500 text-white border-amber-600',
  'green':        'bg-green-500 text-white border-green-600',
  'bright-green': 'bg-emerald-400 text-white border-emerald-500',
}
```
Never build class strings with template literals or string concatenation — Tailwind JIT cannot detect dynamic class names. Write every variant out in full in a `Record<Platform, string>` constant.

### Pure Function + Import Type Pattern (frontend lib)
**Source:** `frontend/src/lib/gaps.ts` lines 1-2, `frontend/src/lib/score.ts` lines 1-9
**Apply to:** `frontend/src/lib/ai.ts`, `frontend/src/lib/prompt.ts`

```typescript
// Always use import type for type-only imports
import type { ChecklistItem, ChecklistCategory } from './types'
```
All `lib/*.ts` files use `import type` for type-only imports. No runtime type checking — pure TypeScript.

### apiFetch Auth Wrapper (frontend API calls)
**Source:** `frontend/src/lib/api.ts` lines 1-13
**Apply to:** All new `api.ts` wrapper functions (`fetchSettings`, `createPost`, `proxyAIGenerate`)

```typescript
import { supabase } from './supabase'

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(`/api${path}`, { ...init, headers })
}
```
Never call `fetch()` directly in new frontend code — always go through `apiFetch` so the Authorization header is attached.

### h-[100dvh] + safe-area viewport (frontend pages)
**Source:** `frontend/src/pages/GeneratorPage.tsx` lines 66, 85
**Apply to:** No new page files in Phase 5 (GeneratorPage is extended, not replaced)

```typescript
// iOS Safari viewport — always use h-[100dvh] not h-screen
<div className="flex h-[100dvh] flex-col bg-zinc-950 text-white">
// safe-area padding for notch/home indicator
<main className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
```
Keep these unchanged when extending GeneratorPage.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/src/lib/ai.ts` (Gemini Files API path) | service | async/polling | No polling or file-upload pattern exists in codebase — use RESEARCH.md Pattern 1 directly |
| `frontend/src/lib/ai.ts` (Claude browser path) | service | request-response | No Anthropic SDK usage exists — use RESEARCH.md Pattern 3 directly |
| Supabase Realtime subscription block | component hook | event-driven | No Realtime subscription exists in codebase — use RESEARCH.md Pattern 6 directly |

---

## Metadata

**Analog search scope:** `frontend/src/` (lib, components, pages) + `backend/src/` (routes, lib, middleware, db)
**Files scanned:** 25
**Pattern extraction date:** 2026-05-02
