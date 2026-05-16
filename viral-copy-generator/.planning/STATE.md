---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 11 — AI Provider + Model Verification Mechanism
status: executing
stopped_at: Completed Phase 11 Plan 05 — Provider Health Check Worker + Admin Route
last_updated: "2026-05-16T04:46:04.447Z"
last_activity: 2026-05-16
progress:
  total_phases: 12
  completed_phases: 10
  total_plans: 81
  completed_plans: 70
  percent: 86
---

# Project State — Viral Copy Generator

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** Upload one video and have platform-specific copy ready to paste in under 30 seconds — eliminating the 20-30 minute per-post metadata grind.
**Current phase:** 11 — AI Provider + Model Verification Mechanism

## Current Position

Phase: 11 (ai-provider-model-verification-mechanism-centralize-model-id) — EXECUTING
Plan: 6 of 6
Status: Ready to execute
Last activity: 2026-05-16

Progress: [█████████░] 92%

## Phase Status

| # | Phase | Status |
|---|-------|--------|
| 1 | Backend + Auth Foundation | ✅ Complete (5/5 plans, UAT 11/11 passed, code review fixes applied) |
| 2 | Settings + Social OAuth | 🟢 Provisionally complete (7/7 plans done; 02-01 credential checkpoint + 02-07 E2E round-trips deferred — automated suite 47/47 passes; close via `/gsd-verify-work 2` after credentials are in `.env`) |
| 3 | Video Upload + Analysis Engine | ✅ Complete (9/9 plans done; 03-09 rewrote engine to use HTMLVideoElement + rVFC instead of ffmpeg.wasm; manual smoke verified end-to-end on real 22 MB MP4 2026-05-15) |
| 4 | Virality Score + Checklist | ✅ Complete (8/8 plans, 179/179 tests, verification 6/6 passed 2026-05-02) |
| 5 | AI Copy + Platform Cards | ✅ Complete (6/6 plans, 206/206 tests, tsc clean 2026-05-03) |
| 6 | Auto-Upload + Scheduling | 🟢 Provisionally complete (5/5 plans done; 15/15 automated checks pass, 206/206 tests; smoke test deferred — close via `/gsd-verify-work 6` when OAuth accounts connected) |
| 7 | History + Learning Loops | 🟢 Provisionally complete (6/6 plans done; 20/20 automated checks pass; smoke test deferred — close via `/gsd-verify-work 7` after backend .env configured) |
| 8 | Admin Panel | 🟢 Provisionally complete (8/8 plans done; human checkpoint approved 2026-05-03; smoke test confirmation via `/gsd-verify-work 8` when servers running) |
| 9 | Content Research Engine | ✅ Complete (7/7 plans, 15/15 RESEARCH requirements verified, human checkpoint approved 2026-05-04) |
| 10 | Polish + Resilience | ✅ Complete (4/4 plans, all SC-01–SC-10 passed, persistent top navigation added, human checkpoint approved 2026-05-05) |

## Completed Phases

- **Phase 1: Backend + Auth Foundation** — Completed 2026-05-01
  - Supabase project + all 4 tables with RLS, pg-boss running, auth-gated Express backend, login screen with COOP/COEP, admin account configured

- **Phase 2: Settings + Social OAuth** — Provisionally complete 2026-05-02
  - AES-256-GCM crypto + OAuth CSRF state + settings GET/PATCH/disconnect routes + Google YouTube OAuth + Meta Instagram/Facebook OAuth + weekly Meta token refresh job + Settings UI with screen switcher
  - Automated suite: 47/47 Vitest pass, tsc clean, frontend build clean (76 modules / 410 kB)
  - Deferred: real OAuth round-trip E2E verification (02-07) and credential provisioning (02-01 Task 3) — pending `.env` setup; close via `/gsd-verify-work 2` when ready

- **Phase 7: History + Learning Loops** — Provisionally complete 2026-05-03
  - GET /api/posts (EXISTS subquery platform filter, newest-first), DELETE /api/posts/:id, POST /api/platform-posts/:id/views (atomic db.transaction with EMA calibration)
  - 5 learning endpoints: /hooks (MAX views), /hashtags (unnest), /posting-times (PKT EXTRACT + HAVING COUNT≥2), /niche-performance (COALESCE), /weights
  - HistoryPage (filters, inline view logging, accuracy badge), LearningPage (inline-style bar charts), learning injection in GeneratorPage (fetchTopHooks/fetchTopHashtags before every AI call)
  - All 20 automated checks pass; smoke test deferred (backend .env + server restart required)

- **Phase 4: Virality Score + Checklist** — Execution complete 2026-05-02 (pending /gsd-verify-work 4)
  - score.ts (piecewise linear formula, per-platform weights, EMA calibration) + checklist.ts (21 items, 3-state) + gaps.ts + viewRange.ts
  - ScorePanel.tsx (hero ring, D-23 palette, calibration footer) + PlatformCardGrid.tsx (5 mini-cards, band-colored, view-range strings)
  - ChecklistAccordion.tsx (4 collapsible sections, default-expand rules) + GapAnalysisPanel.tsx (numbered fix list, hidden when empty)
  - GeneratorPage.tsx integrated via useMemo (D-24); __testSignals test hook for Phase 4; Phase 3 wires via setSignals()
  - Full suite: 179/179 Vitest pass, tsc clean, build 84 modules / 424 kB

## Accumulated Context

### Roadmap Evolution

- 2026-05-15: Phase 11 added — AI Provider + Model Verification Mechanism (centralize 6 stale model IDs, runtime verify key + model, model_not_found discriminant, capability matrix, weekly health-check pg-boss job). Time-critical: `deepseek-chat` retires 2026-07-24.
- 2026-05-16: Phase 12 added — Cover-Frame Scoring & Recommendation. Score the 10 frames extracted by the engine for thumbnail/cover CTR-likelihood (face-on, rule-of-thirds, contrast, text-readable zones, eye-contact, motion-blur). Recommend top 3 frames per video; auto-overlay AI `cover_text` on the winner. New CoverFramePanel between ScorePanel and PlatformCardGrid. Closes audit gap #1 — single biggest YouTube/Instagram growth lever currently missing.

### Architecture Decisions

- **@vitejs/plugin-react pinned at 4.7.0** — v6.0.1 requires vite@^8, incompatible with locked vite@^6; 4.7.0 supports vite ^4/5/6/7
- **Supabase** (Auth + PostgreSQL + Realtime) — multi-user platform, RLS enforces per-user isolation
- **pg-boss** (PostgreSQL-backed queue) — replaces BullMQ + Redis; queue lives in Supabase DB
- **VPS file storage** — `/var/uploads/{user_id}/{uuid}.ext`; Nginx served; NOT Supabase Storage
- **No public signup** — admin creates all accounts in Supabase dashboard only
- **Gemini Files API always** — inline base64 broken for all sizes (Google confirmed bug)
- **OpenAI backend proxy** — browser CORS permanently blocked
- **COOP/COEP via configureServer plugin** — NOT server.headers (breaks Vite HMR)
- **Meta container in pg-boss job** — created at fire time, not at schedule time (24h expiry)
- **Instagram 2025 scopes** — `instagram_business_basic` + `instagram_business_content_publish`
- **Facebook Reels requires Page** — `page_id` + `page_access_token` stored from OAuth
- **Weekly Meta token refresh job** — 60-day token, no refresh token fallback
- **EMA for score calibration** — `newEMA = 0.3 × newDelta + 0.7 × prevEMA`, activates at 10+ data points
- **COOP/COEP in Express middleware** — set on all backend responses before CORS/routes; required for Phase 3 SharedArrayBuffer support in @ffmpeg/core
- **pg-boss named import { PgBoss }** — v12 ESM breaking change from default import; startup order: migrations → storage → boss → listen
- **Hashtag aggregation uses unnest()** — spec SQL was wrong (scalar vs TEXT[])
- **entities.roles.provider='supabase' mandatory** — without it drizzle-kit generate produces no CREATE POLICY statements (Pitfall 6)
- **session pooler (port 5432) for DATABASE_URL** — direct connection is IPv6-only and unreachable; session pooler supports prepared statements for Drizzle and pg-boss
- **drizzle-kit generate + migrate only** — push silently drops RLS policies (confirmed Pitfall 4)
- **vite-env.d.ts triple-slash reference** — required for import.meta.env types and CSS module side-effect imports; must be in src/ and included in tsconfig
- **font-bold on LoginPage submit button** — UI-SPEC checker overrides RESEARCH.md Pattern 8 (font-semibold); 2-weight rule: 400 body + 700 bold only
- **error !== null conditional in LoginPage** — does not reserve space when no error; `{error && ...}` coerces empty string to no-render but `{error !== null && ...}` is explicit
- **pg-boss v12 createQueue() before schedule()** — `pgboss.schedule` has FK on `(name)` referencing `pgboss.queue`; must call `createQueue(name)` before `schedule(name, cron, {})`
- **nginx /uploads/ no internal directive** — Meta's Instagram/Facebook servers need public HTTPS access for Phase 6 video ingestion (STORE-02); CORP must be `cross-origin` not `same-origin`
- **pg-boss v12 work() receives Job<T>[] batch array** — iterate with for..of inside handler; WorkHandler<ReqData> signature: `(jobs: Job<ReqData>[]) => Promise<void>`
- **multer diskStorage tmp dir + rename pattern** — userId unavailable in multer destination() callback (no res.locals access); write to UPLOADS_ROOT/tmp/{uuid}.mp4 then rename to UPLOADS_ROOT/{userId}/{uuid}.mp4 in route handler
- **Platform worker stubs for Plan 06-01** — upload-youtube/instagram/facebook/tiktok.ts stubs required for TypeScript module resolution; throw "not yet implemented" until Plan 06-02
- **Instagram container created at job fire time** — createContainer() called inside uploadInstagram() worker body (not at schedule time or module level); Instagram containers expire 24h after creation; job may fire days later
- **YouTube token refresh 5-min buffer** — refresh access_token if Date.now() + 300000 > expiry; refreshed token encrypted and persisted back to settings.platform_config.youtube immediately
- **Facebook binary upload uses createReadStream + duplex: half** — Node 22 native fetch accepts ReadStream body with duplex: 'half'; no @ts-expect-error suppression needed in TypeScript 6
- **TikTok stub gates on TIKTOK_APPROVED=true env** — uploadTikTok() always throws; worker checks flag first; stub error message explains activation path
- **pg-mem v3.0.5 PatchedPool for drizzle tests** — pg-mem v3.0.5 lacks rowMode/getTypeParser/JSONB-merge; PatchedPool subclass in _helpers.ts intercepts and rewrites these in JS; test-only shim, production code unchanged
- **Settings UPSERT partial-field update** — INSERT...onConflictDoUpdate uses dynamic Record<string,unknown> patch so PATCH with only default_niche does not overwrite api_key_encrypted
- **TRUNCATE → DELETE in pg-mem tests** — pg-mem does not support TRUNCATE ... RESTART IDENTITY CASCADE; DELETE FROM table achieves per-test isolation
- **OAuth callback before authMiddleware** — /callback router mounted before `app.use('/api', authMiddleware)`; Google + Meta redirects carry no Bearer token; state param provides CSRF + userId; /connect gated via per-route authMiddleware
- **JSON on /connect not 302** — CORS hides Location header on cross-origin opaque redirects from XHR; frontend uses window.location.assign(auth_url); confirmed browser behaviour
- **prompt=consent mandatory on Google OAuth** — without it refresh_token only issued on first connect; subsequent reconnects return no refresh_token (Pitfall 2)
- **Two separate Meta OAuth flows** — Instagram Login (api.instagram.com, instagram_business_basic + instagram_business_content_publish) and Facebook Login for Business (graph.facebook.com, pages_show_list + pages_manage_posts + pages_read_engagement); same META_APP_ID/META_APP_SECRET but different authorization servers (research Pitfall 9)
- **Instagram #_ code trim** — Meta appends `#_` to the redirect URI code; strip with `code.replace(/#_$/, '')` before token exchange (Pitfall 1)
- **Instagram short->long-lived exchange mandatory** — short-lived (1h) token from code exchange must be exchanged for long-lived (60-day) before storage; no refresh_token — weekly ig_refresh_token grant extends it
- **PERSONAL Instagram account rejection** — PERSONAL accounts cannot publish via API; account_type preflight GET /me?fields=account_type before DB write; PERSONAL -> failRedirect without storing any token (Pitfall 4)
- **Facebook no-page -> setup_required flag** — when /me/accounts returns no page with CREATE_CONTENT task, store `{ setup_required: true }` in platform_config.facebook and redirect with warning=no_facebook_page; UI surfaces "Create Facebook Page" CTA (Open Question 1)
- **PlatformConfig.facebook widened to union type** — `{ access_token, page_id, expiry } | { setup_required: true } | null`; no as-unknown cast needed (CLAUDE.md rule 9)
- **Test assertion error message must not contain 'duplicate' substring** — the meta-refresh duplicate-swallow catch block checks msg.includes('duplicate'); test error messages used to verify re-throw must not contain this substring
- **SettingsRow type with index signature [key: string]: unknown** — required for db.execute<T extends Record<string,unknown>> generic constraint; type alias (not interface) with index signature satisfies constraint without cast
- **useState screen switcher in App.tsx** — currentScreen: 'generator' | 'settings'; no routing library; onNavigate prop threads the setter to child screens; Screen type in types.ts extensible for Phase 3+
- **oauthBanner state in App.tsx not SettingsPage** — banner must survive the generator→settings screen transition triggered by the OAuth redirect params; App.tsx is the correct owner
- **OAuth redirect params read in session-aware useEffect** — second useEffect depends on `session` so it only runs once the user is authenticated; history.replaceState strips params immediately after read
- **ChecklistOptions camelCase shape** — `{ niche: Niche; enabledPlatforms: Platform[] }`; caller maps from `settings.default_niche / settings.enabled_platforms` at the GeneratorPage boundary
- **beat_aligned_audio + no_long_silence return 'pending' when hasAudio=false** (D-25) — gap analysis (04-03) skips them so the user is not asked to fix what they cannot fix without audio
- **vertical_for_reels_shorts info-only when no short-form platform enabled** — does not penalise X-only or Facebook-only users; only fails when the user has IG/TikTok/YouTube enabled AND aspect is wide
- **no_face_niche_ok always status='pass'; label switches** — reassurance copy (`No-face content matches travel/hotel/drive niche…`) only when faceCount=0 AND niche in {travel, hotels, cars, bikes}; otherwise generic label
- **fmt1/fmt2/fmtInt format helpers return 'unknown' for non-finite values** — guards every fix-string interpolation against NaN/Infinity leakage into UI
- **GAP_GROUP_ORDER excludes 'metadata-quality'** (Plan 04-03) — defensive: even if a metadata-quality item somehow has status='fail', it has no bucket in the group map and is naturally dropped; group order video-technical → virality-boosters → niche-pakistan
- **viewRangeFor takes platform's own score (SCORE-04), not overall** — caller passes `perPlatform[platform]` from ScoreResult; D-13 ranges are calibrated per-platform; the function itself is a pure Platform+score → string lookup
- **VIEW_RANGES strings copied verbatim from D-13** — no concatenation/interpolation; IG and FB share identical tiers (both Meta algorithmic); test asserts parity to lock the design intent
- **ScorePanel BAND_CLASSES Record<ColorBand,string>** (Plan 04-04) — full Tailwind class strings stored per band (not dynamic concatenation); Tailwind 4 JIT tree-shake fails on dynamic class names; pattern reused by all Phase 4 UI band-coloured components
- **ScorePanel data-band attribute** — exposes the resolved ColorBand on the ring node for tests + future styling hooks; complements the className for assertion-without-Tailwind-coupling
- **GeneratorPage __testSignals prop** — temporary Phase 4 test hook; seeds useState initial value; Phase 3 replaces by calling setSignals() from analyse() callback in upload component
- **useMemo triple-derived state in GeneratorPage** — scoreResult → checklistItems → gapMessages; all null-guarded on signals; renders placeholder when signals===null
- **PKT peak times are UTC+5, no DST** — Pakistan does not observe daylight saving; getPeakTimes() scans forward 14 days returning first 2 slots >5min in future as UTC ISO strings
- **ScheduleModal rendered at page root level** — outside `<main overflow-y-auto>` to avoid overlay clipping; fixed inset-0 z-50 covers full viewport
- **ScheduleUploadBody omits filePath/publicUrl/fileSizeBytes** — backend derives from userId+fileId (T-06-13 mitigation); client sends only postId/platform/fileId/caption/hashtags/scheduledAt
- **Instagram 100 MB gate is UX-only (frontend)** — backend multer stat()-based check is authoritative; frontend gate improves UX by blocking modal before any network call
- **handleScheduleConfirm optimistic upload status** — sets 'uploading' immediately; Supabase Realtime pushes 'posted'/'failed' from platform_posts without polling
- **setUTCDate before setUTCHours in candidate construction** — setUTCHours first then setUTCDate causes month-rollover on last-day-of-month; correct order: advance date first, then set hours
- **vitest.config.ts include covers both test directories** — backend uses tests/ (integration) and src/test/ (unit); include: ['tests/**/*.test.ts', 'src/test/**/*.test.ts']
- **adminMiddleware is synchronous** — reads already-populated res.locals.user; no async/await; avoids Express 5 async error forwarding edge case for sync handlers; app_metadata.role read exclusively from server-side Supabase field
- **Double-gate admin auth pattern** — authMiddleware at app.use('/api') (401 without JWT) then adminMiddleware at router.use() inside adminRouter (403 without admin role); both required per ADMIN-01
- **pg-boss v12 resume/cancel take (name, id) not (id)** — boss.resume(name, jobId) and boss.cancel(name, jobId); queue name looked up from pgboss.job before each call so the public API remains jobId-only; returns 404 if job not found
- **Supabase ban_duration '87600h' for permanent disable, 'none' to restore** — updateUserById with ban_duration disables login; reversible with 'none'; admin self-lockout guard compares targetUserId vs res.locals.userId (ADMIN-05)
- **GET /admin/users ADMIN-10 allowlist** — explicit object literal (id, email, created_at, last_sign_in_at, banned bool, upload_count, connected_platforms); platform_config keys extracted via Object.keys only — token values never touched (ADMIN-04, ADMIN-10)
- **Learning reset COUNT inside transaction** — COUNT(*) executed inside db.transaction() before DELETE so count is atomic with the delete; avoids a separate pre-flight query that could race with concurrent deletions (ADMIN-06)
- **Platform stats as two separate GROUP BY queries** — uploadStatsRows + scoreStatsRows merged in JS rather than OUTER JOIN; cleaner sql template, avoids NULL/0 ambiguity in conditional aggregates across joined tables (ADMIN-09)
- **avg_virality_score returns null not 0 when no data** — scoreMap falsy guard returns null explicitly so UI can distinguish "no uploads with scores" from "average score of 0" (ADMIN-10)
- **Fail-partial health endpoint** — disk (exec df) and database (pg_size_pretty) each have independent try/catch so one failure does not suppress the other; admin sees maximum diagnostic info in degraded scenarios (ADMIN-07)
- **Fixed-string exec() for disk usage** — 'df -h /var' is a compile-time literal with no user input concatenated; prevents shell injection while enabling VPS introspection (T-08-17)
- **LOG_FILE env var only for log path** — readFile receives process.env.LOG_FILE; no request-time path construction; operator sets path at deploy time (T-08-19)
- **Pino log parsing fail-open** — non-JSON lines (startup messages, stack traces) pass all filters and appear in tail result so no log output is silently lost
- **AdminDiskInfo exported as named interface** — enables 08-07 AdminPage type-narrowing on fail-partial health.disk field (`'size' in health.disk` type guard)
- **fetchAdminLogs options object not positional params** — all three filters (lines, userId, from) are optional; object param avoids undefined-chaining at call sites in AdminPage
- **resetAdminLearning returns {deleted: number} not void** — AdminPage confirmation display shows 'Deleted N signals' without an extra GET fetch
- **disableAdminUser reads error body on failure** — backend sends `{ error: 'Cannot disable your own account' }` for self-lockout; error propagates to AdminPage UI without a second fetch
- **JOB_STATE_STYLES Record<string, string> with ?? fallback** — unknown pg-boss job states (future additions) fall back to zinc badge instead of crashing the render; robust without needing type cast
- **showAllJobs checkbox drives fetchAdminJobs(includeAll)** — default omits cancelled/completed jobs; admin opts in for full pg-boss history; consistent with 08-06 API param design
- **resetResults Record<string,number> in-memory state** — stores deleted count per userId; AdminPage shows confirmation without a second GET; cleared on page reload (v1 acceptable)
- **AdminPage tab-scoped data loading** — useEffect fires per-tab; each of 5 tabs manages its own loading/error/data state; tabs load only when activated (not on mount)
- **trend_cache uses unique() not index()** — ON CONFLICT (source, niche) DO UPDATE requires a UNIQUE constraint; Drizzle index() creates a regular index that does not satisfy ON CONFLICT specification (Pitfall 6 in RESEARCH.md)
- **GeneratorPage generation counter pattern** — generationRef.current incremented on every Cancel/re-pick/startAnalyse; analyse() result applied only when myGen === generationRef.current; avoids AbortController complexity with WASM workers (T-03-24, T-03-25)
- **AnalysisError detail as text node** — error.detail rendered as {detail} (never dangerouslySetInnerHTML) to prevent XSS from engine error messages containing script tags (T-03-23)
- **GeneratorPage D-19 no persistence** — EngineSignals stored only in React useState for session; no localStorage/sessionStorage/IndexedDB round-trip at any state transition
- **YOUTUBE_API_KEY is optional in Phase 9** — fetchYouTubeTrends returns [] if env var absent; key in .env.example as commented-out optional, NOT in REQUIRED_ENV; other 3 trend sources still work
- **google-trends-api CJS/ESM interop confirmed** — default import returns typeof 'object' in NodeNext ESM; no createRequire wrapper needed; Plan 09-02 uses `import googleTrends from 'google-trends-api'` directly
- **research-cache.ts stub for tsc dynamic import** — boss.ts worker uses lazy dynamic import; TypeScript NodeNext resolution checks dynamic imports statically; stub file with throwing implementations satisfies tsc until Plan 09-03 implements it
- **google-trends-api.d.ts hand-rolled** — no @types/google-trends-api package on npm (404); minimal interface covers relatedQueries + interestOverTime; placed in backend/src/types/ within tsconfig include scope
- **reddit.ts outer try/catch** — per-subreddit inner catch handles individual failures; outer catch returns [] for full fail-open guarantee; satisfies grep verification for return [] in all 4 fetcher files
- **@google/generative-ai + @anthropic-ai/sdk installed on backend** — multi-provider AI routing in research-ai.ts requires both SDKs server-side; frontend has different package names (@google/genai vs @google/generative-ai); backend/package.json pinned to exact versions (0.24.0 and 0.39.0)
- **safeParseIdeas uses lastIndexOf(']') not indexOf(']')** — handles AI responses with trailing text or whitespace after JSON array closes; same robustness pattern as Phase 5 platform card JSON parsing (Pitfall 8)
- **buildCalendar setDate before setUTCHours** — prevents month-rollover on last day of month; calendar.ts line 38-39; consistent with STATE.md setUTCDate-before-setUTCHours pitfall
- **isValidNiche exported from research.ts** — enables direct function testing without supertest/DB; isValidNiche('travel') returns true, isValidNiche('__proto__') returns false; both confirmed in 8/8 research.test.ts assertions
- **content_ideas insert with .returning({id})** — frontend needs real UUIDs from DB to call POST /ideas/:id/save; zipping inserted UUIDs back onto idea objects required before JSON response
- **POST /ideas/:id/save toggles saved boolean** — implements toggle (newSaved = !existing.saved) not set-to-true; enables unsave flow from Saved tab; user_id ownership check enforced either way

### Critical Bugs to Avoid

- ffprobe returns -1 even on success (GitHub #817) — always read output file unconditionally
- tf.tidy() does NOT wrap async functions — use element-passing + explicit dispose
- MediaPipe solutionPath is MANDATORY — omit causes silent init failure
- YouTube multipart has 5 MB limit — use resumable always
- Drizzle JSONB update replaces whole column — use `|| patch::jsonb` merge operator
- Dynamic Tailwind width classes not generated at build — use inline style for bar charts

## Deferred Items

| Category | Item | Deferred At |
|----------|------|-------------|
| v2 | Social login (Google/Meta for signup) | Init |
| v2 | X/Twitter auto-upload | Init |
| v2 | Bulk video processing | Init |
| v2 | Export history CSV | Init |
| v2 | Competitor channel tracking | Init |

## Session Continuity

Last session: 2026-05-16T04:46:04.435Z
Stopped at: Completed Phase 11 Plan 05 — Provider Health Check Worker + Admin Route
Resume:

- **Phase 3:** Verified end-to-end (engine v3 — HTMLVideoElement + rVFC). Run `/gsd-verify-work 3` to formally close.
- Phase 10: Run `/gsd-plan-phase 10` then `/gsd-execute-phase 10`
- Phase 8: `/gsd-verify-work 8` to formally close Phase 8 (confirm smoke test when backend servers running)
- Phase 7: `/gsd-verify-work 7` once backend `.env` configured + servers restarted
- Phase 6: `/gsd-verify-work 6` once OAuth accounts connected
- Phase 2: `/gsd-verify-work 2` once OAuth credentials provisioned in `.env`

**Planned Phase:** 11 (ai-provider-model-verification-mechanism-centralize-model-id) — 6 plans — 2026-05-16T03:56:03.729Z
