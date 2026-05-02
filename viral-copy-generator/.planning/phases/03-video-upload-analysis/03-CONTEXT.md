# Phase 3: Video Upload + Analysis Engine - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning
**Mode:** Auto (recommended option selected for each gray area; no interactive Q&A)

<domain>
## Phase Boundary

Authenticated user can drag-and-drop or pick a video (MP4/MOV, ≤250 MB), see thumbnail + duration/resolution/aspect ratio instantly from the HTML5 video element, then click **Analyse** to run a fully in-browser engine pipeline that produces an `EngineSignals` object — ffmpeg.wasm metadata + scene cuts + 10 frame extracts + TF.js face detection + COCO-SSD object labels + motion score + Web Audio energy/beat/silence + Canvas brightness. Analysis is session-scoped — no persistence to DB until Phase 5 post save. WebAssembly-less browsers see a graceful manual-description fallback.

**In scope:** UPLOAD-01..03, ANALYSIS-01..10
**Out of scope (other phases):** Score formula (Phase 4), platform copy generation (Phase 5), post save / DB write / VPS upload (Phase 5+)
</domain>

<decisions>
## Implementation Decisions

### Upload UX

- **D-01:** Upload zone is a contained dropzone card on the Generator page (not a full-page overlay). After file selection, the same card morphs into the preview + analysis-result panel. Single screen, single state machine.
- **D-02:** Both drag-drop and file picker entry points (locked by UPLOAD-01). Drag overlay highlights when a file is over the dropzone.
- **D-03:** 200 MB warning is a non-blocking advisory banner that stays visible during analysis ("Large file — analysis may be slow on this device"). 250 MB rejection is a blocking error with a clear "compress with HandBrake or CapCut" hint.
- **D-04:** Optional description textarea (UPLOAD-03) sits below the thumbnail/metadata strip. Empty by default with placeholder "Optional: brief description — helps AI when video is ambiguous". 2-line max (textarea `rows={2}` + soft 280-char limit).

### Loading & Progress

- **D-05:** Two-phase indicator (locked by ANALYSIS-08) is implemented as Phase 1 = "Analysing video…" with rotating step sub-label, Phase 2 = "Generating copy…" (Phase 5 work). The Phase 1 sub-labels rotate through the actual pipeline steps: "Extracting metadata…" → "Extracting frames…" → "Detecting faces…" → "Computing audio energy…" → "Computing motion score…" → "Computing brightness…". One step at a time, fade transition.
- **D-06:** Determinate progress (percent) is **not** required — step labels alone provide enough confidence. Avoid fake percent estimates.
- **D-07:** TF.js + MediaPipe model preload starts silently in the background as soon as the user picks/drops a file. Visual cue ("Preparing models…") appears **only** if the user clicks Analyse before preload has finished — otherwise users never see model-loading text on the fast path.

### Cancellation & State

- **D-08:** Visible Cancel button next to the spinner during analysis. Click → abort. Implementation: ffmpeg.wasm has no graceful cancel API, so we let in-flight WASM calls run to completion in the background but discard their results; the UI returns immediately to the pre-analysis state (thumbnail + description visible). Acceptable because the WASM run is bounded (~30-90s) and the user is no longer waiting on it.
- **D-09:** Re-pick flow: when the user drops or picks a new file *after* an analysis has completed, wipe results and reset to the post-pick / pre-analysis state. No confirm modal — undo by re-picking the original file. Match the "session-scoped" rule from ROADMAP.md.

### Failure & Fallback UX

- **D-10:** Single inline error card replaces the spinner on analysis failure. Contains:
  - Human-readable cause ("Couldn't decode video — codec may not be supported")
  - **Retry** button (re-runs analysis from scratch)
  - **Skip analysis** link (proceeds to copy-generation flow with description only — same path as the WebAssembly fallback in ANALYSIS-09)
  - Collapsible "Tell me more" expander with the underlying error message for debugging
- **D-11:** WebAssembly absence (ANALYSIS-09) is detected on mount via `typeof WebAssembly === 'undefined'`. The dropzone shows a banner above the upload card: "This browser can't run video analysis. You can still write copy from a description below." The Analyse button is hidden; description textarea is enlarged (5 rows) and a "Generate Copy" button takes its place. Phase 5 will wire that button.

### Mobile Posture

- **D-12:** Desktop-first. Non-blocking advisory banner on viewports < 768 px or `navigator.userAgent` matching mobile patterns: "Best on desktop — analysis uses significant memory and CPU." Don't block mobile flows; if a phone genuinely can't run ffmpeg.wasm or hits OOM, the existing failure-card path (D-10) catches it and offers Skip analysis.
- **D-13:** Touch interactions: drag-drop is desktop-only (touch devices don't have a useful drag source); file picker is the only entry point on touch devices. Detect via `'ondragstart' in document.body` or pointer-type media query.

### Engine Architecture

- **D-14:** `frontend/src/lib/engine.ts` is the single orchestrator that owns the ffmpeg.wasm singleton, TF.js model handles, and the analysis state machine. It exposes one async function `analyse(file: File, onProgress: (step: string) => void): Promise<EngineSignals>`. All raw API surfaces (ffmpeg, TF.js, Web Audio, Canvas) stay encapsulated inside engine.ts — pages never call them directly.
- **D-15:** `EngineSignals` TypeScript interface lives at `frontend/src/lib/types.ts` (locked by ROADMAP.md). Every Phase 4+ consumer imports from there.
- **D-16:** Tensor lifecycle: TF.js models receive HTML elements directly (`model.detect(canvasOrImg)`) — no manually created tensors. If a manual tensor is unavoidable for a specific signal, dispose with `try { ... } finally { tensor.dispose() }` (NOT `tf.tidy` — async incompatible per CLAUDE.md).
- **D-17:** ffprobe call always reads `meta.json` from the virtual FS regardless of the return code (locked by ANALYSIS-10 / ROADMAP.md / GitHub #817 bug).
- **D-18:** Scene detection runs in a separate ffmpeg pass with a `log` event listener; no scene-output file. Frame extraction runs in another pass writing JPEGs to virtual FS that are read back as Uint8Arrays.

### Persistence

- **D-19:** Analysis results live in React state during the session. No localStorage, no IndexedDB, no backend roundtrip — the file Blob and EngineSignals stay in memory. ANALYSIS-07 locks "no video file sent to any server during analysis phase". Persistence comes in Phase 5 when the user saves the post.

### Claude's Discretion

- Component decomposition (`UploadDropzone`, `VideoPreview`, `AnalyseButton`, `AnalysisProgress`, `AnalysisError`, etc.) — planner decides
- Tailwind class structure — match existing GeneratorPage.tsx and SettingsPage.tsx patterns
- Error message copy — follow Phase 1's tone (LoginPage error styling)
- Beat detection library choice (`meyda` vs `music-tempo`) — researcher evaluates and locks in PLAN
- Frame extraction interval (every Nth frame) — researcher picks a value that yields ~10 frames for typical 15-90s reels per ANALYSIS-02

### Folded Todos

None — no pending todos cross-referenced for this phase.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and contracts
- `.planning/ROADMAP.md` §"Phase 3: Video Upload + Analysis Engine" — goal, key implementation notes, success criteria
- `.planning/REQUIREMENTS.md` UPLOAD-01..03, ANALYSIS-01..10 — acceptance criteria
- `.planning/PROJECT.md` — core value, constraints, niches (travel, hotels, cars, bikes, coding, lifestyle without face)

### Project rules
- `viral-copy-generator/CLAUDE.md` §"Video Analysis (Phase 3+)" — ffmpeg single-thread only, ffprobe -1 bug, scene log parsing, tf.tidy async incompatibility, MediaPipe solutionPath mandatory
- `viral-copy-generator/CLAUDE.md` §"Frontend" — h-[100dvh] not h-screen, viewport-fit=cover, no routing library, Tailwind only

### Known bugs and constraints
- ffmpeg/ffmpeg.wasm GitHub #817 — ffprobe returns -1 even on success → always read output file unconditionally (ANALYSIS-10)
- `@ffmpeg/core-mt` fails on Chromium → use `@ffmpeg/core` single-thread only
- COOP/COEP headers MUST be set on every response (Phase 1 wired this for backend; Vite plugin from Phase 1 wires it for frontend dev) — required for SharedArrayBuffer used by ffmpeg.wasm

### Existing code (Phase 1 + Phase 2 outputs)
- `viral-copy-generator/frontend/src/App.tsx` — currentScreen useState pattern, OAuth banner placement
- `viral-copy-generator/frontend/src/pages/GeneratorPage.tsx` — current page shell, where the Phase 3 upload UI lives
- `viral-copy-generator/frontend/src/lib/types.ts` — Screen + Settings types (Phase 2); EngineSignals lands here in Phase 3
- `viral-copy-generator/frontend/vite.config.ts` — COOP/COEP `configureServer` plugin

No external specs/ADRs — requirements fully captured in REQUIREMENTS.md and ROADMAP.md.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **GeneratorPage.tsx** — currently a placeholder shell from Phase 2; Phase 3 fleshes it out with the dropzone + preview + Analyse button
- **App.tsx screen switcher** — currentScreen useState already toggles Generator ↔ Settings; no new routing needed
- **Tailwind 4 theme** — established in Phase 1 (h-[100dvh], font-bold for emphasis only, error/success styles from LoginPage)
- **types.ts** — Screen, AIProvider, Platform types from Phase 2; add EngineSignals here
- **supabase client** — Phase 1 lib for auth-gated API calls (only used in Phase 3 if we need to fetch user settings, e.g. AI provider preference for Phase 5 wiring)

### Established Patterns
- **No routing library** — useState screen switching only (CLAUDE.md rule)
- **No UI component library** — Tailwind classes only
- **Error UX from LoginPage** — `error !== null` conditional, `bg-red-50 text-red-900 border-red-200` class palette; reuse for analysis-error card
- **h-[100dvh] + viewport-fit=cover** — iOS Safari viewport handling already in index.html
- **OAuth banner pattern from App.tsx** — analysis success could follow the same banner pattern (auto-dismiss after N seconds), but Phase 3 likely doesn't need it; Phase 5 may

### Integration Points
- **GeneratorPage.tsx** — primary integration target; Phase 3 builds the upload + analysis UI here
- **engine.ts (NEW)** — single orchestrator owning ffmpeg/TF.js/Web Audio; exposes `analyse(file, onProgress)`
- **types.ts** — add EngineSignals interface; downstream phases (Score, Checklist, Gaps, AI prompt) all import from here
- **vite.config.ts** — verify COOP/COEP plugin still in place; Phase 3 actually exercises SharedArrayBuffer for the first time

### Creative Options the Architecture Enables
- Pre-warming TF.js + MediaPipe in the background while the user is still typing the optional description — masks model load time
- Streaming step labels via React state — no extra dependency
</code_context>

<specifics>
## Specific Ideas

- Description textarea placeholder: "Optional: brief description — helps AI when video is ambiguous"
- Cancel button label: just "Cancel" — neutral, not "Stop" (which feels destructive)
- Failure card primary action: "Retry"; secondary text link: "Skip analysis and write copy from description"
- WebAssembly absence banner: "This browser can't run video analysis. You can still write copy from a description below."
- Mobile advisory banner: "Best on desktop — analysis uses significant memory and CPU."
- 250 MB rejection hint: "File over 250 MB — compress with HandBrake or CapCut and try again."
- Pakistani creator niches (no-face on camera): scenery, hotels, food, drives — face detection should *not* penalise no-face videos in Phase 4 scoring (note for Phase 4 planner; Phase 3 just reports `faceCount: 0`)
</specifics>

<deferred>
## Deferred Ideas

- **Bulk video processing** — already in v2 backlog (PROJECT.md)
- **Cloud-side analysis fallback** — for users on weak hardware. Future phase if usage data justifies it; Phase 3 ships in-browser only.
- **Resume in-flight analysis after page refresh** — not worth the IndexedDB complexity for v1; user re-runs (~60s)
- **Real-time preview during analysis** — show frames as they're extracted. Cute but adds React state churn; defer until polish phase

No reviewed-but-not-folded todos.
</deferred>

---

*Phase: 03-video-upload-analysis*
*Context gathered: 2026-05-02*
