# Roadmap — Viral Copy Generator

## Overview

Eight phases that deliver the full tool. Each phase must complete before the next begins —
the dependency chain is hard. This roadmap incorporates deep per-phase technical research
with all identified bottlenecks and spec errors corrected before execution begins.

**Key spec corrections from research:**
- Schema missing `learned_weights` column and `learning_signals.post_id` FK → fixed in Phase 1
- Spec's hashtag SQL wrong (`hashtag` scalar vs `TEXT[]`) → fixed in Phase 7
- Gemini inline video broken for all sizes → Files API always (Phase 5)
- OpenAI blocks direct browser calls → backend proxy required (Phase 5)
- Instagram scopes deprecated Jan 27 2025 → use new scopes (Phase 2 + 6)
- Facebook Reels requires a Facebook Page → Page token flow added (Phase 2 + 6)
- YouTube must use resumable upload → multipart has 5 MB hard limit (Phase 6)
- Meta container must be created inside the BullMQ job → 24h expiry risk removed (Phase 6)
- Instagram hard file size limit 100 MB → size check before queuing (Phase 6)
- `tf.tidy()` cannot wrap async inference → element-passing + explicit dispose (Phase 3)
- ffmpeg.wasm already has built-in worker → Phase 8 "Web Worker migration" is a config check, not a rewrite

---

## Phases

- [ ] **Phase 1: Backend Foundation** — Express + Drizzle + PostgreSQL + BullMQ/Redis scaffold with corrected DB schema and all API routes
- [ ] **Phase 2: Settings + OAuth** — AI provider config, API key encryption, Google + Meta OAuth using redirect flow and new 2025 scopes
- [ ] **Phase 3: Video Upload + Analysis Engine** — In-browser ffmpeg.wasm + TF.js + Web Audio + Canvas with researched API patterns and bug workarounds
- [ ] **Phase 4: Virality Score + Checklist** — Weighted score, per-platform variants, three-state checklist, rule-based gap analysis
- [ ] **Phase 5: AI Copy + Platform Cards** — Gemini Files API, OpenAI backend proxy, Anthropic browser flag, 5 platform cards, Get Better Version
- [ ] **Phase 6: Auto-Upload + Scheduling** — YouTube resumable, Meta two-step Reels with container-in-job fix, BullMQ PKT scheduling, Instagram 100 MB gate
- [ ] **Phase 7: History + Learning Loops** — Post history, view logging transaction, EMA score calibration, corrected hashtag unnest queries
- [ ] **Phase 8: Polish + Resilience** — Async tensor dispose, unified API error mapping, iOS Safari layout, indeterminate progress

---

## Phase Details

### Phase 1: Backend Foundation

**Goal:** The full backend infrastructure is running, all DB tables exist with the corrected
schema (including `learned_weights` and `post_id` FK that the spec omitted), Redis is
configured for job persistence, and COOP/COEP headers are verified in both Vite dev and
Nginx before any ffmpeg code is written.

**Depends on:** Nothing (first phase)

**Requirements:** UI-01, UI-02

**Spec corrections addressed:**
- Add `learned_weights JSONB DEFAULT NULL` to settings table (spec omitted this — Phase 4 + 7 depend on it)
- Add `post_id UUID REFERENCES posts(id) ON DELETE CASCADE` to learning_signals (spec omitted — delete cascade broken without it)
- Declare `learning_signals.hashtags` as `TEXT[]` array column (spec text implies scalar)
- Use `drizzle-kit generate + migrate` — NOT `push` (push leaves no audit trail, silent DROP COLUMN on live data)

**Key implementation notes:**
- COOP/COEP in Vite: use `configureServer` middleware plugin, not `server.headers` (breaks HMR — vitejs/vite#16536)
- Pin `@types/express` to exactly `5.0.6` (4.x types cause error handler type errors with Express 5)
- Express 5 changes: wildcards must be named (`/*splat`), `res.redirect` arg order reversed, async throws forwarded natively (no asyncHandler wrapper needed)
- Redis config (set before Phase 6): `maxmemory 200mb`, `maxmemory-policy noeviction`, `appendonly yes` (BullMQ jobs lost on restart without AOF)
- AES-256-GCM: use `randomBytes(12)` for IV (12 bytes / 96-bit is NIST standard for GCM, not 16)
- Vite: pin to `^6.0.0` (latest npm tag now points to v8)
- Tailwind v4: `@import "tailwindcss"` + `@theme {}` in CSS — no `tailwind.config.js` at all
- Run `migrate()` at app startup (under 100ms on small schema, provides audit trail)
- Add 1–2 GB swap file on VPS; set `--max-old-space-size=384` on Node process

**Success Criteria:**
1. `GET /health` returns 200 with DB connectivity and Redis connectivity confirmed
2. All Drizzle migrations run cleanly against a fresh PostgreSQL 17 database — all 4 tables present including `settings.learned_weights` column and `learning_signals.post_id` FK
3. BullMQ connects to Redis (with `appendonly yes` verified) and a test job enqueues, delays, and completes without error
4. Frontend Vite dev server starts, renders a placeholder root screen, and hot-reloads correctly with COOP/COEP headers active (HMR not broken)
5. `self.crossOriginIsolated === true` confirmed in browser console — both Vite dev and Nginx production configs verified before any ffmpeg code is written
6. AES-256-GCM encrypt/decrypt round-trip test passes with `randomBytes(12)` IV

**Plans:** TBD
**UI hint:** yes

---

### Phase 2: Settings + OAuth

**Goal:** User can configure AI provider, save an encrypted API key, connect YouTube via
Google OAuth and Instagram + Facebook via Meta's Instagram Login (July 2024) using the
correct 2025 scopes — all via a redirect-based flow (no popup, no localStorage). A weekly
BullMQ job refreshes the 60-day Meta token automatically.

**Depends on:** Phase 1

**Requirements:** SETTINGS-01, SETTINGS-02, SETTINGS-03, SETTINGS-04, SETTINGS-05, SETTINGS-06, SETTINGS-07, SETTINGS-08

**Critical blockers resolved:**
- COOP `same-origin` kills OAuth popups via `window.opener` → use redirect flow: backend redirects to `/?screen=settings&connected=youtube` after code exchange; frontend reads query param in `useEffect`, switches screen, strips param, refetches settings
- Meta App Review NOT required — app stays in Development Mode permanently; developer has role on app = all permissions work without App Review. Personal-only tool, never goes to Live Mode.
- Facebook Reels requires a Facebook Page (not personal profile) → Phase 2 must retrieve and store `page_id` + `page_access_token` via `GET /me/accounts` after Meta OAuth

**Instagram scope change (Jan 27, 2025):**
- Old (deprecated): `instagram_basic`, `instagram_content_publish` — DO NOT USE
- New (correct): `instagram_business_basic`, `instagram_business_content_publish`
- Use Instagram Login path (not Facebook Login) — launched July 2024, does not require a Facebook Page for Instagram

**Meta token lifecycle:**
- Exchange short-lived token (1h) for long-lived token (60 days) immediately after OAuth
- Long-lived token refreshable via `GET graph.instagram.com/refresh_access_token` before expiry
- No refresh token exists — if 60-day window missed, user must re-authorize from scratch
- **BullMQ weekly refresh job is Phase 2 scope** — not deferrable

**Key implementation notes:**
- Google scopes: `https://www.googleapis.com/auth/youtube.upload` only; `access_type=offline` + `prompt=consent` for guaranteed refresh token
- Token revocation — Google: `POST https://oauth2.googleapis.com/revoke` (body: `token=<access_token>`); Meta: `DELETE /{user_id}/permissions`
- JSONB partial update: `sql\`${settings.platform_config} || ${JSON.stringify(patch)}::jsonb\`` — wrap in `SELECT FOR UPDATE` transaction
- API key masking: decrypt server-side, return only `{ masked: '****last4' }` — masking in API response layer, not DB query
- Settings: single row upsert, `id = 1`, `onConflictDoUpdate`
- User must have Instagram Creator/Business account (free to switch in-app) and a Facebook Page — surface pre-flight check in Settings UI

**Success Criteria:**
1. User selects Claude/Gemini/OpenAI, enters API key, saves it — page reload shows masked key (`****last4`); key stored AES-256-GCM encrypted in DB, never in localStorage
2. User clicks "Connect YouTube", completes Google OAuth consent screen via redirect flow (no popup), and sees "Connected ✓" badge — token stored in `settings.platform_config` backend-only
3. User clicks "Connect Instagram + Facebook", completes Meta OAuth via Instagram Login redirect flow, and sees both Instagram + Facebook connected — `page_id` + `page_access_token` stored from `GET /me/accounts` response
4. Settings screen shows pre-flight warning if Instagram account is not Creator/Business type or if no Facebook Page is found
5. Weekly BullMQ token refresh job exists, successfully refreshes a non-expired Meta token, and logs the result
6. User can disconnect any platform — token is revoked via the correct API and cleared from DB
7. TikTok credentials input renders greyed-out with "Pending API approval" label

**Plans:** TBD
**UI hint:** yes

---

### Phase 3: Video Upload + Analysis Engine

**Goal:** User can drag-and-drop or pick a video (up to 250 MB), see thumbnail and metadata
immediately from the HTML5 video element, and have all engine signals computed entirely
in-browser via ffmpeg.wasm + TF.js + Web Audio API + Canvas — with a two-phase loading
indicator and correct iOS fallback.

**Depends on:** Phase 2

**Requirements:** UPLOAD-01, UPLOAD-02, UPLOAD-03, ANALYSIS-01, ANALYSIS-02, ANALYSIS-03, ANALYSIS-04, ANALYSIS-05, ANALYSIS-06, ANALYSIS-07, ANALYSIS-08, ANALYSIS-09

**Architecture clarifications from research:**
- `@ffmpeg/ffmpeg` 0.12.x already spawns its own internal worker thread automatically — no manual Web Worker wrapping needed in Phase 3 or Phase 8
- `@ffmpeg/core` (single-thread) does NOT require SharedArrayBuffer — iOS fallback is only needed for browsers without WebAssembly (iOS 15.2+ is fine)
- `tf.tidy()` cannot wrap async inference — `model.detect()` and `estimateFaces()` are async; use element-passing pattern (pass HTML canvas/img element directly to model calls — models manage internal tensors)
- Thumbnail + basic metadata (duration, width, height): use HTML5 video element `onloadedmetadata` + canvas `drawImage` — shown instantly on file select, before analysis begins

**Critical bugs to avoid:**
- `ffprobe()` confirmed bug (GitHub #817): returns -1 even on success — NEVER gate logic on return code; always call `readFile('meta.json', 'utf8')` unconditionally after ffprobe
- `ffprobe()` requires `-o filename` flag — stdout not accessible in wasm; output must be written to virtual FS file and read back
- Scene detection output is in the log stream, NOT a file: use `select=gt(scene\,0.4),showinfo -f null -` pattern; accumulate `ffmpeg.on('log', ...)` lines and parse `pts_time:X.XXX` with regex
- MediaPipe face-detection: `solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection'` is MANDATORY in detector config — omitting it causes silent initialization failure

**Key implementation notes:**
- ffmpeg singleton: create once at module init, reuse across analyses
- TF.js model pre-warm: load COCO-SSD + face-detection in background when file is selected, not on Analyse click
- Motion score: COCO-SSD bounding box centroid delta between consecutive frames (no built-in motion API in TF.js)
- Beat detection: use `meyda` or `music-tempo` npm package for onset detection from Web Audio API FFT data
- Frame extraction: `select='not(mod(n\,INTERVAL))',scale=512:512` — output as JPEG to virtual FS, read back as Uint8Array
- iOS detection: `typeof WebAssembly === 'undefined'` — show fallback message + manual description textarea

**Success Criteria:**
1. User drags an MP4 or MOV — thumbnail and duration/resolution/aspect ratio appear instantly from HTML5 video element, before Analyse is clicked; files over 200 MB show a warning; files over 250 MB are rejected
2. After clicking Analyse, "Analysing video..." loading state appears; ffmpeg extracts metadata (duration, fps, bitrate, audio presence), 10 frames as JPEG, and scene-change timestamps from log stream — no network request for the video file during this phase
3. `ffprobe()` output is read unconditionally from the virtual FS file regardless of return code
4. TF.js COCO-SSD produces object/scene labels; face-detection with MediaPipe solutionPath produces face-presence flag — tab does not crash on repeat analysis (tensor count stable)
5. Motion score is computed as bounding box centroid delta across frame sequence
6. Web Audio API produces audio energy score, beat presence flag, and max silence gap
7. Canvas API produces brightness (luma) score
8. On iOS Safari without WebAssembly, user sees a clear fallback message and manual description textarea — no blank screen or crash

**Plans:** TBD
**UI hint:** yes

---

### Phase 4: Virality Score + Checklist

**Goal:** After analysis, user sees a 0–100 virality score with colour coding, per-platform
variants, predicted view ranges, a three-state checklist (pass/fail/pending), and a
rule-based gap analysis with actual video values in the fix messages — all without AI.

**Depends on:** Phase 3

**Requirements:** SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, SCORE-06, SCORE-07

**Architecture decisions from research:**
- Metadata Quality checklist section (8 items) requires AI output — render as `pending` in Phase 4, evaluated and updated in Phase 5
- Checklist item type: `status: 'pass' | 'fail' | 'pending'` (not boolean)
- View range lookup uses the platform-specific score (not overall score) — consistent with SCORE-03 and SCORE-04
- Gap analysis: dynamic fix messages that embed actual measured values (e.g. "Max silence gap: 3.2s — remove gaps over 1.5s") — `gaps.ts` filters `checklist.filter(item => item.status === 'fail').map(item => item.fix)`
- `EngineSignals` TypeScript interface lives at `frontend/src/lib/types.ts`, shared by Phase 3 (engine.ts) and Phase 4 (score.ts, checklist.ts, gaps.ts)

**Score formula normalization (per-signal):**
- Hook: `(hookSceneChange ? 50 : 0) + motionScoreFirst3s * 0.5`, bounded 0–100
- Pacing: `100 * (1 - e^(-cutsPerMin / 6))` — exponential curve, prevents overflow
- Face: binary 100/0
- Audio: `energyScore * 0.75 + (beatDetected ? 15 : 0) - max(0, silenceGapMaxSeconds - 1.5) * 5`, floor 0 if no audio
- Duration fit: 100 inside optimal range, linear decay to 0 at 2× upper bound
- Aspect ratio: 100 if within ±0.02 of 9:16, else 0
- Brightness: 0 below luma 30, ramps to 50 at luma 60, ramps to 100 at luma 80+
- Edge cases: `durationSeconds === 0`, no audio, no face, no scene cuts, malformed aspect ratio all handled without crash

**Learned weights merge:** `effectiveWeight = baseline + clampedDelta` where delta capped at ±15% of baseline; re-normalise to sum to 1.0; use baseline unchanged if `dataPoints < 10`

**Success Criteria:**
1. Overall virality score renders with correct colour: red 0–39, amber 40–59, green 60–79, bright green 80–100
2. Per-platform score variants computed for all 5 platforms; expected view ranges displayed using each platform's own score (not overall score)
3. Checklist renders all four sections; Video Technical and Virality Booster items show pass/fail; Metadata Quality items show `pending` (not failed) before AI has run; each failed item shows a fix message with actual video values interpolated
4. Gap analysis list generated from failed checklist items with zero AI calls
5. Score computation handles edge cases (no audio, no face, 0-duration, unknown aspect ratio) without crash or NaN

**Plans:** TBD

---

### Phase 5: AI Copy + Platform Cards

**Goal:** One AI call returns all five platform outputs as JSON; five styled platform cards
with per-field copy buttons; "Get Better Version" second pass; manual copy always available.
Provider routing: Gemini via Files API (always), Claude from browser with explicit flag,
OpenAI via backend proxy.

**Depends on:** Phase 4

**Requirements:** AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, AI-08, PLATFORM-01, PLATFORM-02, PLATFORM-03, PLATFORM-04, PLATFORM-05, PLATFORM-06, PLATFORM-07, PLATFORM-08, PLATFORM-09, PLATFORM-10, UI-03, UI-04, UI-05

**Critical spec corrections:**
- Gemini inline video is broken for ALL sizes (Google acknowledged bug, 500/503 even for 300 KB files) — Files API is the only working path regardless of file size; spec's ">70 MB" threshold is wrong
- OpenAI permanently blocks direct browser calls (intentional CORS policy, confirmed Jan 2026) — OpenAI calls must be proxied through the backend `/api/ai/generate` Express route; API key fetched from DB (already encrypted there from Phase 2)
- Claude: `dangerouslyAllowBrowser: true` required in SDK constructor (Anthropic added CORS support Aug 2024, requires explicit opt-in); appropriate for BYO-key personal tool
- Gemini JSON mode: `responseMimeType: "application/json"` alone is not enough — must pass `responseSchema` object alongside it

**Provider routing table:**
| Provider | Call origin | Video method | JSON mode |
|----------|-------------|--------------|-----------|
| Gemini 2.5 Flash | Browser (direct) | Files API always (upload → poll → generate) | `responseMimeType + responseSchema` |
| Claude claude-sonnet-4-5 | Browser (direct, `dangerouslyAllowBrowser`) | 10 extracted frames as base64 image array | Prompt-level JSON instruction |
| OpenAI gpt-4.1 | Backend proxy (CORS blocked) | 10 extracted frames as base64 image array | `response_format: { type: "json_object" }` |

**JSON parsing robustness:** strip markdown fences → find first `{` and last `}` → JSON.parse → if still throws, return empty strings per field (never blank the whole card)

**"Get Better Version":** full re-run of same prompt with `improved_script_outline` appended as additional context; images not re-sent → ~50% cheaper second call

**Streaming:** not used — JSON cards cannot be meaningfully rendered partially; wait for complete response, render all 5 cards at once

**Checklist update:** after AI output arrives, re-evaluate the 8 Metadata Quality checklist items (was `pending` from Phase 4) and update their status

**Success Criteria:**
1. Gemini: video is uploaded via Files API, polled until processing complete, then generation request sent — works for all file sizes including small files
2. Claude: SDK initialized with `dangerouslyAllowBrowser: true`; 10 base64 frames sent as image content blocks — all 5 platform cards populate
3. OpenAI: generation request goes to backend proxy route `/api/ai/generate`; API key fetched from DB — response returns to frontend correctly
4. Malformed JSON (markdown fences, extra text, truncated) is handled without blank cards — strip + fallback always produces parseable output
5. Metadata Quality checklist items transition from `pending` to `pass`/`fail` after AI output arrives
6. "Get Better Version" fires a second AI call with `improved_script_outline` context; all cards update with new output
7. TikTok card upload button is greyed out with "Available once API approved"; manual copy is active
8. All copy buttons work; platform character limits displayed with live counter; app is usable on a mobile phone

**Plans:** TBD
**UI hint:** yes

---

### Phase 6: Auto-Upload + Scheduling

**Goal:** User can upload to YouTube, Instagram, and Facebook from the app via connected
OAuth tokens, schedule at PKT peak times or a manual time, and see clear upload state per
platform. All Meta containers created inside the BullMQ job to avoid 24h expiry risk.

**Depends on:** Phase 5

**Requirements:** AUTOUP-01, AUTOUP-02, AUTOUP-03, AUTOUP-04, AUTOUP-05, AUTOUP-06, AUTOUP-07, AUTOUP-08

**Hard blockers resolved:**
- Facebook Reels: requires a Facebook Page (not personal profile) — Phase 2 already stores `page_id` + `page_access_token` from `GET /me/accounts`; Phase 6 uses `page_access_token` for all Facebook API calls
- Instagram account must be Creator/Business (personal accounts excluded from Graph API) — pre-flight check in Settings (Phase 2) surfaces this before Phase 6 is reached
- Instagram scopes already corrected in Phase 2 to `instagram_business_basic` + `instagram_business_content_publish`

**Critical flow fix — Meta container creation:**
- Container must be created INSIDE the BullMQ job at fire time, NOT when the user clicks "Schedule"
- Reason: Instagram containers expire in 24 hours — a container created at schedule time will be expired by the time a post scheduled 48h+ in advance fires
- Job payload: `{ platform, filePath, caption, hashtags, scheduledAt }` — no container ID in payload

**File size gates (before queuing):**
- Instagram: hard 100 MB limit — reject with clear error for videos 100–250 MB before queuing
- YouTube: no hard limit via resumable upload (handles up to 256 GB)
- Facebook: 1 GB limit (no practical issue for this tool)

**Upload flows:**
- YouTube: `youtube.videos.insert({ media: { mimeType: 'video/mp4', body: fs.createReadStream(filePath) } })` — googleapis handles chunking; Shorts auto-detected by YouTube server-side (vertical + ≤60s + `#Shorts` in title)
- Instagram: POST `/media` (container) → poll `GET /{container-id}?fields=status_code` every 5s until `FINISHED` (max 5 min) → POST `/media_publish`; never publish on `IN_PROGRESS`; `EXPIRED` = create new container
- Facebook: POST `/{page-id}/video_reels` with `upload_phase=START` → upload bytes to `upload_url` → POST `/{page-id}/video_reels` with `upload_phase=FINISH, video_state=PUBLISHED`; uses `page_access_token`
- TikTok: code behind `isTikTokApproved` flag, button greyed out, activatable without re-deploy

**Temp file lifecycle:**
- Frontend POSTs video to backend → written to `/tmp/{uuid}.mp4`
- Backend serves at `GET /uploads/{uuid}.mp4` (Nginx proxies this with public HTTPS)
- Meta fetch: container creation references `VPS_PUBLIC_URL/uploads/{uuid}.mp4`
- Cleanup: delete file after `media_publish` success; BullMQ cleanup job deletes files older than 1 hour (handles failed publishes)

**Environment requirement:** `VPS_PUBLIC_URL` must be set as env var before Phase 6 can be tested

**BullMQ scheduling:** delayed jobs stored in Redis sorted set (fire timestamp as score); survive server restart IF Redis has `appendonly yes` (set in Phase 1); `removeOnComplete: { count: 100 }`, `removeOnFail: { count: 50 }`

**Upload state tracking:** `platform_posts.upload_status` updated by BullMQ worker on job complete/fail; frontend polls `GET /api/posts/{id}/status` every 3s while any platform shows `pending` or `uploading`

**Success Criteria:**
1. Instagram pre-flight: if account is not Creator/Business type, Settings screen shows a clear setup instruction — upload button disabled until resolved
2. YouTube: a 250 MB test video uploads successfully via `googleapis videos.insert` resumable stream; Shorts detected server-side; upload_status transitions to `posted`
3. Instagram Reels: container created inside BullMQ job (not at schedule time); status polled every 5s; `media_publish` only called after `FINISHED`; videos over 100 MB show a clear rejection error before queuing
4. Facebook Reels: upload uses `page_access_token` from `settings.platform_config.facebook.page_access_token`; `page_id` used in all Facebook API paths
5. Scheduled upload queued with BullMQ delay fires at correct PKT time after a server restart (Redis AOF confirmed)
6. Temp file cleaned up after successful `media_publish`; cleanup job removes any file older than 1 hour
7. Upload state per platform cycles Idle → Uploading → Posted/Failed with descriptive error messages (never silent failure)

**Plans:** TBD

---

### Phase 7: History + Learning Loops

**Goal:** User can browse all past generated posts, log actual views per platform in a single
DB transaction that atomically updates accuracy + learning signals + learned weights, and
view learning insights computed entirely by SQL aggregation — feeding top hooks and hashtags
back into AI prompts and self-calibrating the score formula.

**Depends on:** Phase 6

**Requirements:** HISTORY-01, HISTORY-02, HISTORY-03, HISTORY-04, HISTORY-05, HISTORY-06, LEARNING-01, LEARNING-02, LEARNING-03, LEARNING-04, LEARNING-05, LEARNING-06, LEARNING-07, LEARNING-08

**Spec SQL corrections:**
- Spec Loop 1 hashtag query references `hashtag` (scalar) but column is `TEXT[]` — use `unnest(hashtags) AS hashtag` in a subquery; must use `db.execute(sql\`...\`)` (no Drizzle fluent builder equivalent)
- Hook learning: use `MAX(actual_views)` not `AVG` — for a solo creator, max surfaces the viral ceiling of each hook
- Platform filter in post history: needs an EXISTS subquery (`platform` lives in `platform_posts`, not `posts`)
- `COALESCE(niche, 'Other')` in GROUP BY — NULL niches from engine detection silently exclude posts; fall back to `settings.default_niche` when writing to `learning_signals`

**View logging transaction (atomic — all 4 writes or none):**
```
db.transaction(async (tx) => {
  1. UPDATE platform_posts SET actual_views, views_logged_at
  2. Compute accuracy (overperformed / matched / underperformed)
  3. INSERT INTO learning_signals (niche, platform, hook_text, hashtags, virality_score, actual_views, score_accuracy)
  4. Compute EMA delta for each signal; UPDATE settings SET learned_weights
})
```
Partial commit silently corrupts learning loops — must be a single transaction.

**EMA formula for score calibration:**
`newEMA = 0.3 × newDelta + 0.7 × prevEMA`
Store per-signal deltas (not raw weights) in `settings.learned_weights` JSONB alongside `dataPoints` counter.
Cap each delta at ±0.15. On application side: if `dataPoints < 10`, use baseline weights unchanged.

**Learning injection:** fetch fresh before every AI call via `Promise.all([getLearningHooks, getLearningHashtags])` — queries are <5ms on local DB, no per-session caching needed

**Best posting times query:**
```sql
SELECT EXTRACT(DOW FROM posted_at AT TIME ZONE 'Asia/Karachi') as day,
       EXTRACT(HOUR FROM posted_at AT TIME ZONE 'Asia/Karachi') as hour,
       AVG(actual_views) as avg_views
FROM platform_posts
WHERE platform = $platform AND actual_views IS NOT NULL
GROUP BY day, hour
HAVING COUNT(*) >= 2
ORDER BY avg_views DESC
```

**Bar chart:** pure Tailwind with inline `style={{ width: '${pct}%' }}` — Tailwind cannot generate dynamic width classes at build time

**Success Criteria:**
1. Post History lists all posts newest-first; platform filter uses EXISTS subquery correctly; niche + date range filters work
2. Logging actual views completes as a single atomic transaction — if any write fails, no partial state is committed; accuracy label appears immediately
3. After 10+ logged data points, a virality score computed on a niche with calibration data visibly differs from the baseline formula
4. When fewer than 5 data points exist for a niche, AI prompt falls back to hardcoded hashtag bank without error
5. Learning Insights shows top 5 hooks (`MAX(actual_views)`) and top 10 hashtags (`unnest(hashtags)` aggregated correctly) per niche
6. Best posting times displayed in PKT using `AT TIME ZONE 'Asia/Karachi'` conversion
7. Bar chart renders with inline style (not dynamic Tailwind class) — displays from 1 data point

**Plans:** TBD
**UI hint:** yes

---

### Phase 8: Polish + Resilience

**Goal:** The tool runs smoothly under repeated use, on mobile, and under all error conditions.
Async tensor dispose, unified API error mapping, iOS Safari layout fixes, indeterminate
progress animation, and score calibration indicator.

**Depends on:** Phase 7

**Requirements:** (quality properties spanning Phases 1–7)

**Architecture clarifications:**
- ffmpeg.wasm Web Worker: `@ffmpeg/ffmpeg` 0.12.x already runs WASM in an internal worker — Phase 8 is a config verification (`optimizeDeps.exclude` in Vite) and profiling task, not an architecture rewrite
- UI freeze if it occurs comes from `ffmpeg.writeFile()` + TF.js input prep on main thread — profile with Chrome DevTools first, only move these to a wrapper Worker if freeze is confirmed

**Async tensor leak fix:**
- `tf.tidy()` does NOT work with async functions — cleanup never fires in async context
- Pattern: pass HTML canvas/img elements directly to model calls (models manage internal tensors); use explicit `imageTensor.dispose()` in `try/finally` for any manually created tensors
- Add `tf.memory().numTensors` logging in DEV mode only; should be stable across repeat analyses

**Unified API error mapping table:**
| Condition | Claude `error.type` | Gemini `error.status` | OpenAI `error.code` | UI action |
|-----------|--------------------|-----------------------|---------------------|-----------|
| Invalid key | `authentication_error` | `UNAUTHENTICATED` | `invalid_api_key` | "Invalid API key — update in Settings" |
| Rate limited | `rate_limit_error` | `RESOURCE_EXHAUSTED` | `rate_limit_exceeded` | "Rate limited — try again in 60s" + retry button |
| Quota exhausted | `rate_limit_error` | `RESOURCE_EXHAUSTED` | `insufficient_quota` | "API quota exhausted — check your account" |
| Model busy | `overloaded_error` | `UNAVAILABLE` | — | "Model busy — try again" + retry button |
| Network error | — | — | — | "Network error" + retry button |

Retry button only for retryable errors (rate_limited, model_busy, network) — never for invalid_key or quota_exhausted.

**iOS Safari layout:**
- Replace all `h-screen` / `100vh` with `h-[100dvh]` (iOS 15.4+ dynamic viewport height)
- Add `viewport-fit=cover` to meta viewport tag
- Fixed bottom elements: `pb-[env(safe-area-inset-bottom)]`

**ffmpeg progress:** `on('progress')` is unreliable for image/frame extraction tasks (documented in ffmpeg.wasm) — use indeterminate spinner animation, not a percentage bar

**OAuth expiry:** if backend receives 401 from YouTube/Meta API during upload, return structured error `{ code: 'oauth_expired', platform }` → frontend shows "YouTube connection expired — reconnect in Settings"

**Score calibration indicator:** small badge on the virality score card: "Calibrated (N posts)" when `dataPoints >= 10`, nothing when using baseline

**Success Criteria:**
1. Five consecutive video analyses without page reload — no UI freeze; TF.js tensor count stable (`tf.memory().numTensors` constant after each run in DEV mode)
2. Each API error state (invalid key, rate limit, quota exhausted, model busy, network) shows the correct user-facing message from the unified mapping table; retry button appears only for retryable errors
3. OAuth expiry during upload shows "reconnect in Settings" message, not a raw error
4. Full workflow completable on a mid-range Android phone — no layout breakage, no unreachable touch targets
5. iOS Safari: `h-[100dvh]` in place of `h-screen`; no content clipped by dynamic browser chrome
6. Score card shows "Calibrated (N posts)" badge when learning data is active
7. ffmpeg progress shows indeterminate animation — no broken percentage bar

**Plans:** TBD
**UI hint:** yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Foundation | 0/TBD | Not started | - |
| 2. Settings + OAuth | 0/TBD | Not started | - |
| 3. Video Upload + Analysis Engine | 0/TBD | Not started | - |
| 4. Virality Score + Checklist | 0/TBD | Not started | - |
| 5. AI Copy + Platform Cards | 0/TBD | Not started | - |
| 6. Auto-Upload + Scheduling | 0/TBD | Not started | - |
| 7. History + Learning Loops | 0/TBD | Not started | - |
| 8. Polish + Resilience | 0/TBD | Not started | - |
