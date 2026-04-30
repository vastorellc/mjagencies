# Architecture Research

**Project:** Viral Copy Generator
**Researched:** 2026-04-30
**Confidence:** HIGH — spec is fully locked; research verifies external integration specifics

---

## Component Map

Seven discrete components. Each has one owner (browser or server) and explicit boundaries.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                    │
│                                                                             │
│  ┌──────────────┐   raw file    ┌─────────────────────────────────────────┐ │
│  │  UI Layer    │──────────────▶│  Video Analysis Engine                  │ │
│  │  (React 19)  │               │  ffmpeg.wasm | TensorFlow.js | WebAudio │ │
│  │  4 screens   │◀──────────────│  Web Worker (optional, see note below)  │ │
│  └──────┬───────┘  signals JSON └─────────────────────────────────────────┘ │
│         │                                                                   │
│         │ engine signals + AI key                                           │
│         ▼                                                                   │
│  ┌──────────────┐                                                           │
│  │  AI Client   │────────────── directly to Claude / Gemini / OpenAI APIs  │
│  │  (ai.ts)     │               (user's own key, no backend relay needed)   │
│  └──────┬───────┘                                                           │
│         │ generated copy JSON                                               │
│         ▼                                                                   │
│  ┌──────────────┐                                                           │
│  │  API Client  │────────────── HTTP ──▶  BACKEND                          │
│  │  (api.ts)    │◀────────────── HTTP ──  (persistence + upload proxy)     │
│  └──────────────┘                                                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  BACKEND  (Node.js 22 + Express 5)                                         │
│                                                                             │
│  ┌──────────────┐   Drizzle ORM   ┌─────────────────┐                      │
│  │  REST API    │────────────────▶│  PostgreSQL 17   │                      │
│  │  /posts      │◀────────────────│  4 tables        │                      │
│  │  /settings   │                 └─────────────────┘                      │
│  │  /learning   │                                                           │
│  │  /upload     │──── BullMQ job ──▶ Upload Worker                         │
│  └──────────────┘                      │                                   │
│                                         ├──▶ YouTube Data API v3            │
│  ┌──────────────┐                       ├──▶ Meta Graph API (IG + FB)       │
│  │  OAuth Lib   │                       └──▶ TikTok Content Posting API     │
│  │  (oauth.ts)  │◀── token refresh ──── Upload Worker                      │
│  └──────────────┘                                                           │
│                                                                             │
│  ┌──────────────┐                                                           │
│  │  Encryption  │  AES-256-GCM  ──  wraps AI key + OAuth tokens in DB      │
│  │  (encrypt.ts)│                                                           │
│  └──────────────┘                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Owner | Responsibility | Does NOT do |
|-----------|-------|---------------|-------------|
| UI Layer | Browser | Screen routing (useState), render, copy-to-clipboard | Touches DB, calls social APIs |
| Video Analysis Engine | Browser | ffmpeg.wasm metadata, TF.js inference, Web Audio scoring, virality formula, checklist | Calls backend until analysis complete |
| AI Client | Browser | Builds prompt with engine signals + learned data, calls AI provider API directly | Stores anything — sends result to UI for backend save |
| API Client | Browser | Thin HTTP wrapper — all backend calls in one file | Business logic |
| REST API | Backend | CRUD for posts / settings / learning, upload proxy, OAuth token refresh | Video analysis |
| Upload Worker | Backend | Executes BullMQ jobs — YouTube resumable upload, Meta two-step publish, peak-time delay | Returns directly to HTTP request (async) |
| PostgreSQL | Backend | Persistence for all 4 tables | Nothing except data storage |

---

## Data Flow

### Flow 1 — Generate Copy (happy path)

```
1. User drops video onto UI
   └─ browser holds file in memory (File object, never sent to backend)

2. Analysis Engine runs (all in browser, sequential within engine):
   a. ffmpeg.wasm   → duration, fps, resolution, scene timestamps, bitrate
   b. TF.js         → face detection, motion score, scene labels, objects
   c. Web Audio API → energy, beat, silence gaps
   d. Canvas API    → luma score
   └─ outputs: EngineSignals JSON

3. Virality score computed (score.ts, browser)
   └─ uses learned_weights fetched from backend at page load

4. API Client fetches learning signals from backend:
   GET /learning/hooks?niche=travel&platform=youtube
   GET /learning/hashtags?niche=travel&platform=youtube
   └─ backend queries learning_signals table, returns top-10 per niche/platform

5. Prompt builder assembles context (prompt.ts, browser):
   └─ engine signals + virality score + learned hooks + learned hashtags → prompt string

6. AI Client calls provider directly (ai.ts, browser):
   Gemini:       POST api.generativelanguage.googleapis.com (video inline_data)
   Claude/OpenAI: extract 10 frames via ffmpeg.wasm → POST as base64 image array
   └─ response: generated_copy JSON (5 platform objects)

7. UI renders platform cards with copy + upload buttons

8. API Client saves post to backend:
   POST /posts   { engine_signals, generated_copy, virality_score, niche, ... }
   POST /platform-posts  (one per platform)
   └─ backend INSERT into posts + platform_posts tables
```

### Flow 2 — Auto-Upload (YouTube example)

```
1. User clicks Upload on YouTube card
   └─ frontend POST /upload/youtube  { post_id, schedule_time? }

2. Backend /upload route:
   a. validates post_id exists in DB
   b. reads OAuth tokens from settings.platform_config (decrypted)
   c. refreshes token if expires_in < 300s (oauth.ts)
   d. enqueues BullMQ job: { post_id, platform: 'youtube', tokens, delay_ms }
   └─ returns 202 Accepted immediately

3. Upload Worker (BullMQ):
   a. waits for delay (peak-time scheduler math)
   b. streams video to YouTube resumable upload endpoint (chunked, 256KB chunks)
      — video source: frontend re-sends file OR backend uses a temp copy
      — DECISION: frontend streams file directly to /upload endpoint (multipart),
        backend writes to /tmp, proxies to YouTube, deletes tmp after
   c. on success: UPDATE platform_posts SET upload_status='posted', posted_at=now()
   d. on failure: UPDATE platform_posts SET upload_status='failed'
      retries up to 3× with exponential backoff (BullMQ built-in)
   └─ frontend polls GET /platform-posts/:id/status every 3s for UI state
```

### Flow 3 — Learning Loop (triggered by logging views)

```
1. User logs actual views: PATCH /platform-posts/:id/views { actual_views: 45000 }

2. Backend:
   a. UPDATE platform_posts SET actual_views, views_logged_at
   b. Compute score_accuracy:
      actual > predicted_max  → 'overperformed'
      actual within range     → 'matched'
      actual < predicted_min  → 'underperformed'
   c. INSERT into learning_signals:
      { niche, platform, hook_text, hashtags[], virality_score, actual_views, score_accuracy }
   d. If score_accuracy = 'overperformed':
      → read engine_signals for that post
      → boost weight for each present signal by +5% (capped at +15% from baseline)
      → UPDATE settings SET platform_config.learned_weights = { ... }
   └─ returns updated post row

3. Next generation for same niche:
   GET /learning/hooks returns updated top-5 hooks
   GET /learning/hashtags returns updated top-10 hashtags
   GET /settings returns updated learned_weights → used in score.ts
```

---

## Critical Integration Points

These must be built in the exact sequence listed. Each has a hard dependency on the previous.

### Integration Point 1 — COOP/COEP headers gate everything in Phase 3

ffmpeg.wasm requires `SharedArrayBuffer`. `SharedArrayBuffer` is only available in a cross-origin isolated context. Without the correct headers, `self.crossOriginIsolated` is `false` and ffmpeg refuses to initialise with a cryptic error.

**What must be set:**
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**Where to set them — two places, both required:**

1. `vite.config.ts` (dev):
```typescript
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
},
build: { target: 'esnext' },
```

2. Nginx (production — on the same VPS serving frontend static files):
```nginx
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;
```

**Side effect:** COEP blocks cross-origin resources that don't send `Cross-Origin-Resource-Policy: cross-origin`. This means any third-party CDN assets (Google Fonts, external images) will be blocked. For this project: use no third-party resources in the frontend, or serve all assets locally.

**TF.js WASM backend shares the same requirement.** TF.js multi-threaded WASM also uses `SharedArrayBuffer`. Since the COOP/COEP headers satisfy both, no separate configuration is needed — but it means both must live behind the same HTTPS origin.

### Integration Point 2 — OAuth tokens must be in DB before upload can work

Upload Worker (Phase 6) reads tokens from `settings.platform_config`. If Settings screen (Phase 2) and the OAuth token write path are not complete, the entire upload path cannot be tested.

Build order enforced by this:
- Phase 1 (DB schema + settings route) BEFORE Phase 2 (OAuth connect UI)
- Phase 2 (OAuth connect) BEFORE Phase 6 (upload)

### Integration Point 3 — Meta upload requires a publicly accessible video URL

Meta's Graph API (`/me/media` with `video_url`) requires Meta's servers to fetch the video from a URL. The video cannot be sent as raw bytes in the initial container creation request (the resumable path via `rupload.facebook.com` is the alternative).

Two viable patterns for a self-hosted VPS:

**Pattern A (simpler):** Frontend uploads video file to backend `/upload` endpoint first. Backend saves to `/tmp`, serves it as a static route (e.g. `/uploads/:filename`), passes that public URL to Meta, cleans up after `media_publish` completes. Requires the VPS to have a public HTTPS URL.

**Pattern B (resumable):** Use `rupload.facebook.com` resumable upload endpoint — video bytes piped directly from backend without needing a public URL. More complex to implement (chunked protocol, session tokens), no public URL dependency.

Recommendation: Pattern A for Phase 6. It reuses the same `/tmp` file that YouTube upload already uses. Add cleanup job to delete files older than 1 hour.

### Integration Point 4 — YouTube upload requires resumable protocol for files over 5MB

YouTube multipart upload has a 5MB hard limit. All real videos are larger. The resumable upload protocol (POST to initiate session → PUT chunks in 256KB multiples) is mandatory.

Node.js implementation: use `googleapis` npm package (`google.youtube('v3').videos.insert`) which handles resumable protocol internally. Feed it a `fs.createReadStream()` from the `/tmp` file.

### Integration Point 5 — Learning weights are fetched at analysis time, not generation time

`score.ts` in the browser uses `learned_weights` from the settings row to adjust signal weights. These weights must be fetched from the backend BEFORE the virality score is computed. The API Client must call `GET /settings` at page load (or before analysis starts) and cache the result in React state.

If this call is made after the score is computed, the learning loop has no effect on the current generation — it only takes effect on the next page load.

---

## Build Order Implications

The spec's Phase 1-8 order is correct. The dependencies that make the order non-negotiable:

```
Phase 1 (DB + backend routes)
    │
    ├──▶ Phase 2 depends on: settings routes (GET/PATCH /settings)
    │                         OAuth token write endpoint
    │
    └──▶ Phase 3 depends on: Phase 1 is complete (posts.create route ready to receive output)
             │                COOP/COEP headers in Vite config SET FIRST in Phase 3
             │
             ├──▶ Phase 4 depends on: Phase 3 engine signals output structure (score formula
             │                         operates on EngineSignals type)
             │
             ├──▶ Phase 5 depends on: Phase 4 checklist complete (metadata re-run after AI output)
             │                         Phase 1 learning routes (GET /learning/hooks|hashtags)
             │
             └──▶ Phase 6 depends on: Phase 2 OAuth tokens stored in DB
                                        Phase 1 /upload route + BullMQ worker
                                        Phase 3 file upload to /tmp (video file path)
                      │
                      └──▶ Phase 7 depends on: Phase 1 platform_posts table + views route
                                                 Phase 5 learning_signals populated

Phase 8 (Polish) — no hard dependencies, can start any time after Phase 3
```

**Single hard-sequencing constraint:** ffmpeg.wasm (Phase 3, step 1) must work before TF.js (Phase 3, step 2), because TF.js motion scoring operates on decoded frames from ffmpeg. Do not write TF.js code until ffmpeg frame extraction is verified working in the browser.

---

## Notes on ffmpeg.wasm / Browser Video Processing

### Package choice: single-thread vs multi-thread core

Two npm packages: `@ffmpeg/core` (single-threaded) and `@ffmpeg/core-mt` (multi-threaded).

Use `@ffmpeg/core` (single-thread). Reason: Chrome-based browsers have known issues with the multi-threaded build (GitHub issue #597) — multithreading works in Firefox but fails silently or errors in Chromium. Since this tool targets mobile-first usage and most mobile browsers are Chromium-based, single-thread is the safer default. Performance is adequate for the operations needed (metadata extraction + 10 frame grab + scene detection — not full encode).

### Import pattern (must use `?url` imports)

```typescript
// video.ts
import { FFmpeg } from '@ffmpeg/ffmpeg'
import coreURL from '@ffmpeg/core/dist/esm/ffmpeg-core.js?url'
import wasmURL from '@ffmpeg/core/dist/esm/ffmpeg-core.wasm?url'

const ffmpeg = new FFmpeg()
await ffmpeg.load({ coreURL, wasmURL })
```

Without `?url`, Vite bundles the WASM binary incorrectly and the load call throws.

### Web Worker consideration

ffmpeg.wasm blocks the main thread during processing. For a 50–500MB video, analysis can take 3–15 seconds. The spec calls for a two-phase loading indicator ("Analysing video..." / "Generating copy..."). This works acceptably without a Web Worker if the UI updates before `ffmpeg.load()` is called. However, if UI freezes are observed during testing, move the engine orchestrator into a Web Worker using `new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })`.

TF.js similarly benefits from Web Workers — the TF.js WASM backend's multi-thread mode requires `SharedArrayBuffer` (already set), and running it in a Worker prevents UI jank during inference.

Recommended approach: build Phase 3 on main thread first, verify correctness, then move to Worker if UI freeze is unacceptable during Phase 8 polish.

### 500MB file handling

500MB files never leave the browser for analysis. The file stays as a browser `File` object (Blob URL). ffmpeg.wasm receives it via `ffmpeg.writeFile()` writing a `Uint8Array`. For 500MB this will allocate ~500MB of WebAssembly memory — ensure the user's browser allows this (modern browsers do, but the tool should show a clear error if WebAssembly memory allocation fails).

For upload to backend: the browser sends the file via `fetch` with a `FormData` body to `/upload`. Express + Multer receives it, writes to `/tmp/<uuid>.mp4`. The 500MB upload over localhost or local network is fast. Over the internet to a VPS, this is the slowest step — show progress via upload `XMLHttpRequest` with `progress` event, or chunk the upload using `tus-js-client`.

---

## OAuth Token Storage Pattern

### The problem with localStorage (spec's stated approach)

The spec says "token saved to localStorage." This should be revised. localStorage is synchronously accessible to any JavaScript on the page. An XSS vulnerability (even in a third-party script) can exfiltrate all OAuth tokens. For a single-user personal tool where the token gives write access to the user's YouTube and Instagram accounts, this is a meaningful risk even though it's a personal tool.

### Recommended pattern: encrypted DB storage, backend-proxied uploads

Tokens are stored in `settings.platform_config` JSONB column, encrypted at rest with AES-256-GCM (the same encryption util used for the AI API key). The frontend never holds the raw token.

OAuth flow adjusted:
1. Google/Meta OAuth popup completes → browser receives `code` (not token)
2. Browser sends `code` to backend: `POST /settings/oauth/callback { platform, code }`
3. Backend exchanges `code` for `access_token + refresh_token` using client_secret (stored in backend env var, never in frontend)
4. Backend encrypts tokens, writes to `settings.platform_config`, returns `{ connected: true }`
5. Upload calls go to `/upload/:platform` — backend decrypts token from DB, uses it

This is the server-side OAuth flow. The spec's current "localStorage" statement describes the client-side implicit flow, which is deprecated by Google and not available for YouTube API v3 (YouTube requires server-side OAuth for uploads).

Note: The spec already lists `backend/lib/oauth.ts` for token refresh — this confirms backend token storage is the intended final shape, even if the spec text says localStorage for the initial connect step.

### AI API key encryption

The `ai_api_key` field in `settings` must be encrypted at rest.

Standard pattern using Node.js built-in `crypto`:

```typescript
// backend/src/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') // 32 bytes, hex-encoded

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)                          // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()                     // 16-byte GCM auth tag
  // store as: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(stored: string): string {
  const [ivHex, tagHex, encHex] = stored.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const enc = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc) + decipher.final('utf8')
}
```

`ENCRYPTION_KEY` is a 32-byte random hex string stored in `.env`. Generate once:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

GCM mode (not CBC) is required because it provides authenticated encryption — if the ciphertext is tampered with, decryption throws before returning corrupted data.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|-----------|-------|
| ffmpeg.wasm COOP/COEP requirement | HIGH | Official ffmpeg.wasm docs + multiple verified guides confirm exactly this |
| @ffmpeg/core vs @ffmpeg/core-mt choice | HIGH | GitHub issues #530 and #597 directly confirm Chromium multi-thread failures |
| Meta video URL requirement | HIGH | Meta official docs state `video_url` must be publicly accessible |
| YouTube resumable upload requirement | HIGH | Google official docs state 5MB multipart limit; resumable required for real video |
| OAuth token storage pattern | HIGH | RFC 9700 (Jan 2025) + Google OAuth docs confirm server-side flow required for YouTube |
| AES-256-GCM pattern | HIGH | Node.js crypto module built-in, authenticated encryption best practice |
| BullMQ for upload scheduling | MEDIUM | Widely used; Redis dependency adds one more service to VPS — verify memory fits 1GB VPS |

---

## Sources

- ffmpeg.wasm Vite COOP/COEP setup: https://debugplay.com/posts/ffmpeg-react-setup/
- ffmpeg.wasm multi-thread Chromium failure: https://github.com/ffmpegwasm/ffmpeg.wasm/issues/597
- ffmpeg.wasm SharedArrayBuffer discussion: https://github.com/ffmpegwasm/ffmpeg.wasm/discussions/576
- TF.js Web Worker support: https://medium.com/@wl1508/webworker-in-tensorflowjs-49a306ed60aa
- Meta Graph API content publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing/
- Meta rupload endpoint: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/
- YouTube resumable upload: https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
- YouTube server-side OAuth: https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps
- RFC 9700 OAuth 2.0 security best practices (Jan 2025): https://www.obsidiansecurity.com/blog/refresh-token-security-best-practices
- BullMQ scheduled jobs: https://docs.bullmq.io/guide/job-schedulers
- Node.js crypto AES-256-GCM: https://nodejs.org/api/crypto.html
