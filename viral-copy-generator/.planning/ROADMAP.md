# Roadmap — Viral Copy Generator

## Overview

Ten phases delivering the full platform: auth-gated multi-user system, in-browser video
analysis engine, AI copy generation, multi-platform auto-upload, post history + learning
loops, admin panel, and a content research engine powered by external trend data and each
user's own performance history.

**Architecture:** Supabase (Auth + PostgreSQL + Realtime) + VPS (Node.js + Nginx + file
storage) + pg-boss (PostgreSQL-backed job queue, no Redis). Every user account is created
by the admin only — no public registration.

**Spec corrections incorporated from deep research:**
- No public signup — admin creates accounts in Supabase dashboard only
- Supabase replaces raw PostgreSQL + Redis entirely
- pg-boss replaces BullMQ (queue lives in Supabase DB, no separate Redis)
- VPS local disk for file storage — not Supabase Storage
- Supabase Realtime replaces upload status polling
- All tables: `user_id` FK + RLS policies for per-user isolation
- Schema additions: `learned_weights` column (settings), `post_id` FK (learning_signals)
- Gemini Files API always (inline broken for all sizes)
- OpenAI proxied through backend (CORS blocked in browser)
- Instagram scopes: `instagram_business_basic` + `instagram_business_content_publish` (2025)
- Facebook Reels: requires Facebook Page — `page_id` + `page_access_token` stored in Phase 2
- Meta container created inside pg-boss job (not at schedule time — 24h expiry)
- Instagram 100 MB file size gate before queuing
- ffprobe return code bug — always read output file unconditionally
- tf.tidy() async incompatibility — use element-passing + explicit dispose
- COOP/COEP: configureServer middleware plugin in Vite (not server.headers — breaks HMR)

---

## Phases

- [x] **Phase 1: Backend + Auth Foundation** — Supabase project, auth-gated Express scaffold, Drizzle + full schema with RLS, pg-boss, VPS file storage, COOP/COEP
- [x] **Phase 2: Settings + Social OAuth** — Per-user AI key encryption, YouTube + Meta OAuth (redirect flow, 2025 scopes), weekly token refresh job *(provisionally complete 2026-05-02 — automated suite 47/47; E2E round-trips deferred pending credential provisioning)*
- [~] **Phase 3: Video Upload + Analysis Engine** — In-browser ffmpeg.wasm + TF.js + Web Audio + Canvas with researched bug workarounds *(paused 2026-05-02 at Wave 0 — vitest infra installed; fixture videos deferred; pivoted to Phase 4)*
- [x] **Phase 4: Virality Score + Checklist** — Weighted score, per-platform variants, three-state checklist, rule-based gap analysis *(complete 2026-05-02 — 8/8 plans, 179/179 tests, tsc clean, build 84 modules / 424 kB, verification 6/6 passed)*
- [x] **Phase 5: AI Copy + Platform Cards** — Gemini Files API, OpenAI proxy, Anthropic browser flag, 5 platform cards, Realtime upload state, Get Better Version *(complete 2026-05-03 — 6/6 plans, 206/206 tests, tsc clean)*
- [ ] **Phase 6: Auto-Upload + Scheduling** — YouTube resumable, Meta two-step Reels with container-in-job fix, pg-boss PKT scheduling, Instagram 100 MB gate
- [ ] **Phase 7: History + Learning Loops** — Post history (per-user RLS), atomic view logging transaction, EMA calibration, corrected hashtag unnest queries
- [ ] **Phase 8: Admin Panel** — Queue manager, user management, learning data editor, system health, logs viewer
- [ ] **Phase 9: Content Research Engine** — External trend APIs + user learning data + AI → content ideas, briefs, hashtag intelligence, 7-day calendar
- [ ] **Phase 10: Polish + Resilience** — Async tensor dispose, unified API error mapping, iOS Safari layout, indeterminate progress, error boundaries

---

## Phase Details

### Phase 1: Backend + Auth Foundation

**Goal:** Supabase project is live, every route returns 401 for unauthenticated requests,
all DB tables exist with corrected schema and RLS policies, pg-boss queue is running in
Supabase DB, VPS file storage directory is initialised, and COOP/COEP headers are verified
before any ffmpeg code is written.

**Depends on:** Nothing (first phase)

**Requirements:** AUTH-01–07, STORE-01–04, UI-06

**Key implementation notes:**
- Supabase: create project, copy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` to `.env`
- Disable public signup in Supabase dashboard: Authentication → Settings → "Enable email signup" = OFF
- Admin JWT claim: use service role key to set `app_metadata: { role: 'admin' }` on admin user
- Drizzle: connects to Supabase PostgreSQL via `DATABASE_URL` (connection pooling URL from Supabase dashboard)
- Use `drizzle-kit generate + migrate` — NOT `push` (silent DROP COLUMN risk)
- All tables: add `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- RLS: `ALTER TABLE posts ENABLE ROW LEVEL SECURITY; CREATE POLICY "user_own" ON posts USING (user_id = auth.uid())`; same for all tables
- Settings table: add `learned_weights JSONB DEFAULT NULL` (spec omitted this)
- learning_signals: add `post_id UUID REFERENCES posts(id) ON DELETE CASCADE` (spec omitted)
- learning_signals: `hashtags TEXT[]` declared as array (Drizzle: `.array()`)
- pg-boss: `new PgBoss({ connectionString: process.env.DATABASE_URL })` — queue schema created in Supabase DB automatically
- COOP/COEP in Vite: use `configureServer` plugin (NOT `server.headers` — breaks HMR, vitejs/vite#16536)
- Nginx: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Resource-Policy: same-origin`
- VPS: `mkdir -p /var/uploads && chown node:node /var/uploads`; Nginx serves `/uploads/` at `VPS_PUBLIC_URL/uploads/`
- AES-256-GCM: `randomBytes(12)` IV (12 bytes / 96-bit NIST standard)
- Express 5: `@types/express` pinned to `5.0.6`; named wildcards (`/*splat`); async errors forwarded natively
- Tailwind v4: `@import "tailwindcss"` + `@theme {}` in CSS — no `tailwind.config.js`
- Auth middleware: every Express route (except health) validates Supabase JWT via `supabase.auth.getUser(token)`
- Frontend: Supabase client initialised with anon key; `onAuthStateChange` redirects to login if no session

**Success Criteria:**
1. Supabase project live; public signup disabled in dashboard; admin account created with `role: admin` JWT claim
2. `GET /health` returns 200; `GET /api/posts` returns 401 without valid Supabase JWT
3. All DB migrations run clean against Supabase PostgreSQL — all tables present including `settings.learned_weights` and `learning_signals.post_id` FK; RLS enabled on all tables
4. pg-boss starts, connects to Supabase DB, test job enqueues and fires without error
5. `self.crossOriginIsolated === true` in browser console (COOP/COEP verified in Vite dev AND Nginx) before any ffmpeg code is written
6. `/var/uploads/` directory exists on VPS; Nginx serves a test file at `VPS_PUBLIC_URL/uploads/test.txt`
7. Frontend login screen is the only accessible screen for unauthenticated users — direct URL navigation redirects to login

**Plans:** 5 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffold: package manifests, test stubs, .env.example, make-admin script, Supabase setup checkpoint
- [x] 01-02-PLAN.md — Drizzle schema: all four tables with UUID PKs, authUsers FK, RLS policies, drizzle-kit generate [BLOCKING]
- [x] 01-03-PLAN.md — Express backend: auth/admin middleware, routes, pg-boss v12, VPS storage, startup orchestration
- [x] 01-04-PLAN.md — Frontend: Vite + COOP/COEP plugin, Tailwind v4, login screen, App.tsx auth gate
- [x] 01-05-PLAN.md — Integration verification: Vitest suite, API smoke, pg-boss confirm, make-admin, manual phase sign-off (COMPLETE — human-verify approved 2026-05-01)

**UI hint:** yes

---

### Phase 2: Settings + Social OAuth

**Goal:** Authenticated users can configure their AI provider with an encrypted personal
API key, connect YouTube via Google OAuth and Instagram + Facebook via Meta Instagram Login
(2025 scopes) using a COOP-safe redirect flow — all tokens stored per-user in DB. A weekly
pg-boss job keeps Meta tokens alive automatically.

**Depends on:** Phase 1

**Requirements:** SETTINGS-01–10

**Key implementation notes:**
- OAuth redirect flow (no popup — COOP `same-origin` kills `window.opener`): backend redirects to `/?screen=settings&connected=youtube` after code exchange; frontend reads param in `useEffect`, strips it, refetches settings
- Google scopes: `https://www.googleapis.com/auth/youtube.upload` + `https://www.googleapis.com/auth/youtube.readonly` (readonly added for Phase 9 research); `access_type=offline` + `prompt=consent` ensures refresh token
- Meta scopes (2025): `instagram_business_basic` + `instagram_business_content_publish` via Instagram Login path — NOT Facebook Login, NOT deprecated `instagram_basic`
- After Meta OAuth: exchange short-lived token (1h) for long-lived token (60 days) immediately; store in `settings.platform_config`
- Facebook Page token: call `GET /me/accounts` after Meta OAuth; store `page_id` + `page_access_token` in `settings.platform_config.facebook`; user must have a Facebook Page (surface pre-flight check in UI)
- Weekly pg-boss job: `boss.schedule('meta-token-refresh', '0 9 * * 1', {})` — refreshes via `GET graph.instagram.com/refresh_access_token` before 60-day expiry
- JSONB partial update: `sql\`${settings.platform_config} || ${JSON.stringify(patch)}::jsonb\`` in `SELECT FOR UPDATE` transaction
- API key masking: decrypt server-side, return `{ masked: '****last4' }` only
- Settings row: single row per user, `ON CONFLICT (user_id) DO UPDATE`
- Instagram pre-flight: check account type from Meta profile; show setup instructions if not Creator/Business

**Success Criteria:**
1. User saves AI API key — page reload shows `****last4`; key stored encrypted in DB per user; cannot be read by other users (RLS verified)
2. YouTube OAuth completes via redirect flow (no popup); token stored per-user backend-only; "Connected ✓" badge appears
3. Meta OAuth completes via Instagram Login redirect; both Instagram + Facebook show connected; `page_id` + `page_access_token` present in `settings.platform_config.facebook`
4. Pre-flight warning shown if no Facebook Page found on the connected Meta account
5. Weekly pg-boss job registered and successfully refreshes a non-expired Meta token
6. Two different user accounts each connect their own YouTube/Meta accounts — each can only see their own connection status (RLS enforced)

**Plans:** 7 plans

Plans:
- [x] 02-01-PLAN.md — Crypto + env validation + OAuth credentials checkpoint (encryption.ts, oauth-state.ts, .env.example) [BLOCKING] (COMPLETE 2026-05-01)
- [x] 02-02-PLAN.md — Settings routes (GET/PATCH/disconnect) + OAuth route stubs + app.ts wiring (COMPLETE 2026-05-01)
- [x] 02-03-PLAN.md — YouTube OAuth (googleapis 171.4.0, prompt=consent, encrypted tokens) (COMPLETE 2026-05-01)
- [x] 02-04-PLAN.md — Meta OAuth (Instagram Login + Facebook Login for Business — two flows, account_type preflight, page selection) (COMPLETE 2026-05-02)
- [x] 02-05-PLAN.md — Weekly meta-token-refresh pg-boss job (60-day token, 7-day cadence) (COMPLETE 2026-05-02)
- [x] 02-06-PLAN.md — Frontend SettingsPage + App.tsx screen switcher + OAuth-redirect param handler (COMPLETE 2026-05-02)
- [x] 02-07-PLAN.md — Verification: automated 47/47 ✓; real OAuth round-trips deferred pending `.env` credentials (PARTIAL 2026-05-02 — close via `/gsd-verify-work 2`)

**UI hint:** yes

---

### Phase 3: Video Upload + Analysis Engine

**Goal:** Authenticated user can drag-and-drop or pick a video (up to 250 MB), see thumbnail
and metadata immediately from HTML5 video element, and have all engine signals computed
entirely in-browser — with correct ffprobe bug workaround, element-passing TF.js pattern,
and WebAssembly fallback.

**Depends on:** Phase 2

**Requirements:** UPLOAD-01–03, ANALYSIS-01–10

**Key implementation notes:**
- Thumbnail + basic metadata instantly from HTML5 `video.onloadedmetadata` + canvas `drawImage` — before Analyse click
- ffmpeg singleton: `new FFmpeg()` once at module init; reuse across analyses (library auto-spawns internal worker)
- ffprobe BUG (GitHub #817): returns -1 even on success — `readFile('meta.json', 'utf8')` called unconditionally regardless of return code
- ffprobe requires `-o filename` flag: `await ffmpeg.ffprobe(['-v', 'quiet', '-print_format', 'json', '-show_streams', '-o', 'meta.json', 'input.mp4'])`
- Scene detection from log stream: `ffmpeg.on('log', ({ message }) => { if (message.includes('pts_time:')) ... })` during `select=gt(scene\,0.4),showinfo -f null -` exec
- Frame extraction: `select='not(mod(n\\,INTERVAL))',scale=512:512` → JPEG output to virtual FS → read back as Uint8Array
- TF.js models pre-warm on file select (background), not on Analyse click
- TF.js inference: pass HTML canvas/img element directly to `model.detect(element)` — models manage internal tensors; use explicit `tensor.dispose()` in `try/finally` for any manually created tensors
- MediaPipe face-detection: `solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection'` is MANDATORY — omit causes silent init failure
- Motion score: COCO-SSD bounding box centroid delta across frame sequence
- Beat detection: `meyda` or `music-tempo` npm package on Web Audio API FFT data
- WebAssembly fallback: `typeof WebAssembly === 'undefined'` → show clear message + manual description textarea

**Success Criteria:**
1. Drag-and-drop MP4/MOV — thumbnail + duration/resolution/aspect ratio appear instantly from HTML5 element; 200 MB warning shown; 250 MB hard reject
2. Analyse clicked — "Analysing video..." state; ffmpeg extracts metadata, 10 frames, and scene timestamps from log stream — zero network requests for video file
3. ffprobe output read unconditionally from virtual FS file regardless of -1 return code
4. TF.js face-detection initialises with `solutionPath`; object labels produced; tab stable after 3 repeat analyses (no tensor leak)
5. Motion score, audio energy, beat flag, silence gap, brightness all computed and present in `EngineSignals` object
6. Browser without WebAssembly shows clear fallback — no crash or blank screen
7. Authenticated user's analysis is session-scoped — analysis data not persisted until Phase 5 post save

**Plans:** 8 plans

Plans:
- [~] 03-01-PLAN.md — Wave 0: Vitest browser-mode infra + 5 fixture videos + test scripts (PARTIAL 2026-05-02 — Tasks 1+2 done: vitest 4 dual-project config + setup; Tasks 3+4 deferred awaiting fixture videos)
- [ ] 03-02-PLAN.md — EngineSignals types + engine.ts skeleton (canRunEngine, getFFmpeg singleton, warmup, analyse stub) + 9 runtime deps pinned
- [ ] 03-03-PLAN.md — Upload UI primitives: UploadDropzone (drag-drop + picker, 250 MB cap) + VideoPreview (thumbnail + description) + upload.ts validators
- [ ] 03-04-PLAN.md — ffmpeg pipeline: probeVideo (ANALYSIS-10 unconditional read) + detectScenes (log stream) + extractFrames (~10 base64 JPEGs)
- [ ] 03-05-PLAN.md — TF.js pipeline: MediaPipe face detector (solutionPath mandatory) + COCO-SSD object labels + motion score + tensor leak regression test
- [ ] 03-06-PLAN.md — Audio + brightness: Meyda OfflineAudioContext (energy/beat/silence) + BT.601 luma + ANALYSIS-07 network regression test
- [ ] 03-07-PLAN.md — Generator state machine: AnalysisProgress + AnalysisError + WasmFallbackBanner + MobileAdvisoryBanner + GeneratorPage rewrite
- [ ] 03-08-PLAN.md — A2/A3 calibration evidence + manual smoke test on 5 fixtures (CHECKPOINT)
**UI hint:** yes

---

### Phase 4: Virality Score + Checklist

**Goal:** After analysis, user sees a 0–100 virality score with colour coding, per-platform
variants using platform-specific scores for view range lookup, a three-state checklist
(pass/fail/pending for Metadata Quality), and rule-based gap analysis with actual values
interpolated in fix messages — all without any AI call.

**Depends on:** Phase 3

**Requirements:** SCORE-01–08

**Key implementation notes:**
- `EngineSignals` TypeScript interface at `frontend/src/lib/types.ts` — shared across engine.ts, score.ts, checklist.ts, gaps.ts
- Checklist item type: `{ id, label, status: 'pass'|'fail'|'pending', fix: string }`
- Metadata Quality section (8 items): render as `pending` in Phase 4; Phase 5 re-evaluates after AI output
- View range lookup: use each platform's own computed score (not overall score)
- Score formula normalisation per signal (see Phase 4 research for exact curves)
- `settings.learned_weights` read at score compute time; `effectiveWeight = baseline + clampedDelta`; skip calibration if `dataPoints < 10`
- Gap messages embed actual values: `gaps.ts` maps `checklist.filter(s === 'fail').map(item => item.fix)`
- Edge cases handled: `durationSeconds === 0`, no audio, no face, no scene cuts, NaN aspect ratio

**Success Criteria:**
1. Score renders with correct colour band; per-platform variants shown for all 5 platforms
2. View ranges displayed using each platform's own score tier (not overall)
3. Checklist: Video Technical + Virality Boosters show pass/fail; Metadata Quality 8 items show `pending`; each failed item has fix with actual values
4. Gap analysis list generated from failed items, zero AI calls
5. Score computes without crash/NaN for edge-case videos (no audio, no face, 0-duration)
6. Learned weights applied when `dataPoints >= 10`; baseline used when below threshold

**Plans:** 8 plans

Plans:
- [x] 04-01-PLAN.md — types.ts extensions + score.ts (curves D-05..D-11, weights D-04+D-12, bandForScore D-14, applyLearnedWeights D-20) + comprehensive unit tests *(complete 2026-05-02 — 48/48 tests pass; 04-01-SUMMARY.md)*
- [x] 04-02-PLAN.md — checklist.ts (21 items per D-15..D-18) + unit tests covering all edge cases *(complete 2026-05-02 — 41/41 tests pass; 04-02-SUMMARY.md)*
- [x] 04-03-PLAN.md — gaps.ts (buildGapAnalysis D-19) + viewRange.ts (D-13 lookup) + unit tests *(complete 2026-05-02 — 42/42 new tests pass; 131/131 lib suite green; 04-03-SUMMARY.md)*
- [x] 04-04-PLAN.md — ScorePanel.tsx (hero ring D-22+D-23, calibration footer D-21) + render tests *(complete 2026-05-02 — 13/13 happy-dom tests pass; tsc clean; 04-04-SUMMARY.md)*
- [ ] 04-05-PLAN.md — PlatformCardGrid.tsx (5 mini-cards with view ranges) + render tests
- [ ] 04-06-PLAN.md — ChecklistAccordion.tsx (4 collapsible sections, default-expand rules) + render tests
- [ ] 04-07-PLAN.md — GapAnalysisPanel.tsx (numbered list, hidden when empty) + render tests
- [ ] 04-08-PLAN.md — GeneratorPage integration (useMemo D-24) + integration tests + full-suite verification

---

### Phase 5: AI Copy + Platform Cards

**Goal:** One AI call returns all five platform outputs; five styled cards with per-field
copy buttons and Realtime-powered upload state; "Get Better Version" second pass; Metadata
Quality checklist updated from pending. Provider routing: Gemini via Files API always,
Claude direct with explicit flag, OpenAI via backend proxy.

**Depends on:** Phase 4

**Requirements:** AI-01–11, PLATFORM-01–10, UI-01–05

**Key implementation notes:**
- Gemini: Files API always (inline broken — Google confirmed bug for ALL sizes); flow: `uploadFile` → poll `getFile` until state `ACTIVE` → `generateContent` with file URI; `responseMimeType + responseSchema` for JSON mode
- Claude: `new Anthropic({ dangerouslyAllowBrowser: true })`; 10 base64 frames as `image` content blocks
- OpenAI: `POST /api/ai/generate` backend proxy route; Express handler decrypts user's API key from DB, calls OpenAI, returns result; avoids CORS block
- JSON parsing: strip markdown fences → find first `{` / last `}` → JSON.parse → on failure return empty strings per field (never blank card)
- "Get Better Version": same prompt + `improved_script_outline` appended; images not re-sent (~50% cheaper)
- Metadata Quality re-evaluation: after AI output, evaluate all 8 items and update from `pending` to `pass/fail`
- Post saved to DB after first AI generation: `POST /api/posts` creates posts + platform_posts rows
- Supabase Realtime: subscribe to `platform_posts` changes on `user_id` filter — upload state pushed to frontend without polling
- AI call error handling (Phase 8 maps fully, but surface errors here): invalid key, rate limit, quota exhausted

**Success Criteria:**
1. Gemini: Files API used for all sizes including small files; all 5 cards populate
2. Claude: `dangerouslyAllowBrowser: true` set; 10 frames sent; cards populate
3. OpenAI: request goes through backend proxy; API key never exposed to browser
4. Malformed JSON (fences, truncation) handled — no blank cards
5. Metadata Quality checklist updates from `pending` to `pass/fail` after AI returns
6. "Get Better Version" fires second call with `improved_script_outline`; cards update
7. Supabase Realtime subscription established; upload state changes appear without page refresh
8. TikTok card: upload button greyed out, manual copy active; X card: copy only, no upload button
9. Mobile layout — all cards, copy buttons reachable without horizontal scroll

**Plans:** 6 plans

Plans:
- [x] 05-01-PLAN.md — Wave 0: SDK installs + test stubs (RED state, Nyquist) *(complete 2026-05-02 — 2/2 auto tasks done; paused checkpoint:human-verify — Supabase Realtime)*
- [ ] 05-02-PLAN.md — Types + backend routes (AIOutput types, OpenAI proxy, POST /api/posts, CSP update)
- [ ] 05-03-PLAN.md — prompt.ts + ai.ts (Gemini Files API, Claude browser, OpenAI routing, JSON robustness)
- [ ] 05-04-PLAN.md — checklist.ts MQ re-evaluation + api.ts typed wrappers
- [ ] 05-05-PLAN.md — PlatformCopyCard component (5 platforms, copy buttons, upload states, colour accents)
- [ ] 05-06-PLAN.md — GeneratorPage integration (file picker, AI call, Realtime, Get Better Version) + checkpoint
**UI hint:** yes

---

### Phase 6: Auto-Upload + Scheduling

**Goal:** User can upload to YouTube, Instagram, and Facebook; schedule at PKT peak times
or manual time; see Realtime upload state. Meta containers created inside pg-boss job to
avoid 24h expiry. Instagram 100 MB gate prevents silent failures.

**Depends on:** Phase 5

**Requirements:** AUTOUP-01–08, STORE-05

**Key implementation notes:**
- Video flow: frontend POSTs file to `POST /api/upload/file` → backend writes `/var/uploads/{user_id}/{uuid}.mp4` → returns `{ fileId, publicUrl }`
- pg-boss job payload: `{ userId, fileId, filePath, publicUrl, platform, caption, hashtags, scheduledAt }` — no container ID (created at fire time)
- Meta container creation INSIDE worker: `async function uploadInstagram(job)` calls `POST /me/media` at fire time
- Instagram 100 MB gate: `if (fileSizeBytes > 100 * 1024 * 1024) throw new Error('Instagram: max 100 MB')` before `boss.send()`
- Instagram poll: `GET /{container-id}?fields=status_code` every 5s; `FINISHED` → publish; `EXPIRED` → create new container; `ERROR` → fail job
- Facebook: use `page_access_token` + `page_id` from `settings.platform_config.facebook`; `POST /{page-id}/video_reels` two-phase flow
- YouTube: `youtube.videos.insert({ media: { mimeType: 'video/mp4', body: fs.createReadStream(filePath) } })` — googleapis handles chunking
- File cleanup: `fs.unlink(filePath)` after successful social upload; pg-boss job `boss.send('cleanup-stale-files', {})` hourly — deletes files older than 1h
- Supabase Realtime: `platform_posts.upload_status` updated by worker → pushed to frontend
- `VPS_PUBLIC_URL` env var must be set for Meta video fetch

**Success Criteria:**
1. Instagram: videos over 100 MB rejected before queuing with clear error message
2. Meta container created inside pg-boss worker at fire time — not at schedule time
3. Instagram poll only calls `media_publish` after `status_code === 'FINISHED'`
4. Facebook upload uses `page_access_token` + `page_id` from settings
5. YouTube 250 MB video uploads via resumable stream successfully
6. pg-boss delayed job fires at correct PKT time after a server restart
7. Stale files (>1h) cleaned up by hourly pg-boss job
8. Upload state transitions (Idle → Uploading → Posted/Failed) pushed via Realtime — no polling
9. TikTok upload code present behind `isTikTokApproved = false` flag

**Plans:** 5 plans

Plans:
- [ ] 06-01-PLAN.md — File upload route (POST /api/upload/file multer) + pg-boss worker skeleton + deleteFile() + VPS_PUBLIC_URL validation
- [ ] 06-02-PLAN.md — Platform workers: uploadYouTube (resumable stream), uploadInstagram (container-in-job + poll), uploadFacebook (page token + 3-phase), uploadTikTok stub
- [ ] 06-03-PLAN.md — PKT peak-time scheduling utility (getPeakTimes) + GET /api/upload/peak-times endpoint + unit tests
- [ ] 06-04-PLAN.md — Frontend: ScheduleModal + api.ts upload wrappers + GeneratorPage handleUpload wiring + Instagram 100 MB gate
- [ ] 06-05-PLAN.md — Verification checkpoint: automated checks + human smoke test

---

### Phase 7: History + Learning Loops

**Goal:** Authenticated user sees only their own post history (RLS enforced). Logging actual
views executes as a single atomic transaction. EMA score calibration activates at 10+ data
points. Hashtag aggregation uses `unnest()`. Learning data injected fresh into every AI call.

**Depends on:** Phase 6

**Requirements:** HISTORY-01–06, LEARNING-01–09

**Key implementation notes:**
- All queries: RLS on `posts` ensures per-user isolation automatically — no `WHERE user_id =` needed in app code
- Platform filter: EXISTS subquery (`platform` is in `platform_posts`, not `posts`)
- Hashtag aggregation: `SELECT unnest(hashtags) AS hashtag, AVG(actual_views) ...` via `db.execute(sql\`...\`)`
- Hook learning: `SELECT hook_text, MAX(actual_views)` — MAX not AVG for viral ceiling
- View logging transaction (single `db.transaction()`):
  1. `UPDATE platform_posts SET actual_views, views_logged_at`
  2. Compute accuracy label
  3. `INSERT INTO learning_signals (niche = COALESCE(niche, default_niche), ...)`
  4. Compute EMA delta; `UPDATE settings SET learned_weights`
- EMA: `newEMA = 0.3 × newDelta + 0.7 × prevEMA`; delta capped ±15%; re-normalise weights to sum 1.0; skip calibration if `dataPoints < 10`
- Best times query: `EXTRACT(DOW/HOUR FROM posted_at AT TIME ZONE 'Asia/Karachi')`, `HAVING COUNT(*) >= 2`
- Bar chart: `style={{ width: \`${pct}%\` }}` inline (Tailwind can't generate dynamic width at build time)
- `COALESCE(niche, 'Other')` in GROUP BY; fall back to `default_niche` at write time for NULL niches
- Learning injection: `Promise.all([getLearningHooks(niche), getLearningHashtags(niche, platform)])` before every AI call

**Success Criteria:**
1. Post history shows only authenticated user's posts — querying another user's posts returns empty (RLS verified)
2. Platform filter uses EXISTS subquery — correct results for platform-filtered view
3. View logging: all 4 DB writes succeed atomically; if any fails, none commit
4. After 10+ data points, score formula produces different result than baseline (calibration active)
5. With < 5 data points for a niche, AI prompt uses hardcoded hashtag bank without error
6. Hashtag aggregation uses `unnest(hashtags)` — top 10 per niche/platform correct
7. Best posting times shown in PKT timezone
8. Bar chart renders with inline style — displays from 1 data point onward
9. "Calibrated (N posts)" badge appears on score card when active

**Plans:** 6 plans

Plans:
- [ ] 07-01-PLAN.md — GET /api/posts full impl (EXISTS filter) + DELETE /api/posts/:id (cascade)
- [ ] 07-02-PLAN.md — backend/src/routes/learning.ts: 5 GET endpoints (hooks MAX, hashtags unnest, posting-times PKT, niche-performance COALESCE, weights)
- [ ] 07-03-PLAN.md — frontend types.ts Phase 7 extensions + api.ts 8 new client functions
- [ ] 07-04-PLAN.md — HistoryPage.tsx: post list, platform/niche/date filters, inline view logging, accuracy badge, delete
- [ ] 07-05-PLAN.md — LearningPage.tsx (bar charts inline style) + GeneratorPage learning injection + prompt.ts extension + App.tsx nav wiring
- [ ] 07-06-PLAN.md — Automated structural verification (20 checks) + human visual checkpoint
**UI hint:** yes

---

### Phase 8: Admin Panel

**Goal:** Admin user (only) can access a management panel showing all upload jobs across
all users, user account management, learning data inspection, system health metrics, and
application logs — without access to individual users' API keys or generated content.

**Depends on:** Phase 7

**Requirements:** ADMIN-01–10

**Key implementation notes:**
- Admin guard: `if (req.user.app_metadata?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })` on all admin routes; frontend route guard checks JWT claim before rendering
- pg-boss job listing: `SELECT * FROM pgboss.job WHERE state IN ('created','active','failed') ORDER BY createdon DESC` via Drizzle raw SQL
- Job retry: `boss.resume(jobId)`; job cancel: `boss.cancel(jobId)`
- System health: VPS stats via `os.cpus()`, `os.totalmem()`, `os.freemem()`; disk usage via `df -h /var` exec; Supabase DB size via `SELECT pg_size_pretty(pg_database_size(current_database()))`
- Logs: structured JSON logs via `pino`; admin endpoint tails last N lines from log file or streams from pino transport
- Admin sees aggregate stats via SQL GROUP BY — not individual user content
- User management: Supabase Admin API (`supabase.auth.admin.listUsers()`, `updateUserById` to disable)
- Learning reset: `DELETE FROM learning_signals WHERE user_id = $userId` + `UPDATE settings SET learned_weights = NULL WHERE user_id = $userId` in transaction

**Success Criteria:**
1. Non-admin JWT receives 403 on any `/api/admin/*` route; admin-panel screen not rendered for non-admin users
2. Admin sees all pg-boss jobs across all users with correct state, platform, and user_id
3. Admin can retry a failed job — job re-enters queue and fires
4. Admin can disable a user account — disabled user cannot log in; their data intact
5. System health panel shows live VPS CPU/memory/disk and Supabase DB size
6. Admin cannot retrieve any user's decrypted API key or OAuth token (API returns masked values only)
7. Admin can reset learning data for a user — `learning_signals` deleted + `learned_weights` nulled atomically

**Plans:** 8 plans

Plans:
- [x] 08-01-PLAN.md -- Admin middleware (adminMiddleware) + adminRouter scaffold + app.ts mount *(complete 2026-05-03)*
- [x] 08-02-PLAN.md -- Queue manager routes: GET /jobs, POST /jobs/:id/retry, DELETE /jobs/:id *(complete 2026-05-03)*
- [x] 08-03-PLAN.md -- User management routes: GET /users, PATCH /:userId/disable, PATCH /:userId/enable *(complete 2026-05-03)*
- [x] 08-04-PLAN.md -- Learning reset + platform stats: DELETE /:userId/learning, GET /stats/platforms *(complete 2026-05-03)*
- [ ] 08-05-PLAN.md -- System health + logs: GET /health, GET /logs
- [ ] 08-06-PLAN.md -- Frontend admin types (AdminJob, AdminUser etc.) + api.ts admin functions
- [ ] 08-07-PLAN.md -- AdminPage.tsx: 5-tab admin panel UI (queue, users, health, logs, stats)
- [ ] 08-08-PLAN.md -- App.tsx admin routing + isAdmin guard + human verification checkpoint
**UI hint:** yes

---

### Phase 9: Content Research Engine

**Goal:** Authenticated users access a separate Research screen where external trend data
(YouTube, Google Trends, Reddit, ExplodingTopics) is combined with their own learning
history to generate AI-powered content ideas, full video briefs, a hashtag intelligence
tab, and a 7-day content calendar — all cached for 24 hours, refreshable on demand.

**Depends on:** Phase 7 (needs learning data to personalise research)

**Requirements:** RESEARCH-01–15

**Architecture:**
- `trend_cache` table: `(id, source, niche, data JSONB, fetched_at)` — global cache (shared across users for same niche/source to conserve API quota)
- `content_ideas` table: `(id, user_id, idea JSONB, niches TEXT[], platforms TEXT[], generated_at, saved BOOLEAN)` — per-user RLS
- pg-boss daily job: `boss.schedule('refresh-trends', '0 5 * * *', {})` — refreshes all trend sources for all active niches

**External data sources:**
- **YouTube Data API v3**: `GET /youtube/v3/videos?chart=mostPopular&regionCode=PK&videoCategoryId={id}&part=snippet,statistics` — reuses user's YouTube OAuth token; add `youtube.readonly` scope in Phase 2 (non-breaking addition)
- **Google Trends**: `google-trends-api` npm package; `googleTrends.interestOverTime({ keyword: niche, geo: 'PK' })` + `relatedTopics`
- **Reddit API**: `GET https://www.reddit.com/r/{subreddit}/hot.json` — no OAuth needed for public subreddits; subreddit map per niche (r/pakistan, r/travel, r/motorcycles, r/programming, r/CasualPakistan)
- **ExplodingTopics**: fetch `https://explodingtopics.com/category/{niche}` page + parse rising topics; or use their API if budget allows
- **User learning data**: top hooks + top hashtags + best-performing niches from learning_signals (fresh query per user)

**AI generation call:**
```
Prompt context:
- Trending topics from YouTube/Google/Reddit/ExplodingTopics (for user's niches)
- User's top 5 performing hooks (from learning_signals)
- User's top 10 performing hashtags per niche (from learning_signals)
- User's best-performing niche (highest avg actual_views)
- User's PKT optimal posting times (from learning_signals)

Output: JSON array of 5-10 content ideas, each with:
{ title, angle, hookVariants[3], scriptOutline, keyMoments[3-5],
  brollSuggestions, platforms[], estimatedStrength,
  gapWarnings[], hashtagSuggestions[] }
```

**Key implementation notes:**
- 24h cache check: `WHERE source = $source AND niche = $niche AND fetched_at > NOW() - INTERVAL '24 hours'`
- On-demand refresh: frontend sends `POST /api/research/refresh` → pg-boss job fires immediately bypassing cache
- Freshness indicator: `fetched_at` shown as "Last updated: Xh ago"
- Hashtag intelligence tab: merge external trend data with user's own top hashtags, ranked by `trendVelocity * (1 + userAvgViews / 1000)`
- Calendar: 7 slots per day × 7 days; assign ideas to optimal PKT windows from SETTINGS-10; one idea per platform per slot
- Gap warnings in ideas: rule-based pre-analysis of content type (e.g. face-free outdoor → "expect low face score — compensate with strong hook and high pacing")

**Success Criteria:**
1. Research screen loads with cached trend data for user's default niche — results appear instantly from cache
2. YouTube trending, Google Trends, Reddit, and ExplodingTopics all fetched and stored in `trend_cache` per niche
3. Daily pg-boss job refreshes all trend sources; on-demand refresh button works and updates freshness indicator
4. AI generates 5–10 content ideas using both trend data and user's own learning history
5. Each idea includes: concept, 3 hook variants, script outline, key moments, B-roll, platforms, gap warnings
6. Hashtag intelligence tab shows external trending hashtags merged with user's own top performers
7. 7-day calendar populated with ideas assigned to PKT-optimal posting windows
8. User can save an idea — appears in saved list on next session (per-user RLS)
9. Two different users see different personalised recommendations (their own learning data used as context)

**Plans:** TBD
**UI hint:** yes

---

### Phase 10: Polish + Resilience

**Goal:** The platform runs smoothly under repeated use, on mobile, on iOS Safari, and under
all error conditions — unified API error mapping, async tensor cleanup, iOS layout fixes,
indeterminate progress animation, and error boundaries throughout.

**Depends on:** Phase 9

**Requirements:** Quality properties spanning all phases

**Key implementation notes:**
- TF.js async tensor leak: `tf.tidy()` does NOT work with async functions — use explicit `tensor.dispose()` in `try/finally`; log `tf.memory().numTensors` in DEV only
- ffmpeg progress: `on('progress')` unreliable for frame extraction — use indeterminate spinner, not percentage bar
- Unified API error mapping (Claude `error.type` / Gemini `error.status` / OpenAI `error.code` → UI message + retry decision)
- Retry button only for: `rate_limited`, `model_busy`, `network_error` — never for `invalid_key` or `quota_exhausted`
- OAuth expiry during upload: backend returns `{ code: 'oauth_expired', platform }` → "Reconnect [platform] in Settings"
- iOS Safari layout: `h-[100dvh]` (not `h-screen`), `viewport-fit=cover` in meta viewport, `pb-[env(safe-area-inset-bottom)]` on fixed bottom elements
- COOP/COEP + Google OAuth popup: verified working via redirect flow (no popup used anywhere)
- Score calibration badge: "Calibrated (N posts)" when `dataPoints >= 10`
- React error boundary on Generator, Research, and Admin screens — uncaught error shows recovery message, not blank screen
- Bundle: `optimizeDeps.exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core']` in Vite config; TF.js models lazy-loaded when file is selected

**Success Criteria:**
1. Five consecutive analyses — TF.js tensor count stable; no UI freeze
2. Every API error state (invalid key, rate limit, quota, model busy, network) shows correct user-facing message; retry button appears only for retryable errors
3. OAuth expiry during upload shows "Reconnect in Settings" — not raw error
4. Full workflow completable on mid-range Android phone — no layout breakage
5. iOS Safari: `h-[100dvh]` in place; no content clipped by browser chrome
6. Error boundary catches uncaught errors on all main screens — shows recovery UI, not blank
7. ffmpeg progress shows indeterminate animation — no broken percentage bar

**Plans:** TBD
**UI hint:** yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend + Auth Foundation | 5/5 | Complete | 2026-05-01 |
| 2. Settings + Social OAuth | 7/7 | Provisionally complete (E2E deferred) | 2026-05-02 |
| 3. Video Upload + Analysis Engine | 1/8 partial | Paused at Wave 0 (fixtures deferred) | - |
| 4. Virality Score + Checklist | 8/8 | Complete | 2026-05-02 |
| 5. AI Copy + Platform Cards | 0/TBD | Not started | - |
| 6. Auto-Upload + Scheduling | 0/TBD | Not started | - |
| 7. History + Learning Loops | 0/TBD | Not started | - |
| 8. Admin Panel | 0/TBD | Not started | - |
| 9. Content Research Engine | 0/TBD | Not started | - |
| 10. Polish + Resilience | 0/TBD | Not started | - |
