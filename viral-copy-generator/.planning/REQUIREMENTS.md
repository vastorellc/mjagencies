# Requirements — Viral Copy Generator

**v1 scope:** Multi-user platform — auth, video analysis, AI copy, auto-upload, scheduling,
history, learning loops, admin panel, content research engine.
**Stack:** Supabase Auth + PostgreSQL, Drizzle ORM, pg-boss, VPS file storage, React 19 + Vite 6.

---

## v1 Requirements

### AUTH — Authentication and User Isolation

- [ ] **AUTH-01**: User accounts are created exclusively by the admin via Supabase dashboard — no public signup form exists anywhere in the app
- [x] **AUTH-02**: Every screen and route is protected — unauthenticated users see only the login screen and are redirected there on any direct URL access
- [x] **AUTH-03**: User can log in with email and password (Supabase Auth), stay logged in across sessions, and log out
- [x] **AUTH-04
**: All DB tables have `user_id UUID REFERENCES auth.users(id)` and Row Level Security policies — users can only read/write their own rows; no cross-user data leakage possible
- [ ] **AUTH-05**: Admin role is set as a custom JWT claim (`role: 'admin'`) via Supabase service role key — only one admin account exists
- [ ] **AUTH-06**: Admin panel routes/screens are inaccessible to non-admin users (enforced at both frontend guard and backend middleware)
- [ ] **AUTH-07**: Password reset via Supabase email link — admin can also reset any user password directly from Supabase dashboard

### UPLOAD — Video Upload

- [ ] **UPLOAD-01**: User can upload a video via drag-and-drop or file picker (MP4, MOV, max 250 MB hard cap with warning at 200 MB)
- [ ] **UPLOAD-02**: User sees a thumbnail preview and video metadata (duration, resolution, aspect ratio) after selecting a file
- [ ] **UPLOAD-03**: User can provide an optional description (2-line textarea) before analysis

### ANALYSIS — In-Browser Video Analysis Engine

- [ ] **ANALYSIS-01**: System extracts video metadata (duration, resolution, fps, bitrate, audio presence, scene count) via ffmpeg.wasm running entirely in-browser
- [ ] **ANALYSIS-02**: System extracts 10 representative frames for AI providers that require frame-based input (Claude, OpenAI)
- [ ] **ANALYSIS-03**: System detects scene changes and timestamps via ffmpeg log stream parsing (`select=gt(scene\,0.4),showinfo -f null -`)
- [ ] **ANALYSIS-04**: System detects face presence via `@tensorflow-models/face-detection` with MediaPipe backend (`solutionPath` mandatory); object/scene labels via COCO-SSD; motion score via bounding box centroid delta across frames
- [ ] **ANALYSIS-05**: System measures audio energy, beat presence, and silence gaps via Web Audio API
- [ ] **ANALYSIS-06**: System measures brightness (luma score) via Canvas API
- [ ] **ANALYSIS-07**: All analysis runs in-browser — no video file sent to any server during analysis phase
- [ ] **ANALYSIS-08**: User sees a two-phase loading indicator: "Analysing video..." then "Generating copy..."
- [ ] **ANALYSIS-09**: System gracefully degrades on browsers without WebAssembly (shows clear message, falls back to manual description input)
- [ ] **ANALYSIS-10**: ffprobe output always read from virtual FS file unconditionally (never gated on return code — confirmed bug returns -1 on success)

### SCORE — Virality Scoring, Checklist, Gap Analysis

- [x] **SCORE-01**: System computes a virality score (0–100) from engine signals using the weighted formula (hook 25%, pacing 20%, face 15%, audio 15%, duration fit 10%, aspect ratio 10%, brightness 5%) with normalised per-signal curves *(complete 2026-05-02 — 04-01 score.ts BASELINE_WEIGHTS + 7 curves)*
- [x] **SCORE-02**: Score shown with colour coding: red (0–39), amber (40–59), green (60–79), bright green (80–100) *(complete 2026-05-02 — 04-01 bandForScore)*
- [x] **SCORE-03**: Score computed overall AND per platform (platform-weighted variants with defined weight tables) *(complete 2026-05-02 — 04-01 PLATFORM_WEIGHTS + computeScore returns ScoreResult{overall, perPlatform})*
- [x] **SCORE-04
**: System shows expected view range per platform per score tier using platform-specific score (not overall score)
- [x] **SCORE-05
**: System shows pass/fail/pending checklist: Video Technical + Metadata Quality (pending until AI runs) + Virality Boosters + Pakistan-specific niche checks
- [x] **SCORE-06
**: Every failed checklist item shows a specific actionable fix with actual video values interpolated (e.g. "Silence gap: 3.2s — remove gaps over 1.5s")
- [x] **SCORE-07
**: System generates a rule-based gap analysis list triggered by checklist failures — zero AI cost
- [x] **SCORE-08
**: Checklist item type is three-state: `pass | fail | pending` (Metadata Quality items are `pending` until Phase 5 AI output arrives)

### AI — AI Copy Generation

- [ ] **AI-01**: User can select AI provider in settings (Claude claude-sonnet-4-5 / Gemini gemini-2.5-flash / OpenAI gpt-4.1) — per user
- [ ] **AI-02**: System generates a single AI call per analysis returning JSON with all 5 platform outputs
- [ ] **AI-03**: Gemini sends video via Files API for ALL sizes (inline base64 is broken — Google confirmed bug)
- [ ] **AI-04**: Claude calls made directly from browser with `dangerouslyAllowBrowser: true` (Anthropic added CORS support Aug 2024); 10 base64 frames sent as image content blocks
- [ ] **AI-05**: OpenAI calls proxied through backend (`/api/ai/generate`) — OpenAI permanently blocks browser CORS; 10 base64 frames sent via proxy
- [ ] **AI-06**: Gemini JSON mode uses both `responseMimeType: "application/json"` AND `responseSchema` object (mime type alone is insufficient)
- [ ] **AI-07**: AI prompt injects all engine signals, gap data, niche hashtag bank, and learning data (top hooks + top hashtags from user's own history) as context
- [ ] **AI-08**: AI copy uses English with natural Urdu code-switching for Pakistani audience resonance
- [ ] **AI-09**: System strips markdown fences and handles malformed JSON gracefully — no blank platform cards on any parsing failure
- [ ] **AI-10**: Metadata Quality checklist items re-evaluated from `pending` to `pass/fail` after AI output arrives
- [ ] **AI-11**: User can request a "Get Better Version" second pass using `improved_script_outline` from first response as additional context

### PLATFORM — Platform Cards and Output

- [ ] **PLATFORM-01**: Generator screen shows 5 platform cards: YouTube Shorts, Instagram Reels, TikTok, Facebook Reels, X/Twitter
- [ ] **PLATFORM-02**: Each card shows platform-specific copy fields with character counts and platform limits enforced
- [ ] **PLATFORM-03**: Each field has a one-click copy button — title, description, tags/hashtags copyable individually
- [ ] **PLATFORM-04**: YouTube card: title (60 chars), description (150 chars), tags (10–15), hook suggestion, upload button, manual copy fallback
- [ ] **PLATFORM-05**: Instagram card: caption (150–200 chars, Urdu/English mix), hashtags (25–30), cover text suggestion, upload button, manual copy fallback
- [ ] **PLATFORM-06**: TikTok card: hook (first 3 words), caption (under 150 chars), hashtags (5–7), upload button greyed out "Available once API approved", manual copy always active
- [ ] **PLATFORM-07**: Facebook card: caption (Urdu/English, 2–3 sentences), CTA, 2–3 hashtags, upload button, manual copy fallback
- [ ] **PLATFORM-08**: X card: tweet (280 chars max), 2–3 hashtags, thread option, copy only — no upload button
- [ ] **PLATFORM-09**: Upload button has 4 states: Idle / Uploading / Posted / Failed — with Supabase Realtime push (no polling)
- [ ] **PLATFORM-10**: Manual copy always available regardless of upload state or OAuth connection

### SETTINGS — Per-User Configuration and Integrations

- [x] **SETTINGS-01**: User can select AI provider and save their own API key — stored encrypted AES-256-GCM per user in DB, never in localStorage _(02-01, 02-02)_
- [x] **SETTINGS-02**: User can set a default niche (pre-fills generation context for every analysis) _(02-02)_
- [x] **SETTINGS-03**: User can toggle platforms on/off (YouTube / Instagram / Facebook / TikTok / X) _(02-02)_
- [x] **SETTINGS-04
**: User can connect YouTube via Google OAuth 2.0 — server-side redirect flow; tokens stored backend-only per user
- [x] **SETTINGS-05
**: User can connect Instagram + Facebook via Meta Instagram Login (July 2024) — correct 2025 scopes: `instagram_business_basic` + `instagram_business_content_publish`
- [x] **SETTINGS-06
**: Phase 2 stores `page_id` + `page_access_token` from `GET /me/accounts` for Facebook Reels uploads
- [x] **SETTINGS-07**: Weekly pg-boss job refreshes 60-day Meta long-lived token before expiry (no refresh token exists — missed window requires re-auth) _(02-05: meta-refresh.ts pg-boss cron '0 9 * * 1', per-user error isolation, 7/7 tests)_
- [x] **SETTINGS-08**: TikTok credentials input exists but greyed out "Pending API approval" _(02-02: enabled_platforms storage supports tiktok; UI greyed-out in 02-06)_
- [x] **SETTINGS-09**: User can disconnect any connected platform (token revoked, cleared from DB) _(02-02: DELETE /api/settings/connections/:platform with JSONB merge)_
- [x] **SETTINGS-10**: Timezone fixed to PKT (UTC+5) — no user configuration _(02-02: Asia/Karachi in GET response)_

### STORE — VPS File Storage

- [x] **STORE-01
**: Uploaded video files stored on VPS at `/var/uploads/{user_id}/{uuid}.{ext}` — user-isolated paths
- [ ] **STORE-02**: Files served via Nginx at `VPS_PUBLIC_URL/uploads/{user_id}/{uuid}.{ext}` over public HTTPS (required for Meta video fetch)
- [x] **STORE-03
**: Files deleted after successful social platform upload
- [x] **STORE-04
**: pg-boss cleanup job deletes any file older than 1 hour (handles failed/abandoned uploads)
- [ ] **STORE-05**: Instagram pre-upload size check: reject videos over 100 MB with clear error before queuing (Instagram hard limit)

### AUTOUP — Auto-Upload and Scheduling

- [x] **AUTOUP-01
**: YouTube upload uses resumable protocol via `googleapis videos.insert` with readable stream — never multipart (5 MB hard limit)
- [x] **AUTOUP-02
**: Instagram Reels: two-step flow — container created inside pg-boss job (not at schedule time, 24h expiry), poll `status_code` until `FINISHED`, then publish — never publish on `IN_PROGRESS`
- [x] **AUTOUP-03
**: Facebook Reels uses `page_access_token` + `page_id` stored from Settings OAuth — same Meta app as Instagram
- [x] **AUTOUP-04
**: TikTok upload code built but hidden behind `isTikTokApproved` flag — activatable without re-deploy
- [ ] **AUTOUP-05**: User can schedule upload at PKT peak times or override with manual datetime
- [ ] **AUTOUP-06**: Peak times: YouTube Fri/Sat/Sun 6pm+8pm PKT · Instagram Mon/Wed/Fri 7pm+9pm PKT · TikTok Tue/Thu/Fri 8pm+10pm PKT · Facebook Wed/Thu 8pm+10pm PKT
- [ ] **AUTOUP-07**: pg-boss queues scheduled uploads — jobs persist in Supabase DB and survive server restarts
- [ ] **AUTOUP-08**: Supabase Realtime pushes upload status changes to frontend (no polling)

### HISTORY — Post History

- [ ] **HISTORY-01**: Post History screen lists authenticated user's posts, newest first (RLS enforced)
- [ ] **HISTORY-02**: Each post row shows: platform icons, niche tag, virality score, predicted view range, date posted
- [ ] **HISTORY-03**: User can filter post history by platform (EXISTS subquery), niche, and date range
- [ ] **HISTORY-04**: User can log actual views per platform per post via inline input
- [ ] **HISTORY-05**: Each post shows accuracy indicator once views logged: Overperformed / Matched / Underperformed
- [ ] **HISTORY-06**: User can delete a post — cascades to platform_posts and learning_signals via `post_id` FK

### LEARNING — Learning Loops and Insights

- [ ] **LEARNING-01**: Learning Insights screen shows top 5 hooks by `MAX(actual_views)` per niche (not AVG — surfaces viral ceiling)
- [ ] **LEARNING-02**: Learning Insights screen shows top 10 hashtags per niche/platform using `unnest(hashtags)` aggregation (not scalar column)
- [ ] **LEARNING-03**: Score accuracy bar chart (predicted vs actual) using inline Tailwind style (not dynamic class)
- [ ] **LEARNING-04**: Best posting times per platform from `EXTRACT(DOW/HOUR FROM posted_at AT TIME ZONE 'Asia/Karachi')`, HAVING COUNT >= 2
- [ ] **LEARNING-05**: Niche performance breakdown using `COALESCE(niche, 'Other')` — NULL niches fall back to `default_niche` at write time
- [ ] **LEARNING-06**: Top hooks and hashtags injected into AI prompt at call time (fresh fetch, no caching — queries < 5ms)
- [ ] **LEARNING-07**: Score calibration via EMA: `newEMA = 0.3 × newDelta + 0.7 × prevEMA`, delta capped ±15%, stored in `settings.learned_weights` JSONB; baseline used unchanged if `dataPoints < 10`
- [ ] **LEARNING-08**: All view logging writes (update platform_posts + accuracy + insert learning_signals + update learned_weights) execute in a single DB transaction — partial commit corrupts learning loops
- [ ] **LEARNING-09**: Score card shows "Calibrated (N posts)" badge when learning data active

### ADMIN — Admin Panel

- [x] **ADMIN-01
**: Admin panel is a separate screen accessible only to users with `role: 'admin'` JWT claim — frontend guard + backend middleware both enforce this
- [x] **ADMIN-02
**: Admin can view all pg-boss jobs (pending, active, failed, completed) across all users with job type, user_id, platform, scheduled time
- [x] **ADMIN-03
**: Admin can retry any failed upload job or cancel any pending job
- [x] **ADMIN-04
**: Admin can view all registered users — email, join date, last active, upload count, connected platforms
- [x] **ADMIN-05
**: Admin can disable/enable any user account
- [x] **ADMIN-06
**: Admin can view and reset learning data for any user (learning_signals + learned_weights)
- [x] **ADMIN-07
**: Admin can view system health dashboard: VPS CPU, memory, disk usage; Supabase DB size; pg-boss queue depth
- [x] **ADMIN-08
**: Admin can view application logs: upload errors, AI call errors, OAuth failures — filterable by user and time range
- [x] **ADMIN-09
**: Admin can view aggregate platform stats: total uploads per platform, success/failure rates, avg virality score across all users
- [x] **ADMIN-10
**: Admin cannot view individual users' API keys, OAuth tokens, or generated copy — only system-level data

### RESEARCH — Content Research Engine

- [x] **RESEARCH-01**: Content Research is a separate screen ("Research" tab) — completely independent from the Generator upload flow
- [x] **RESEARCH-02**: System fetches trending videos and topics from YouTube Data API v3 (`chart=mostPopular`, `regionCode=PK`, category-matched to user's niches) — reuses existing OAuth scope + adds `youtube.readonly`
- [x] **RESEARCH-03**: System fetches Google Trends data for user's content niches (rising queries, interest by region Pakistan) via `google-trends-api` npm package
- [x] **RESEARCH-04**: System fetches trending posts from Reddit (r/pakistan + niche subreddits: r/travel, r/motorcycles, r/programming, r/CasualPakistan) via Reddit API (read-only, no OAuth required for public subreddits)
- [x] **RESEARCH-05**: System fetches emerging topics from ExplodingTopics or similar source (web fetch or API) for early trend detection
- [x] **RESEARCH-06**: All external trend data cached in `trend_cache` table per niche per source (24-hour TTL) — user sees instant results from cache; pg-boss job refreshes cache daily
- [x] **RESEARCH-07**: Trend data combined with user's own learning data (top-performing niches, hooks, hashtags) to rank content opportunities by predicted performance
- [x] **RESEARCH-08**: AI generates 5–10 content ideas per session using combined trend + learning context
- [x] **RESEARCH-09**: Each content idea includes: concept title, hook options (3 variations), script outline, key moments (3–5 timestamps), B-roll suggestions, target platform(s), estimated virality signal strength
- [x] **RESEARCH-10**: Each content idea includes a gap pre-analysis: checklist items likely to fail based on the content type (e.g. "Face-free lifestyle video — low face score expected, compensate with strong hook + pacing")
- [x] **RESEARCH-11**: System provides hashtag intelligence tab: trending hashtags by niche from external sources ranked by trend velocity, combined with user's own top performers
- [x] **RESEARCH-12**: System generates a 7-day content calendar: suggested topics, target platforms, PKT optimal posting times, based on trends + user's own best-performing day/time patterns
- [x] **RESEARCH-13**: User can save any content idea (stored in `content_ideas` table, per-user RLS)
- [x] **RESEARCH-14**: User can trigger on-demand refresh of trend data (bypasses 24h cache)
- [x] **RESEARCH-15**: Research results show data freshness indicator ("Last updated: 3h ago")

### VERIFY — AI Provider + Model Verification

- [x] **VERIFY-01
**: Single `MODELS` source-of-truth constant per side (frontend + backend); all 6 previously-hardcoded model IDs reference these constants; no other hardcoded model strings outside the constant file (verified by grep)
- [x] **VERIFY-02
**: All four providers (Gemini, Claude, OpenAI, DeepSeek) use the locked May-2026 model IDs per `.planning/notes/2026-05-15-ai-models-current-state.md`
- [x] **VERIFY-03
**: `POST /api/settings/validate-key` verifies both API key AND model ID; returns `key_valid`, `model_valid`, `capabilities`, and `error_kind` discriminator (`invalid_key` | `model_not_found` | `rate_limited` | `service_unavailable` | null)
- [x] **VERIFY-04
**: `parseProviderError` adds `model_not_found` AIErrorKind with `retryable: false` for all 4 providers, with admin-action UX message
- [x] **VERIFY-05
**: Weekly pg-boss `provider-health-check` job pings each (provider, model) and writes one row per check to `admin_provider_health`; fail-partial (one provider down does not block others); missing service key produces a `not_configured` row, not a job failure; cleanup keeps last 30 rows per (provider, model)
- [ ] **VERIFY-06**: Admin panel adds Provider Health tab showing last ping per (provider, model), capability matrix, latency p95 over last 7 days; manual Refresh button (no auto-poll per Pitfall 10)

### UI — Interface and UX

- [x] **UI-01
**: No routing library — useState screen switching between screens (Generator, History, Research, Settings + Admin for admin users)
- [x] **UI-02
**: No UI component library — Tailwind CSS only, mobile-first layout
- [ ] **UI-03**: Platform card colour accents: YouTube red · Instagram pink/purple · TikTok black+cyan · Facebook blue · X black+white
- [ ] **UI-04**: Score colour coding: red (0–39) · amber (40–59) · green (60–79) · bright green (80–100)
- [x] **UI-05
**: App usable on mobile phone (primary use case) — `h-[100dvh]` not `h-screen`, `viewport-fit=cover`, `pb-[env(safe-area-inset-bottom)]` for iOS Safari
- [x] **UI-06**: Auth screen (login + signup) is the entry point for unauthenticated users

---

## v2 Requirements (deferred)

- Social login (Google/Meta OAuth for signup, not just platform connection)
- Multi-language UI (Urdu interface option)
- Bulk video processing queue
- X/Twitter auto-upload if API becomes accessible
- Export post history and research ideas as CSV
- Custom hashtag bank editing UI
- Competitor channel tracking
- Video re-upload / repost scheduling

---

## Out of Scope

- Central AI API — users supply own keys
- Supabase Storage — files on VPS
- Redis / BullMQ — pg-boss on Supabase DB
- Video editing — separate tool scope
- Social inbox (read messages) — Business Verification complexity
- Auto-caption burn-in — video editing scope
- X/Twitter auto-upload v1 — API cost not justified
- A/B copy testing — future scope

---

## Traceability

| Phase | Requirements Covered |
|-------|----------------------|
| 1. Backend + Auth Foundation | AUTH-01–06, STORE-01–04, UI-06 |
| 2. Settings + Social OAuth | SETTINGS-01–10 |
| 3. Video Upload + Analysis Engine | UPLOAD-01–03, ANALYSIS-01–10 |
| 4. Virality Score + Checklist | SCORE-01–08 |
| 5. AI Copy + Platform Cards | AI-01–11, PLATFORM-01–10, UI-01–05 |
| 6. Auto-Upload + Scheduling | AUTOUP-01–08, STORE-05 |
| 7. History + Learning Loops | HISTORY-01–06, LEARNING-01–09 |
| 8. Admin Panel | ADMIN-01–10 |
| 9. Content Research Engine | RESEARCH-01–15 |
| 10. Polish + Resilience | Quality properties spanning all phases |
| 11. AI Provider + Model Verification Mechanism | VERIFY-01–06 |
