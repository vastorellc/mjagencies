# Research Summary — Viral Copy Generator

**Project:** Viral Copy Generator
**Domain:** In-browser video analysis + AI copy generation + multi-platform social auto-upload (single-user personal tool)
**Researched:** 2026-04-30
**Confidence:** HIGH

---

## Recommended Stack

| Layer | Decision |
|-------|----------|
| Frontend | React 19 + Vite 6.x + TypeScript 5.8 + Tailwind CSS 4.x |
| Video analysis | @ffmpeg/ffmpeg 0.12.15 (single-thread core) + @tensorflow-models/coco-ssd + @tensorflow-models/face-detection + Web Audio API + Canvas API |
| Backend | Node.js 22 LTS + Express 5.2.1 |
| ORM + DB | Drizzle ORM 0.45.x + PostgreSQL 17 |
| Job queue | BullMQ 5.76.x + Redis 7.x (self-hosted) |
| AI SDKs | @google/generative-ai 0.24.x (Gemini 2.5 Flash) + openai 4.x (gpt-4.1) + @anthropic-ai/sdk 0.39.x (claude-sonnet-4-5) |
| Encryption | Node.js built-in node:crypto -- AES-256-GCM |
| Hosting | Hetzner CX22 (2 vCPU / 4 GB RAM) + Nginx + PM2 |

**Stack corrections from research:**
- CX11 retired. CX22 at EUR3.79/mo is the real entry tier (4 GB RAM, not 2 GB).
- Use @tensorflow-models/face-detection + @mediapipe/face_detection for faces. COCO-SSD detects objects/scenes only.
- Use @ffmpeg/core (single-thread) not @ffmpeg/core-mt. Chromium has confirmed failures with the multi-thread build.
- OAuth tokens must be stored backend-only (DB, encrypted). localStorage is insecure; YouTube API v3 requires server-side OAuth.
- Gemini must use Files API (not inline_data) for videos over ~70 MB. Inline base64 limit is 100 MB encoded.

---

## Table Stakes Features

Must be present for the tool to be usable. Absence means immediate abandonment.

- Platform-specific copy per platform. One caption everywhere is amateur. Spec covers all 5: YouTube, Instagram, TikTok, Facebook, X.
- One-click copy buttons, per-field (title, description, hashtags separately).
- Platform-aware character limits and hashtag counts. YouTube title 60 chars, X 280 chars, IG 25-30 hashtags.
- Upload status feedback: Idle / Uploading / Posted / Failed. Silent failures destroy trust.
- Manual copy fallback, always active regardless of upload API state.
- Loading states during analysis. ffmpeg.wasm + TF.js takes 5-15s. Blank screen equals assumed crash.
- Mobile-first layout. Primary users are creators on phones.
- Settings persistence. OAuth tokens + API key survive sessions, encrypted in DB.
- Platform OAuth connect flow, not manual token pasting.
- Post history. Every scheduling tool has it. Screen 2 in spec.
- Descriptive error messages. Explain what went wrong and what to do.

---

## Key Differentiators

What makes this better than OpusClip, VidIQ, Metricool, Buffer, CapCut:

**D1 - In-browser video analysis (zero per-video cost):** ffmpeg.wasm + TF.js runs entirely client-side. No video sent to third-party servers. Competitors bill per video. This costs nothing beyond the VPS.

**D2 - Transparent, auditable virality score:** Computed from real frame-level signals (motion, scene cuts, audio energy, brightness). Every score component maps to a specific fix. OpusClip score is opaque and self-described as heuristic.

**D3 - Specific, video-level gap analysis:** Fixes generated for this video based on what was detected. VidIQ/TubeBuddy give the same suggestions to everyone.

**D4 - Learning loops on your own data:** Hashtag ranking, hook ranking, and score calibration update from your actual view counts. No other tool does this for a solo creator.

**D5 - Pakistan-aware copy:** Urdu/English code-switching, Pakistan-specific hashtag banks, PKT-optimised posting times. Every major competitor is US/EU-centric.

**D6 - Predicted vs actual view tracking:** Closes the feedback loop between pre-publish prediction and real performance. No competitor does this.

**D7 - BYO API key:** Platform costs USD4/mo flat. OpusClip Pro USD19-29/mo. VidIQ Boost USD49/mo.

**D8 - Scheduled upload at PKT peak times:** BullMQ queues uploads at PKT-optimal windows (e.g. Fri-Sun 6-8pm for YouTube Shorts).

**D9 - Get Better Version re-generation:** Structured second-pass using the improved_script_outline from the first response as context. Competitors generate once.

---

## Critical Pitfalls (prioritized)

**P1 - COOP/COEP headers are a hard prerequisite for Phase 3 (WILL BREAK)**
Missing Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp causes SharedArrayBuffer is not defined and ffmpeg.wasm refuses to load entirely. Must be set in both Vite dev config AND Nginx production config. Side effect: COEP blocks any third-party iframe or CDN script. Use only self-hosted assets. Verify Google OAuth popup still works after adding headers.

**P2 - YouTube upload uses wrong protocol if not corrected (WILL BREAK)**
YouTube uploadType=multipart has a 5 MB hard limit. All real videos exceed this. Must use uploadType=resumable (chunked, 256 KB multiples). The googleapis npm package handles this via videos.insert with a readable stream.

**P3 - Meta container published before FINISHED status (WILL BREAK)**
Instagram Reels: create container -> poll status_code until FINISHED -> publish. Calling publish while IN_PROGRESS returns 400. Poll every 5s up to 5 minutes. Never retry a container that reached ERROR.

**P4 - OAuth tokens in localStorage (SECURITY HOLE)**
Spec draft mentions token saved to localStorage. Do not do this. Store all tokens backend-only in settings.platform_config (encrypted AES-256-GCM). YouTube API v3 requires server-side OAuth. Not optional.

**P5 - Gemini inline_data fails for videos over ~70 MB (WILL BREAK)**
Gemini inline_data base64 limit is 100 MB. A 70 MB video base64-encodes to ~93 MB. Use Gemini Files API for videos over 70 MB. Claude/OpenAI frame extraction already avoids this.

**P6 - TF.js tensor memory leaks crash the tab on repeat analysis (DEGRADES)**
TF.js does not auto-release tensors. Wrap all inference in tf.tidy(). Call tensor.dispose() after each frame. Log tf.memory().numTensors in development to catch leaks before they become crashes.

**P7 - AI returns markdown-wrapped JSON breaking all parsers (DEGRADES)**
Models wrap JSON in markdown code fences ~20% of the time. JSON.parse throws and all platform cards are blank. Strip fences before parsing. Add fallback regex to find first { and last }. Use response_mime_type: application/json for Gemini JSON mode.

---

## Architectural Decisions

**A1 - AI calls from browser, not backend.** AI Client calls Claude/Gemini/OpenAI directly using the user key. Backend handles persistence and upload proxy only.

**A2 - Video never leaves the browser for analysis.** File object stays in browser memory for the entire analysis phase. Only on Upload click does the file go to the backend, written to /tmp, and proxied to social APIs.

**A3 - Backend-proxied OAuth (server-side flow).** OAuth code exchange on the backend. Frontend receives only { connected: true }. Tokens stay in settings.platform_config encrypted. Required for YouTube API v3.

**A4 - @ffmpeg/core single-thread only.** Chromium fails with the multi-thread WASM build. Adequate for metadata extraction + 10-frame grab + scene detection. Move to Web Worker in Phase 8 if UI freeze observed.

**A5 - JSONB merge operator for all settings writes.** Drizzle partial updates replace entire column. Use platform_config || partial::jsonb raw SQL. Add SELECT FOR UPDATE around token refresh writes.

**A6 - ffmpeg singleton + TF.js pre-warm.** Create ffmpeg instance once at startup. Load TF.js models in background when a file is selected, not on Analyse click.

**A7 - iOS Safari graceful fallback.** Detect typeof SharedArrayBuffer at startup. On failure show clear message and route to manual description input. The manual textarea already exists in the spec.

---

## Build Order Implications

The spec Phase 1-8 order is correct and non-negotiable.

Phase 1: DB schema + backend routes (posts, settings, learning, upload)
  -> required by Phase 2: Settings + OAuth connect (needs settings routes + token write endpoint)
  -> Phase 2 required by Phase 6: Upload (OAuth tokens must be in DB before upload fires)

Phase 3: Video Analysis Engine
  PREREQUISITE: Set COOP/COEP headers in Vite config BEFORE writing any ffmpeg code.
  WITHIN Phase 3: verify ffmpeg frame extraction before writing any TF.js code.
  -> required by Phase 4: Virality Score + Checklist + Gap Analysis (EngineSignals type)
  -> Phase 4 required by Phase 5: AI Copy Generation (checklist + learning routes)
  -> Phase 5 required by Phase 6: Auto-Upload (post saved in DB + OAuth from Phase 2)
  -> Phase 6 required by Phase 7: Post History + Learning Loops

Phase 8: Polish (Web Worker migration if needed, iOS fallback, score calibration UI)

**Phase 1 infrastructure setup (do immediately):**
- Redis: maxmemory 200mb, maxmemory-policy noeviction
- BullMQ: removeOnComplete: { count: 100 }, removeOnFail: { count: 50 }
- PostgreSQL: shared_buffers=128MB, work_mem=4MB
- Node.js: --max-old-space-size=384
- Add 1-2 GB swap file on VPS

**Phase 6 Meta upload architecture:**
Frontend uploads file -> backend writes to /tmp/uuid.mp4 -> serves as GET /uploads/:file -> passes URL to Meta -> deletes after media_publish. Add cleanup job for files older than 1 hour.

**Alternative:** consider pg-boss (PostgreSQL-backed queue) instead of BullMQ + Redis to eliminate Redis as a separate memory consumer. Viable for single-user low-volume tool.

---

## Research Flags

**Needs deeper phase research during planning:**
- Phase 6 (Upload): Meta two-step container flow has undocumented edge cases (status codes, rate limit windows, Business Verification requirement). Treat Meta as highest-risk API integration.
- Phase 5 (AI Generation): JSON mode availability varies by model version. Test structured output per provider before finalising prompt architecture.

**Standard patterns, skip research-phase:**
- Phase 1 (Backend + DB): Express 5 + Drizzle + PostgreSQL are mature. AES-256-GCM is 20 lines of built-in Node.js crypto.
- Phase 4 (Score + Checklist): Pure formula/rule logic, no external dependencies.
- Phase 7 (Learning Loops): SQL aggregation + prompt injection. Low external surface area.
- Phase 8 (Polish): Established patterns for Web Workers, error states, mobile layout.

---

## Open Questions for Planning

- **Score calibration EMA vs raw average:** Research recommends exponential moving average to dampen outliers. Select before Phase 7 implementation.
- **Gemini Files API two-step path:** For videos over 70 MB: upload file -> get URI -> include URI in generation request. Phase 5 must model this explicitly.
- **TikTok behind flag:** Build Phase 6 TikTok upload path behind isTikTokApproved flag (code complete, flag off). Activatable without re-deploy.
- **Video file size cap:** Spec says 500 MB. Research confirms this crashes browser tabs. Enforce a hard 250 MB cap with a warning at 200 MB.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified by version on npm; version-specific behaviours confirmed against official docs |
| Features | HIGH | Competitive landscape verified across 8 tools; differentiators grounded in documented user complaints |
| Architecture | HIGH | COOP/COEP, YouTube resumable, Meta two-step publish, OAuth server-side flow all confirmed against official docs |
| Pitfalls | HIGH | All critical pitfalls verified against official docs or GitHub issues with direct citations |

**Overall confidence:** HIGH

---
Research completed: 2026-04-30
Ready for roadmap: yes