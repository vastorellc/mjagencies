# Roadmap — Viral Copy Generator

## Overview

Eight phases that deliver the full tool: a backend and DB foundation, then settings and OAuth,
then the in-browser video analysis engine, then virality scoring, then AI copy generation and
platform cards, then auto-upload and scheduling, then post history and learning loops, and
finally a polish pass. Each phase must complete before the next can begin — the dependency
chain is hard and non-negotiable per research.

## Phases

- [ ] **Phase 1: Backend Foundation** - Express + Drizzle + PostgreSQL + BullMQ/Redis scaffold with all DB schema and base API routes
- [ ] **Phase 2: Settings + OAuth** - AI provider config, API key encryption, Google + Meta OAuth connect/disconnect flows
- [ ] **Phase 3: Video Upload + Analysis Engine** - Drag-and-drop upload UI, ffmpeg.wasm in-browser analysis, TF.js object/face detection, Web Audio + Canvas signals
- [ ] **Phase 4: Virality Score + Checklist** - Weighted virality score formula, per-platform variants, pass/fail checklist, rule-based gap analysis
- [ ] **Phase 5: AI Copy + Platform Cards** - Single AI call returning all 5 platform outputs, platform cards with copy buttons, Get Better Version re-generation
- [ ] **Phase 6: Auto-Upload + Scheduling** - YouTube resumable upload, Meta two-step Reels flow, BullMQ PKT-optimised scheduling, TikTok gated behind flag
- [ ] **Phase 7: History + Learning Loops** - Post history screen, actual view logging, learning insights, AI prompt injection, score self-calibration
- [ ] **Phase 8: Polish + Resilience** - Web Worker migration for ffmpeg, iOS Safari fallback, error states, mobile layout hardening

## Phase Details

### Phase 1: Backend Foundation
**Goal**: The full backend infrastructure is running and all DB tables exist, so every later phase can persist data immediately without revisiting schema.
**Depends on**: Nothing (first phase)
**Requirements**: UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. `GET /health` returns 200 with DB and Redis connectivity confirmed
  2. All Drizzle migrations run cleanly against a fresh PostgreSQL 17 database (posts, platform_posts, settings, learning_signals tables present)
  3. BullMQ connects to Redis and a test job enqueues and completes without error
  4. Frontend Vite dev server starts, renders a placeholder root screen, and hot-reloads — confirming React 19 + Tailwind + no-routing-library scaffold is correct
  5. COOP/COEP headers (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) are present on every response in both Vite dev config and Nginx production config, verified before any ffmpeg code is written
**Plans**: TBD
**UI hint**: yes

### Phase 2: Settings + OAuth
**Goal**: The user can configure their AI provider, save an encrypted API key, connect YouTube and Meta accounts via server-side OAuth, and disconnect any platform — all credentials stored backend-only, never in localStorage.
**Depends on**: Phase 1
**Requirements**: SETTINGS-01, SETTINGS-02, SETTINGS-03, SETTINGS-04, SETTINGS-05, SETTINGS-06, SETTINGS-07, SETTINGS-08
**Success Criteria** (what must be TRUE):
  1. User can select Claude / Gemini / OpenAI, enter an API key, save it, and retrieve a masked version on page reload — key stored AES-256-GCM encrypted in DB, never in localStorage
  2. User can click "Connect YouTube", complete the Google OAuth consent screen, and see a "Connected" badge — token stored in `settings.platform_config` backend-only
  3. User can click "Connect Instagram + Facebook", complete Meta OAuth, and see both platforms marked connected via a single login
  4. User can disconnect any connected platform and the token is revoked and cleared from DB
  5. TikTok credentials input renders as greyed-out with "Pending API approval" label — no functional OAuth path
**Plans**: TBD
**UI hint**: yes

### Phase 3: Video Upload + Analysis Engine
**Goal**: The user can drop or pick a video, see thumbnail and metadata immediately, and have all engine signals (ffmpeg + TF.js + Web Audio + Canvas) computed entirely in-browser with a two-phase loading indicator — no video bytes sent to the server during analysis.
**Depends on**: Phase 2
**Requirements**: UPLOAD-01, UPLOAD-02, UPLOAD-03, ANALYSIS-01, ANALYSIS-02, ANALYSIS-03, ANALYSIS-04, ANALYSIS-05, ANALYSIS-06, ANALYSIS-07, ANALYSIS-08, ANALYSIS-09
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop or file-pick an MP4 or MOV up to 250 MB; files over 200 MB show a warning before processing; files over 250 MB are rejected with an error
  2. After selecting a file, user sees thumbnail preview plus duration, resolution, and aspect ratio before clicking Analyse
  3. After clicking Analyse, user sees "Analysing video..." then "Generating copy..." loading states while ffmpeg.wasm extracts metadata, fps, bitrate, audio presence, scene count, 10 frames, and scene-change timestamps — no network request for the video during this phase
  4. TF.js COCO-SSD object detection and face-detection model produce face-presence flag, motion score, and scene labels without crashing the tab on repeat analysis (tf.tidy + dispose applied)
  5. On iOS Safari without SharedArrayBuffer, user sees a clear fallback message and is routed to the manual description textarea instead of a blank or crashed screen
**Plans**: TBD
**UI hint**: yes

### Phase 4: Virality Score + Checklist
**Goal**: After analysis completes, the user sees a 0–100 virality score with colour coding, per-platform score variants, a predicted view range, a pass/fail checklist with actionable per-video fixes, and a rule-based gap analysis list — all computed without any AI call.
**Depends on**: Phase 3
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, SCORE-06, SCORE-07
**Success Criteria** (what must be TRUE):
  1. Overall virality score renders with correct colour: red 0–39, amber 40–59, green 60–79, bright green 80–100
  2. Per-platform score variants appear for all 5 platforms (YouTube, Instagram, TikTok, Facebook, X) with their respective predicted view ranges per score tier
  3. Pass/fail checklist covers all four sections (Video Technical, Metadata Quality, Virality Boosters, Pakistan-specific niche checks) and each failed item shows a specific fix for this video — not generic advice
  4. Gap analysis list appears when checklist items fail, generated by rule logic with zero AI calls
**Plans**: TBD

### Phase 5: AI Copy + Platform Cards
**Goal**: The user can trigger one AI call that returns copy for all five platforms in a single JSON response, see five styled platform cards with per-field copy buttons, and request a second-pass "Get Better Version" — with manual copy always available regardless of upload or OAuth state.
**Depends on**: Phase 4
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, AI-08, PLATFORM-01, PLATFORM-02, PLATFORM-03, PLATFORM-04, PLATFORM-05, PLATFORM-06, PLATFORM-07, PLATFORM-08, PLATFORM-09, PLATFORM-10, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. Selecting Claude, Gemini, or OpenAI in settings and clicking Generate produces a single AI call; all five platform cards populate with copy — even if the AI returns markdown-wrapped JSON, the parser strips fences and no card is ever blank
  2. Each platform card shows correct colour accent (YouTube red, Instagram pink/purple, TikTok black+cyan, Facebook blue, X black+white) and enforces platform character limits with visible counts
  3. Every individual field (title, description, hashtags) has a one-click copy button; clicking it copies that field to clipboard
  4. TikTok card shows upload button greyed out with "Available once API approved" while manual copy remains active
  5. Clicking "Get Better Version" fires a second AI call using `improved_script_outline` from the first response as additional context, and the cards update with the new output
  6. App is usable on a mobile phone screen (primary use case) — all cards, copy buttons, and inputs are reachable without horizontal scroll
**Plans**: TBD
**UI hint**: yes

### Phase 6: Auto-Upload + Scheduling
**Goal**: The user can upload a video to YouTube, Instagram, and Facebook directly from the app using the connected OAuth tokens, schedule the upload at PKT peak times or a manual time, and see clear Idle / Uploading / Posted / Failed state on each platform card — with manual copy always available as fallback.
**Depends on**: Phase 5
**Requirements**: AUTOUP-01, AUTOUP-02, AUTOUP-03, AUTOUP-04, AUTOUP-05, AUTOUP-06, AUTOUP-07, AUTOUP-08
**Success Criteria** (what must be TRUE):
  1. YouTube upload button initiates a resumable upload (not multipart) via `googleapis videos.insert` with a readable stream — a 250 MB test video uploads successfully without hitting the 5 MB multipart limit
  2. Instagram Reels upload creates a container, polls `status_code` every 5 seconds until `FINISHED`, then publishes — the tool never calls `media_publish` while status is `IN_PROGRESS`
  3. Facebook Reels upload completes using the same Meta token as Instagram
  4. TikTok upload code exists behind `isTikTokApproved` flag and can be activated without re-deploy — the flag is off by default and the button renders greyed out
  5. User can select "PKT peak time" or enter a manual datetime; uploads queue in BullMQ and fire at the scheduled time, returning 200 immediately from the API
  6. Upload state per platform card cycles correctly through Idle → Uploading → Posted (or Failed with descriptive error message)
**Plans**: TBD

### Phase 7: History + Learning Loops
**Goal**: The user can browse all past generated posts, log actual view counts per platform, see whether each post overperformed or underperformed its prediction, and access learning insights that feed top hooks and hashtags back into AI prompts and self-calibrate the virality score formula.
**Depends on**: Phase 6
**Requirements**: HISTORY-01, HISTORY-02, HISTORY-03, HISTORY-04, HISTORY-05, HISTORY-06, LEARNING-01, LEARNING-02, LEARNING-03, LEARNING-04, LEARNING-05, LEARNING-06, LEARNING-07, LEARNING-08
**Success Criteria** (what must be TRUE):
  1. Post History screen lists all past posts newest-first, filterable by platform, niche, and date range, each row showing platform icons, niche tag, virality score, predicted view range, and date
  2. User can enter actual views for any platform on any post; the post immediately shows Overperformed / Matched / Underperformed vs. predicted range
  3. User can delete a post and it cascades to platform_posts and learning_signals
  4. Learning Insights screen shows top 5 hooks and top 10 hashtags per niche (per platform), best posting times from logged data, niche performance breakdown, and a score accuracy bar chart — all computed by SQL aggregation, no AI calls
  5. When fewer than 5 data points exist for a niche, the AI prompt falls back to the hardcoded hashtag bank without error
  6. After 10+ logged view data points, the virality score formula self-calibrates (±5% per signal, capped ±15%) — a score computed on a niche with calibration data visibly differs from the baseline formula
**Plans**: TBD
**UI hint**: yes

### Phase 8: Polish + Resilience
**Goal**: The tool runs smoothly under repeated use, on mobile, on iOS Safari, and under error conditions — the UI freezes during ffmpeg are resolved with a Web Worker, error messages are descriptive and actionable, and the mobile layout is hardened.
**Depends on**: Phase 7
**Requirements**: (all requirements covered by Phases 1–7; this phase addresses implementation quality and resilience properties that span the full stack)
**Success Criteria** (what must be TRUE):
  1. Running five consecutive video analyses without a page reload produces no UI freeze during ffmpeg processing (ffmpeg runs in a Web Worker)
  2. All error states — upload failure, AI key invalid, OAuth expired, analysis failed — display a specific message explaining what went wrong and what to do next, never a blank screen or raw exception
  3. The full workflow (upload → analyse → generate → copy) is completable on a mid-range Android phone without layout breakage or unreachable touch targets
  4. TF.js tensor count does not grow across repeat analyses (tf.memory().numTensors is stable after each run)
**Plans**: TBD
**UI hint**: yes

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
