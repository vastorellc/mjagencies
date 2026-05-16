# Phase 12: Cover-Frame Scoring & Recommendation - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

A CoverFramePanel that ranks the 10 already-extracted frames by a 6-predictor cover-suitability score, surfaces a top-3 carousel with breakdown badges, lets the user inspect all 10, and downloads the chosen frame as a PNG at four platform-specific dimensions with the Phase 5 `cover_text` overlaid. All scoring runs inside `analyse()` so per-frame canvases are reused without re-decoding. No DB persistence, no auto-attach to Phase 6 upload — v1 is generator-only, session-scoped, download-only.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**10 requirements are locked.** See `12-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `12-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- 6-predictor scoring engine in `frontend/src/lib/cover.ts` (pure functions + per-frame orchestrator)
- `EngineSignals.coverFrameScores` field + `analyse()` populates it
- `frontend/src/components/CoverFramePanel.tsx` (top-3 carousel, expand-to-10, badges, preview)
- 4-size PNG download (YT 1280×720, IG 1080×1080, Story/TikTok 1080×1920, FB 1280×720)
- Auto-contrast single-line text overlay using Phase 5 `InstagramOutput.cover_text`
- Lazy-loaded MediaPipe Face Mesh (`@mediapipe/face_mesh` with `refineLandmarks: true`) for eye-contact predictor only
- No-face graceful degradation + deterministic scoring
- Unit tests per predictor + integration test for panel + manual smoke on existing fixtures

**Out of scope (from SPEC.md):**
- Multi-line text wrap / custom font picker
- Background removal / subject cutout
- Auto-attaching chosen cover to Phase 6 upload pipeline
- Server-side render / persistence across sessions
- A/B variants / multiple branded covers per platform
- Cover regeneration for past posts in History
- Labelled reference dataset / quantitative quality benchmark
- Per-platform AI-generated cover text (extending `AIOutput` schema)

</spec_lock>

<decisions>
## Implementation Decisions

### Engine plumbing (Area 1)
- **D-01:** Cover scoring runs **inline inside `analyse()`** after `detectFacesAcrossFrames`, before per-frame canvases leave scope. `EngineSignals` gets a new `coverFrameScores: CoverFrameScore[]` field. No `analyse()` signature change for callers.
- **D-02:** `detectFacesAcrossFrames` is refactored to return per-frame face results alongside the aggregate: `{ faceCount, faceConfidence, perFrame: FaceResult[][] }`. Aggregate consumers (existing EngineSignals fields) ignore `perFrame`; `scoreCoverFrames` consumes it. One face-detection pass — no double inference.
- **D-03:** A new orchestrator `scoreCoverFrames(canvases, perFrameFaces, faceMeshDetector)` in `frontend/src/lib/cover.ts` returns the 10-element score array. Called from `analyse()`; never called from React components (which only see the cached result on `EngineSignals`).

### FaceMesh lazy-load (Area 2)
- **D-04:** `@mediapipe/face_mesh` model loads inside `analyse()` warmup alongside the existing `Promise.allSettled([getFaceDetector(), getCocoDetector()])` call (engine.ts:674). New `getFaceMeshDetector()` singleton mirroring `getFaceDetector()` pattern (try/catch returns null on failure).
- **D-05:** On FaceMesh load failure, the `eyeContact` predictor returns `0` for every frame and a single console.warn is logged. The other 5 predictors continue. CoverFramePanel renders normally; no error banner required (matches Phase 3 graceful-degradation precedent — silent log only).
- **D-06:** Hosted via jsdelivr CDN: `solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh'`. Matches the face-detection pattern at engine.ts:84. `refineLandmarks: true` is mandatory (locked by SPEC) — needed for iris landmarks.

### Predictor thresholds (Area 3)
- **D-07:** Ship SPEC default values. Add `frontend/src/lib/cover.calibration.test.ts` mirroring `engine.calibration.test.ts` — runs all 6 predictors against the 5 fixture videos and logs per-frame breakdown to stdout. Operator reviews scores during 12-SUMMARY manual smoke. If results are clearly off, a follow-up plan in this phase (e.g. `12-XX-PLAN.md`) revises thresholds before phase verification.
- **D-08:** Magic numbers live in `COVER_THRESHOLDS` const exported from `cover.ts`, mirroring the `AUDIO_THRESHOLDS` pattern at engine.ts:557–561. Keys at minimum: `CONTRAST_STDEV_LOW`, `CONTRAST_STDEV_HIGH`, `FACE_AREA_MIN`, `EYE_CONTACT_BAND`, `MOTION_BLUR_LAPLACIAN_LOW`, `MOTION_BLUR_LAPLACIAN_HIGH`, `TEXT_ZONE_VARIANCE_HIGH`. Predictor functions and tests both import this const — single source of truth.

### CoverFramePanel UX (Area 4)
- **D-09:** Top-3 layout = **horizontal carousel with hero**: #1 large with cover_text preview overlaid, #2 and #3 smaller flanking thumbnails. Tapping a flank promotes it to the hero slot (selection state in component-local `useState`). Mobile fallback: horizontal scroll if cards exceed viewport width.
- **D-10:** "Show all 10" expansion = **inline 5×2 grid below the top-3 row**, toggled by chevron. No modal/lightbox. Tapping any of the 7 promotes it to the hero slot. Matches the Phase 9 IdeaCard inline expand pattern.
- **D-11:** Download = **4 explicit buttons** below the chosen frame: `⬇ YouTube 1280×720`, `⬇ Instagram 1080×1080`, `⬇ Story / TikTok 1080×1920`, `⬇ Facebook 1280×720`. Filename pattern: `cover-{platform}-{videoBaseName}-{Date.now()}.png` where `platform` ∈ {`youtube`, `instagram`, `story`, `facebook`}. No zip, no dropdown.
- **D-12:** Cover-text preview in the panel is rendered via **canvas, not DOM overlay**. Single `renderCoverPng(canvas, text, { width, height })` function (in cover.ts) is called both for the preview render and for the download blob. WYSIWYG guarantee — preview matches download pixel-for-pixel. Slight cost (~20ms re-render on each frame switch) accepted.

### Claude's Discretion
- Component-internal state shape (hero index, expanded toggle) — implementation detail
- Exact carousel animation / transition CSS — none required, instant switch is fine
- Font selection for canvas text (sans-serif default; system font stack acceptable)
- Canvas font size scaling formula per target dimension (proportional to height — e.g. `fontPx = Math.round(height * 0.07)`)
- `data-testid` attribute names on rendered nodes (follow the ScorePanel/PlatformCardGrid convention)
- Whether the FaceMesh singleton lives in `cover.ts` or stays in `engine.ts` next to the other detector singletons (prefer cover.ts for cohesion — only cover scoring uses it)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements
- `.planning/phases/12-cover-frame-scoring/12-SPEC.md` — **Locked requirements, boundaries, acceptance criteria. MUST read before planning.**

### Engine integration points
- `frontend/src/lib/engine.ts` §16–27 (canRunEngine), §74–95 (getFaceDetector pattern to mirror), §503–523 (detectFacesAcrossFrames — refactor target), §557–561 (AUDIO_THRESHOLDS pattern to mirror), §662–788 (analyse — call site for scoreCoverFrames)
- `frontend/src/lib/types.ts` §47–66 (EngineSignals — `coverFrameScores` field added here), §118 (InstagramOutput.cover_text — overlay source)

### UI integration points
- `frontend/src/pages/GeneratorPage.tsx` §694–714 (analysis-done block — CoverFramePanel renders between ScorePanel:701 and PlatformCardGrid:702)
- `frontend/src/components/ScorePanel.tsx` — BAND_CLASSES static Tailwind pattern, `data-testid` + `data-band` convention, vitest render-test pattern

### Project-wide constraints
- `viral-copy-generator/CLAUDE.md` — Video Analysis section (engine constraints), Frontend section (Tailwind only, no UI library, no routing library, h-[100dvh] mobile rules)
- `.planning/STATE.md` — Phase 3 STATE entries on canvas/detector singletons + tensor leak patterns

### MediaPipe Face Mesh (new dependency)
- No internal ADR yet — pin version and document `refineLandmarks: true` requirement in the first plan (parallel to MediaPipe Face Detection `solutionPath` mandatory note at engine.ts:84)
- Upstream: https://www.npmjs.com/package/@mediapipe/face_mesh (researcher should verify current stable version + check for known landmark-numbering changes vs the previous engine.ts face-detection model)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`detectFacesAcrossFrames` (engine.ts:503)** — refactor in place to return per-frame results. Existing logic that picks max face count and averages confidence stays; we just stop discarding the per-frame raw results.
- **`extractFramesViaVideo` (engine.ts:285)** — already produces `HTMLCanvasElement[]` at native resolution; we use these directly for scoring (no re-decode).
- **`getFaceDetector` (engine.ts:74) singleton pattern** — copy verbatim for `getFaceMeshDetector`. Same `tf.ready()` + try/catch + lazy promise structure.
- **`AUDIO_THRESHOLDS` const (engine.ts:557)** — exact pattern to mirror for `COVER_THRESHOLDS`.
- **`ScorePanel.tsx` BAND_CLASSES + data-testid pattern** — reuse for predictor-band coloring on badges and for stable test selectors.
- **`engine.calibration.test.ts`** — exact pattern to copy for `cover.calibration.test.ts` (fixture sweep + per-frame log to stdout).
- **`__testSignals` hook in GeneratorPage** (D-24 from Phase 4) — seeds analysis-done state; reuse for CoverFramePanel integration test.

### Established Patterns
- **Pure functions in `frontend/src/lib/*.ts`, components in `frontend/src/components/*.tsx`** — cover.ts holds all scoring logic + renderCoverPng; CoverFramePanel.tsx holds only React + UI state.
- **Lazy model singleton with try/catch returning null on failure** (engine.ts face-detection/coco-ssd) — same shape for face-mesh.
- **Determinism / no `Math.random()`** in engine code — SPEC requirement 9; matches existing engine pattern.
- **Full Tailwind class strings stored in a `Record<…, string>`** for Tailwind JIT detection (ScorePanel BAND_CLASSES) — reuse for any predictor-band coloring on badges.
- **`Promise.allSettled` for parallel model warmup** at engine.ts:674 — add `getFaceMeshDetector()` to this array.
- **happy-dom + vitest render tests** for components — ScorePanel.test.tsx is the closest pattern; reuse setup.

### Integration Points
- **EngineSignals** (types.ts:47) — append `coverFrameScores: CoverFrameScore[]` plus the `CoverFrameScore` interface declaration.
- **analyse()** (engine.ts:662) — insert `scoreCoverFrames` call between `detectFacesAcrossFrames` and `detectObjectsAndMotion`. Per-frame face results threaded from the refactored `detectFacesAcrossFrames` return.
- **GeneratorPage.tsx** (line 701–702) — insert `<CoverFramePanel frames={signals.framesBase64} scores={signals.coverFrameScores} coverText={aiOutput?.instagram?.cover_text ?? ''} />` between `<ScorePanel>` and `<PlatformCardGrid>`. Conditional render on `signals.coverFrameScores?.length > 0`.
- **Vite config** — `@mediapipe/face_mesh` should likely be added to `optimizeDeps.exclude` parallel to the Phase 10 ffmpeg exclusion to avoid Vite dev-server pre-bundling a large WASM-adjacent dep. Researcher to confirm.

</code_context>

<specifics>
## Specific Ideas

- "WYSIWYG preview" — the in-panel preview must look exactly like the downloaded PNG. Locked via D-12 (single canvas render path for both).
- "Tap a flank thumbnail to promote it" — interaction precedent for the carousel. No SPA routing needed; pure local useState.
- Threshold tuning happens through observation, not modeling — operator runs `cover.calibration.test.ts`, eyeballs the per-frame breakdowns on the 5 fixtures, and revises the COVER_THRESHOLDS const if a known-good frame consistently scores low. No labelled training set, no fitting.

</specifics>

<deferred>
## Deferred Ideas

- **Per-platform AI cover text** — extending Phase 5 `AIOutput` so YouTube gets a title-style cover and Facebook gets a CTA-style cover. v1 reuses `InstagramOutput.cover_text` for all 4. Revisit if user feedback shows the IG cover text reads awkwardly on YT.
- **Auto-attach chosen cover to Phase 6 upload pipeline** — YouTube `thumbnails.set` API, Instagram cover-frame parameter on `POST /me/media`. New phase when upload UX is revisited.
- **Server-side persistence** — store chosen cover_frame_index + rendered PNG URL on `posts` table; show cover in History; allow regeneration. v2 / future phase.
- **Multi-line text wrap + custom fonts** — out of scope; sidesteps the entire layout-engine question for v1.
- **Background removal / subject cutout** — would require Selfie Segmentation model (~20 MB additional). v2 if cover quality demands it.
- **Labelled quality benchmark** — formal reference dataset for tuning. v1 ships with visual + determinism verification only.

</deferred>

---

*Phase: 12-cover-frame-scoring*
*Context gathered: 2026-05-16*
