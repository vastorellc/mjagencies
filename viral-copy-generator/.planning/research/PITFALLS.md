# Pitfalls Research — Viral Copy Generator

**Domain:** In-browser video analysis + AI copy generation + social API auto-upload
**Researched:** 2026-04-30
**Confidence:** HIGH (all critical pitfalls verified against official docs or multiple sources)

---

## Critical Pitfalls (will break the build)

| Pitfall | Warning Signs | Prevention | Phase |
|---------|--------------|------------|-------|
| **ffmpeg.wasm: missing COEP/COOP headers** — SharedArrayBuffer is gated behind cross-origin isolation. Without `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on every response, ffmpeg.wasm throws `SharedArrayBuffer is not defined` and refuses to load entirely. | Console error: "SharedArrayBuffer will require cross-origin isolation"; ffmpeg.load() hangs or throws on first call | Set both headers in Vite's `server.headers` config for dev AND in the VPS Nginx config for production. Both environments need them — forgetting the Nginx side is the most common deploy-time failure. | Phase 3 |
| **ffmpeg.wasm: COEP breaks any third-party iframe or script** — Enabling COEP forces every sub-resource to carry `Cross-Origin-Resource-Policy: cross-origin`. Google Fonts, CDN-loaded scripts, OAuth popup windows, and any iframe (e.g. a future embed) will silently fail or block. | OAuth popup fails to open; external fonts stop loading; browser console shows "blocked by COEP" for sub-resources | Load all fonts/icons locally (self-host). Verify OAuth popups work after adding the headers. Google OAuth popup is the only active third-party resource in this build; test it explicitly in Phase 3 before assuming it works. | Phase 3 |
| **YouTube upload: multipart is limited to 5 MB** — The spec draft uses `uploadType=multipart`. This limit is 5 MB per Google's API docs. A typical short-form video is 50–500 MB. Every upload will fail silently or with a 400 error. | Upload returns HTTP 400/413; video never appears on YouTube | Switch to `uploadType=resumable` for all YouTube uploads regardless of file size. Resumable supports up to 256 GB. Send chunks of exactly 256 KB multiples. | Phase 6 |
| **Meta Graph API: publishing a container before it's FINISHED causes 400** — Instagram Reels use a two-step container model. The container's status must be `FINISHED` before calling `/me/media_publish`. Calling publish immediately after container creation returns a 400 error because processing is still `IN_PROGRESS`. | Upload appears to succeed (container ID returned) but publish silently fails or errors; reels never appear on Instagram | Poll `/{container-id}?fields=status_code` at 5-second intervals until `FINISHED`, with a maximum of 5 minutes total. Never publish in the same request cycle as container creation. If status reaches `ERROR`, discard the container and start fresh — never retry a failed container. | Phase 6 |
| **Meta tokens stored in localStorage** — The spec notes "token saved to localStorage." OAuth tokens (especially long-lived Meta tokens) in localStorage are readable by any JavaScript on the page, including third-party scripts. An XSS attack exfiltrates them permanently. | N/A — silent security hole until exploited | Store all OAuth tokens on the backend only. Frontend requests backend routes like `POST /api/upload/youtube` which reads the token from the DB (already encrypted). Never send raw tokens to the frontend. The spec's backend already has an `upload.ts` proxy route — use it for all social uploads. | Phase 2 / Phase 6 |
| **Gemini inline_data limit for large videos** — The spec sends video as base64 `inline_data` to Gemini. The limit for inline data is 100 MB (base64 encoded, raised from 20 MB in January 2026). A 500 MB video base64-encoded is ~667 MB — far over the limit. Even a 70 MB video base64-encodes to ~93 MB, near the ceiling. | AI call returns HTTP 413 or API error referencing payload size; Gemini call silently drops large videos | For Gemini, use the Files API (`uploadFile()`) for any video over ~70 MB rather than inline base64. For Claude and OpenAI, the spec already extracts 10 frames via ffmpeg.wasm — this avoids the size problem entirely. Add a size check before choosing inline vs Files API path. | Phase 5 |

---

## Important Pitfalls (will degrade quality)

### 1. ffmpeg.wasm: iOS Safari is effectively broken

**What goes wrong:** iOS Safari does not reliably support SharedArrayBuffer in Web Workers, even on iOS 17+. ffmpeg.wasm's multithreading requires it. Users opening this tool on an iPhone (a primary use case for a Pakistani short-form creator) will encounter a broken engine.

**Why it happens:** Apple's implementation of SharedArrayBuffer in cross-origin isolated contexts has historically been inconsistent, and the threaded WASM build that ffmpeg.wasm uses requires it unconditionally.

**Warning signs:** Engine silently fails on iPhone; analysis never completes; no error shown to user.

**Prevention:** Detect SharedArrayBuffer availability at startup with `typeof SharedArrayBuffer !== 'undefined'`. On failure, show a specific message: "Video analysis requires Chrome or Firefox on desktop. Safari and iOS are not supported. Copy generation still works — paste your video details manually." The manual description textarea already exists in the spec; lean on it as the iOS fallback path.

**Phase:** Phase 3

---

### 2. TensorFlow.js WebGL tensor memory leaks

**What goes wrong:** TensorFlow.js does not automatically garbage-collect tensors. Every call to `model.detect()`, `tf.fromPixels()`, or intermediate operations creates tensors that stay in GPU/WebGL memory until explicitly disposed. Processing a 60-second video frame-by-frame without disposal will exhaust GPU memory and crash the tab within minutes.

**Why it happens:** WebGL textures are cached by physical shape. Tensors going out of JavaScript scope does not release WebGL memory — only `tensor.dispose()` or `tf.tidy()` does.

**Warning signs:** `tf.memory().numTensors` grows without bound during analysis; browser tab slows noticeably on second or third analysis run; eventual tab crash.

**Prevention:**
- Wrap every model inference call in `tf.tidy(() => { ... })` — it auto-disposes all intermediate tensors except the return value.
- After each frame processed, call `tf.dispose(result)` on detection outputs before moving to the next frame.
- After analysis completes, call `model.dispose()` if the model won't be needed again, or keep a single shared instance and never re-load it.
- Add `tf.memory().numTensors` logging during development to catch leaks early.

**Phase:** Phase 3

---

### 3. TensorFlow.js model load time on first use

**What goes wrong:** COCO-SSD (the primary object/scene detection model) downloads and initializes on first call. The model itself is ~20–30 MB over the network and takes 3–8 seconds to initialize on a mid-range mobile device. During this time the UI appears frozen if no loading state is shown.

**Why it happens:** Model weights are loaded lazily on first inference, not at import time.

**Warning signs:** Long blank pause between "Analyse & Generate" button press and first progress update; users abandon the session.

**Prevention:** Pre-warm models during the idle time after video is selected but before the user clicks Analyse (e.g., load models in the background as soon as a file is chosen). Show a "Loading analysis engine…" indicator as part of the two-phase loading system. Use `lite_mobilenet_v2` as the base (default) rather than `mobilenet_v2` — it is smaller and faster with acceptable accuracy for scene labelling.

**Phase:** Phase 3

---

### 4. Meta access token expires silently after 60 days

**What goes wrong:** Meta long-lived tokens expire after 60 days. If the user does not upload anything for 60 days, or if the auto-refresh job misses a window, the next upload attempt fails with an auth error. The user sees no explanation — the upload just returns 401 and the post sits at `upload_status = 'failed'`.

**Why it happens:** Long-lived tokens cannot be refreshed once expired — the window is lost. Tokens can only be refreshed if they are at least 24 hours old but not yet expired.

**Warning signs:** Upload fails with OAuth error after a period of inactivity; `platform_config` in settings has a token with an `expires_at` timestamp in the past.

**Prevention:**
- Store `token_expires_at` in `platform_config` JSONB when the token is saved.
- On every backend startup and on every upload attempt, check if token expires within 7 days. If so, trigger a refresh automatically using the existing `oauth.ts` handler.
- On the Settings screen, show the token expiry date and a "Reconnect" button if expired or within 7 days of expiry.
- Schedule a daily cron job (via BullMQ or `node-cron`) to refresh any tokens approaching expiry.

**Phase:** Phase 2 (token storage) / Phase 6 (refresh cron)

---

### 5. AI prompt returns markdown-wrapped JSON (breaks all parsers)

**What goes wrong:** Despite the instruction "Return ONLY a JSON object — no markdown, no explanation," models (especially Gemini Flash) frequently wrap the JSON in a markdown code block: `` ```json\n{...}\n``` ``. A direct `JSON.parse()` call throws a SyntaxError. This fails silently if not caught, producing no platform cards.

**Why it happens:** Models are fine-tuned to produce helpful formatting including code blocks. The instruction is honoured ~80% of the time but fails on the remaining ~20%, especially when the prompt is long or the model is under load.

**Warning signs:** `JSON.parse()` throws `Unexpected token `\`` in production; copy generation appears to work but platform cards are blank; error only visible in the console.

**Prevention:**
- In `prompt.ts`, after receiving the raw response, strip markdown fences before parsing: `raw.replace(/^```json\n?/,'').replace(/\n?```$/,'')`.
- Add a secondary extraction step: if direct parse fails, use a regex to find the first `{` and last `}` and attempt to parse the substring.
- Use Gemini's or OpenAI's native structured output / JSON mode when available (e.g., `response_mime_type: 'application/json'` for Gemini Flash) — this guarantees schema-valid output at the model level.
- Log and surface the raw response on parse failure so the user can copy the text manually.

**Phase:** Phase 5

---

### 6. AI hallucination of hashtags that don't exist

**What goes wrong:** Models fabricate plausible-looking but non-existent hashtags (e.g., `#VisitPakistanNow2025Official`). These pass the character-count check but return zero results when searched on Instagram or TikTok, harming discoverability.

**Why it happens:** The model pattern-matches from training data rather than verifying hashtag existence. Hallucination rates for list-type outputs are higher than for prose.

**Warning signs:** Generated hashtags include long compound phrases; hashtags contain year numbers; no existing posts found when searching the tag.

**Prevention:**
- Inject the niche hashtag bank (from `hashtags.ts`) directly into the prompt as "Use hashtags ONLY from this verified list, and add general tags that are real and commonly used." This anchors the model to real tags.
- Add a length filter in `checklist.ts`: any hashtag over 30 characters should be flagged for review.
- The learning loop naturally surfaces this problem — hashtags with zero actual view contribution get deprioritised over time, gradually cleaning the pool.

**Phase:** Phase 4 (hashtag bank injection) / Phase 5 (checklist validation)

---

### 7. Score calibration loop overcorrecting on 2–5 data points

**What goes wrong:** The spec's Loop 3 adjusts signal weights by ±5% per data point, capped at ±15% total. With only 2–5 posts logged, a single outlier (a video that went viral for reasons unrelated to its signals — e.g., it was reshared by a celebrity) will shift weights significantly. Subsequent scores become misleading and the user loses trust in the tool.

**Why it happens:** Small-N statistical noise is interpreted as signal. The formula has a hard cap at ±15% but no minimum data requirement for weight adjustment.

**Prevention:**
- Add a minimum threshold: do not apply any weight adjustment until at least 10 data points exist for that niche/platform combination. The spec already mentions "Resets to baseline if fewer than 10 data points" — enforce this strictly in `learning.ts`.
- Use exponential moving average rather than raw average for weight updates — this dampens outliers without discarding them.
- Display a "Learning active (N/10 posts logged)" progress indicator on the Learning Insights screen so the user understands the system is in cold-start mode.

**Phase:** Phase 7

---

### 8. BullMQ + Redis on 1 GB VPS: memory exhaustion kills the queue

**What goes wrong:** The spec uses BullMQ for upload scheduling. On a 1 GB Hetzner VPS running Node.js + PostgreSQL + Redis simultaneously, total memory use easily exceeds available RAM. The Linux OOM killer then terminates whichever process uses most memory at that moment — usually Node.js or PostgreSQL, crashing the entire stack.

**Why it happens:** Redis defaults to `noeviction` (correct for a queue) but provides no memory ceiling. BullMQ accumulates completed job data in Redis if not explicitly removed. Node.js V8 heap has no default cap.

**Warning signs:** VPS becomes unresponsive; `dmesg | grep -i "out of memory"` shows OOM kills; Redis `INFO memory` shows `used_memory` approaching `total_system_memory`.

**Prevention:**
- Set `maxmemory 200mb` and `maxmemory-policy noeviction` in Redis config.
- Configure BullMQ to auto-remove completed and failed jobs: `removeOnComplete: { count: 100 }` and `removeOnFail: { count: 50 }` in job options.
- Set `--max-old-space-size=384` in the Node.js startup command.
- Configure PostgreSQL `shared_buffers = 128MB` and `work_mem = 4MB` in `postgresql.conf`.
- Add a 1–2 GB swap file. This will not prevent OOM kills but gives enough headroom for burst scenarios.
- Consider replacing BullMQ entirely with `pg-boss` (PostgreSQL-backed job queue) to eliminate Redis as a separate memory consumer. This is viable given the single-user, low-volume nature of the tool.

**Phase:** Phase 1 (infrastructure setup)

---

## Minor Pitfalls (watch out for)

### 9. ffmpeg.wasm: loading the WASM core multiple times per session

**What goes wrong:** If the ffmpeg instance is created (`new FFmpeg()`) and `load()` is called more than once — e.g., between video analyses — memory in the browser increases linearly and is never released, eventually causing OOM errors. This is a known unfixed issue in ffmpeg.wasm.

**Prevention:** Create the ffmpeg instance and call `load()` once at app startup. Export it as a singleton. Never re-instantiate it per-video.

**Phase:** Phase 3

---

### 10. Drizzle ORM JSONB partial updates corrupt the column

**What goes wrong:** When updating only one key inside a JSONB column (e.g., updating only `platform_config.youtube.token` inside the `settings` table), using a standard Drizzle `update().set({ platformConfig: { ...newPartial } })` replaces the entire column with only the partial object, silently deleting other keys. Additionally, Drizzle has a known bug where JSONB values are occasionally inserted as strings rather than proper JSONB, breaking `->` operator queries.

**Prevention:** For partial JSONB updates, use raw SQL with the PostgreSQL merge operator:
```sql
SET platform_config = platform_config || $newPartial::jsonb
```
Or use Drizzle's `sql` template: `sql\`${settings.platformConfig} || ${JSON.stringify(partial)}::jsonb\``. Always test with `->` queries after updates to confirm JSONB integrity.

**Phase:** Phase 1

---

### 11. YouTube Shorts mis-classification

**What goes wrong:** YouTube classifies a video as a Short based on a combination of signals: duration ≤60 seconds, aspect ratio 9:16, and `#Shorts` in the title or description. If any one of these is missing the video lands on the regular feed, not the Shorts shelf. There is no dedicated Shorts upload endpoint — the same `videos.insert` call is used for both.

**Prevention:** The spec already detects vertical aspect ratio and duration. In the YouTube upload payload builder, auto-inject `#Shorts` into the description (not the title — it counts toward the 60-char title limit) whenever duration ≤60s AND aspect ratio is 9:16. Validate this condition in `upload.ts` before sending the API call.

**Phase:** Phase 6

---

### 12. Google OAuth tokens also stored in localStorage (spec draft)

**What goes wrong:** The spec notes "token saved to localStorage" for Google OAuth as well. Google access tokens expire in 1 hour; refresh tokens are long-lived. Storing either in localStorage exposes them to XSS.

**Prevention:** Same as Meta tokens — store in the backend database (already in `settings.platform_config`). The `oauth.ts` handler already exists for token refresh. Frontend never sees the raw token.

**Phase:** Phase 2

---

### 13. Web Audio API: file must be fully decoded before analysis

**What goes wrong:** The Web Audio API `decodeAudioData()` requires the entire audio file to be in memory as an ArrayBuffer before decoding begins. For a 500 MB video file, this means loading the entire file into memory twice — once as the original file and once as decoded audio data — before any analysis starts.

**Prevention:** Use ffmpeg.wasm to extract the audio track as a small MP3/AAC file first (a few seconds of ffmpeg processing), then run `decodeAudioData()` on the extracted audio only. This keeps memory usage for the audio step in the 1–10 MB range regardless of source video size.

**Phase:** Phase 3

---

### 14. Single-row settings table: update race condition

**What goes wrong:** The `settings` table has a single row. If the user saves settings from the UI at the same moment a background token refresh job runs, the two writes can produce a last-write-wins race that drops one update silently.

**Prevention:** Use PostgreSQL `UPDATE ... WHERE id = $id RETURNING *` with the JSONB merge operator for all settings writes, so each write only modifies the keys it owns. Add a `SELECT ... FOR UPDATE` lock around token refresh writes in `oauth.ts`.

**Phase:** Phase 1

---

## Phase-Specific Warnings

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|---------------|------------|
| Phase 1 | Infrastructure | 1 GB RAM exhausted by Node + PG + Redis | Set memory limits, add swap, consider pg-boss over BullMQ |
| Phase 1 | Drizzle JSONB | Partial update wipes entire column | Use JSONB merge operator for settings writes |
| Phase 2 | OAuth tokens | Token stored in localStorage (XSS exposure) | Store tokens backend-only; frontend uses proxy routes |
| Phase 2 | Meta token lifecycle | Token expires after 60 days with no warning | Store `expires_at`, implement refresh cron |
| Phase 3 | ffmpeg.wasm | COEP/COOP breaks OAuth popup | Test Google OAuth popup after adding isolation headers |
| Phase 3 | ffmpeg.wasm | iOS Safari completely broken | Detect SharedArrayBuffer; show graceful fallback message |
| Phase 3 | ffmpeg.wasm singleton | Re-instantiating ffmpeg leaks memory | Create once at startup, export as singleton |
| Phase 3 | TensorFlow.js | Tensors not disposed → tab crash | Wrap all inference in `tf.tidy()`; log `tf.memory()` in dev |
| Phase 3 | TensorFlow.js | 3–8s model load blocks UX | Pre-warm models on file-select, not on Analyse click |
| Phase 3 | Web Audio API | 500MB file decoded into RAM | Extract audio track with ffmpeg first, then decode |
| Phase 5 | AI JSON output | Markdown-wrapped JSON breaks parser | Strip fences + fallback regex extraction; use JSON mode API flag |
| Phase 5 | AI hashtags | Hallucinated tags harm discoverability | Anchor prompt to verified hashtag bank; filter tags >30 chars |
| Phase 5 | Gemini large video | inline_data fails for videos >70 MB | Gate on file size: use Files API for videos >70 MB |
| Phase 6 | YouTube upload | multipart limited to 5 MB | Use resumable upload protocol for all video uploads |
| Phase 6 | YouTube Shorts | Missing `#Shorts` tag → wrong shelf | Auto-inject `#Shorts` in description when duration ≤60s + 9:16 |
| Phase 6 | Meta Reels | Publish called before container FINISHED | Poll status; never publish an IN_PROGRESS container |
| Phase 7 | Score calibration | Overcorrection on <10 data points | Enforce minimum 10 data points before adjusting weights |

---

## Sources

- ffmpeg.wasm COEP/COOP requirements: [ffmpegwasm/ffmpeg.wasm issue #263](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/263), [ffmpegwasm/ffmpeg.wasm issue #576](https://github.com/ffmpegwasm/ffmpeg.wasm/discussions/576), [Debug & Play React setup guide](https://debugplay.com/posts/ffmpeg-react-setup/)
- ffmpeg.wasm iOS/mobile: [ffmpegwasm iOS issue #299](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/299), [memory issue #83](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/83)
- TensorFlow.js memory leaks: [tfjs issue #6019](https://github.com/tensorflow/tfjs/issues/6019), [TensorFlow platform & environment guide](https://www.tensorflow.org/js/guide/platform_environment)
- TensorFlow.js WebGL texture cache: [tfjs issue #1440](https://github.com/tensorflow/tfjs/issues/1440)
- Meta Graph API token expiry: [Meta refresh token docs](https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token/), [DEV.to Meta OAuth guide](https://dev.to/alex97po/meta-oauth-short-lived-vs-long-lived-tokens-and-why-your-token-expires-after-1-hour-4609)
- Meta Reels container-publish flow: [Meta content publishing docs](https://developers.facebook.com/docs/instagram-platform/content-publishing/), [Postproxy Instagram Reels guide](https://postproxy.dev/blog/instagram-reels-api-publishing-guide/)
- YouTube upload resumable protocol: [Google Resumable Uploads guide](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol), [Postproxy YouTube upload guide](https://postproxy.dev/blog/youtube-upload-api-guide/)
- YouTube Shorts classification: [Postproxy Shorts guide](https://postproxy.dev/blog/youtube-upload-api-guide/), [Elfsight YouTube API guide](https://elfsight.com/blog/youtube-data-api-v3-limits-operations-resources-methods-etc/)
- AI JSON parsing: [DEV.to LLM structured output 2026](https://dev.to/pockit_tools/llm-structured-output-in-2026-stop-parsing-json-with-regex-and-do-it-right-34pk)
- Gemini inline_data limits: [Google Gemini video understanding docs](https://ai.google.dev/gemini-api/docs/video-understanding), [Google file limits announcement](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-new-file-limits/)
- BullMQ Redis memory: [BullMQ production guide](https://docs.bullmq.io/guide/going-to-production), [DEV.to Redis memory monitoring](https://dev.to/lbd/avoiding-redis-crashes-with-bullmq-memory-monitoring-basics-2848)
- Drizzle JSONB issues: [drizzle-orm issue #2279](https://github.com/drizzle-team/drizzle-orm/issues/2279), [drizzle-orm issue #724](https://github.com/drizzle-team/drizzle-orm/issues/724)
- VPS memory management: [DCHost OOM killer guide](https://www.dchost.com/blog/en/managing-ram-swap-and-the-oom-killer-on-vps-servers/), [MassiveGRID Coolify resource planning](https://massivegrid.com/blog/coolify-resource-planning-multiple-apps/)
- Token storage security: [Auth0 token storage docs](https://auth0.com/docs/secure/security-guidance/data-security/token-storage)
