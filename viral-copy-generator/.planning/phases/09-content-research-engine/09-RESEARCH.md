# Phase 9: Content Research Engine — Research

**Researched:** 2026-05-03
**Domain:** External trend APIs + pg-boss scheduling + Drizzle schema + AI prompt generation + React screen integration
**Confidence:** HIGH (stack patterns verified against existing codebase; API quotas/limits cited from official docs)

---

## Summary

Phase 9 adds a self-contained Research screen to the existing `useState`-based screen switcher. The backend
fetches trend data from four external sources (YouTube Data API v3, google-trends-api npm, Reddit public JSON,
ExplodingTopics page fetch), caches results in a new `trend_cache` table with a 24-hour TTL, and merges that data
with each user's own learning history before making an AI call. A pg-boss daily scheduled job keeps the cache warm.
The frontend exposes four sub-tabs: Ideas, Hashtags, Calendar, Saved.

**Critical architectural constraint:** ExplodingTopics has no usable free API — the $249/month Business plan is
required for API access. The fallback is a plain `fetch()` of their public HTML category page followed by
regex/JSON extraction. This is fragile and should be implemented with robust error-swallowing so its failure
never blocks the other three sources.

**Primary recommendation:** Implement all four sources as independent, fail-open async fetchers. Any individual
source failure returns an empty array and logs an error — it never throws or blocks the combined result. The
`trend_cache` table is global (no `user_id`) so all users sharing the same niche benefit from one API call.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| External API fetching (YouTube, Trends, Reddit, ExplodingTopics) | Backend (Node.js) | — | API keys must not be exposed to browser; rate limit pooling; CORS restrictions |
| 24-hour trend cache | Database (Supabase) | — | Shared across all users for same niche; survives server restarts |
| pg-boss daily refresh job | Backend (Node.js) | — | Same pattern as `meta-refresh` and `cleanup-stale-files` already in boss.ts |
| On-demand refresh trigger | Backend (Node.js) | — | `POST /api/research/refresh` enqueues immediate pg-boss job |
| AI idea generation | Backend (Node.js) | — | Reuses existing `/api/ai/generate` proxy pattern for OpenAI; user's decrypted key accessed server-side |
| User learning context | Backend (Node.js) | — | Fetches user's top hooks/hashtags via existing `/api/learning/*` queries — same pattern as GeneratorPage |
| content_ideas persistence | Database (Supabase) | — | Per-user RLS table; `saved BOOLEAN` flag for save-idea feature |
| Research screen UI | Frontend (React/Vite) | — | New `ResearchPage.tsx` wired into App.tsx `currentScreen` state |
| Hashtag intelligence ranking | Backend (Node.js) | — | `trendVelocity * (1 + userAvgViews / 1000)` formula computed server-side before JSON response |
| 7-day calendar generation | Backend (Node.js) | — | Assigns ideas to PKT posting windows from learning data; frontend renders the grid |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESEARCH-01 | Content Research separate screen | `Screen` type in types.ts extended with `'research'`; App.tsx switch case added |
| RESEARCH-02 | YouTube trending via API v3, regionCode=PK, per-niche category ID | `videos.list` with `chart=mostPopular`, API key (not OAuth), costs 1 quota unit; category IDs documented below |
| RESEARCH-03 | Google Trends via `google-trends-api` npm | `interestOverTime + relatedQueries`, `geo: 'PK'`, version 4.9.2 confirmed current; rate-limit pitfall documented |
| RESEARCH-04 | Reddit public JSON API, niche subreddits | `GET /r/{sub}/hot.json` with custom `User-Agent` header; 10 QPM unauthenticated; subreddit map documented |
| RESEARCH-05 | ExplodingTopics emerging topics | API requires $249/month plan; fallback is `fetch()` HTML page + regex; fail-open required |
| RESEARCH-06 | 24h cache in `trend_cache` table, pg-boss daily refresh | `WHERE fetched_at > NOW() - INTERVAL '24 hours'`; Drizzle schema documented; pg-boss pattern matches boss.ts |
| RESEARCH-07 | Trend + learning data ranked by predicted performance | Server-side merge of cache data + learning endpoint results; returned as ranked JSON |
| RESEARCH-08 | AI generates 5-10 content ideas using combined context | Backend route calls AI; reuses user's provider + encrypted key via settings; prompt template documented |
| RESEARCH-09 | Each idea includes title, 3 hooks, outline, key moments, B-roll, platforms, strength | AI output schema documented; Zod-style TypeScript interface in types.ts |
| RESEARCH-10 | Gap pre-analysis per idea based on content type | Rule-based; no AI cost; same pattern as gaps.ts from Phase 4 |
| RESEARCH-11 | Hashtag intelligence tab with trendVelocity ranking | Backend merges external hashtags with `GET /api/learning/hashtags`; ranking formula documented |
| RESEARCH-12 | 7-day content calendar with PKT optimal windows | Backend uses `GET /api/learning/posting-times`; generates 7×N grid |
| RESEARCH-13 | Save idea to `content_ideas` table | `POST /api/research/ideas/:id/save`; RLS enforced |
| RESEARCH-14 | On-demand refresh bypasses 24h cache | `POST /api/research/refresh` fires pg-boss job immediately; existing `boss.send()` pattern |
| RESEARCH-15 | Freshness indicator | `fetched_at` returned from cache query; frontend formats as "Last updated: Xh ago" |
</phase_requirements>

---

## Standard Stack

### Core (already in backend/package.json — no new installs)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `pg-boss` | 12.18.1 | Daily scheduled job + on-demand refresh trigger | Already installed [VERIFIED: backend/package.json] |
| `drizzle-orm` | 0.45.2 | trend_cache + content_ideas schema + queries | Already installed [VERIFIED: backend/package.json] |
| `@supabase/supabase-js` | 2.105.1 | Auth middleware on all research routes | Already installed [VERIFIED: backend/package.json] |
| `googleapis` | 171.4.0 | YouTube Data API v3 client | Already installed [VERIFIED: backend/package.json] |

### New installs required
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `google-trends-api` | 4.9.2 | Google Trends interestOverTime + relatedQueries | Thin wrapper over Google's unofficial endpoint; current version confirmed [VERIFIED: npm view] |
| `node-fetch` or native `fetch` | Node 22 built-in | Reddit + ExplodingTopics HTTP fetches | Node 22 has native `fetch` — no install needed [ASSUMED: Node 22 global fetch] |

**Version verification:**
```bash
npm view google-trends-api version   # returns 4.9.2
npm view pg-boss version             # returns 12.18.2 (12.18.1 in package.json is fine)
```

**Installation:**
```bash
cd backend && npm install google-trends-api@4.9.2
```

No frontend dependencies needed — Research screen uses the same `apiFetch` helper from `api.ts`.

---

## Architecture Patterns

### System Architecture Diagram

```
User (Research screen)
        |
        | GET /api/research/trends?niche=travel
        v
[Express researchRouter]
        |
        |── Check trend_cache (WHERE source+niche, fetched_at > NOW()-24h)
        |       |
        |  Cache HIT ──────────────────────────────────> Return cached data
        |       |
        |  Cache MISS
        |       |
        |       |── [fetchYouTubeTrends(niche)] ─── YouTube Data API v3
        |       |── [fetchGoogleTrends(niche)]  ─── google-trends-api
        |       |── [fetchRedditTrends(niche)]  ─── reddit.com/r/{sub}/hot.json
        |       |── [fetchExplodingTopics()]    ─── explodingtopics.com (fail-open)
        |       |
        |  Promise.allSettled() → merge fulfilled results
        |       |
        |  INSERT INTO trend_cache (source, niche, data, fetched_at)
        |       |
        |  Return merged trend data
        |
        | POST /api/research/generate
        v
[Express researchRouter]
        |
        |── GET /api/learning/hooks   (user's top hooks)
        |── GET /api/learning/hashtags (user's top hashtags)
        |── GET /api/learning/niche-performance (best niche)
        |── GET /api/learning/posting-times (PKT windows)
        |── Fetch trend_cache for user's niches
        |
        |── Build AI prompt (trend context + learning context)
        |── Call AI provider (reuse user's ai_provider + decrypted key)
        |── Parse JSON response → ContentIdea[]
        |── INSERT INTO content_ideas (user_id, idea, niches, platforms, generated_at)
        v
Return { ideas: ContentIdea[], calendar: CalendarDay[], hashtags: HashtagIntel[] }
```

### Recommended Project Structure

New files only — all existing files unchanged:
```
backend/src/
├── routes/
│   └── research.ts          — All /api/research/* route handlers
├── lib/
│   ├── trends/
│   │   ├── youtube.ts       — fetchYouTubeTrends(niche): TrendItem[]
│   │   ├── google-trends.ts — fetchGoogleTrends(niche): TrendItem[]
│   │   ├── reddit.ts        — fetchRedditTrends(niche): TrendItem[]
│   │   └── exploding.ts     — fetchExplodingTopics(niche): TrendItem[]
│   ├── research-cache.ts    — getTrendCache(), setTrendCache(), isCacheFresh()
│   ├── research-ai.ts       — buildResearchPrompt(), callResearchAI()
│   └── calendar.ts          — buildCalendar(ideas, postingTimes): CalendarDay[]
backend/src/db/
└── schema.ts                — EXTEND with trend_cache + content_ideas tables

frontend/src/
├── pages/
│   └── ResearchPage.tsx     — 4-tab panel (Ideas, Hashtags, Calendar, Saved)
├── lib/
│   ├── types.ts             — EXTEND with ContentIdea, HashtagIntel, CalendarDay, ResearchResponse
│   └── api.ts               — EXTEND with fetchResearchTrends, generateResearchIdeas, saveIdea, refreshTrends
```

### Pattern 1: pg-boss Daily Refresh Job

**What:** Scheduled job that refreshes all niches from all external sources at 5am UTC daily.
**When to use:** All scheduled background processing in this codebase uses this pattern.

```typescript
// Source: backend/src/lib/boss.ts (verified pattern from existing codebase)
// backend/src/lib/research-refresh.ts

export async function registerResearchRefreshJob(bossInstance: PgBoss): Promise<void> {
  // CRITICAL: createQueue() BEFORE schedule() — FK constraint on pgboss.schedule.name
  await bossInstance.createQueue('refresh-trends')

  // Idempotent restart guard — same pattern as cleanup-stale-files and meta-token-refresh
  try {
    await bossInstance.schedule('refresh-trends', '0 5 * * *', {})
  } catch (err: unknown) {
    const msg = (err as Error).message ?? ''
    if (!msg.includes('duplicate') && !msg.includes('unique')) throw err
  }

  // Work handler receives Job<T>[] array — iterate with for..of
  await bossInstance.work<Record<string, never>>('refresh-trends', async (_jobs) => {
    const NICHES = ['travel', 'hotels', 'cars', 'bikes', 'coding', 'lifestyle']
    for (const niche of NICHES) {
      await refreshTrendCache(niche)
    }
    console.log('[pg-boss] refresh-trends completed')
  })

  console.log('[pg-boss] refresh-trends job registered')
}
```

Register in `backend/src/index.ts` after existing registrations:
```typescript
await registerResearchRefreshJob(boss)  // Phase 9
```

### Pattern 2: Fail-Open Trend Fetchers with Promise.allSettled

**What:** Each external source is called independently; one failure never blocks others.
**When to use:** Any time multiple unreliable external APIs must be called in parallel.

```typescript
// backend/src/lib/trends/[source].ts pattern
// Source: [ASSUMED — standard Node.js pattern, verified against codebase style]

export interface TrendItem {
  title: string
  score: number          // relative trend score 0-100
  source: 'youtube' | 'google-trends' | 'reddit' | 'exploding-topics'
  url?: string
}

// Example: Reddit fetcher
const SUBREDDIT_MAP: Record<string, string[]> = {
  travel:    ['pakistan', 'travel', 'CasualPakistan'],
  hotels:    ['pakistan', 'travel'],
  cars:      ['motorcycles', 'pakistan'],
  bikes:     ['motorcycles', 'pakistan'],
  coding:    ['programming', 'learnprogramming'],
  lifestyle: ['CasualPakistan', 'pakistan'],
}

export async function fetchRedditTrends(niche: string): Promise<TrendItem[]> {
  const subs = SUBREDDIT_MAP[niche] ?? ['pakistan']
  const results: TrendItem[] = []
  for (const sub of subs) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, {
        headers: {
          // REQUIRED: Reddit rejects default Node.js User-Agent — returns 429 or 403
          'User-Agent': 'viral-copy-generator/1.0 (by /u/viral_copy_bot)',
        },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const data = await res.json() as RedditResponse
      const posts = data?.data?.children ?? []
      for (const post of posts) {
        results.push({
          title: post.data.title,
          score: Math.min(100, Math.floor(post.data.score / 100)),
          source: 'reddit',
          url: `https://reddit.com${post.data.permalink}`,
        })
      }
    } catch {
      // Fail-open: one subreddit timeout does not abort the whole niche fetch
      continue
    }
  }
  return results
}
```

### Pattern 3: 24-Hour Cache Query

```typescript
// backend/src/lib/research-cache.ts
// Source: [ASSUMED — standard Drizzle pattern verified against existing codebase SQL style]
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { trend_cache } from '../db/schema.js'

export async function getTrendCache(source: string, niche: string): Promise<TrendItem[] | null> {
  const rows = await db.execute<{ data: TrendItem[]; fetched_at: Date }>(
    sql`SELECT data, fetched_at FROM trend_cache
        WHERE source = ${source}
          AND niche = ${niche}
          AND fetched_at > NOW() - INTERVAL '24 hours'
        ORDER BY fetched_at DESC
        LIMIT 1`
  )
  return rows.rows[0]?.data ?? null
}

export async function setTrendCache(
  source: string,
  niche: string,
  data: TrendItem[],
): Promise<void> {
  await db.execute(
    sql`INSERT INTO trend_cache (source, niche, data, fetched_at)
        VALUES (${source}, ${niche}, ${JSON.stringify(data)}::jsonb, NOW())
        ON CONFLICT (source, niche)
        DO UPDATE SET data = ${JSON.stringify(data)}::jsonb, fetched_at = NOW()`
  )
}
```

### Pattern 4: Google Trends API Call

```typescript
// backend/src/lib/trends/google-trends.ts
// Source: [CITED: https://github.com/pat310/google-trends-api/blob/master/README.md]
import googleTrends from 'google-trends-api'

export async function fetchGoogleTrends(niche: string): Promise<TrendItem[]> {
  try {
    const raw = await googleTrends.relatedQueries({
      keyword: niche,
      geo: 'PK',                    // Pakistan
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),  // last 7 days
    })
    const parsed = JSON.parse(raw as string) as GoogleTrendsResponse
    const rising = parsed?.default?.rankedList?.[1]?.rankedKeyword ?? []
    return rising.slice(0, 10).map((item) => ({
      title: item.query,
      score: item.value,
      source: 'google-trends' as const,
    }))
  } catch {
    // Google Trends blocks with CAPTCHA under high request frequency.
    // 24h cache means this is called at most once/day per niche — low risk.
    return []
  }
}
```

### Pattern 5: YouTube Data API v3

```typescript
// backend/src/lib/trends/youtube.ts
// Source: [CITED: https://developers.google.com/youtube/v3/docs/videos/list]
import { google } from 'googleapis'

const YOUTUBE_CATEGORY_MAP: Record<string, string> = {
  travel:    '19',   // Travel & Events [VERIFIED: mixedanalytics.com]
  hotels:    '19',   // Travel & Events
  cars:      '2',    // Autos & Vehicles [VERIFIED: mixedanalytics.com]
  bikes:     '2',    // Autos & Vehicles
  coding:    '28',   // Science & Technology [VERIFIED: mixedanalytics.com]
  lifestyle: '22',   // People & Blogs [VERIFIED: mixedanalytics.com]
}

const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY })

export async function fetchYouTubeTrends(niche: string): Promise<TrendItem[]> {
  try {
    const categoryId = YOUTUBE_CATEGORY_MAP[niche] ?? '24'  // Entertainment fallback
    const res = await youtube.videos.list({
      part: ['snippet', 'statistics'],
      chart: 'mostPopular',
      regionCode: 'PK',
      videoCategoryId: categoryId,
      maxResults: 10,
    })
    return (res.data.items ?? []).map((video) => ({
      title: video.snippet?.title ?? '',
      score: Math.min(100, Math.floor(Number(video.statistics?.viewCount ?? 0) / 10000)),
      source: 'youtube' as const,
      url: `https://youtube.com/watch?v=${video.id}`,
    }))
  } catch {
    return []
  }
}
```

### Pattern 6: Research Route Handler

```typescript
// backend/src/routes/research.ts
// Source: [ASSUMED — follows existing route handler pattern from learning.ts/admin.ts]
import { Router, type Request, type Response } from 'express'
import { getTrendCache, setTrendCache } from '../lib/research-cache.js'
import { fetchYouTubeTrends } from '../lib/trends/youtube.js'
import { fetchGoogleTrends } from '../lib/trends/google-trends.js'
import { fetchRedditTrends } from '../lib/trends/reddit.js'
import { fetchExplodingTopics } from '../lib/trends/exploding.js'

export const researchRouter = Router()

researchRouter.get('/trends', async (req: Request, res: Response) => {
  const niche = (req.query['niche'] as string) ?? 'travel'

  // Serve from cache if fresh
  const cached = await getTrendCache('all', niche)
  if (cached) {
    return res.json({ trends: cached, fromCache: true })
  }

  // Fetch all sources in parallel — any failure is swallowed
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
  res.json({ trends, fromCache: false })
})
```

### Pattern 7: Research Screen Integration in App.tsx

The `Screen` type in `frontend/src/lib/types.ts` must be extended:

```typescript
// frontend/src/lib/types.ts — add 'research' to Screen union
export type Screen = 'generator' | 'settings' | 'history' | 'learning' | 'admin' | 'research'
```

In `frontend/src/App.tsx` — add after the `learning` branch:
```tsx
// Source: [VERIFIED: frontend/src/App.tsx — existing pattern for all screens]
if (currentScreen === 'research') {
  return <ResearchPage onNavigate={setCurrentScreen} />
}
```

The Research tab button goes in the nav alongside History/Learning — same `onClick={() => setCurrentScreen('research')}` pattern as all other screens.

### Anti-Patterns to Avoid

- **Calling trend APIs in the request path without cache check first:** Always check `trend_cache` before hitting external APIs. One user request should never trigger 4 external API calls.
- **Storing `user_id` in `trend_cache`:** The cache is global — all users sharing a niche get the same data. Per-user storage would exhaust YouTube quota instantly.
- **Using `boss.schedule()` before `boss.createQueue()`:** This causes a FK constraint violation crash on startup. The existing `boss.ts` and `meta-refresh.ts` demonstrate the correct order — copy their try/catch guard exactly.
- **Throwing inside individual trend fetchers:** Use try/catch that returns `[]` — the caller uses `Promise.allSettled()` which only works when fetchers resolve (not reject).
- **Dynamic Tailwind width classes in the calendar grid:** Use `style={{ width: `${pct}%` }}` inline as in LearningPage — established project rule for bar chart widths.
- **Reading Google Trends result without JSON.parse:** `google-trends-api` returns a JSON string, not a parsed object. Always `JSON.parse(raw)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YouTube API authentication | Custom HTTP + OAuth flow | `google.youtube({ version: 'v3', auth: API_KEY })` from `googleapis` (already installed) | googleapis handles auth, retries, type safety |
| Cron scheduling | Custom setInterval / node-cron | `boss.schedule('job', '0 5 * * *', {})` — pg-boss already running | pg-boss survives server restarts; in-DB persistence |
| Google Trends HTTP requests | Custom fetch to trends.google.com | `google-trends-api` npm package | Google's unofficial endpoint requires cookie handling; the npm package handles this |
| Cache TTL logic | Custom timestamps + expiry math | `WHERE fetched_at > NOW() - INTERVAL '24 hours'` SQL | Atomic, timezone-safe, no race conditions |
| AI call routing | New AI client logic | Reuse `/api/ai/generate` proxy pattern + `callResearchAI()` that reads user's `ai_provider` and decrypted key from settings | Per-user key management already solved in Phase 5 |

**Key insight:** The hardest problems in this phase (job scheduling, AI provider routing, per-user auth, DB caching) are all already solved by existing Phase 1-7 infrastructure. Phase 9 is primarily wiring and UI, not new architectural invention.

---

## Drizzle Schema — New Tables

Both tables extend the existing `backend/src/db/schema.ts`. Add at the bottom:

```typescript
// ============================================================
// trend_cache
// RESEARCH-06: Global cache — no user_id, no RLS needed
// Shared across all users for the same (source, niche) pair to
// conserve external API quota. One row per (source, niche) pair.
// 24h TTL enforced in query: WHERE fetched_at > NOW() - INTERVAL '24 hours'
// ============================================================
export const trend_cache = pgTable('trend_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source').notNull(),    // 'youtube' | 'google-trends' | 'reddit' | 'exploding-topics' | 'all'
  niche: text('niche').notNull(),
  data: jsonb('data').$type<TrendItem[]>().notNull().default([]),
  fetched_at: timestamp('fetched_at').defaultNow().notNull(),
}, (table) => [
  // Unique constraint enables ON CONFLICT DO UPDATE upsert pattern
  index('trend_cache_source_niche_idx').on(table.source, table.niche),
])

// ============================================================
// content_ideas
// RESEARCH-13: Per-user saved ideas with RLS
// ============================================================
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

**Note on trend_cache unique constraint:** The `setTrendCache` upsert requires a UNIQUE constraint on `(source, niche)`. The schema above uses an index — add an explicit `unique()` call or use `UNIQUE INDEX` in the migration SQL. The correct Drizzle syntax:

```typescript
// In the table config:
}, (table) => [
  unique('trend_cache_source_niche_unique').on(table.source, table.niche),
])
```

Import `unique` from `drizzle-orm/pg-core`.

---

## AI Prompt Structure

The research AI prompt differs from the generator prompt (Phase 5) — it focuses on ideation, not copy generation.

```typescript
// backend/src/lib/research-ai.ts
// Source: [ASSUMED — prompt structure follows Phase 5 pattern from ROADMAP.md spec]

export function buildResearchPrompt(params: {
  trends: TrendItem[]
  topHooks: TopHook[]
  topHashtags: TopHashtag[]
  bestNiche: string
  postingTimes: PostingTimeSlot[]
  userNiches: string[]
}): string {
  return `You are a content strategist for Pakistani short-form video creators.

TRENDING TOPICS (last 24h, Pakistan region):
${params.trends.slice(0, 20).map(t => `- ${t.title} (score: ${t.score}, source: ${t.source})`).join('\n')}

USER'S TOP-PERFORMING HOOKS:
${params.topHooks.map(h => `- "${h.hook_text}" (${h.max_views} views)`).join('\n') || 'No data yet'}

USER'S TOP HASHTAGS:
${params.topHashtags.map(h => `#${h.hashtag} (${Math.round(h.avg_views)} avg views)`).join(', ') || 'No data yet'}

USER'S BEST NICHE: ${params.bestNiche}
USER'S CONTENT NICHES: ${params.userNiches.join(', ')}
PKT OPTIMAL POSTING WINDOWS: ${params.postingTimes.slice(0, 3).map(t => `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][t.dow]} ${t.hour}:00 PKT (${t.platform})`).join(', ')}

Generate ${5}-${10} content ideas for Pakistani short-form video creators in the niches: ${params.userNiches.join(', ')}.

Return a JSON array with this exact schema:
[{
  "title": "string",
  "angle": "string",
  "hookVariants": ["hook1", "hook2", "hook3"],
  "scriptOutline": "string",
  "keyMoments": [{"timestamp": "0:00", "description": "string"}],
  "brollSuggestions": ["string"],
  "platforms": ["youtube", "instagram"],
  "estimatedStrength": 75,
  "gapWarnings": ["string"],
  "hashtagSuggestions": ["string"]
}]

Use English with natural Urdu code-switching (e.g., "yaar", "bhai", "scene kya hai") for Pakistani audience.
Return ONLY valid JSON. No markdown fences. No explanation text.`
}
```

**AI provider routing:** Reuse the exact same provider-routing pattern from Phase 5's `/api/ai/generate` proxy. The research AI call happens entirely server-side (unlike Phase 5 where Gemini and Claude are browser-callable), so:
- Gemini: use Gemini SDK server-side (no Files API needed — text-only prompt)
- Claude: call server-side (no `dangerouslyAllowBrowser` needed)
- OpenAI: direct call from backend (no proxy needed)

This is SIMPLER than Phase 5 because there are no video frames to send.

---

## Common Pitfalls

### Pitfall 1: pg-boss createQueue() / schedule() Order
**What goes wrong:** `boss.schedule('refresh-trends', cron, {})` fails with FK violation if `createQueue` is not called first.
**Why it happens:** pg-boss v12 `pgboss.schedule` table has a FK on `(name)` referencing `pgboss.queue`.
**How to avoid:** Always call `await boss.createQueue(name)` before `await boss.schedule(name, ...)`. Then wrap `schedule()` in the duplicate-key try/catch guard (see existing `boss.ts`).
**Warning signs:** Startup crash: `insert or update on table "schedule" violates foreign key constraint`

### Pitfall 2: Google Trends CAPTCHA Block
**What goes wrong:** `google-trends-api` throws `302 Moved / CAPTCHA` after multiple rapid calls.
**Why it happens:** Google detects automated scraping and redirects to a CAPTCHA page.
**How to avoid:** The 24h cache means this is called at most once per niche per day — well within the ~1400 requests/day limit. Wrap in try/catch returning `[]`. Never call `google-trends-api` in the request path without checking cache first.
**Warning signs:** Error message contains `302` or `CAPTCHA` in the google-trends-api error.

### Pitfall 3: Reddit User-Agent Rejection
**What goes wrong:** Reddit returns 429 Too Many Requests or a rate limit HTML page instead of JSON.
**Why it happens:** Reddit's API requires a custom `User-Agent` string. Default Node.js `fetch` User-Agent is blocklisted.
**How to avoid:** Always set `'User-Agent': 'viral-copy-generator/1.0 (by /u/viral_copy_bot)'` in the fetch headers. [CITED: Reddit API documentation]
**Warning signs:** Response body is HTML (Reddit rate limit page) instead of JSON — JSON.parse will throw.

### Pitfall 4: YouTube API Key vs OAuth
**What goes wrong:** Developer uses a per-user OAuth token for `videos.list?chart=mostPopular`. This ties trend fetching to whether a specific user has connected YouTube.
**Why it happens:** Confusion between read-only public data (API key sufficient) and user-specific data (OAuth required).
**How to avoid:** Use `YOUTUBE_API_KEY` env var (a server-side API key, not OAuth) for `videos.list`. OAuth is only needed for uploads and user-specific data. [VERIFIED: developers.google.com/youtube/v3/docs/videos/list]
**Warning signs:** Getting 401 when no user is connected, or trend cache failing for users without YouTube OAuth.

### Pitfall 5: ExplodingTopics HTML Structure Changes
**What goes wrong:** ExplodingTopics page scraping breaks silently when they change their HTML/JS rendering.
**Why it happens:** ExplodingTopics is a JS-rendered SPA — the raw HTML fetch may not contain the topic data if they lazy-load it.
**How to avoid:** Implement `fetchExplodingTopics` as a defensive fetch that: (1) tries a simple `fetch()`, (2) looks for JSON in `<script>` tags with a regex, (3) catches ALL errors and returns `[]`. Never let this function throw. Flag it as `LOW` confidence data.
**Warning signs:** ExplodingTopics returns 0 results while other sources return data normally.

### Pitfall 6: trend_cache UNIQUE Constraint Missing
**What goes wrong:** The `ON CONFLICT (source, niche) DO UPDATE` upsert fails at runtime with "there is no unique or exclusion constraint matching the ON CONFLICT specification".
**Why it happens:** Drizzle `index()` creates a regular index, not a UNIQUE constraint.
**How to avoid:** Use `unique('trend_cache_source_niche_unique').on(table.source, table.niche)` in the schema — import `unique` from `drizzle-orm/pg-core`. Run `drizzle-kit generate + migrate` after schema change.
**Warning signs:** Runtime error: `there is no unique or exclusion constraint`

### Pitfall 7: google-trends-api Returns String, Not Object
**What goes wrong:** `googleTrends.interestOverTime(...)` returns a JSON string, not a parsed object. Accessing `.default.rankedList` on the raw string crashes with "Cannot read property of undefined".
**Why it happens:** The library returns raw JSON text (designed for piping to JSON consumers).
**How to avoid:** Always `JSON.parse(await googleTrends.relatedQueries(...))`.

### Pitfall 8: Content Ideas AI Parse Failure
**What goes wrong:** AI returns markdown-fenced JSON or truncated JSON; parsing fails; no ideas shown.
**Why it happens:** Same issue as Phase 5's platform card JSON parsing.
**How to avoid:** Reuse Phase 5's JSON robustness pattern: strip markdown fences → find first `[` / last `]` → `JSON.parse` → on failure return `[]`. Never show a blank screen.

---

## External API Reference

### YouTube Data API v3 — `videos.list`

- **Endpoint:** `GET https://www.googleapis.com/youtube/v3/videos`
- **Auth:** API key only (public data — no OAuth required) [VERIFIED: developers.google.com/youtube/v3/docs]
- **Quota cost:** 1 unit per request [VERIFIED: developers.google.com/youtube/v3/determine_quota_cost]
- **Daily quota:** 10,000 units/day default [CITED: developers.google.com/youtube/v3]
- **Key parameters:** `chart=mostPopular`, `regionCode=PK`, `videoCategoryId={id}`, `part=snippet,statistics`, `maxResults=10`
- **Category IDs for project niches:** [VERIFIED: mixedanalytics.com/blog/list-of-youtube-video-category-ids]
  - Travel & Events: `19` (travel, hotels)
  - Autos & Vehicles: `2` (cars, bikes)
  - Science & Technology: `28` (coding)
  - People & Blogs: `22` (lifestyle)
  - Entertainment: `24` (fallback)
- **Env var required:** `YOUTUBE_API_KEY` (Google Cloud Console → API key, not OAuth credential)
- **Rate limit concern:** With 6 niches × 1 call each = 6 units/day run — negligible against 10,000 unit budget.

### google-trends-api npm — `relatedQueries`

- **Package:** `google-trends-api@4.9.2` [VERIFIED: npm view]
- **Method:** `googleTrends.relatedQueries({ keyword, geo: 'PK', startTime: Date })`
- **Returns:** JSON string (must `JSON.parse`)
- **Response path:** `parsed.default.rankedList[1].rankedKeyword` (index 1 = "rising" queries; index 0 = "top" queries)
- **Rate limit:** ~1400 requests/24h before CAPTCHA; daily cache keeps actual usage at 6-12 calls/day
- **Known issue:** Returns `302 / CAPTCHA` on rapid burst requests — handled by try/catch returning `[]`
- **Import:** `import googleTrends from 'google-trends-api'` (default import)

### Reddit Public JSON API

- **Endpoint:** `https://www.reddit.com/r/{subreddit}/hot.json?limit=10`
- **Auth:** None required for public subreddits [CITED: Reddit API documentation]
- **Rate limit:** 10 requests/minute unauthenticated [CITED: data365.co/blog/reddit-api-limits]
- **User-Agent:** MANDATORY — `'viral-copy-generator/1.0 (by /u/viral_copy_bot)'` [CITED: Reddit API docs]
- **Response path:** `data.data.children[].data.{ title, score, permalink }`
- **Subreddit map:**
  - travel: `pakistan`, `travel`, `CasualPakistan`
  - hotels: `pakistan`, `travel`
  - cars/bikes: `motorcycles`, `pakistan`
  - coding: `programming`, `learnprogramming`
  - lifestyle: `CasualPakistan`, `pakistan`

### ExplodingTopics

- **Free API:** Does not exist — API access costs $249/month (Business plan) [CITED: tipsonblogging.com/exploding-topics-pricing]
- **Fallback strategy:** `fetch('https://explodingtopics.com/blog/trending-topics')` + regex extract JSON from `<script>` tags
- **Reliability:** LOW — JS-rendered SPA may not expose data in raw HTML fetch
- **Recommendation:** Implement as pure best-effort fetcher returning `[]` on any failure. Mark results from this source as `LOW` confidence.
- **Alternative:** If ExplodingTopics scraping is consistently empty, replace with a second Google Trends call using `interestOverTime` with different keywords. The phase spec says "ExplodingTopics or similar source."

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Reddit OAuth required for all endpoints | Public subreddits accessible via `.json` appended to URL, no OAuth | Before 2023 | Simplifies implementation — no OAuth needed for read-only public data |
| google-trends-api relied on unofficial endpoint | Same unofficial endpoint; Google launched official Trends API in alpha (July 2025) | July 2025 | Official API is alpha-only with limited endpoints — unofficial npm package remains the practical choice for now |
| ExplodingTopics had a public trends page | ExplodingTopics is now fully JS-rendered; scraping is unreliable | ~2024 | Must treat as fail-open optional enrichment only |

**Deprecated/outdated:**
- `youtube.readonly` OAuth scope for `videos.list?chart=mostPopular`: This is NOT needed. API key is sufficient for public data. The ROADMAP.md mentions "reuses user's YouTube OAuth token" — but this is incorrect for public chart data. Use a server-side API key instead.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js global `fetch` | Reddit + ExplodingTopics HTTP | ✓ | Node 22 built-in | — |
| `googleapis` npm | YouTube Data API | ✓ | 171.4.0 (backend/package.json) | — |
| `google-trends-api` npm | Google Trends | ✗ (not yet installed) | 4.9.2 (to install) | Skip source, return [] |
| `YOUTUBE_API_KEY` env var | YouTube trends fetch | ✗ (not in .env) | — | Skip YouTube source, return [] |
| Supabase PostgreSQL | trend_cache + content_ideas tables | ✓ | Running (Phase 1 confirmed) | — |
| pg-boss | Daily refresh job | ✓ | 12.18.1 (backend/package.json) | — |

**Missing dependencies with no fallback:**
- `YOUTUBE_API_KEY` — must be provisioned in `.env` before YouTube trends work. The route must check for this env var and skip YouTube fetching if absent.

**Missing dependencies with fallback:**
- `google-trends-api` — install in Wave 0; route fails-open if absent at test time.
- `YOUTUBE_API_KEY` — YouTube fetcher returns `[]` if env var missing, other sources still work.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `backend/vitest.config.ts` |
| Quick run command | `cd backend && npm test -- --reporter=verbose tests/research.test.ts` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RESEARCH-06 | Cache hit returns cached data; cache miss triggers fetch | unit | `npm test -- tests/research-cache.test.ts` | ❌ Wave 0 |
| RESEARCH-06 | pg-boss refresh-trends job registers without crash | unit | `npm test -- tests/research-refresh.test.ts` | ❌ Wave 0 |
| RESEARCH-02 | YouTube fetcher returns TrendItem[] with correct shape | unit | `npm test -- tests/research-cache.test.ts` | ❌ Wave 0 |
| RESEARCH-03 | Google Trends fetcher: success + CAPTCHA error both return valid shape | unit | `npm test -- tests/research-cache.test.ts` | ❌ Wave 0 |
| RESEARCH-04 | Reddit fetcher: success + User-Agent header set | unit | `npm test -- tests/research-cache.test.ts` | ❌ Wave 0 |
| RESEARCH-08 | AI prompt includes trend data + learning data | unit | `npm test -- tests/research-ai.test.ts` | ❌ Wave 0 |
| RESEARCH-09 | AI response parsed into ContentIdea[] with all required fields | unit | `npm test -- tests/research-ai.test.ts` | ❌ Wave 0 |
| RESEARCH-13 | GET /api/research/saved returns only authenticated user's saved ideas (RLS) | integration | `npm test -- tests/research.test.ts` | ❌ Wave 0 |
| RESEARCH-14 | POST /api/research/refresh enqueues pg-boss job | integration | `npm test -- tests/research.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npm test -- --reporter=verbose tests/research*.test.ts`
- **Per wave merge:** `cd backend && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work 9`

### Wave 0 Gaps
- [ ] `backend/tests/research-cache.test.ts` — covers RESEARCH-06, trend fetcher shapes
- [ ] `backend/tests/research-ai.test.ts` — covers RESEARCH-08, RESEARCH-09 prompt + parse
- [ ] `backend/tests/research.test.ts` — integration: route handlers with pg-mem + auth
- [ ] `backend/npm install google-trends-api@4.9.2` — required for Google Trends fetcher

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `authMiddleware` (already implemented) on all `/api/research/*` routes |
| V3 Session Management | no | Handled by Supabase Auth — no new session logic |
| V4 Access Control | yes | RLS on `content_ideas` table; `trend_cache` is global (intentional — no user data) |
| V5 Input Validation | yes | `niche` query param must be validated against `NICHES` allowlist before DB query |
| V6 Cryptography | no | No new crypto — AI key decryption reuses existing `encryption.ts` |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Niche param injection | Tampering | Validate `niche` against allowlist `NICHES` array before using in SQL or external API calls |
| trend_cache data poisoning | Tampering | External API data stored in JSONB; only backend writes to it; no user-controlled data in cache |
| AI prompt injection via trend data | Tampering | External trend titles are included in prompt — sanitize by stripping backticks and injection markers before inserting into prompt string |
| Content idea RLS bypass | Elevation of Privilege | `pgPolicy` enforces `user_id = auth.uid()` on `content_ideas`; same pattern as all other tables |
| ExplodingTopics fetch SSRF | Elevation of Privilege | URL is a compile-time constant, not user-provided — no SSRF risk |

---

## Recommended Plan Breakdown

Phase 9 should be 7 plans across 4 waves:

### Wave 1: Foundation (Plans 09-01, 09-02)
- **09-01:** DB schema (trend_cache + content_ideas tables) + drizzle-kit generate + migrate + Wave 0 test stubs [BLOCKING]
- **09-02:** Trend fetcher library (`backend/src/lib/trends/*.ts`) — YouTube, Google Trends, Reddit, ExplodingTopics — all fail-open, tested with mocks

### Wave 2: Backend Routes (Plans 09-03, 09-04)
- **09-03:** Research cache + pg-boss refresh job (`research-cache.ts`, `research-refresh.ts`) + register in `index.ts`
- **09-04:** Research routes (`GET /trends`, `POST /generate`, `GET /saved`, `POST /ideas/:id/save`, `POST /refresh`) + auth middleware + niche validation

### Wave 3: AI + Calendar (Plan 09-05)
- **09-05:** `research-ai.ts` (prompt builder + AI provider routing) + `calendar.ts` (7-day grid from posting times) + `GET /api/research/hashtags` ranked endpoint

### Wave 4: Frontend (Plans 09-06, 09-07)
- **09-06:** `types.ts` Phase 9 extensions + `api.ts` research client functions + `ResearchPage.tsx` skeleton wired into `App.tsx`
- **09-07:** `ResearchPage.tsx` full implementation (4 tabs: Ideas, Hashtags, Calendar, Saved) + automated verification checkpoint

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Node 22 built-in `fetch` is available globally without import | Standard Stack | Research routes would need to import `node-fetch` — easy fix |
| A2 | ExplodingTopics returns any usable data from a plain HTML fetch | External API Reference | ExplodingTopics section will return empty array for all users — acceptable, system degrades gracefully |
| A3 | AI research call is text-only (no frames), making it simpler than Phase 5 | AI Prompt Structure | If the AI provider routing has edge cases without frames, provider logic needs adjustment |
| A4 | `YOUTUBE_API_KEY` is a simple API key (not OAuth client credential) in `.env` | Environment Availability | If team wants to use per-user OAuth token instead, the YouTube fetcher must read from user's `platform_config.youtube` — more complex but feasible |
| A5 | `google-trends-api` default import works in ESM (`"type": "module"` in package.json) | Standard Stack | May require `import googleTrends from 'google-trends-api'` with `createRequire` wrapper if the package is CJS-only — check after install |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.
*(Table is not empty — A2 and A5 in particular should be validated during Wave 0.)*

---

## Open Questions

1. **YOUTUBE_API_KEY vs per-user OAuth token**
   - What we know: Public chart data (`videos.list?chart=mostPopular`) requires only a server-side API key, not per-user OAuth
   - What's unclear: Whether the team wants to maintain one global API key or route through each user's connected YouTube account
   - Recommendation: Use `YOUTUBE_API_KEY` server-side env var. Add it to `.env.example` and the `REQUIRED_ENV` check in `index.ts` — OR make it optional (skip YouTube source if absent) to avoid a hard startup dependency.

2. **google-trends-api CJS/ESM compatibility**
   - What we know: `backend/package.json` has `"type": "module"`; `google-trends-api` 4.9.2 is a CommonJS module
   - What's unclear: Whether `import googleTrends from 'google-trends-api'` works or requires a `createRequire` workaround
   - Recommendation: Test immediately in Wave 0 with a small spike: `tsx -e "import googleTrends from 'google-trends-api'; console.log(typeof googleTrends)"`. If it fails, wrap with `import { createRequire } from 'module'; const require = createRequire(import.meta.url); const googleTrends = require('google-trends-api')`.

3. **ResearchPage UI complexity vs phase scope**
   - What we know: ROADMAP specifies 4 sub-tabs (Ideas, Hashtags, Calendar, Saved)
   - What's unclear: Whether the calendar should be a visual grid or a simple list
   - Recommendation: Implement as a 7-row table (one row per day, columns per platform) using Tailwind. Avoid any charting library — inline styles only per project rules.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: backend/package.json] — installed packages and versions
- [VERIFIED: backend/src/lib/boss.ts] — pg-boss createQueue/schedule pattern
- [VERIFIED: backend/src/db/schema.ts] — existing Drizzle schema patterns to match
- [VERIFIED: frontend/src/App.tsx] — useState screen switcher integration point
- [VERIFIED: frontend/src/lib/types.ts] — Screen type, existing type patterns
- [VERIFIED: backend/src/routes/learning.ts] — route handler patterns to reuse
- [VERIFIED: npm view google-trends-api] — version 4.9.2
- [CITED: developers.google.com/youtube/v3/docs/videos/list] — API endpoint, auth requirements
- [CITED: developers.google.com/youtube/v3/determine_quota_cost] — 1 unit per videos.list call
- [CITED: mixedanalytics.com/blog/list-of-youtube-video-category-ids] — YouTube category IDs

### Secondary (MEDIUM confidence)
- [CITED: github.com/pat310/google-trends-api/blob/master/README.md] — interestOverTime/relatedQueries API, geo param, response shape
- [CITED: data365.co/blog/reddit-api-limits] — Reddit 10 QPM unauthenticated rate limit
- [CITED: tipsonblogging.com/exploding-topics-pricing] — ExplodingTopics $249/month for API access

### Tertiary (LOW confidence)
- [ASSUMED] — google-trends-api CAPTCHA threshold (~1400 requests/day) — based on WebSearch community reports
- [ASSUMED] — ExplodingTopics HTML page scrapability — not verified against live site structure

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all libraries verified against package.json and npm registry
- Architecture: HIGH — all patterns verified against existing Phase 1-8 codebase; this phase follows established patterns throughout
- External APIs: MEDIUM — YouTube and Reddit verified against official docs; google-trends-api verified against GitHub README; ExplodingTopics is LOW (scraping reliability unverifiable without live test)
- Pitfalls: HIGH — pg-boss pitfalls are verified from STATE.md accumulated context; API pitfalls are MEDIUM/LOW

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (30 days — stable libraries; external API rate limits are stable)
