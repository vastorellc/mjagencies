---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: Phase 4 (Virality Score + Checklist) — 4/8 plans complete; Phase 3 paused at Wave 0 (fixtures deferred)
status: paused
stopped_at: Completed 04-04-PLAN.md
last_updated: "2026-05-02T03:44:49.799Z"
last_activity: 2026-05-02
progress:
  total_phases: 10
  completed_phases: 2
  total_plans: 28
  completed_plans: 17
  percent: 61
---

# Project State — Viral Copy Generator

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** Upload one video and have platform-specific copy ready to paste in under 30 seconds — eliminating the 20-30 minute per-post metadata grind.
**Current phase:** Phase 4 (Virality Score + Checklist) — 4/8 plans complete; Phase 3 paused at Wave 0 (fixtures deferred)

## Current Position

Phase: 4 of 10 (Virality Score + Checklist) — IN PROGRESS (4/8 plans complete)
Plan: 04-04 complete (ScorePanel.tsx hero ring + calibration footer; 13 happy-dom tests pass; tsc clean). Next: 04-05.
Status: Phase 3 paused at Wave 0 awaiting fixture videos; Phase 4 Wave 1 done; Wave 2 underway (1/4 UI components shipped — ScorePanel).
Last activity: 2026-05-02

Progress: [██████░░░░] 61%

## Phase Status

| # | Phase | Status |
|---|-------|--------|
| 1 | Backend + Auth Foundation | ✅ Complete (5/5 plans, UAT 11/11 passed, code review fixes applied) |
| 2 | Settings + Social OAuth | 🟢 Provisionally complete (7/7 plans done; 02-01 credential checkpoint + 02-07 E2E round-trips deferred — automated suite 47/47 passes; close via `/gsd-verify-work 2` after credentials are in `.env`) |
| 3 | Video Upload + Analysis Engine | 🟡 Paused at Wave 0 (1/8 plans partial — vitest infra installed; awaiting 5 fixture videos in `frontend/test/fixtures/`) |
| 4 | Virality Score + Checklist | 🟡 In progress (4/8 plans — 04-01 score.ts + 04-02 checklist.ts + 04-03 gaps.ts/viewRange.ts + 04-04 ScorePanel.tsx complete; 131 lib tests + 13 ScorePanel tests pass; Wave 1 done, Wave 2 started) |
| 5 | AI Copy + Platform Cards | ⬜ Not started |
| 6 | Auto-Upload + Scheduling | ⬜ Not started |
| 7 | History + Learning Loops | ⬜ Not started |
| 8 | Admin Panel | ⬜ Not started |
| 9 | Content Research Engine | ⬜ Not started |
| 10 | Polish + Resilience | ⬜ Not started |

## Completed Phases

- **Phase 1: Backend + Auth Foundation** — Completed 2026-05-01
  - Supabase project + all 4 tables with RLS, pg-boss running, auth-gated Express backend, login screen with COOP/COEP, admin account configured

- **Phase 2: Settings + Social OAuth** — Provisionally complete 2026-05-02
  - AES-256-GCM crypto + OAuth CSRF state + settings GET/PATCH/disconnect routes + Google YouTube OAuth + Meta Instagram/Facebook OAuth + weekly Meta token refresh job + Settings UI with screen switcher
  - Automated suite: 47/47 Vitest pass, tsc clean, frontend build clean (76 modules / 410 kB)
  - Deferred: real OAuth round-trip E2E verification (02-07) and credential provisioning (02-01 Task 3) — pending `.env` setup; close via `/gsd-verify-work 2` when ready

## Accumulated Context

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

Last session: 2026-05-02T03:44:14.329Z
Stopped at: Completed 04-04-PLAN.md
Resume:

- Phase 4 (active): `/gsd-execute-phase 4` to continue with 04-05 (Wave 2 UI continues — PlatformCardGrid)
- Phase 3: drop 5 fixture videos into `viral-copy-generator/frontend/test/fixtures/` (per the README), then `/gsd-execute-phase 3` to resume from Plan 03-01 Task 3
- Phase 2: `/gsd-verify-work 2` once OAuth credentials provisioned in `.env`
