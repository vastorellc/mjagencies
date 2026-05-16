# Phase 12: Cover-Frame Scoring & Recommendation — Specification

**Created:** 2026-05-16
**Ambiguity score:** 0.16 (gate: ≤ 0.20)
**Requirements:** 10 locked

## Goal

After analysis completes, the user sees a CoverFramePanel that ranks the 10 already-extracted frames by a 0–100 cover-suitability score (equal-weight mean of 6 visual predictors), recommends the top 3 with per-predictor breakdown badges, and lets the user download the chosen frame with the Phase 5 `cover_text` auto-overlaid at four platform-specific dimensions.

## Background

The engine at `frontend/src/lib/engine.ts` already extracts 10 frames per analysis (`framesBase64` on `EngineSignals`, plus internal `HTMLCanvasElement[]` from `extractFramesViaVideo`) and runs MediaPipe face detection on every frame (`detectFacesAcrossFrames`). Today these signals are aggregated into `faceCount` / `faceConfidence` only — per-frame face geometry is discarded, no compositional / contrast / sharpness metrics are computed, and the user has no UI surface to inspect candidate covers. Phase 5 already produces `InstagramOutput.cover_text` via the AI provider; nothing renders it onto a frame.

The CoverFramePanel will sit between `<ScorePanel>` and `<PlatformCardGrid>` on `GeneratorPage.tsx` (currently lines 701–702). All scoring runs inside `analyse()` so per-frame canvases (which are not currently exposed on `EngineSignals`) can be reused without re-decoding.

## Requirements

1. **EngineSignals extension**: `coverFrameScores` is computed and returned as part of `EngineSignals`.
   - Current: `EngineSignals` (frontend/src/lib/types.ts:47–66) has no per-frame scoring fields; per-frame face detection results are aggregated and discarded.
   - Target: New field `coverFrameScores: CoverFrameScore[]` where `CoverFrameScore = { frameIndex: number; score: number; breakdown: { faceOn, ruleOfThirds, contrast, textZone, motionBlur, eyeContact }; badges: string[] }`. Length always equals `framesBase64.length`.
   - Acceptance: TypeScript declaration committed; `analyse()` returns a 10-element `coverFrameScores` array for any video that yields 10 frames; each element has all six `breakdown` keys present as finite numbers in `[0, 100]`.

2. **Six predictors implemented**: Each predictor produces a 0–100 sub-score per frame.
   - Current: None of the six predictors exist.
   - Target:
     - `faceOn` — face-detection bounding box present + face area ≥ 8% of frame area
     - `ruleOfThirds` — 100 − (normalized distance of dominant-subject centroid from nearest of 4 power points × 200), clamped to [0, 100]
     - `contrast` — stdev of luma channel on a 128×128 downsample, mapped to [0, 100] via piecewise linear (stdev 0.08 → 0, stdev 0.25 → 100)
     - `textZone` — best of (top-third, bottom-third) uniform-luma score: 100 − (sliding-window luma variance × scale) — high score where text can be legibly placed
     - `motionBlur` — Laplacian variance on a 256×256 grayscale downsample, mapped to [0, 100] (low variance = blurry = low score)
     - `eyeContact` — MediaPipe Face Mesh `refineLandmarks: true` iris landmarks; score 100 when iris centroid is within face bbox center ± 15% of face width, falls linearly to 0 outside that band
   - Acceptance: Each predictor function exported from `frontend/src/lib/cover.ts`, unit-tested with synthetic inputs (solid-color canvas, gradient canvas, mock face landmark structure); each returns a finite number in [0, 100].

3. **Equal-weight scoring**: Final cover-frame score is the mean of the six predictors.
   - Current: No formula exists.
   - Target: `score = (faceOn + ruleOfThirds + contrast + textZone + motionBlur + eyeContact) / 6`, rounded to nearest integer. When a predictor is unavailable (no face → faceOn = 0, eyeContact = 0; both contribute zero to the sum but denominator stays 6).
   - Acceptance: Unit test asserts `score` equals integer mean of `breakdown` values for ≥ 3 fabricated inputs.

4. **Top-3 recommendation with badges**: The panel surfaces a ranked top-3 carousel with per-frame badge list (the top 2 predictors for that frame, e.g. `["High contrast", "Face center"]`).
   - Current: No CoverFramePanel exists.
   - Target: New `frontend/src/components/CoverFramePanel.tsx` renders a horizontal carousel of top-3 frames sorted by `score` desc; each card shows the frame thumbnail, overall score, and ≤ 2 badge chips; the remaining 7 frames are accessible via a "Show all 10" expand-toggle.
   - Acceptance: Render test (vitest + happy-dom) mounts CoverFramePanel with mocked `coverFrameScores` and asserts (a) top-3 frames appear sorted desc, (b) the highest-scoring frame's top-2 badge labels are rendered as text, (c) expand toggle reveals frames 4–10.

5. **Overlay text source**: The cover_text rendered on every download size is `aiOutput.instagram.cover_text` from Phase 5.
   - Current: `InstagramOutput.cover_text` (frontend/src/lib/types.ts:118) exists but is never rendered onto a frame; only displayed as text inside the IG card.
   - Target: When `aiOutput` is present and `aiOutput.instagram.cover_text` is non-empty, the CoverFramePanel renders the same string overlaid on the #1 recommended frame preview AND on every downloaded PNG, regardless of target platform size. When `aiOutput.instagram.cover_text` is missing or empty, the preview/download shows the frame with no text overlay (no error).
   - Acceptance: Component test asserts the `cover_text` string appears in the rendered preview's DOM (e.g. inside a positioned `<span>` over the image); download with empty `cover_text` produces a PNG with no text layer.

6. **Four download dimensions**: User can download the chosen cover as a PNG at four fixed sizes.
   - Current: No download capability exists.
   - Target: Four download buttons — YouTube 1280×720, Instagram 1080×1080, Story/TikTok 1080×1920, Facebook 1280×720 — each invokes `<canvas>` → `canvas.toBlob('image/png')` → `URL.createObjectURL` → `<a download>` click. Source frame is letterbox-scaled to fit (no crop loss); text overlay re-positioned to bottom-third with auto-contrast outline (white text + black stroke or vice versa based on background luma) for the target aspect ratio.
   - Acceptance: Manual smoke (captured in 12-SUMMARY.md) on `with-face.mp4` produces four PNG files matching declared dimensions exactly (verified via `file` or image metadata).

7. **Auto-contrast text rendering**: Overlay text remains legible on any frame background.
   - Current: N/A.
   - Target: Sample mean luma of the bottom-third (or wherever text is placed) of the rendered frame; if mean luma ≥ 0.55, render text in black with white stroke 2px; else white with black stroke 2px. Single-line only; if `cover_text` length exceeds the safe-area width at chosen font size, the text is truncated with ellipsis (no wrapping in v1).
   - Acceptance: Unit test on `pickTextColor(meanLuma)` returns expected pair for luma 0.2 and luma 0.8; manual smoke shows readable text on both a bright and a dark fixture frame.

8. **No-face graceful degradation**: Videos with no detected faces still produce sensible recommendations.
   - Current: N/A.
   - Target: When `faceCount === 0` across all frames, `faceOn` and `eyeContact` predictors each return 0 for every frame (denominator still 6 so max possible score is 66/100). Top-3 ranking proceeds based on the remaining 4 predictors; CoverFramePanel still renders normally with a `<p>` note: "No faces detected — recommendations based on composition, contrast, sharpness, and text-readable zones."
   - Acceptance: Unit test with mocked face results = `[]` asserts panel renders without throw and the "No faces detected" note appears; ranking is stable (deterministic).

9. **Determinism**: Identical input video produces identical `coverFrameScores`.
   - Current: N/A.
   - Target: All six predictors are pure functions of the canvas pixel data + face-detection output. No `Math.random()`, no time-dependent input, no model warmup state leak.
   - Acceptance: Unit test analyses the same fixture canvas array twice and asserts `JSON.stringify(coverFrameScores1) === JSON.stringify(coverFrameScores2)`.

10. **GeneratorPage integration**: CoverFramePanel renders in the analysis-done section between ScorePanel and PlatformCardGrid.
    - Current: GeneratorPage.tsx:701–702 renders ScorePanel directly followed by PlatformCardGrid; no CoverFramePanel import.
    - Target: GeneratorPage imports CoverFramePanel and renders it conditionally inside `{status.kind === 'done' && signals && scoreResult && ...}` block when `signals.coverFrameScores` is non-empty; receives `frames={signals.framesBase64}`, `scores={signals.coverFrameScores}`, and `coverText={aiOutput?.instagram?.cover_text ?? ''}` as props.
    - Acceptance: Integration test (existing GeneratorPage test pattern) seeds `__testSignals` with mocked `coverFrameScores`, asserts CoverFramePanel renders between ScorePanel and PlatformCardGrid in DOM order.

## Boundaries

**In scope:**
- 6-predictor scoring engine in `frontend/src/lib/cover.ts` (pure functions + per-frame orchestrator)
- `EngineSignals.coverFrameScores` field + `analyse()` populates it
- `frontend/src/components/CoverFramePanel.tsx` (top-3 carousel, expand-to-10, badges, preview)
- 4-size PNG download (YT 1280×720, IG 1080×1080, Story/TikTok 1080×1920, FB 1280×720)
- Auto-contrast single-line text overlay using Phase 5 `InstagramOutput.cover_text`
- Lazy-loaded MediaPipe Face Mesh (`@mediapipe/face_mesh` with `refineLandmarks: true`) for eye-contact predictor only
- No-face graceful degradation + deterministic scoring
- Unit tests for each predictor + integration test for panel + manual smoke on existing fixtures

**Out of scope:**
- Multi-line text wrap, custom font picker — single-line auto-sized only; deferred to v2 if user demand surfaces
- Background removal / subject cutout (rembg, u2net, MediaPipe Selfie Segmentation) — text overlays directly on the frame with auto-contrast outline; no compositing
- Auto-attaching chosen cover to Phase 6 upload pipeline (YouTube `thumbnails.set`, Instagram cover-frame parameter) — v1 ships download-only; upload integration is a future phase
- Server-side cover render / persistence across sessions — chosen cover state lives in React useState only; refreshing the page resets to top-3 recommendation; storing chosen cover in `posts` table is v2
- A/B variants / multiple branded covers per platform — v1 picks #1 only
- Cover regeneration for past posts in History screen — v1 is generator-only
- Labelled reference dataset / quantitative quality benchmark — v1 acceptance is visual + determinism only on existing fixture videos
- Per-platform AI-generated cover text (extending `AIOutput` schema) — v1 reuses `InstagramOutput.cover_text` for all 4 downloads; per-platform copy is a Phase 5 enhancement, not Phase 12

## Constraints

- **No new heavy dependencies beyond `@mediapipe/face_mesh`** — all other predictors use existing canvas/TF.js machinery already loaded by Phase 3 engine.
- **Eye-contact model is lazy-loaded** — `face_mesh` (with `refineLandmarks: true`) loads only when `coverFrameScores` is first requested, not at engine warmup, so users who never reach the analysis-done state pay no bundle cost.
- **Predictors run inside `analyse()`** — must reuse the `HTMLCanvasElement[]` already produced by `extractFramesViaVideo` (currently scoped inside `analyse()`); cannot decode frames a second time from `framesBase64`. This requires routing the per-frame canvases (and per-frame face-detection results) into a new `scoreCoverFrames(canvases, faceResults)` orchestrator.
- **Scoring must run on Chromium-based mobile browsers** — same WebGL/MediaPipe target as Phase 3; no WebGPU.
- **Output PNG sizes are fixed strings** — no custom dimension input in v1.
- **Cover text overlay is rasterized into the PNG** — not an SVG/HTML layer; uses canvas `fillText` + `strokeText`.

## Acceptance Criteria

- [ ] `EngineSignals.coverFrameScores` declared in `frontend/src/lib/types.ts` with the documented shape
- [ ] `analyse()` returns `coverFrameScores` with length === `framesBase64.length` for every successful analysis
- [ ] All six `breakdown` keys present on every entry, each a finite number in [0, 100]
- [ ] `score = round(mean(breakdown values))`, asserted by unit test
- [ ] `frontend/src/lib/cover.ts` exports each predictor function and is covered by unit tests with synthetic inputs
- [ ] `CoverFramePanel.tsx` renders a top-3 carousel with badges and an expand-to-10 toggle
- [ ] CoverFramePanel renders between ScorePanel and PlatformCardGrid in GeneratorPage when analysis is done
- [ ] When `faceCount === 0` across all frames, panel renders the "No faces detected" note and scoring proceeds without throw
- [ ] Identical input produces identical `coverFrameScores` across two runs (determinism test)
- [ ] Four download buttons produce PNGs at 1280×720, 1080×1080, 1080×1920, 1280×720 — verified on `with-face.mp4` fixture (manual smoke captured in 12-SUMMARY.md)
- [ ] `cover_text` from `aiOutput.instagram.cover_text` is rasterized onto the downloaded PNG at the bottom-third with auto-contrast outline; empty `cover_text` produces a PNG with no text layer (no error)
- [ ] `@mediapipe/face_mesh` is lazy-loaded — bundle analysis confirms it does NOT appear in the initial JS bundle
- [ ] No new linter errors; `tsc --noEmit` clean; full vitest suite green

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                |
|--------------------|-------|------|--------|------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | 6 predictors + equal-weight mean + 4 sizes locked    |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | 8-item out-of-scope list with reasoning              |
| Constraint Clarity | 0.80  | 0.65 | ✓      | FaceMesh lazy-load accepted; canvas reuse mandated   |
| Acceptance Criteria| 0.75  | 0.70 | ✓      | 13 pass/fail criteria; visual verification on fixtures |
| **Ambiguity**      | 0.16  | ≤0.20| ✓      |                                                      |

## Interview Log

| Round | Perspective         | Question summary                                | Decision locked                                                              |
|-------|---------------------|-------------------------------------------------|------------------------------------------------------------------------------|
| 0     | (initial roadmap)   | Score 6 predictors for thumbnail CTR-likelihood | Roadmap-supplied: face-on / RoT / contrast / text-zone / motion-blur / eye-contact |
| 1     | Researcher          | Eye-contact requires FaceMesh — keep or drop?   | Keep eye-contact; lazy-load `@mediapipe/face_mesh` (~10 MB) on first use      |
| 1     | Researcher          | Reference dataset for "top-3 ≥ 60 on 4 of 6"?   | No labelled dataset; visual + determinism verification on existing fixtures   |
| 1     | Researcher          | Which download sizes ship in v1?                | 4 sizes: YT 1280×720, IG 1080×1080, Story/TikTok 1080×1920, FB 1280×720       |
| 2     | Simplifier          | How do 6 predictors combine into 0–100?         | Equal-weight mean of 6; round to integer                                      |
| 2     | Simplifier          | Where does overlay text come from?              | Reuse `InstagramOutput.cover_text` for all 4 downloads; no Phase 5 change     |
| 2     | Boundary Keeper     | What is explicitly out of scope?                | Multi-line wrap, bg removal, auto-attach to upload, server-side persistence   |

---

*Phase: 12-cover-frame-scoring*
*Spec created: 2026-05-16*
*Next step: /gsd-discuss-phase 12 — implementation decisions (cover.ts module layout, FaceMesh lazy-load pattern, canvas-reuse plumbing through analyse(), PNG download UX)*
