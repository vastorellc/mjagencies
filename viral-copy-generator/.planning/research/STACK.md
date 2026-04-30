# Stack Research — Viral Copy Generator

**Project:** Viral Copy Generator (single-user, personal tool)
**Researched:** 2026-04-30
**Spec source:** viral-copy-generator-FINAL-SPEC.md

---

## Recommended Stack

| Layer | Choice | Version | Rationale | Confidence |
|-------|--------|---------|-----------|------------|
| Frontend framework | React | 19.2.1 | Stable, Server Actions not needed here so pure client React is correct. Hooks + context sufficient for 4-screen no-router app. | HIGH |
| Build tool | Vite | 6.x (latest stable) | Fast HMR, first-class React support, required for COOP/COEP header injection via vite.config.ts server.headers. Vite 8 is in beta — stay on 6.x for stability. | HIGH |
| Language | TypeScript | 5.8.x | Strict mode. Required for signal typing across engine, score, and AI layers. | HIGH |
| Styling | Tailwind CSS | 4.x | Released stable Jan 2025. CSS-first config (`@theme` in CSS, no tailwind.config.js). Use `@tailwindcss/vite` plugin — replaces PostCSS-based setup. No UI component library per spec. | HIGH |
| Video analysis: metadata + frames | @ffmpeg/ffmpeg + @ffmpeg/util | 0.12.15 | Only stable WASM port of FFmpeg for browsers. Extracts duration, fps, bitrate, scene detect, frame grabs. **Requires SharedArrayBuffer** — COOP/COEP headers mandatory in Vite dev and Express production. | HIGH |
| Video analysis: vision/ML | @tensorflow-models/coco-ssd + @tensorflow/tfjs | 4.x + coco-ssd 2.2.3 | COCO-SSD on `lite_mobilenet_v2` backend is under 1 MB, runs at ~70ms per frame in WebGL mode. Adequate for face detection proxy (detect "person" class) and scene/object labelling. Not a dedicated face detector — see risks. | MEDIUM |
| Video analysis: audio | Web Audio API (browser built-in) | n/a | Zero dependency. OfflineAudioContext for energy/beat analysis of extracted audio. No npm package needed. | HIGH |
| Video analysis: brightness | Canvas API (browser built-in) | n/a | drawImage + getImageData for luma calculation per frame. Zero dependency. | HIGH |
| Backend runtime | Node.js | 22 LTS | Active LTS. Required by Express 5.2.x (drops Node < 18). | HIGH |
| Backend framework | Express | 5.2.1 | Went stable March 2025 (5.1.0 is now the npm default). Async/await error propagation built-in — middleware rejections bubble correctly. No need for express-async-errors wrapper. | HIGH |
| ORM | Drizzle ORM | 0.45.x (drizzle-orm) + drizzle-kit | Type-safe, schema-first, no magic. Migrations via `drizzle-kit push` or `drizzle-kit generate`. Best fit for the 4-table schema in spec. | HIGH |
| PostgreSQL driver (under Drizzle) | postgres.js (porsager/postgres) | 3.x | 2-3x faster than node-postgres (pg) in benchmarks, built-in connection pooling, TypeScript-native. Drizzle supports it natively. For a single-user VPS tool with low concurrency, either would work but postgres.js is the modern choice for greenfield. | MEDIUM |
| Database | PostgreSQL | 17 | Stable, JSONB for engine_signals and generated_copy (correct per spec), `gen_random_uuid()` built-in, `TEXT[]` for hashtag arrays. Run locally on VPS — no managed DB cost. | HIGH |
| Job scheduling | BullMQ | 5.76.x | Active (published <24h ago as of research date). Peak-time scheduler per spec. Requires Redis. Single-user tool means queue load is trivial. | HIGH |
| Redis (BullMQ dependency) | Redis (self-hosted on VPS) | 7.x | Required by BullMQ. On a 2GB VPS, Redis idle memory ~10MB — not a concern. Use `redis` npm client 4.x. | HIGH |
| AI provider SDK: Gemini | @google/generative-ai | latest (0.24.x) | Native video via `inline_data` — single call handles full video. Gemini 2.5 Flash is the spec model. | HIGH |
| AI provider SDK: OpenAI | openai | 4.x | gpt-4.1 model per spec. Frame array path via base64 image messages. | HIGH |
| AI provider SDK: Anthropic/Claude | @anthropic-ai/sdk | 0.39.x | claude-sonnet-4-5 per spec. Frame array path via base64 image content blocks. | HIGH |
| Encryption (API key at rest) | Node.js built-in `crypto` | built-in | AES-256-GCM with random IV per encrypt. No third-party dependency needed. Use `crypto.randomBytes(16)` for IV, `scryptSync` for key derivation from an `ENCRYPTION_KEY` env var. | HIGH |
| OAuth token management | Custom thin wrapper | n/a | Google OAuth2 refresh via `https://oauth2.googleapis.com/token`. Meta token refresh via `https://graph.facebook.com/oauth/access_token`. Both are simple POST calls — no SDK needed for a single-user tool. | HIGH |
| Hosting | Hetzner CX22 | n/a | **NOT CX11.** Hetzner retired CX11 (1 vCPU / 2 GB RAM). Current entry plan is CX22: 2 vCPU / 4 GB RAM / 40 GB SSD / 20 TB traffic for €3.79/mo. Run Node.js + PostgreSQL + Redis on same instance comfortably. | HIGH |
| Process manager | PM2 | 5.x | Node.js process management, restart on crash, cluster mode if needed later. | HIGH |
| Reverse proxy | Nginx | 1.26.x | Terminate HTTPS, proxy to Node.js on port 3001, serve static frontend build from `/dist`. Required to inject COOP/COEP headers for ffmpeg.wasm. | HIGH |

---

## Risks & Flags

### CRITICAL: ffmpeg.wasm + 500 MB Videos = Browser Tab Crashes

**Risk level: HIGH**

ffmpeg.wasm must load the entire file into browser memory before processing. The spec allows MP4/MOV up to 500 MB. In practice:
- WASM memory ceiling before tab crash is ~500 MB (confirmed in GitHub issues #623, #876).
- For a 500 MB video, the tab will routinely die on lower-end phones (target device for a Pakistani content creator).
- Memory is never freed between runs (known leak — issue #494).

**Mitigation:**
1. Add a hard client-side file-size gate: warn at 200 MB, hard reject above 300 MB.
2. For metadata-only extraction (duration, fps, bitrate), ffmpeg.wasm loads fast — only the transcoding / frame-extraction path is heavy.
3. For the 10-frame extraction path (Claude/OpenAI), extract frames at minimal resolution (320x180) to keep WASM memory low.
4. Run ffmpeg operations in a Web Worker (supported in 0.12.x via `SharedArrayBuffer` + multi-threading flag) to avoid blocking the main thread.

The spec says "max 500MB" — this ceiling must be lowered in implementation to ~200-250 MB.

### CRITICAL: ffmpeg.wasm Requires COOP/COEP Headers Everywhere

**Risk level: HIGH**

SharedArrayBuffer (required by ffmpeg.wasm) is disabled in all modern browsers unless the page is served with:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
These must be set by:
- **Vite dev server** (`vite.config.ts` → `server.headers`)
- **Nginx** in production (on the frontend static files location block)

If these headers are missing, ffmpeg.wasm throws `ReferenceError: SharedArrayBuffer is not defined` at runtime — a silent build-time failure.

**Also:** Any third-party scripts (analytics, fonts) loaded from other origins will break under COEP. Since this is a personal tool, this is not an issue — but note it for the setup phase.

### MODERATE: TF.js COCO-SSD Is Not a Face Detector

The spec uses TensorFlow.js for "face detection." COCO-SSD detects the `person` class, not faces specifically. For actual face bounding boxes, use `@tensorflow-models/face-detection` with the `MediaPipeFaceDetector` model instead. This is a one-line swap but a different package.

COCO-SSD is correct for scene labelling (road, mountain, laptop, motorbike). Use `face-detection` model for face presence signal.

**Packages:**
- Scene labels / object detection: `@tensorflow-models/coco-ssd`
- Face detection: `@tensorflow-models/face-detection` with `@mediapipe/face_detection` backend

### MODERATE: Meta Graph API — Video Must Be Publicly Accessible at Upload Time

The Instagram/Facebook Reels upload flow (`video_url` parameter) requires the video to be hosted on a **publicly accessible URL** at the time Meta's servers fetch it. The spec's flow is: user uploads from browser → backend proxies → Meta fetches.

This means the backend must either:
1. Accept the file upload, temporarily store it (local disk or object storage), expose a public URL, call Meta, then delete.
2. Or use the `rupload.facebook.com` resumable upload endpoint (binary bytes, no public URL needed).

Option 2 (resumable binary upload) is more reliable for a VPS. This path is different from the spec's described two-step flow and adds complexity to Phase 6.

### MODERATE: YouTube Quota — 6 Videos/Day Maximum

Default quota: 10,000 units/day. Video upload costs 1,600 units. Max 6 uploads per day on default quota. For a single creator posting 1–2 videos per day this is fine, but worth noting. Quota increases require a Google review process.

### LOW: Tailwind v4 vs v3 — Config Migration

Tailwind v4 is the correct modern choice for greenfield, but it is a breaking change from v3 patterns. Config moves from `tailwind.config.js` to `@theme {}` blocks in CSS. The `@tailwind base/components/utilities` directives are replaced by `@import "tailwindcss"`. The Vite plugin is `@tailwindcss/vite`, not PostCSS-based. Engineers familiar with v3 need to unlearn the config approach. Automated upgrade tool exists (`@tailwindcss/upgrade`) but is irrelevant for greenfield — just start with v4 patterns.

### LOW: Drizzle ORM Is Still Pre-1.0

`drizzle-orm` is at 0.45.x. A v1.0 beta has been announced. The API is stable in practice and widely used in production, but there is a theoretical risk of pre-1.0 API changes. For a personal tool this is acceptable risk.

### LOW: Hetzner CX22 Memory Under Concurrent Load

Running Node.js (Express + BullMQ workers) + PostgreSQL + Redis on 4 GB RAM is fine for a single-user tool. PostgreSQL default `shared_buffers` (128 MB) plus `work_mem` defaults will be well within limits. No tuning needed at this scale.

### LOW: TikTok API Approval

The spec correctly gates TikTok behind an `isTikTokApproved` feature flag. TikTok Content Posting API requires an application review process with no guaranteed timeline. The flag approach is the right pattern — build it, gate it, flip it when approval comes.

---

## What NOT to Use (and Why)

| Rejected Option | Why Not | Use Instead |
|----------------|---------|-------------|
| Next.js | Overkill for a 4-screen SPA personal tool. SSR adds no value here. No SEO needed. Adds complexity to the COOP/COEP header setup (middleware required). | Vite + React |
| Prisma ORM | Heavy runtime dependency, slower cold start, code-gen step on every schema change, opinionated client that fights raw SQL. Drizzle is lighter, TypeScript-native, and produces cleaner SQL. | Drizzle ORM |
| `jsonwebtoken` | Does not run in Edge/WASM contexts. Not applicable here (no JWT needed — single user, no auth), but noted for consistency with CLAUDE.md project standards. | No JWT needed; if ever needed: `jose` |
| node-cron / node-schedule | BullMQ + Redis handles scheduling with persistence (survives restarts). Cron libraries lose queue state on crash. | BullMQ |
| `face-api.js` | Last npm publish was 2020. Not maintained. Uses older TF.js API. | `@tensorflow-models/face-detection` |
| crypto-js (npm) | Third-party dependency for something Node.js `crypto` handles natively with AES-256-GCM. Adds supply chain risk. | `node:crypto` built-in |
| Socket.io / WebSockets | No real-time multi-user requirements. Polling the backend for upload status is sufficient for a single-user tool. | REST polling or SSE for upload progress |
| Sequelize / TypeORM | Both are heavier, older-paradigm ORMs with more runtime magic. Drizzle is the 2025 standard for TypeScript-first Postgres projects. | Drizzle ORM |
| MongoDB | The schema is relational by nature (posts → platform_posts → learning_signals). PostgreSQL JSONB handles the flexible signal blobs. No reason to introduce a separate DB paradigm. | PostgreSQL 17 |
| Vite 8 (beta) | Vite 8 (Rolldown-based) was in beta as of December 2025. Not production-ready for a build that needs to ship. | Vite 6.x stable |
| `@google-cloud/storage` or S3 for video buffering | Over-engineered for a personal tool on a VPS. Temporary local disk writes for the Meta upload intermediary path are sufficient. | Local `/tmp` with cleanup |

---

## Installation Reference

```bash
# Frontend
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install tailwindcss @tailwindcss/vite
npm install @ffmpeg/ffmpeg @ffmpeg/util
npm install @tensorflow/tfjs @tensorflow-models/coco-ssd @tensorflow-models/face-detection @mediapipe/face_detection
npm install @google/generative-ai openai @anthropic-ai/sdk

# Backend
mkdir backend && cd backend
npm init -y
npm install express@5 typescript tsx @types/node @types/express
npm install drizzle-orm postgres
npm install bullmq redis
npm install -D drizzle-kit

# Dev tooling (shared)
npm install -D typescript@5.8 vitest @vitest/ui
```

Vite config snippet for required COOP/COEP headers (ffmpeg.wasm prerequisite):
```typescript
// vite.config.ts
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
},
```

Nginx snippet for production:
```nginx
location / {
  add_header Cross-Origin-Opener-Policy "same-origin" always;
  add_header Cross-Origin-Embedder-Policy "require-corp" always;
  try_files $uri $uri/ /index.html;
}
```

---

## Notes for Roadmap

1. **Phase 1 (Backend + DB) is unblocked and straightforward.** Express 5 stable, Drizzle 0.45, postgres.js — all mature. No surprises. Encryption with `node:crypto` AES-256-GCM is ~20 lines.

2. **Phase 2 (Frontend Core) has a hidden prerequisite:** COOP/COEP headers must be configured in Vite before any ffmpeg.wasm work begins. If this is missed, Phase 3 will silently fail in the browser.

3. **Phase 3 (Video Engine) is the highest-risk phase.** The combination of ffmpeg.wasm + TF.js + Web Audio in-browser is technically feasible but fragile on constrained devices. The file size limit must be enforced (recommend 200-250 MB hard cap, not 500 MB). Recommend Web Worker isolation for ffmpeg to avoid UI freeze.

4. **Phase 6 (Upload) requires backend video buffering** for the Meta path. The spec describes `video_url` for Instagram/Facebook Reels — Meta's servers must be able to fetch the file from a public URL. The backend must temporarily store the uploaded video file, expose a short-lived public URL, trigger the Meta API, then clean up. This is not described in the spec's file structure but is required.

5. **Hetzner CX22 (€3.79/mo, 4 GB RAM) is the real entry point** — CX11 no longer exists. Spec cost table needs updating from ~$4/mo but the price is essentially identical.

6. **TF.js model loading adds ~1-3 MB to initial bundle** for lite_mobilenet_v2 (COCO-SSD). Use dynamic import + lazy load — only load TF.js models when the user clicks "Analyse & Generate", not on app boot.

7. **Gemini 2.5 Flash native video path is the superior AI route.** The base64 frame extraction for Claude/OpenAI (10 frames via ffmpeg.wasm) adds browser memory pressure on top of the video analysis that has already been done. Phase 5 should treat Gemini as the primary path and test the frame path carefully.

---

## Sources

- [@ffmpeg/ffmpeg on npm](https://www.npmjs.com/package/@ffmpeg/ffmpeg) — v0.12.15 confirmed
- [ffmpeg.wasm GitHub issues — memory limits](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/623)
- [ffmpeg.wasm SharedArrayBuffer requirements](https://github.com/ffmpegwasm/ffmpeg.wasm/discussions/576)
- [How to Set Up FFmpeg in React (Vite, 2025)](https://debugplay.com/posts/ffmpeg-react-setup/)
- [Express 5.1.0 now default on npm](https://expressjs.com/2025/03/31/v5-1-latest-release.html)
- [TensorFlow.js models — face-detection](https://github.com/tensorflow/tfjs-models/tree/master/face-detection)
- [Tailwind CSS v4.0 release](https://tailwindcss.com/blog/tailwindcss-v4-alpha)
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm) — v0.45.2 confirmed
- [BullMQ npm](https://www.npmjs.com/package/bullmq) — v5.76.4 confirmed
- [YouTube Data API v3 quota](https://developers.google.com/youtube/v3/determine_quota_cost)
- [Meta Graph API rate limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/)
- [Instagram Reels API upload guide 2025](https://postproxy.dev/blog/instagram-reels-api-publishing-guide/)
- [Hetzner CX22 pricing](https://www.hetzner.com/pressroom/new-cx-plans/)
- [postgres.js vs node-postgres benchmark](https://dev.to/nigrosimone/benchmarking-postgresql-drivers-in-nodejs-node-postgres-vs-postgresjs-17kl)
- [Node.js crypto AES-256-GCM](https://nodejs.org/api/crypto.html)
