---
phase: 09-content-research-engine
verified: 2026-05-04T00:00:00Z
status: passed
score: 15/15 must-haves verified
overrides_applied: 0
gaps: []
gap_fixes:
  - gap: "Gemini JSON mode missing responseSchema"
    fix: "Added responseSchema (SchemaType.ARRAY of ContentIdeaData objects) to generationConfig in the Gemini branch of callResearchAI — commit fix(09): add Gemini responseSchema"
    status: resolved
human_verification:
  - test: "End-to-end Research screen flow"
    expected: "Research button opens screen, niche selector loads trends, Generate produces 5-10 idea cards with hook variants, Hashtags tab shows ranked bars, Calendar tab shows 7-day grid, Save/Unsave cycles from Saved tab, Refresh fires pg-boss job"
    why_human: "Requires running backend + frontend with valid API key and Supabase credentials; network calls to YouTube/Google/Reddit can only be verified live"
  - test: "Two different users get different personalised recommendations (RESEARCH-09 roadmap SC #9)"
    expected: "User A and User B each see different content ideas because their own learning_signals rows differ"
    why_human: "Requires two active Supabase user accounts with different learning history populated"
  - test: "Gemini responseSchema fix runtime validation — after adding responseSchema, Gemini provider returns valid ContentIdeaData[] array without manual fence-stripping"
    expected: "JSON response is well-formed array, safeParseIdeas succeeds on first try without needing fence stripping"
    why_human: "Requires live Gemini API key to call gemini-2.5-flash with updated config"
---

# Phase 9: Content Research Engine Verification Report

**Phase Goal:** Build a full Content Research Engine — trend aggregation from 4 sources (YouTube, Google Trends, Reddit, Exploding Topics), AI-powered content idea generation, hashtag intelligence, a 7-day PKT posting calendar, saved ideas, cache + on-demand refresh, and a 4-tab Research UI wired into App.tsx.

**Verified:** 2026-05-04
**Status:** GAPS FOUND
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Research is a completely separate screen (RESEARCH-01) | VERIFIED | `Screen` union includes `'research'`; `App.tsx` line 98-100 renders `<ResearchPage>` on `currentScreen === 'research'`; floating purple nav button wired at line 119 |
| 2 | YouTube, Google Trends, Reddit, ExplodingTopics all fetched and cached (RESEARCH-02..05) | VERIFIED | All 4 fetchers exist: `trends/youtube.ts` (chart=mostPopular, regionCode=PK), `trends/google-trends.ts` (geo=PK, rising), `trends/reddit.ts` (5 subreddits), `trends/exploding.ts` (HTML scrape, fail-open) — each returns `TrendItem[]` or `[]` on any failure |
| 3 | 24h cache in trend_cache; pg-boss refreshes daily (RESEARCH-06) | VERIFIED | `research-cache.ts` implements 24h TTL query `WHERE fetched_at > NOW() - INTERVAL '24 hours'` + ON CONFLICT upsert; `boss.ts` registers `refresh-trends` cron `0 5 * * *` with lazy `refreshAllNiches` import |
| 4 | Trend + learning data combined to rank opportunities (RESEARCH-07) | VERIFIED | `POST /api/research/generate` queries `learning_signals` for topHooks, topHashtags, bestNiche, postingTimes in parallel with Promise.allSettled; all passed to `callResearchAI` and `buildCalendar` |
| 5 | AI generates 5-10 content ideas (RESEARCH-08) | VERIFIED | `buildResearchPrompt` instructs "Generate 5 to 10 content ideas"; `callResearchAI` routes to openai/gemini/claude using user's decrypted key from settings; `safeParseIdeas` strips fences and finds array bounds |
| 6 | Each idea has all required fields: title, 3 hooks, outline, key moments, B-roll, platforms, gap warnings (RESEARCH-09 + RESEARCH-10) | VERIFIED | Prompt schema includes all 10 fields; `ContentIdeaData` interface fully typed; `IdeaCard` renders title/angle/hookVariants/gapWarnings/scriptOutline/keyMoments/brollSuggestions/platforms/hashtagSuggestions/estimatedStrength |
| 7 | Hashtag intelligence tab shows trend + user hashtags ranked by trendVelocity formula (RESEARCH-11) | VERIFIED | `buildHashtagIntel` computes `trendScore * (1 + userAvgViews / 1000)`; `HashtagsTab` renders with inline `style={{ width: '${pct}%' }}` bars (no dynamic Tailwind classes); source color coding present |
| 8 | 7-day PKT calendar with optimal posting windows (RESEARCH-12) | VERIFIED | `buildCalendar` returns `Array.from({ length: 7 })` with DOW-matched `postingTimes` slots; posting times queried with `AT TIME ZONE 'Asia/Karachi'`; `CalendarTab` renders 7 day cards |
| 9 | User can save/unsave ideas; saved ideas persist per-user with RLS (RESEARCH-13) | VERIFIED | `POST /ideas/:id/save` toggles `saved` boolean with `AND eq(content_ideas.user_id, userId)` double-check; `GET /saved` filters by `user_id + saved=true`; `SavedTab` shows full idea fields + Unsave button; RLS policy `content_ideas_user_own` in schema |
| 10 | On-demand refresh bypasses 24h cache (RESEARCH-14) | VERIFIED | `POST /refresh` calls `boss.send('refresh-trends', {})` which enqueues immediate job execution; `handleRefresh` in frontend calls `refreshTrends()` then re-fetches trends |
| 11 | Freshness indicator shows "Last updated: Xh ago" (RESEARCH-15) | VERIFIED | `fetchedAt` returned from both `/trends` (cache hit and miss) and `/generate`; `freshnessLabel()` function formats `< 1h → "just now"`, else `Xh ago`; rendered in header below niche selector |
| 12 | DB schema: trend_cache + content_ideas tables with correct constraints (RESEARCH-06 + RESEARCH-13) | VERIFIED | `schema.ts` has `trend_cache` with UNIQUE(source, niche) and `content_ideas` with `user_id` FK + `pgPolicy` RLS + index |
| 13 | App.tsx wired: Research screen branch + floating nav button (RESEARCH-01) | VERIFIED | Import on line 10; screen branch lines 98-100; floating purple button line 117-123; `setCurrentScreen('research')` call on button click |
| 14 | Frontend types complete (TrendItem, ContentIdeaData, HashtagIntel, CalendarDay, CalendarSlot, SavedIdea, ResearchTab, ResearchTrendsResponse, ResearchGenerateResponse) | VERIFIED | All 9 interfaces/types defined in `types.ts` lines 373-440 with correct shapes matching backend schema |
| 15 | Gemini JSON mode uses BOTH responseMimeType AND responseSchema (CLAUDE.md requirement) | FAILED | `research-ai.ts` line 142 only sets `responseMimeType: 'application/json'` — `responseSchema` is absent. CLAUDE.md line 89: "Gemini JSON mode: requires BOTH `responseMimeType` AND `responseSchema`" |

**Score:** 14/15 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/routes/research.ts` | 6 Express routes | VERIFIED | 286 lines; 6 routes: GET /trends, POST /generate, GET /saved, POST /ideas/:id/save, POST /refresh, GET /hashtags; mounted at /api/research in app.ts line 86 |
| `backend/src/lib/research-cache.ts` | 24h TTL cache CRUD | VERIFIED | 88 lines; `getTrendCache`, `setTrendCache`, `refreshAllNiches` all exported; ON CONFLICT upsert; 24h WHERE predicate |
| `backend/src/lib/research-ai.ts` | Prompt builder + AI router | VERIFIED (with gap) | 163 lines; `buildResearchPrompt`, `safeParseIdeas`, `callResearchAI` exported; Gemini uses `responseMimeType` only — missing `responseSchema` |
| `backend/src/lib/calendar.ts` | 7-day calendar builder | VERIFIED | 58 lines; `buildCalendar` pure function returns `CalendarDayData[]` with length 7; PKT timezone via postingTimes |
| `backend/src/lib/trends/youtube.ts` | YouTube Data API v3 fetcher | VERIFIED | chart=mostPopular, regionCode=PK, per-niche categoryId map, fail-open |
| `backend/src/lib/trends/google-trends.ts` | Google Trends fetcher | VERIFIED | relatedQueries, geo=PK, rising (index 1), JSON.parse of string response, fail-open |
| `backend/src/lib/trends/reddit.ts` | Reddit public JSON fetcher | VERIFIED | 5 subreddits mapped, custom User-Agent header, per-subreddit fail-open, abort timeout |
| `backend/src/lib/trends/exploding.ts` | ExplodingTopics scraper | VERIFIED | Best-effort HTML scrape with regex, full fail-open, all errors swallowed |
| `backend/src/db/schema.ts` | trend_cache + content_ideas | VERIFIED | trend_cache: UNIQUE(source,niche); content_ideas: user_id FK + pgPolicy RLS + boolean saved + index |
| `frontend/src/pages/ResearchPage.tsx` | 4-tab Research UI | VERIFIED | 583 lines; IdeaCard, HashtagsTab, CalendarTab, SavedTab all implemented; no TODO or placeholder text; no dynamic Tailwind width classes |
| `frontend/src/App.tsx` | Research screen branch + nav | VERIFIED | Import line 10; branch lines 98-100; floating purple Research button lines 117-123 |
| `frontend/src/lib/types.ts` | Phase 9 type extensions | VERIFIED | 9 Phase 9 interfaces/types from line 373 onwards; Screen union includes 'research' |
| `frontend/src/lib/api.ts` | 6 research client functions | VERIFIED | fetchResearchTrends, generateResearchIdeas, fetchSavedIdeas, saveIdea, refreshTrends, fetchResearchHashtags — all exported at lines 350-405 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| App.tsx | ResearchPage | `if (currentScreen === 'research') return <ResearchPage...>` | WIRED | Line 98-100 confirmed |
| Research floating button | setCurrentScreen('research') | `onClick={() => setCurrentScreen('research')}` | WIRED | Line 119 confirmed |
| ResearchPage | fetchResearchTrends | `useEffect` on niche change | WIRED | Lines 39-53 |
| ResearchPage | generateResearchIdeas | `handleGenerate()` button click | WIRED | Lines 64-77 |
| ResearchPage | fetchSavedIdeas | `useEffect` on `activeTab === 'saved'` | WIRED | Lines 55-62 |
| ResearchPage | refreshTrends | `handleRefresh()` button click | WIRED | Lines 79-92 |
| CalendarTab | calendar.map() | `{calendar.map((day) => ...)}` | WIRED | Line 389 |
| SavedTab | fetchSavedIdeas in parent | `setSavedIdeas(saved)` from parent useEffect | WIRED | Lines 56-62 |
| POST /generate | callResearchAI | Route calls `callResearchAI({userId, trends, topHooks,...})` | WIRED | Line 179-182 |
| POST /generate | buildCalendar | Route calls `buildCalendar(ideas, postingTimes)` | WIRED | Line 201 |
| POST /refresh | boss.send('refresh-trends') | Direct pg-boss send | WIRED | Line 254 |
| boss.ts refresh-trends worker | refreshAllNiches | Lazy import `import('./research-cache.js')` | WIRED | Boss.ts lines 60-64 |
| app.ts | researchRouter | `app.use('/api/research', researchRouter)` | WIRED | app.ts line 86 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ResearchPage (Ideas tab) | `ideas: ContentIdeaData[]` | `generateResearchIdeas(niche)` → POST /api/research/generate → `callResearchAI` | Yes — AI call from user's decrypted key + learning_signals queries | FLOWING |
| ResearchPage (Hashtags tab) | `hashtags: HashtagIntel[]` | `generateResearchIdeas` or standalone `fetchResearchHashtags` | Yes — trend_cache query + learning_signals unnest | FLOWING |
| ResearchPage (Calendar tab) | `calendar: CalendarDay[]` | `generateResearchIdeas` → `buildCalendar(ideas, postingTimes)` | Yes — platform_posts AT TIME ZONE 'Asia/Karachi' query | FLOWING |
| ResearchPage (Saved tab) | `savedIdeas: SavedIdea[]` | `fetchSavedIdeas()` → GET /api/research/saved | Yes — content_ideas WHERE saved=true AND user_id=userId | FLOWING |
| CalendarTab (slots) | `day.slots` | postingTimes from `platform_posts` query | Real data (empty if no learning history — expected) | FLOWING |
| trend_cache | `data: TrendItem[]` | Promise.allSettled over 4 fetchers | Real data (fail-open — individual source failures return []) | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Frontend TypeScript compiles clean | `cd frontend && npx tsc --noEmit` | 0 errors | PASS |
| Backend TypeScript compiles clean | `cd backend && npx tsc --noEmit` | 0 errors | PASS |
| ResearchPage has no dynamic Tailwind width classes | `grep "w-\[" frontend/src/pages/ResearchPage.tsx` | 0 matches | PASS |
| ResearchPage has no placeholder/TODO text | `grep -i "TODO\|FIXME\|Coming soon\|placeholder"` | 0 matches | PASS |
| Research router mounted in app.ts | `grep "researchRouter" backend/src/app.ts` | Line 86: `app.use('/api/research', researchRouter)` | PASS |
| Screen union includes 'research' | `grep "Screen" frontend/src/lib/types.ts` | Line 1: includes 'research' | PASS |
| pg-boss daily cron registered | `grep "0 5 \* \* \*" backend/src/lib/boss.ts` | Line 54: `schedule('refresh-trends', '0 5 * * *', {})` | PASS |
| 6 API client functions exported | `grep "export async function fetch\|generate\|save\|refresh" api.ts` | 6 functions at lines 350-405 | PASS |
| Gemini responseSchema present | `grep "responseSchema" backend/src/lib/research-ai.ts` | 0 matches — MISSING | FAIL |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| RESEARCH-01 | 09-05, 09-06, 09-07 | Content Research is separate screen | SATISFIED | Screen union, App.tsx branch + nav button |
| RESEARCH-02 | 09-02 | YouTube Data API v3, regionCode=PK | SATISFIED | youtube.ts: chart=mostPopular, regionCode=PK, per-niche categoryId |
| RESEARCH-03 | 09-02 | Google Trends, geo=PK, rising queries | SATISFIED | google-trends.ts: relatedQueries, geo=PK, rising (index 1) |
| RESEARCH-04 | 09-02 | Reddit public JSON, niche subreddits | SATISFIED | reddit.ts: 5 subreddits mapped, custom User-Agent |
| RESEARCH-05 | 09-02 | ExplodingTopics emerging topics | SATISFIED | exploding.ts: HTML scrape, fully fail-open |
| RESEARCH-06 | 09-01, 09-03, 09-04 | 24h cache + pg-boss daily refresh | SATISFIED | research-cache.ts 24h TTL + ON CONFLICT upsert; boss.ts cron job |
| RESEARCH-07 | 09-04 | Trend + learning data ranked by performance | SATISFIED | /generate route combines trend + 4 learning queries |
| RESEARCH-08 | 09-03, 09-04 | AI generates 5-10 ideas | SATISFIED | buildResearchPrompt + callResearchAI (3 providers); safeParseIdeas |
| RESEARCH-09 | 09-03, 09-04, 09-06 | Each idea: concept, 3 hooks, outline, key moments, B-roll, platforms, strength | SATISFIED | ContentIdeaData interface + AI prompt schema + IdeaCard rendering all 10 fields |
| RESEARCH-10 | 09-03, 09-06 | Gap pre-analysis in each idea | SATISFIED | buildResearchPrompt includes face-free gap warning instruction; gapWarnings rendered in IdeaCard and SavedTab |
| RESEARCH-11 | 09-04, 09-06 | Hashtag intelligence tab | SATISFIED | buildHashtagIntel with trendVelocity formula; HashtagsTab with inline-style bars |
| RESEARCH-12 | 09-03, 09-04, 09-07 | 7-day PKT calendar | SATISFIED | buildCalendar returns 7 CalendarDayData[]; posting times query AT TIME ZONE 'Asia/Karachi'; CalendarTab renders 7 day cards |
| RESEARCH-13 | 09-04, 09-05, 09-07 | Save/unsave ideas; per-user RLS | SATISFIED | POST /ideas/:id/save toggle with user_id check; GET /saved filters by user; RLS policy in schema; SavedTab + Unsave button |
| RESEARCH-14 | 09-04, 09-06 | On-demand refresh | SATISFIED | POST /refresh fires boss.send immediately; handleRefresh re-fetches after trigger |
| RESEARCH-15 | 09-04, 09-06 | Freshness indicator | SATISFIED | fetchedAt returned from /trends and /generate; freshnessLabel() formats "Last updated: Xh ago"; rendered in header |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/src/lib/research-ai.ts` | 142 | Gemini `generationConfig` missing `responseSchema` — only `responseMimeType` set | BLOCKER | CLAUDE.md line 89: "Gemini JSON mode: requires BOTH `responseMimeType` AND `responseSchema`". Without `responseSchema`, Gemini-2.5-flash is NOT guaranteed to return valid JSON conforming to ContentIdeaData[]. The `safeParseIdeas` fallback handles parse failures but ideally should not be needed. Users with Gemini provider may experience malformed AI output more often than with OpenAI/Claude. |

---

## Human Verification Required

### 1. End-to-End Research Screen Flow

**Test:** Start both `backend npm run dev` and `frontend npm run dev`. Log in, click the purple Research button, change the niche, click Generate Content Ideas (with a valid API key in Settings), switch through all 4 tabs.

**Expected:** Ideas tab shows 5-10 idea cards with title/hooks/angle/gaps/outline; Hashtags tab shows ranked purple bars; Calendar tab shows 7 day cards (slots empty if no learning history — expected behavior); Saved tab initially empty; clicking Save on an idea card and switching to Saved tab shows the idea; Unsave removes it.

**Why human:** Requires live Supabase DB, valid API key (Claude/Gemini/OpenAI), and real network calls to YouTube/Google/Reddit APIs.

### 2. Two-User Personalisation (RESEARCH SC #9)

**Test:** Log in as two different users who each have different learning_signals data. Both visit Research screen and generate ideas.

**Expected:** The AI prompts differ between users (different topHooks, topHashtags, bestNiche sections) leading to different personalised recommendations.

**Why human:** Requires two active user accounts with distinct posting history in Supabase.

### 3. Gemini responseSchema Gap — Post-Fix Validation

**Test:** After adding `responseSchema` to the Gemini call in research-ai.ts, set AI provider to Gemini and generate ideas.

**Expected:** Gemini returns a well-formed JSON array matching ContentIdeaData[] without manual fence stripping needed.

**Why human:** Requires live Gemini API key to call `gemini-2.5-flash` with updated generationConfig.

---

## Gaps Summary

**1 gap blocking full CLAUDE.md compliance:**

The Gemini JSON mode call in `backend/src/lib/research-ai.ts` (line 140-143) uses `responseMimeType: 'application/json'` but omits the required `responseSchema`. CLAUDE.md line 89 mandates both be provided for Gemini JSON mode. The plan spec (09-03-PLAN.md line 407) also only showed `responseMimeType`, so this gap was in the plan from the start and was not caught during execution.

**Fix required:**
```typescript
import { SchemaType } from '@google/generative-ai'

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          angle: { type: SchemaType.STRING },
          hookVariants: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          scriptOutline: { type: SchemaType.STRING },
          keyMoments: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT } },
          brollSuggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          platforms: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          estimatedStrength: { type: SchemaType.NUMBER },
          gapWarnings: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          hashtagSuggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['title', 'angle', 'hookVariants', 'scriptOutline', 'estimatedStrength', 'gapWarnings', 'hashtagSuggestions'],
      },
    },
  },
})
```

**Aside — 6 vs 7 routes:** The task description said "7 routes" but the implementation has exactly 6 routes, which is what Plan 09-04's summary and the route handler both document. The discrepancy is in the task description prompt — the actual plan and implementation agree on 6 routes. This is not a gap.

---

_Verified: 2026-05-04_
_Verifier: Claude (gsd-verifier)_
