# Phase 9: Content Research Engine - Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 14 new/modified files
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/src/db/schema.ts` | model | CRUD | `backend/src/db/schema.ts` (self — extend) | exact (extend) |
| `backend/src/routes/research.ts` | route | request-response | `backend/src/routes/learning.ts` | exact |
| `backend/src/lib/trends/youtube.ts` | service | request-response | `backend/src/lib/upload-youtube.ts` | role-match |
| `backend/src/lib/trends/google-trends.ts` | service | request-response | `backend/src/lib/meta-refresh.ts` | role-match |
| `backend/src/lib/trends/reddit.ts` | service | request-response | `backend/src/lib/meta-refresh.ts` | role-match |
| `backend/src/lib/trends/exploding.ts` | service | request-response | `backend/src/lib/meta-refresh.ts` | role-match |
| `backend/src/lib/research-cache.ts` | utility | CRUD | `backend/src/routes/learning.ts` | role-match |
| `backend/src/lib/research-ai.ts` | service | request-response | `backend/src/routes/ai.ts` | exact |
| `backend/src/lib/calendar.ts` | utility | transform | `backend/src/routes/learning.ts` (posting-times) | role-match |
| `backend/src/lib/boss.ts` (extend) | utility | event-driven | `backend/src/lib/meta-refresh.ts` | exact |
| `backend/src/index.ts` (extend) | config | event-driven | `backend/src/index.ts` (self — extend) | exact |
| `frontend/src/lib/types.ts` (extend) | model | transform | `frontend/src/lib/types.ts` (self — extend) | exact |
| `frontend/src/lib/api.ts` (extend) | utility | request-response | `frontend/src/lib/api.ts` (self — extend) | exact |
| `frontend/src/pages/ResearchPage.tsx` | component | request-response | `frontend/src/pages/LearningPage.tsx` | exact |
| `frontend/src/App.tsx` (extend) | component | event-driven | `frontend/src/App.tsx` (self — extend) | exact |

---

## Pattern Assignments

### `backend/src/db/schema.ts` — extend with `trend_cache` + `content_ideas` (model, CRUD)

**Analog:** `backend/src/db/schema.ts` lines 1-154 (existing file, bottom-append)

**Imports pattern** (lines 1-8) — already present, must also import `unique`:
```typescript
import {
  pgTable, uuid, text, integer, boolean, timestamp, jsonb,
  index, foreignKey, unique
} from 'drizzle-orm/pg-core'
import { pgPolicy } from 'drizzle-orm/pg-core'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'
import { sql } from 'drizzle-orm'
```

**Per-user RLS table pattern** (lines 16-40, posts table) — copy for `content_ideas`:
```typescript
export const content_ideas = pgTable('content_ideas', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  idea: jsonb('idea').$type<ContentIdeaData>().notNull(),
  niches: text('niches').array().notNull().default([]),
  platforms: text('platforms').array().notNull().default([]),
  generated_at: timestamp('generated_at').defaultNow().notNull(),
  saved: boolean('saved').notNull().default(false),
}, (table) => [
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [authUsers.id],
    name: 'content_ideas_user_id_fk',
  }).onDelete('cascade'),
  pgPolicy('content_ideas_user_own', {
    for: 'all',
    to: authenticatedRole,
    using: sql`${authUid} = user_id`,
    withCheck: sql`${authUid} = user_id`,
  }),
  index('content_ideas_user_generated_idx').on(table.user_id, table.generated_at),
])
```

**Global cache table (no user_id, no RLS)** — copy `trend_cache` at bottom of schema:
```typescript
export const trend_cache = pgTable('trend_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source').notNull(),
  niche: text('niche').notNull(),
  data: jsonb('data').$type<TrendItem[]>().notNull().default([]),
  fetched_at: timestamp('fetched_at').defaultNow().notNull(),
}, (table) => [
  // unique() NOT index() — required for ON CONFLICT (source, niche) DO UPDATE upsert
  unique('trend_cache_source_niche_unique').on(table.source, table.niche),
])
```

**Critical:** `unique()` not `index()`. The upsert in `research-cache.ts` uses
`ON CONFLICT (source, niche)` which requires a UNIQUE constraint. `index()` alone will
cause a runtime crash ("there is no unique or exclusion constraint matching the ON CONFLICT
specification").

**JSONB typed column pattern** (line 23) — match the existing schema style:
```typescript
data: jsonb('data').$type<TrendItem[]>().notNull().default([]),
```

---

### `backend/src/routes/research.ts` (route, request-response)

**Analog:** `backend/src/routes/learning.ts` (lines 1-204)

**Imports pattern** (lines 1-8 of learning.ts):
```typescript
import { Router, type Request, type Response } from 'express'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings } from '../db/schema.js'
```

For `research.ts`, replace with:
```typescript
import { Router, type Request, type Response } from 'express'
import { getTrendCache, setTrendCache } from '../lib/research-cache.js'
import { fetchYouTubeTrends } from '../lib/trends/youtube.js'
import { fetchGoogleTrends } from '../lib/trends/google-trends.js'
import { fetchRedditTrends } from '../lib/trends/reddit.js'
import { fetchExplodingTopics } from '../lib/trends/exploding.js'
import { buildResearchPrompt, callResearchAI } from '../lib/research-ai.js'
import { buildCalendar } from '../lib/calendar.js'
import { db } from '../db/index.js'
import { content_ideas } from '../db/schema.js'
import { eq, and, desc } from 'drizzle-orm'
import { getBoss } from '../lib/boss.js'
```

**Router export pattern** (line 8 of learning.ts):
```typescript
export const researchRouter = Router()
```

**Auth userId extraction** (lines 13-15 of learning.ts) — copy on every handler:
```typescript
const userId = res.locals.userId as string
```

**Niche allowlist validation** — copy from `backend/src/routes/posts.ts` lines 8-9:
```typescript
const VALID_NICHES = ['travel', 'hotels', 'cars', 'bikes', 'coding', 'lifestyle'] as const
// At top of each handler that accepts ?niche=:
const niche = (req.query['niche'] as string) ?? 'travel'
if (!VALID_NICHES.includes(niche as typeof VALID_NICHES[number])) {
  res.status(400).json({ error: 'invalid_niche' })
  return
}
```

**Cache-check + Promise.allSettled parallel fetch pattern** (from RESEARCH.md Pattern 6):
```typescript
researchRouter.get('/trends', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const niche = (req.query['niche'] as string) ?? 'travel'

  const cached = await getTrendCache('all', niche)
  if (cached) {
    return res.json({ trends: cached, fromCache: true, fetchedAt: cached.fetchedAt })
  }

  const [yt, gt, rd, et] = await Promise.allSettled([
    fetchYouTubeTrends(niche),
    fetchGoogleTrends(niche),
    fetchRedditTrends(niche),
    fetchExplodingTopics(niche),
  ])

  const trends = [
    ...(yt.status === 'fulfilled' ? yt.value : []),
    ...(gt.status === 'fulfilled' ? gt.value : []),
    ...(rd.status === 'fulfilled' ? rd.value : []),
    ...(et.status === 'fulfilled' ? et.value : []),
  ]
  await setTrendCache('all', niche, trends)
  res.json({ trends, fromCache: false, fetchedAt: new Date().toISOString() })
})
```

**Drizzle select + RLS pattern** (lines 186-196 of learning.ts):
```typescript
const [row] = await db
  .select({ learned_weights: settings.learned_weights })
  .from(settings)
  .where(eq(settings.user_id, userId))
```
Use this style for `GET /api/research/saved` — filter by `eq(content_ideas.user_id, userId)`.

**pg-boss on-demand send pattern** (see `backend/src/lib/boss.ts`):
```typescript
researchRouter.post('/refresh', async (_req: Request, res: Response) => {
  const boss = await getBoss()
  await boss.send('refresh-trends', {})
  res.json({ ok: true })
})
```

**Error shape** — match the project convention (simple string, no stack):
```typescript
res.status(400).json({ error: 'invalid_niche' })
res.status(500).json({ error: 'Internal Server Error' })
```

---

### `backend/src/lib/trends/youtube.ts` (service, request-response)

**Analog:** `backend/src/lib/upload-youtube.ts` + RESEARCH.md Pattern 5

**Imports pattern** — match googleapis usage (already installed):
```typescript
import { google } from 'googleapis'
```

**Fail-open pattern** — every trend fetcher MUST catch-return-empty. No throwing:
```typescript
export async function fetchYouTubeTrends(niche: string): Promise<TrendItem[]> {
  try {
    // ... API call
    return results
  } catch {
    return []  // never throw — caller uses Promise.allSettled()
  }
}
```

**Env var guard** — check before calling API (RESEARCH.md pitfall 4):
```typescript
if (!process.env.YOUTUBE_API_KEY) return []
const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY })
```

**Category map constant** (from RESEARCH.md Pattern 5):
```typescript
const YOUTUBE_CATEGORY_MAP: Record<string, string> = {
  travel: '19', hotels: '19', cars: '2', bikes: '2', coding: '28', lifestyle: '22',
}
```

---

### `backend/src/lib/trends/google-trends.ts` (service, request-response)

**Analog:** `backend/src/lib/meta-refresh.ts` — same fail-open single-responsibility pattern

**Critical import warning** — `google-trends-api` is a CJS module in an ESM project.
Test with `createRequire` fallback if default import fails:
```typescript
// Preferred — test first:
import googleTrends from 'google-trends-api'
// Fallback if ESM/CJS interop fails:
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const googleTrends = require('google-trends-api') as typeof import('google-trends-api').default
```

**Return-string pitfall** (RESEARCH.md Pitfall 7) — always JSON.parse:
```typescript
const raw = await googleTrends.relatedQueries({ keyword: niche, geo: 'PK', ... })
const parsed = JSON.parse(raw as string) as GoogleTrendsResponse
```

**Fail-open wrapper** — same pattern as `fetchYouTubeTrends`:
```typescript
export async function fetchGoogleTrends(niche: string): Promise<TrendItem[]> {
  try { ... return results } catch { return [] }
}
```

---

### `backend/src/lib/trends/reddit.ts` (service, request-response)

**Analog:** `backend/src/lib/meta-refresh.ts` — per-item fail-open iteration pattern (lines 75-110)

**User-Agent header** (RESEARCH.md Pitfall 3 — mandatory):
```typescript
const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, {
  headers: { 'User-Agent': 'viral-copy-generator/1.0 (by /u/viral_copy_bot)' },
  signal: AbortSignal.timeout(8000),
})
```

**Per-item fail-open loop** (mirrors meta-refresh.ts lines 75-110):
```typescript
for (const sub of subs) {
  try {
    // fetch + parse
  } catch {
    continue  // one subreddit failure never aborts the loop
  }
}
```

**Subreddit map** (from RESEARCH.md Pattern 2):
```typescript
const SUBREDDIT_MAP: Record<string, string[]> = {
  travel: ['pakistan', 'travel', 'CasualPakistan'],
  hotels: ['pakistan', 'travel'],
  cars: ['motorcycles', 'pakistan'],
  bikes: ['motorcycles', 'pakistan'],
  coding: ['programming', 'learnprogramming'],
  lifestyle: ['CasualPakistan', 'pakistan'],
}
```

---

### `backend/src/lib/trends/exploding.ts` (service, request-response)

**Analog:** `backend/src/lib/meta-refresh.ts` — defensive per-error catch pattern

**Pure best-effort** — this fetcher is the most fragile. It must NEVER throw:
```typescript
export async function fetchExplodingTopics(_niche: string): Promise<TrendItem[]> {
  try {
    const res = await fetch('https://explodingtopics.com/blog/trending-topics', {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const html = await res.text()
    // Regex to find JSON in <script> tags
    const match = /<script[^>]*>.*?(\[{.*?}\])/s.exec(html)
    if (!match) return []
    const items = JSON.parse(match[1]) as Array<{ topic: string; growth?: number }>
    return items.slice(0, 10).map(item => ({
      title: item.topic,
      score: Math.min(100, item.growth ?? 50),
      source: 'exploding-topics' as const,
    }))
  } catch {
    return []  // ExplodingTopics scraping is low-confidence; silently degrade
  }
}
```

---

### `backend/src/lib/research-cache.ts` (utility, CRUD)

**Analog:** `backend/src/routes/learning.ts` — Drizzle raw SQL + db.execute pattern (lines 17-40)

**Raw SQL execute pattern** (lines 17-35 of learning.ts):
```typescript
const rows = await db.execute<{ data: TrendItem[]; fetched_at: string }>(
  sql`SELECT data, fetched_at FROM trend_cache
      WHERE source = ${source}
        AND niche = ${niche}
        AND fetched_at > NOW() - INTERVAL '24 hours'
      ORDER BY fetched_at DESC
      LIMIT 1`
)
return rows.rows[0]?.data ?? null
```

**Drizzle execute result access** (pattern from learning.ts lines 69-104):
- `rows.rows` is the array (not `rows` directly)
- Generic type on `db.execute<T>` constrains `rows.rows` element type

**Upsert pattern** — use `ON CONFLICT DO UPDATE`:
```typescript
await db.execute(
  sql`INSERT INTO trend_cache (source, niche, data, fetched_at)
      VALUES (${source}, ${niche}, ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT (source, niche)
      DO UPDATE SET data = ${JSON.stringify(data)}::jsonb, fetched_at = NOW()`
)
```

---

### `backend/src/lib/research-ai.ts` (service, request-response)

**Analog:** `backend/src/routes/ai.ts` (lines 1-66) — full file is the pattern

**Decrypt key before AI call** (lines 24-39 of ai.ts):
```typescript
const rows = await db.select({
  api_key_encrypted: settings.api_key_encrypted,
  ai_provider: settings.ai_provider,
}).from(settings).where(eq(settings.user_id, userId)).limit(1)

if (!rows[0]?.api_key_encrypted) {
  // return error or throw — caller decides
}
let apiKey: string
try {
  apiKey = decrypt(rows[0].api_key_encrypted)
} catch {
  throw new Error('key_decrypt_failed')
}
```

**OpenAI call pattern** (lines 41-64 of ai.ts):
```typescript
const openai = new OpenAI({ apiKey })
const completion = await openai.chat.completions.create({
  model: 'gpt-4.1',
  max_tokens: 2048,
  messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  response_format: { type: 'json_object' },
})
const rawText = completion.choices[0]?.message?.content ?? ''
```

**JSON robustness** — strip fences, find array bounds, parse safely:
```typescript
function safeParseIdeas(raw: string): ContentIdeaData[] {
  try {
    const stripped = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '')
    const start = stripped.indexOf('[')
    const end = stripped.lastIndexOf(']')
    if (start === -1 || end === -1) return []
    return JSON.parse(stripped.slice(start, end + 1)) as ContentIdeaData[]
  } catch {
    return []  // never blank screen — RESEARCH.md Pitfall 8
  }
}
```

**Research-specific:** Unlike `ai.ts` (text-only), `research-ai.ts` handles multiple
providers. Route: OpenAI → `new OpenAI({ apiKey })`. For Gemini/Claude providers, reuse
the routing already established in the existing `ai_provider` field. The prompt is
text-only (no frames) — simpler than Phase 5.

---

### `backend/src/lib/calendar.ts` (utility, transform)

**Analog:** `backend/src/routes/learning.ts` posting-times handler (lines 109-158)

**PostingTimeSlot shape** (from `frontend/src/lib/types.ts` lines 247-253):
```typescript
export interface PostingTimeSlot {
  dow: number       // 0=Sunday...6=Saturday
  hour: number      // 0-23, PKT (UTC+5)
  platform: string
  avg_views: number
  post_count: number
}
```

**Calendar generation** — pure transform function, no DB calls:
```typescript
export function buildCalendar(
  ideas: ContentIdeaData[],
  postingTimes: PostingTimeSlot[],
): CalendarDay[] {
  const today = new Date()
  return Array.from({ length: 7 }, (_, dayOffset) => {
    const date = new Date(today)
    date.setDate(today.getDate() + dayOffset)
    const dow = date.getDay()
    const slots = postingTimes
      .filter(t => t.dow === dow)
      .slice(0, 2)  // max 2 slots per day
    return {
      date: date.toISOString().slice(0, 10),
      dow,
      slots: slots.map((slot, i) => ({
        platform: slot.platform,
        hour: slot.hour,
        idea: ideas[dayOffset * 2 + i] ?? null,
      })),
    }
  })
}
```

---

### `backend/src/lib/boss.ts` — extend with `registerResearchRefreshJob` (utility, event-driven)

**Analog:** `backend/src/lib/meta-refresh.ts` (lines 1-34) — exact pattern to copy

**createQueue-before-schedule guard** (lines 17-34 of meta-refresh.ts):
```typescript
export async function registerResearchRefreshJob(boss: PgBoss): Promise<void> {
  // CRITICAL: createQueue() BEFORE schedule() — FK constraint on pgboss.schedule.name
  await boss.createQueue('refresh-trends')

  try {
    await boss.schedule('refresh-trends', '0 5 * * *', {})
  } catch (err: unknown) {
    const msg = (err as Error).message ?? ''
    if (!msg.includes('duplicate') && !msg.includes('unique')) throw err
  }

  await boss.work<Record<string, never>>('refresh-trends', async (_jobs) => {
    const NICHES = ['travel', 'hotels', 'cars', 'bikes', 'coding', 'lifestyle']
    for (const niche of NICHES) {
      await refreshTrendCache(niche)
    }
    console.log('[pg-boss] refresh-trends completed')
  })

  console.log('[pg-boss] refresh-trends job registered')
}
```

**Named PgBoss import** — the existing boss.ts line 2 already uses this; match it:
```typescript
import { PgBoss } from 'pg-boss'  // NAMED import — not default (v12 ESM breaking change)
```

---

### `backend/src/index.ts` — extend with research job registration (config, event-driven)

**Analog:** `backend/src/index.ts` lines 32-44 — existing registration pattern

**Registration call** — add after existing job registrations (line 43):
```typescript
await registerResearchRefreshJob(boss)  // Phase 9 RESEARCH-06
```

**Optional env var pattern** — `YOUTUBE_API_KEY` is not in `REQUIRED_ENV`; it must be
optional with graceful degradation:
```typescript
// In index.ts — do NOT add YOUTUBE_API_KEY to REQUIRED_ENV.
// The YouTube fetcher returns [] when env var is absent (RESEARCH.md Pitfall 4).
// Add to .env.example with a comment marking it optional.
```

**Router mount** — add to `app.ts` after `learningRouter`:
```typescript
app.use('/api/research', researchRouter)
```

---

### `frontend/src/lib/types.ts` — extend with Phase 9 types (model, transform)

**Analog:** `frontend/src/lib/types.ts` — self (append Phase 9 section at bottom)

**Section header pattern** (lines 104-106 of types.ts):
```typescript
// ============================================================================
// Phase 9: Content Research Engine
// ============================================================================
```

**Screen type extension** (line 1 of types.ts):
```typescript
// BEFORE:
export type Screen = 'generator' | 'settings' | 'history' | 'learning' | 'admin'
// AFTER:
export type Screen = 'generator' | 'settings' | 'history' | 'learning' | 'admin' | 'research'
```

**New types to add** — follow existing interface style (explicit fields, no `any`):
```typescript
export interface TrendItem {
  title: string
  score: number
  source: 'youtube' | 'google-trends' | 'reddit' | 'exploding-topics'
  url?: string
}

export interface ContentIdeaData {
  title: string
  angle: string
  hookVariants: [string, string, string]
  scriptOutline: string
  keyMoments: Array<{ timestamp: string; description: string }>
  brollSuggestions: string[]
  platforms: string[]
  estimatedStrength: number
  gapWarnings: string[]
  hashtagSuggestions: string[]
}

export interface HashtagIntel {
  hashtag: string
  trendScore: number
  userAvgViews: number
  combinedScore: number
  source: 'external' | 'user' | 'both'
}

export interface CalendarSlot {
  platform: string
  hour: number
  idea: ContentIdeaData | null
}

export interface CalendarDay {
  date: string        // YYYY-MM-DD
  dow: number         // 0=Sunday...6=Saturday
  slots: CalendarSlot[]
}

export interface ResearchTrendsResponse {
  trends: TrendItem[]
  fromCache: boolean
  fetchedAt: string   // ISO-8601
}

export interface ResearchGenerateResponse {
  ideas: ContentIdeaData[]
  calendar: CalendarDay[]
  hashtags: HashtagIntel[]
}

export interface SavedIdea {
  id: string
  idea: ContentIdeaData
  niches: string[]
  platforms: string[]
  generated_at: string
  saved: boolean
}
```

---

### `frontend/src/lib/api.ts` — extend with research API functions (utility, request-response)

**Analog:** `frontend/src/lib/api.ts` — self (append Phase 9 section at bottom)

**Section header pattern** (lines 229-231 of api.ts):
```typescript
// ============================================================================
// Phase 9: Content Research Engine
// ============================================================================
```

**GET with query params pattern** (lines 116-128 of api.ts — `fetchPosts`):
```typescript
export async function fetchResearchTrends(niche: string): Promise<ResearchTrendsResponse> {
  const res = await apiFetch(`/research/trends?niche=${encodeURIComponent(niche)}`)
  if (!res.ok) throw new Error('research_trends_fetch_failed')
  return res.json() as Promise<ResearchTrendsResponse>
}
```

**POST with JSON body pattern** (lines 22-30 of api.ts — `proxyAIGenerate`):
```typescript
export async function generateResearchIdeas(niche: string): Promise<ResearchGenerateResponse> {
  const res = await apiFetch('/research/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ niche }),
  })
  if (!res.ok) throw new Error('research_generate_failed')
  return res.json() as Promise<ResearchGenerateResponse>
}
```

**Fail-open GET pattern** (lines 162-172 of api.ts — `fetchTopHooks`):
```typescript
export async function fetchSavedIdeas(): Promise<SavedIdea[]> {
  try {
    const res = await apiFetch('/research/saved')
    if (!res.ok) return []
    const json = await res.json() as { ideas: SavedIdea[] }
    return json.ideas ?? []
  } catch {
    return []
  }
}
```

**POST action pattern** (lines 143-154 of api.ts — `logActualViews`):
```typescript
export async function saveIdea(ideaId: string): Promise<void> {
  const res = await apiFetch(`/research/ideas/${encodeURIComponent(ideaId)}/save`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('save_idea_failed')
}

export async function refreshTrends(): Promise<void> {
  const res = await apiFetch('/research/refresh', { method: 'POST' })
  if (!res.ok) throw new Error('refresh_trends_failed')
}
```

---

### `frontend/src/pages/ResearchPage.tsx` (component, request-response)

**Analog:** `frontend/src/pages/LearningPage.tsx` (lines 1-230) — exact structural match

**Props interface pattern** (lines 8-10 of LearningPage.tsx):
```typescript
interface Props {
  onNavigate: (s: Screen) => void
}
```

**Multi-state loading pattern** (lines 15-21 of LearningPage.tsx):
```typescript
const [activeTab, setActiveTab] = useState<ResearchTab>('ideas')
const [trends, setTrends] = useState<TrendItem[]>([])
const [ideas, setIdeas] = useState<ContentIdeaData[]>([])
const [hashtags, setHashtags] = useState<HashtagIntel[]>([])
const [calendar, setCalendar] = useState<CalendarDay[]>([])
const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>([])
const [loading, setLoading] = useState(false)
const [generating, setGenerating] = useState(false)
const [fetchedAt, setFetchedAt] = useState<string | null>(null)
const [niche, setNiche] = useState<string>('travel')
```

**Data fetch in useEffect** (lines 23-41 of LearningPage.tsx):
```typescript
useEffect(() => {
  void (async () => {
    setLoading(true)
    try {
      const data = await fetchResearchTrends(niche)
      setTrends(data.trends)
      setFetchedAt(data.fetchedAt)
    } finally {
      setLoading(false)
    }
  })()
}, [niche])
```

**Layout skeleton** (lines 53-83 of LearningPage.tsx):
```tsx
return (
  <div className="flex h-[100dvh] flex-col bg-zinc-950 text-white">
    <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
      <span className="font-bold">Research</span>
      <button type="button" onClick={() => onNavigate('generator')}
        className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700">
        Generator
      </button>
    </header>

    {/* 4-tab sub-nav — same approach as AdminPage's AdminTab */}
    <div className="flex border-b border-zinc-800">
      {(['ideas', 'hashtags', 'calendar', 'saved'] as const).map(tab => (
        <button key={tab} type="button"
          onClick={() => setActiveTab(tab)}
          className={`px-4 py-2 text-sm capitalize ${activeTab === tab ? 'border-b-2 border-purple-500 text-purple-300' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          {tab}
        </button>
      ))}
    </div>

    <main className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
      {/* Tab content here */}
    </main>
  </div>
)
```

**Inline style bar chart pattern** (lines 114-119 of LearningPage.tsx) — use for hashtag scores:
```tsx
<div className="h-1.5 rounded-full bg-zinc-800">
  <div
    className="h-1.5 rounded-full bg-purple-500"
    style={{ width: `${pct}%` }}
  />
</div>
```
NEVER use dynamic Tailwind width classes (e.g., `w-[${n}%]`). Tailwind does not generate
these at build time. Always `style={{ width: ... }}`.

**Freshness indicator pattern** — compute "Xh ago" from `fetchedAt`:
```tsx
{fetchedAt && (
  <span className="text-xs text-zinc-500">
    Last updated: {Math.round((Date.now() - new Date(fetchedAt).getTime()) / 3_600_000)}h ago
  </span>
)}
```

**4-tab subtype** — same pattern as AdminPage's `AdminTab`:
```typescript
type ResearchTab = 'ideas' | 'hashtags' | 'calendar' | 'saved'
```

---

### `frontend/src/App.tsx` — extend with `research` screen (component, event-driven)

**Analog:** `frontend/src/App.tsx` lines 88-95 — existing screen branch pattern

**Screen branch pattern** (lines 88-91 of App.tsx):
```tsx
if (currentScreen === 'research') {
  return <ResearchPage onNavigate={setCurrentScreen} />
}
```

**Import to add** (after existing page imports, line 9):
```tsx
import ResearchPage from './pages/ResearchPage'
```

**Nav button pattern** — add to nav alongside Learning button, same style as all other
nav buttons (e.g., lines 66-71 of LearningPage.tsx):
```tsx
<button
  type="button"
  onClick={() => onNavigate('research')}
  className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
>
  Research
</button>
```

---

## Shared Patterns

### Authentication — applied to all `/api/research/*` route handlers
**Source:** `backend/src/middleware/auth.ts` lines 5-27
**Applied via:** `app.use('/api', authMiddleware)` in `app.ts` — inherited by all `/api/*` routes
**In each handler**, extract userId:
```typescript
const userId = res.locals.userId as string
```
No additional auth decoration needed on the router itself (unlike `adminRouter` which adds
`adminMiddleware`). Research routes are user-level, not admin-level.

### Error handling — backend route handlers
**Source:** `backend/src/app.ts` lines 90-95 (Express 5 error handler)
**Pattern:** Express 5 forwards async errors natively — no try/catch needed around route
handlers for unexpected errors. Only catch expected errors (e.g., missing API key) and
return specific status codes. Unhandled rejections propagate to the global error handler
which returns `{ error: 'Internal Server Error' }`.

### Drizzle raw SQL execute
**Source:** `backend/src/routes/learning.ts` lines 17-35
**Apply to:** `research-cache.ts`, route handlers that need raw SQL (24h TTL query)
```typescript
const rows = await db.execute<{ col: Type }>(sql`SELECT ... FROM ...`)
// Access: rows.rows[0]?.col
```

### pg-boss createQueue + schedule guard
**Source:** `backend/src/lib/meta-refresh.ts` lines 17-22
**Apply to:** `registerResearchRefreshJob` in `boss.ts` extension
```typescript
await boss.createQueue(QUEUE_NAME)
try {
  await boss.schedule(QUEUE_NAME, CRON, {})
} catch (err: unknown) {
  const msg = (err as Error).message ?? ''
  if (!msg.includes('duplicate') && !msg.includes('unique')) throw err
}
```

### Fail-open async fetch with try/catch returning []
**Source:** `frontend/src/lib/api.ts` lines 162-172 (fetchTopHooks)
**Apply to:** All four trend fetchers in `backend/src/lib/trends/*.ts`
**Rule:** Trend fetchers must return `Promise<TrendItem[]>` and never throw. Any error
returns `[]`. `Promise.allSettled()` in the route handler only works correctly when
fetchers resolve (not reject).

### Inline style bar chart width
**Source:** `frontend/src/pages/LearningPage.tsx` lines 114-119
**Apply to:** `ResearchPage.tsx` hashtag intelligence tab
**Rule:** `style={{ width: \`${pct}%\` }}` — NEVER `className=\`w-[\${pct}%]\``

### JSONB array field default
**Source:** `backend/src/db/schema.ts` lines 90-91 (hashtags field)
**Apply to:** `trend_cache.data`, `content_ideas.niches`, `content_ideas.platforms`
```typescript
niches: text('niches').array().notNull().default([]),
data: jsonb('data').$type<TrendItem[]>().notNull().default([]),
```

---

## No Analog Found

All files have close analogs in the existing codebase. No file in Phase 9 introduces a
genuinely novel architectural pattern — this phase wires existing infrastructure together.

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `backend/src/lib/trends/google-trends.ts` | service | request-response | No existing npm wrapper usage, but pattern matches any fail-open external fetch |

---

## Metadata

**Analog search scope:** `backend/src/**/*.ts`, `frontend/src/**/*.{ts,tsx}`
**Files scanned:** 33 backend files, 20 frontend files
**Pattern extraction date:** 2026-05-03
