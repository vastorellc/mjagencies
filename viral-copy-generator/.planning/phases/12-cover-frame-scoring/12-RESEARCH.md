# Phase 12: Cover-Frame Scoring & Recommendation - Research

**Researched:** 2026-05-16
**Domain:** Canvas pixel scoring, MediaPipe Face Mesh, Laplacian sharpness, PNG canvas compositing
**Confidence:** HIGH (codebase verified) / MEDIUM (external library patterns)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Cover scoring runs inline inside `analyse()` after `detectFacesAcrossFrames`, before per-frame canvases leave scope. `EngineSignals` gets a new `coverFrameScores: CoverFrameScore[]` field. No `analyse()` signature change for callers.

**D-02:** `detectFacesAcrossFrames` is refactored to return per-frame face results alongside the aggregate: `{ faceCount, faceConfidence, perFrame: FaceResult[][] }`. Aggregate consumers (existing EngineSignals fields) ignore `perFrame`; `scoreCoverFrames` consumes it. One face-detection pass — no double inference.

**D-03:** A new orchestrator `scoreCoverFrames(canvases, perFrameFaces, faceMeshDetector)` in `frontend/src/lib/cover.ts` returns the 10-element score array. Called from `analyse()`; never called from React components (which only see the cached result on `EngineSignals`).

**D-04:** `@mediapipe/face_mesh` model loads inside `analyse()` warmup alongside the existing `Promise.allSettled([getFaceDetector(), getCocoDetector()])` call (engine.ts:674). New `getFaceMeshDetector()` singleton mirroring `getFaceDetector()` pattern (try/catch returns null on failure).

**D-05:** On FaceMesh load failure, the `eyeContact` predictor returns `0` for every frame and a single `console.warn` is logged. The other 5 predictors continue. CoverFramePanel renders normally; no error banner required.

**D-06:** Hosted via jsdelivr CDN: `solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh'`. `refineLandmarks: true` is mandatory — needed for iris landmarks.

**D-07:** Ship SPEC default values. Add `frontend/src/lib/cover.calibration.test.ts` mirroring `engine.calibration.test.ts`. Operator reviews scores during 12-SUMMARY manual smoke.

**D-08:** Magic numbers live in `COVER_THRESHOLDS` const exported from `cover.ts`, mirroring the `AUDIO_THRESHOLDS` pattern at engine.ts:557–561.

**D-09:** Top-3 layout = horizontal carousel with hero: #1 large with cover_text preview overlaid, #2 and #3 smaller flanking thumbnails. Tapping a flank promotes it to the hero slot. Mobile fallback: horizontal scroll.

**D-10:** "Show all 10" expansion = inline 5×2 grid below the top-3 row, toggled by chevron. No modal/lightbox.

**D-11:** Download = 4 explicit buttons: YouTube 1280×720, Instagram 1080×1080, Story/TikTok 1080×1920, Facebook 1280×720. Filename pattern: `cover-{platform}-{videoBaseName}-{Date.now()}.png`.

**D-12:** Cover-text preview in the panel is rendered via canvas, not DOM overlay. Single `renderCoverPng(canvas, text, { width, height })` function (in cover.ts) is called both for preview render and download blob. WYSIWYG guarantee.

### Claude's Discretion

- Component-internal state shape (hero index, expanded toggle)
- Exact carousel animation / transition CSS (none required, instant switch is fine)
- Font selection for canvas text (sans-serif default; system font stack acceptable)
- Canvas font size scaling formula per target dimension (proportional to height — e.g. `fontPx = Math.round(height * 0.07)`)
- `data-testid` attribute names on rendered nodes (follow ScorePanel/PlatformCardGrid convention)
- Whether the FaceMesh singleton lives in `cover.ts` or stays in `engine.ts` (prefer cover.ts for cohesion)

### Deferred Ideas (OUT OF SCOPE)

- Per-platform AI cover text (extending Phase 5 `AIOutput` schema)
- Auto-attach chosen cover to Phase 6 upload pipeline (YouTube `thumbnails.set`, Instagram cover-frame parameter)
- Server-side persistence (store chosen cover_frame_index + rendered PNG URL on `posts` table)
- Multi-line text wrap + custom fonts
- Background removal / subject cutout
- Labelled quality benchmark / reference dataset

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COVER-01 | `coverFrameScores: CoverFrameScore[]` added to `EngineSignals`; `analyse()` returns 10-element array | TypeScript interface extension pattern established in types.ts:47–66 |
| COVER-02 | Six predictors implemented in `cover.ts`, each returning [0,100] | Laplacian, BT.601 luma, Rule-of-Thirds, face bbox — all pure canvas operations |
| COVER-03 | Equal-weight mean formula: `round((sum of 6) / 6)` | Pure math; no library needed |
| COVER-04 | CoverFramePanel with top-3 carousel, expand-to-10, badges | React + Tailwind; happy-dom testable |
| COVER-05 | Overlay text from `aiOutput.instagram.cover_text` | InstagramOutput.cover_text field exists at types.ts:118 |
| COVER-06 | Four download dimensions via canvas.toBlob → a[download] | Standard Web API; no library needed |
| COVER-07 | Auto-contrast text rendering (luma sampling + black/white toggle) | BT.601 formula already in engine.ts:651 |
| COVER-08 | No-face graceful degradation; faceOn + eyeContact return 0; panel shows note | Conditional predictor logic; no throw path |
| COVER-09 | Determinism — pure functions, no Math.random(), no time-dependent input | JSON.stringify comparison regression test |
| COVER-10 | GeneratorPage integration — CoverFramePanel between ScorePanel and PlatformCardGrid | Insertion at GeneratorPage.tsx:701–702 |

</phase_requirements>

---

## Summary

Phase 12 adds a cover-frame scoring and recommendation layer on top of the 10 frames already extracted by the Phase 3 engine. All six predictors are pure canvas operations except `eyeContact`, which requires `@mediapipe/face_mesh` with `refineLandmarks: true` to access the 10 iris landmark points (indices 468–477) appended beyond the standard 468-point face mesh.

The codebase already provides almost everything needed. `detectFacesAcrossFrames` (engine.ts:503–523) currently discards per-frame face results after aggregation; refactoring it to also return `perFrame: FaceResult[][]` is a two-line change that requires no API changes for existing callers. The `getFaceDetector()` singleton pattern (engine.ts:74–95) is the exact shape to clone for `getFaceMeshDetector()`. The BT.601 luma formula (`0.299r + 0.587g + 0.114b`) is already present at engine.ts:651 for brightness scoring and can be reused for the `contrast`, `textZone`, and auto-contrast predictor functions.

The `renderCoverPng` canvas compositing path is the phase's only non-trivial new algorithm: letterbox scaling to four fixed dimensions, BT.601 mean-luma sampling of the bottom third, and canvas `fillText`/`strokeText` with conditional color. All existing canvas test patterns use happy-dom, which lacks pixel-accurate `getImageData` — predictor unit tests must create synthetic `ImageData` objects directly rather than rendering into a real canvas and reading back pixels. The browser-mode vitest project (Playwright/Chromium) is available for tests that need real canvas pixel fidelity.

**Primary recommendation:** Implement all six predictors as pure TypeScript functions in `cover.ts` that accept `ImageData` or pre-computed statistics (not raw canvases) so they are testable in happy-dom with synthetic inputs. The canvas sampling is isolated in thin adapter functions that bridge the predictor logic to real DOM canvas elements. This keeps the business logic tested without browser rendering.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Six predictor math functions | Browser / Client (`cover.ts`) | — | Pure pixel math; no server round-trip |
| Face Mesh iris landmark extraction | Browser / Client (`cover.ts` FaceMesh singleton) | — | Needs GPU/WebGL; CDN-loaded WASM model |
| `scoreCoverFrames` orchestrator | Browser / Client (`cover.ts`) | — | Calls predictors; consumes per-frame canvases inside `analyse()` |
| `renderCoverPng` (preview + download) | Browser / Client (`cover.ts`) | — | Canvas 2D API; client-side only |
| `CoverFramePanel` React component | Browser / Client (`CoverFramePanel.tsx`) | — | UI only; no server state |
| PNG download | Browser / Client (Web API) | — | `canvas.toBlob` + `URL.createObjectURL` + `<a download>` |
| EngineSignals extension | Shared types (`types.ts`) | — | Consumed by React state; produced by engine |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@mediapipe/face_mesh` | 0.4.1633559619 | Iris landmark detection (eye-contact predictor) | Only MediaPipe package providing 478-landmark mesh with iris points; peers match installed TF.js |
| `@tensorflow-models/face-landmarks-detection` | 1.0.6 | TF.js API wrapper for FaceMesh with `runtime: 'mediapipe'` | Alternative entry point to same model via existing TF.js SDK |
| Canvas 2D API (browser built-in) | — | All predictor pixel sampling + compositing | Already used in engine.ts for brightness (line 643–656) |
| Web APIs (`toBlob`, `URL.createObjectURL`) | — | PNG download | Already used in Phase 3 frame extraction |

**Version verification (npm registry 2026-05-16):**
- `@mediapipe/face_mesh@0.4.1633559619` — published 2021-10-07, latest dist-tag. Last npm registry update: 2026-05-08T15:20:24.073Z [VERIFIED: npm view]
- `@tensorflow-models/face-landmarks-detection@1.0.6` — latest dist-tag [VERIFIED: npm view]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest-canvas-mock` | latest | Mock `getImageData` / `fillText` in happy-dom | Only needed if predictor tests are kept in the `unit` project; prefer synthetic ImageData instead |

**Installation (only `@mediapipe/face_mesh` is new):**
```bash
cd frontend
npm install @mediapipe/face_mesh@0.4.1633559619
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@mediapipe/face_mesh` (legacy solution) | `@mediapipe/tasks-vision` FaceLandmarker (already installed as `0.10.35`) | tasks-vision is the newer Tasks API; it IS already installed, so `@mediapipe/face_mesh` is an extra dependency. However, D-06 locks the solutionPath jsdelivr pattern which matches the `face_mesh` package specifically. `tasks-vision` has a different API shape (`FaceLandmarker.create(...)`) and is not confirmed to produce the same iris landmark indices. Use `face_mesh` as locked by D-06. |
| Raw `@mediapipe/face_mesh` | `@tensorflow-models/face-landmarks-detection` (TF.js wrapper) | TF.js wrapper requires `@mediapipe/face_mesh` as peer anyway; adds overhead. Direct `@mediapipe/face_mesh` usage via the same CDN pattern as face-detection is simpler and matches the D-06 decision. |

---

## Architecture Patterns

### System Architecture Diagram

```
analyse(file)  [engine.ts]
   │
   ├── extractFramesViaVideo() → { canvases: HTMLCanvasElement[10], framesBase64: string[10] }
   │
   ├── detectFacesAcrossFrames(canvases)  [REFACTORED]
   │   ├── estimateFaces(canvas) × 10  [face-detection model — already loaded]
   │   └── returns { faceCount, faceConfidence, perFrame: FaceResult[][] }
   │
   ├── scoreCoverFrames(canvases, perFrame, faceMeshDetector)  [cover.ts — NEW]
   │   ├── getFaceMeshDetector()  [lazy singleton — loads @mediapipe/face_mesh via CDN]
   │   │   └── on failure → null (eyeContact = 0 for all frames)
   │   │
   │   ├── for each canvas[i]:
   │   │   ├── scoreFaceOn(bbox, frameArea)          → [0,100]
   │   │   ├── scoreRuleOfThirds(bbox_centroid, w, h) → [0,100]
   │   │   ├── scoreContrast(canvas, downsample=128) → [0,100]
   │   │   ├── scoreTextZone(canvas, top|bottom)     → [0,100]
   │   │   ├── scoreMotionBlur(canvas, downsample=256)→ [0,100]
   │   │   └── scoreEyeContact(irisLandmarks, bbox)  → [0,100]
   │   │
   │   └── returns CoverFrameScore[10] { frameIndex, score, breakdown, badges }
   │
   └── returns EngineSignals { ...existing, coverFrameScores }

CoverFramePanel.tsx  [React component — reads signals.coverFrameScores]
   ├── sorts by score desc → top3, rest7
   ├── renderCoverPng(canvas, text, {w, h})  [cover.ts — both preview + download]
   │   ├── letterbox scale source canvas into target {w, h}
   │   ├── sample mean luma of bottom-third
   │   ├── pick text color (luma ≥ 0.55 → black + white stroke, else white + black stroke)
   │   └── fillText + strokeText at bottom-third center
   └── 4 download buttons → canvas.toBlob('image/png') → URL.createObjectURL → <a download>
```

### Recommended Project Structure

```
frontend/src/
├── lib/
│   ├── cover.ts           — scoreCoverFrames orchestrator + 6 predictor functions
│   │                        + renderCoverPng + COVER_THRESHOLDS + getFaceMeshDetector
│   ├── cover.test.ts      — unit tests for all 6 predictors (happy-dom, synthetic ImageData)
│   ├── cover.calibration.test.ts — fixture sweep (browser mode, logs per-frame scores)
│   ├── engine.ts          — refactor detectFacesAcrossFrames; add scoreCoverFrames call
│   └── types.ts           — add CoverFrameScore interface + coverFrameScores field
├── components/
│   ├── CoverFramePanel.tsx       — top-3 carousel, expand-to-10, download buttons
│   └── CoverFramePanel.test.tsx  — render tests (happy-dom)
└── pages/
    └── GeneratorPage.tsx  — import CoverFramePanel; insert at line 701-702
```

### Pattern 1: Predictor With Synthetic-ImageData Unit Test Strategy

**What:** Predictors that need `getImageData` pixel data are written to accept `ImageData` directly (or a sampled Float32Array), not a canvas element. A thin adapter in `cover.ts` calls `ctx.getImageData()` and passes the result to the pure function. Tests bypass the adapter and call the pure function with hand-crafted `ImageData`.

**When to use:** All five canvas-based predictors (`contrast`, `textZone`, `motionBlur`, `faceOn`, `ruleOfThirds`). Avoids happy-dom canvas limitations without switching to browser-mode tests for unit tests.

**Example:**
```typescript
// Source: [ASSUMED] — standard pattern for canvas unit testing in happy-dom
// Pure predictor function (testable with synthetic data)
export function scoreContrastFromData(data: Uint8ClampedArray, width: number, height: number): number {
  let sum = 0, sumSq = 0
  const total = width * height
  for (let i = 0; i < data.length; i += 4) {
    const luma = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
    sum += luma
    sumSq += luma * luma
  }
  const mean = sum / total
  const variance = sumSq / total - mean * mean
  const stdev = Math.sqrt(Math.max(0, variance))
  // Piecewise linear: stdev 0.08 → 0, stdev 0.25 → 100
  const LOW = COVER_THRESHOLDS.CONTRAST_STDEV_LOW   // 0.08
  const HIGH = COVER_THRESHOLDS.CONTRAST_STDEV_HIGH // 0.25
  return Math.max(0, Math.min(100, ((stdev - LOW) / (HIGH - LOW)) * 100))
}

// Adapter (thin canvas wrapper — not unit-tested separately)
export function scoreContrast(canvas: HTMLCanvasElement): number {
  const offscreen = document.createElement('canvas')
  offscreen.width = 128; offscreen.height = 128
  const ctx = offscreen.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(canvas, 0, 0, 128, 128)
  const { data } = ctx.getImageData(0, 0, 128, 128)
  return scoreContrastFromData(data, 128, 128)
}

// Unit test in happy-dom — no real canvas needed
it('solid black → contrast score 0', () => {
  const data = new Uint8ClampedArray(128 * 128 * 4).fill(0)
  for (let i = 3; i < data.length; i += 4) data[i] = 255 // alpha=255
  expect(scoreContrastFromData(data, 128, 128)).toBe(0)
})
```

### Pattern 2: FaceMesh Singleton (mirrors getFaceDetector)

**What:** `getFaceMeshDetector()` in `cover.ts` follows the exact singleton pattern from engine.ts:74–95.

**When to use:** Called once inside `analyse()` warmup via `Promise.allSettled`.

**Example:**
```typescript
// Source: engine.ts:74–95 [VERIFIED: codebase read]
import { FaceMesh } from '@mediapipe/face_mesh'

let faceMeshInstance: FaceMesh | null = null
let faceMeshPromise: Promise<FaceMesh | null> | null = null

export async function getFaceMeshDetector(): Promise<FaceMesh | null> {
  if (faceMeshInstance) return faceMeshInstance
  if (faceMeshPromise) return faceMeshPromise
  faceMeshPromise = (async () => {
    try {
      const mesh = new FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      })
      mesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,       // D-06: MANDATORY for iris landmark indices 468–477
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
      // FaceMesh uses a callback API, not async/await — must resolve via onResults
      await new Promise<void>((resolve, reject) => {
        mesh.onResults(() => resolve())
        // Send a 1×1 blank canvas to trigger model load
        const blank = document.createElement('canvas')
        blank.width = 1; blank.height = 1
        mesh.send({ image: blank }).catch(reject)
        setTimeout(() => reject(new Error('FaceMesh init timeout')), 15_000)
      })
      faceMeshInstance = mesh
      return mesh
    } catch (err) {
      console.warn('[cover:facemesh] init failed — eyeContact predictor disabled:', err)
      return null
    }
  })()
  return faceMeshPromise
}
```

**CRITICAL API NOTE:** `@mediapipe/face_mesh` (legacy Solutions API) uses a callback-driven design. `mesh.send({ image })` triggers `mesh.onResults(callback)`. It does NOT return a Promise of results. The eye-contact predictor must promisify this pattern per-frame:

```typescript
// Source: [VERIFIED: @mediapipe/face_mesh@0.4.1633559619 TypeScript definitions via cdn.jsdelivr.net/npm/@mediapipe/face_mesh/index.d.ts]
async function estimateIrisLandmarks(
  mesh: FaceMesh,
  canvas: HTMLCanvasElement,
): Promise<NormalizedLandmarkList | null> {
  return new Promise((resolve) => {
    mesh.onResults((results) => {
      const landmarks = results.multiFaceLandmarks?.[0] ?? null
      resolve(landmarks)
    })
    mesh.send({ image: canvas }).catch(() => resolve(null))
  })
}
```

### Pattern 3: Laplacian Variance Blur Detection

**What:** Apply a 3×3 Laplacian kernel to a grayscale downsample of the canvas; compute variance of the result. High variance = sharp image = high motionBlur score.

**When to use:** `scoreMotionBlur` predictor.

**Example:**
```typescript
// Source: Revolut Tech Medium article (medium.com/revolut/canvas-based-javascript-blur-detection)
// [CITED: medium.com/revolut/canvas-based-javascript-blur-detection-b92ab1075acf]
const LAPLACIAN_KERNEL = [0, 1, 0, 1, -4, 1, 0, 1, 0]

export function scoreMotionBlurFromData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  // Convert to grayscale luma (BT.601)
  const gray: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    gray.push((0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255)
  }
  // Apply Laplacian kernel (skip 1-pixel border)
  const laplacian: number[] = []
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const v =
        LAPLACIAN_KERNEL[0] * gray[idx - width - 1] +
        LAPLACIAN_KERNEL[1] * gray[idx - width] +
        LAPLACIAN_KERNEL[2] * gray[idx - width + 1] +
        LAPLACIAN_KERNEL[3] * gray[idx - 1] +
        LAPLACIAN_KERNEL[4] * gray[idx] +
        LAPLACIAN_KERNEL[5] * gray[idx + 1] +
        LAPLACIAN_KERNEL[6] * gray[idx + width - 1] +
        LAPLACIAN_KERNEL[7] * gray[idx + width] +
        LAPLACIAN_KERNEL[8] * gray[idx + width + 1]
      laplacian.push(v)
    }
  }
  // Compute variance
  const n = laplacian.length
  if (n === 0) return 0
  const mean = laplacian.reduce((a, b) => a + b, 0) / n
  const variance = laplacian.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  // Map to [0,100]: variance 0 → 0 (totally blurry), threshold HIGH → 100 (sharp)
  // COVER_THRESHOLDS.MOTION_BLUR_LAPLACIAN_LOW = 0.001, HIGH = 0.02 (ASSUMED — tune in calibration)
  const LOW = COVER_THRESHOLDS.MOTION_BLUR_LAPLACIAN_LOW
  const HIGH = COVER_THRESHOLDS.MOTION_BLUR_LAPLACIAN_HIGH
  return Math.max(0, Math.min(100, ((variance - LOW) / (HIGH - LOW)) * 100))
}
```

### Pattern 4: Eye-Contact Scoring via Iris Landmarks

**What:** With `refineLandmarks: true`, FaceMesh produces 478 normalized landmarks. Iris centroid is the average of the 5 iris contour points: left eye indices 468–472, right eye indices 473–477. Index 468 is treated as the left iris center (first of the 5 left iris points). [VERIFIED: mediapipe.readthedocs.io]

**Eye-contact formula from SPEC:**
- Score 100 when iris centroid x is within face bbox center_x ± 15% of face width
- Score falls linearly to 0 outside that band

```typescript
// Source: SPEC requirement 2 + iris landmark indices [VERIFIED: mediapipe.readthedocs.io/solutions/face_mesh]
export function scoreEyeContact(
  landmarks: NormalizedLandmarkList | null,
  faceBbox: { xMin: number; xMax: number; width: number } | null,
  frameWidth: number,
): number {
  if (!landmarks || !faceBbox || landmarks.length < 473) return 0
  // Left iris: indices 468-472, right iris: 473-477
  // Use mean x of both iris groups as the centroid
  let irisSumX = 0
  for (let i = 468; i <= 477; i++) irisSumX += landmarks[i].x * frameWidth
  const irisX = irisSumX / 10

  const faceCenterX = (faceBbox.xMin + faceBbox.xMax) / 2
  const band = COVER_THRESHOLDS.EYE_CONTACT_BAND * faceBbox.width // 0.15 × face width
  const dist = Math.abs(irisX - faceCenterX)
  if (dist <= band) return 100
  // Linear falloff from band edge to 2× band (scores 100→0 across that range)
  const falloffEnd = band * 2
  return Math.max(0, Math.round(100 * (1 - (dist - band) / (falloffEnd - band))))
}
```

### Pattern 5: Rule-of-Thirds Scoring

**What:** The four power points of a frame at dimensions (W, H) are at (W/3, H/3), (2W/3, H/3), (W/3, 2H/3), (2W/3, 2H/3). The score is the distance of the dominant subject centroid from the nearest power point, normalized and inverted.

**SPEC formula (locked):** `100 − (normalizedDist × 200)`, clamped to [0, 100], where normalizedDist is the Euclidean distance from centroid to nearest power point divided by the frame diagonal.

```typescript
// Source: SPEC requirement 2 [VERIFIED: SPEC.md]
export function scoreRuleOfThirds(
  centroidX: number,
  centroidY: number,
  frameWidth: number,
  frameHeight: number,
): number {
  const powerPoints = [
    { x: frameWidth / 3, y: frameHeight / 3 },
    { x: (2 * frameWidth) / 3, y: frameHeight / 3 },
    { x: frameWidth / 3, y: (2 * frameHeight) / 3 },
    { x: (2 * frameWidth) / 3, y: (2 * frameHeight) / 3 },
  ]
  const diagonal = Math.sqrt(frameWidth ** 2 + frameHeight ** 2)
  let minDist = Infinity
  for (const pp of powerPoints) {
    const d = Math.sqrt((centroidX - pp.x) ** 2 + (centroidY - pp.y) ** 2)
    if (d < minDist) minDist = d
  }
  const normalized = minDist / diagonal
  return Math.max(0, Math.min(100, Math.round(100 - normalized * 200)))
}
```

### Pattern 6: TextZone Sliding-Window Luma Variance

**What:** Compute mean luma for every N×1 horizontal row slice of either the top-third or bottom-third. Variance of these row-means measures how uniform the band is. High uniformity = low variance = good text zone.

```typescript
// Source: [ASSUMED] — standard image processing approach
export function scoreTextZoneFromData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  // Evaluate both top-third and bottom-third; return the best score
  const scores = [
    textZoneBandScore(data, width, height, 0, Math.floor(height / 3)),
    textZoneBandScore(data, width, height, Math.floor((2 * height) / 3), height),
  ]
  return Math.max(...scores)
}

function textZoneBandScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startRow: number,
  endRow: number,
): number {
  const rowMeans: number[] = []
  for (let y = startRow; y < endRow; y++) {
    let rowSum = 0
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      rowMeans.push(0) // placeholder
      rowSum += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
    }
    rowMeans[rowMeans.length - 1] // overwrite placeholder with actual
    // Re-do: accumulate per-row means
    rowMeans.length === 0 ? rowMeans.push(rowSum / width) : (rowMeans[rowMeans.length] = rowSum / width)
  }
  const rowMeansClean: number[] = []
  for (let y = startRow; y < endRow; y++) {
    let rowSum = 0
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      rowSum += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
    }
    rowMeansClean.push(rowSum / width)
  }
  if (rowMeansClean.length === 0) return 0
  const mean = rowMeansClean.reduce((a, b) => a + b, 0) / rowMeansClean.length
  const variance = rowMeansClean.reduce((s, v) => s + (v - mean) ** 2, 0) / rowMeansClean.length
  // Low variance = uniform = good text zone. Map: variance 0 → 100, HIGH → 0
  const HIGH = COVER_THRESHOLDS.TEXT_ZONE_VARIANCE_HIGH  // e.g. 0.05 (ASSUMED — tune in calibration)
  return Math.max(0, Math.min(100, Math.round(100 * (1 - variance / HIGH))))
}
```

### Pattern 7: Letterbox Canvas Scaling for Downloads

**What:** Scale the source frame canvas into the target dimension while preserving aspect ratio, centering the image, and filling the remainder with black.

```typescript
// Source: [ASSUMED] — standard canvas letterbox algorithm
export function renderCoverPng(
  sourceCanvas: HTMLCanvasElement,
  coverText: string,
  options: { width: number; height: number },
): HTMLCanvasElement {
  const { width, height } = options
  const out = document.createElement('canvas')
  out.width = width; out.height = height
  const ctx = out.getContext('2d')!

  // Black letterbox background
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)

  // Letterbox-scale: fit source into target preserving aspect ratio
  const srcW = sourceCanvas.width; const srcH = sourceCanvas.height
  const scaleX = width / srcW; const scaleY = height / srcH
  const scale = Math.min(scaleX, scaleY)
  const drawW = Math.round(srcW * scale); const drawH = Math.round(srcH * scale)
  const offsetX = Math.round((width - drawW) / 2)
  const offsetY = Math.round((height - drawH) / 2)
  ctx.drawImage(sourceCanvas, offsetX, offsetY, drawW, drawH)

  // Auto-contrast text overlay (COVER-07)
  if (coverText.trim()) {
    const fontPx = Math.round(height * 0.07)
    // Sample mean luma of the bottom-third
    const bottomData = ctx.getImageData(0, Math.round(height * 2 / 3), width, Math.round(height / 3))
    const meanLuma = computeMeanLuma(bottomData.data)
    const [fill, stroke] = pickTextColor(meanLuma)

    ctx.font = `bold ${fontPx}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const maxW = width * 0.85
    const truncated = truncateText(ctx, coverText, maxW)

    ctx.strokeStyle = stroke
    ctx.lineWidth = 2
    ctx.strokeText(truncated, width / 2, height - fontPx * 0.5)
    ctx.fillStyle = fill
    ctx.fillText(truncated, width / 2, height - fontPx * 0.5)
  }

  return out
}

export function pickTextColor(meanLuma: number): [fill: string, stroke: string] {
  return meanLuma >= 0.55 ? ['#000000', '#ffffff'] : ['#ffffff', '#000000']
}
```

### Anti-Patterns to Avoid

- **FaceMesh as a class with `send()` in a for-loop without await**: The MediaPipe legacy API fires `onResults` asynchronously after `send()`. Calling `send()` in a tight loop without awaiting the previous result causes result cross-talk between frames. Must serialize per-frame calls with a promisified wrapper.
- **Reading getImageData in happy-dom without mock**: happy-dom `getImageData` returns zeros or throws. Predictor unit tests must supply synthetic `Uint8ClampedArray` data directly and never call `ctx.getImageData()` in the unit project.
- **Running FaceMesh in browser-mode tests on fixture videos**: FaceMesh WASM init takes 5–15 seconds. The calibration test (`cover.calibration.test.ts`) in browser mode is the only test that touches the real FaceMesh; predictor unit tests mock the landmark output.
- **tf.tidy() around async FaceMesh calls**: FaceMesh (`@mediapipe/face_mesh`) is not a TF.js model — it manages its own internal WASM memory. Do NOT wrap its calls in `tf.tidy()`. STATE.md confirms `tf.tidy()` does not work with async anyway.
- **Placing `getFaceMeshDetector()` in engine.ts warmup array without D-04 decision review**: D-04 locks this — add to the `Promise.allSettled` at engine.ts:674.
- **Rendering cover_text via DOM overlay (`position: absolute` over `<img>`)**: D-12 locks canvas-only rendering. DOM overlay would not be WYSIWYG with the download.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Iris landmark detection | Custom eye-tracking heuristics | `@mediapipe/face_mesh` + `refineLandmarks: true` | 10 iris points already computed by the model; indices 468–477 are the authoritative centroid data |
| Laplacian kernel convolution | FFT-based blur detector | 3×3 Laplacian on `Uint8ClampedArray` + variance | Laplacian variance is O(WH), sufficient for 256×256 downsamples, and deterministic |
| PNG download | Server-side image generation | `canvas.toBlob('image/png')` + `URL.createObjectURL` + `<a download>` | Zero network round-trip; guaranteed availability; no server cost |
| Text truncation | Full text layout engine | `ctx.measureText()` + binary-search or character-drop loop | Canvas text metrics are sufficient for single-line truncation with ellipsis |

**Key insight:** Every visual predictor is solvable with BT.601 luma math on a `Uint8ClampedArray` — the hard part is choosing threshold constants, not the algorithm.

---

## Runtime State Inventory

Not applicable — this is a greenfield frontend feature with no rename/refactor operations. No stored data, live service config, OS-registered state, secrets, or build artifacts are affected.

---

## Common Pitfalls

### Pitfall 1: FaceMesh `onResults` fires for every `send()` call — results can cross-talk across frames

**What goes wrong:** If you call `mesh.send({ image: canvas })` for frame i then immediately for frame i+1, the `onResults` callback registered before the loop receives BOTH results out of order.

**Why it happens:** `@mediapipe/face_mesh` v0.4 processes frames asynchronously in a WASM worker. The callback fires on the main thread when each frame completes.

**How to avoid:** Promisify each `send()` call by registering a single-use `onResults` listener that resolves and then clears itself. Process frames sequentially with `for...of await`. See Pattern 2 `estimateIrisLandmarks` example above.

**Warning signs:** Eye-contact scores jumping by ±50 between adjacent frames in a static video.

### Pitfall 2: `@mediapipe/face_mesh` needs `optimizeDeps.exclude` in Vite

**What goes wrong:** Vite's ESBuild pre-bundler cannot handle WASM-adjacent packages like `@mediapipe/face_mesh`. Dev server throws "Could not resolve .wasm import" or similar.

**Why it happens:** Same root cause as `@ffmpeg/core` — ESBuild strips WASM import paths.

**How to avoid:** Add `'@mediapipe/face_mesh'` to `optimizeDeps.exclude` in `vite.config.ts` alongside the existing `@ffmpeg/ffmpeg` and `@ffmpeg/core` entries. [VERIFIED: codebase read of vite.config.ts + search results confirming pattern]

```typescript
// vite.config.ts — existing:
optimizeDeps: {
  exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core'],
}
// Add:
optimizeDeps: {
  exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core', '@mediapipe/face_mesh'],
}
```

**Warning signs:** Vite dev server fails to start or throws ESBuild transform errors after `npm install @mediapipe/face_mesh`.

### Pitfall 3: FaceMesh `refineLandmarks: true` required — without it iris indices 468–477 are absent

**What goes wrong:** Without `refineLandmarks: true`, FaceMesh produces only 468 landmarks. Accessing `landmarks[468]` returns `undefined`. The eye-contact predictor silently returns 0 or throws.

**Why it happens:** The iris detection sub-model (FaceMesh Attention) is optional and requires explicit opt-in. D-06 locks this to `true`.

**How to avoid:** `mesh.setOptions({ refineLandmarks: true })`. Assert `landmarks.length >= 478` before accessing iris indices.

**Warning signs:** `scoreEyeContact` always returns 0 even on videos with clear eye contact.

### Pitfall 4: happy-dom `getImageData` returns zeros or throws

**What goes wrong:** Running predictor unit tests in the `unit` vitest project (happy-dom environment) and calling `ctx.getImageData()` on a canvas that `drawImage(video)` was called on returns `Uint8ClampedArray` filled with zeros because happy-dom does not simulate hardware canvas pixel pipeline.

**Why it happens:** happy-dom is a lightweight DOM implementation; it does not emulate GPU compositing.

**How to avoid:** Write all five canvas-based predictors as pure functions accepting `Uint8ClampedArray` + dimensions. Unit tests create synthetic `ImageData` via `new ImageData(data, w, h)` or hand-crafted `Uint8ClampedArray`. The canvas adapter is only used in production and in browser-mode calibration tests.

**Warning signs:** All predictor scores return exactly 0 in unit tests even for non-uniform synthetic data.

### Pitfall 5: Laplacian variance scale — raw variance values are very small for normalized luma

**What goes wrong:** After normalizing luma to [0,1], Laplacian variance values for a "sharp" frame are approximately 0.001–0.02. Setting the HIGH threshold too low (e.g. 0.001) makes every frame score 100; too high (e.g. 1.0) makes every frame score 0.

**Why it happens:** BT.601 normalization divides pixel values by 255, collapsing the range. Laplacian values of neighboring pixels that differ by 1/255 produce very small second-derivative values.

**How to avoid:** The SPEC specifies LOW=0.001, HIGH=0.02 as starting thresholds (D-07 says to tune via calibration test). The `cover.calibration.test.ts` fixture sweep logs raw variance values to stdout. Operator reviews and adjusts `COVER_THRESHOLDS` if needed.

**Warning signs:** All 10 frames score either 0 or 100 on motionBlur for any video.

### Pitfall 6: `canvas.toBlob()` is async and fires a callback, not a Promise

**What goes wrong:** `canvas.toBlob(callback, type)` is callback-based. Calling it and immediately triggering a download before the blob is ready results in a null or 0-byte file.

**Why it happens:** Browser spec: `toBlob` is asynchronous and calls the callback on the next event loop.

**How to avoid:** Promisify it: `const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'))`.

### Pitfall 7: FaceDetector bbox shape vs FaceMesh landmark shape — two different APIs

**What goes wrong:** The existing `detectFacesAcrossFrames` uses `@tensorflow-models/face-detection` which returns `face.box: { xMin, yMin, width, height }`. The FaceMesh model returns normalized landmark coordinates (0–1 range). Mixing these coordinate spaces when computing `scoreEyeContact` produces nonsense.

**Why it happens:** Two different library APIs produce different coordinate conventions.

**How to avoid:** `scoreFaceOn` and `scoreRuleOfThirds` use the face-detection `box` in pixel space. `scoreEyeContact` uses FaceMesh landmarks normalized to [0,1] range multiplied by frame dimensions to convert to pixel space. Document the coordinate system of every function argument explicitly.

---

## Code Examples

### Full `detectFacesAcrossFrames` Refactor

```typescript
// Source: engine.ts:503–523 [VERIFIED: codebase read] — refactored to also return perFrame
import type { Face } from '@tensorflow-models/face-detection'

interface FaceAggregateResult {
  faceCount: number
  faceConfidence: number
  perFrame: Face[][]   // NEW: per-frame face detection results
}

async function detectFacesAcrossFrames(
  frames: HTMLCanvasElement[],
): Promise<FaceAggregateResult> {
  const detector = await getFaceDetector()
  if (!detector || frames.length === 0) {
    return { faceCount: 0, faceConfidence: 0, perFrame: [] }
  }
  let maxFaces = 0
  let totalConf = 0
  let confCount = 0
  const perFrame: Face[][] = []
  for (const canvas of frames) {
    try {
      const result = await detector.estimateFaces(canvas)
      perFrame.push(result)
      if (result.length > maxFaces) maxFaces = result.length
      for (const face of result) {
        const score = (face as { score?: number[] }).score?.[0] ?? 0
        totalConf += score
        confCount++
      }
    } catch {
      perFrame.push([])
    }
  }
  return {
    faceCount: maxFaces,
    faceConfidence: confCount > 0 ? totalConf / confCount : 0,
    perFrame,
  }
}
```

### `COVER_THRESHOLDS` Constant (D-08)

```typescript
// Source: engine.ts:557–561 [VERIFIED: codebase read] — mirrors AUDIO_THRESHOLDS pattern
export const COVER_THRESHOLDS = {
  CONTRAST_STDEV_LOW: 0.08,       // luma stdev mapped to score 0
  CONTRAST_STDEV_HIGH: 0.25,      // luma stdev mapped to score 100
  FACE_AREA_MIN: 0.08,            // face bbox area / frame area threshold for faceOn=100
  EYE_CONTACT_BAND: 0.15,         // iris centroid must be within ±15% of face width from center
  MOTION_BLUR_LAPLACIAN_LOW: 0.001, // Laplacian variance → score 0 (blurry) [ASSUMED — calibrate]
  MOTION_BLUR_LAPLACIAN_HIGH: 0.02, // Laplacian variance → score 100 (sharp) [ASSUMED — calibrate]
  TEXT_ZONE_VARIANCE_HIGH: 0.05,  // row-luma variance → score 0 (non-uniform) [ASSUMED — calibrate]
} as const
```

### `CoverFrameScore` Interface (types.ts extension)

```typescript
// Source: types.ts:47–66 [VERIFIED: codebase read] — extension point
export interface CoverFrameBreakdown {
  faceOn: number       // [0,100]
  ruleOfThirds: number // [0,100]
  contrast: number     // [0,100]
  textZone: number     // [0,100]
  motionBlur: number   // [0,100]
  eyeContact: number   // [0,100]
}

export interface CoverFrameScore {
  frameIndex: number        // 0-based
  score: number             // round(mean of 6 breakdown values), integer in [0,100]
  breakdown: CoverFrameBreakdown
  badges: string[]          // top-2 predictor labels, e.g. ['High contrast', 'Face center']
}

// In EngineSignals interface (add after `brightnessScore`):
// coverFrameScores: CoverFrameScore[]
```

### Download Button Pattern (COVER-06)

```typescript
// Source: [ASSUMED] — standard Web API pattern
const DOWNLOAD_SIZES = [
  { label: 'YouTube 1280×720', platform: 'youtube', width: 1280, height: 720 },
  { label: 'Instagram 1080×1080', platform: 'instagram', width: 1080, height: 1080 },
  { label: 'Story / TikTok 1080×1920', platform: 'story', width: 1080, height: 1920 },
  { label: 'Facebook 1280×720', platform: 'facebook', width: 1280, height: 720 },
] as const

async function handleDownload(
  sourceCanvas: HTMLCanvasElement,
  coverText: string,
  platform: string,
  width: number,
  height: number,
  videoBaseName: string,
): Promise<void> {
  const out = renderCoverPng(sourceCanvas, coverText, { width, height })
  const blob = await new Promise<Blob>((resolve) =>
    out.toBlob((b) => resolve(b!), 'image/png'),
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cover-${platform}-${videoBaseName}-${Date.now()}.png`
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MediaPipe Face Mesh as standalone WASM (pre-2021) | Legacy Solutions API: `@mediapipe/face_mesh` package with CDN `locateFile` pattern | 2021 | Package now installed from npm; WASM assets served from CDN |
| `@tensorflow-models/face-landmarks-detection` with `runtime: 'tfjs'` | `runtime: 'mediapipe'` with `solutionPath` CDN | 2021+ | MediaPipe runtime is faster and more accurate for face mesh |
| MediaPipe Tasks API (`@mediapipe/tasks-vision`) | Still current — newer API, different shape | 2023 | `tasks-vision@0.10.35` is already installed but uses different FaceLandmarker API; D-06 locks the legacy `face_mesh` approach |

**Deprecated/outdated:**
- `faceMesh.setOptions({ predictIrises: true })`: This is the OLD `@tensorflow-models/face-landmarks-detection` v1 API. The current `@mediapipe/face_mesh` package uses `refineLandmarks: true` in `setOptions()`. Do not confuse them.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Laplacian variance thresholds LOW=0.001, HIGH=0.02 produce useful [0,100] mapping on typical video frames | COVER_THRESHOLDS / Pitfall 5 | All frames score 0 or 100 — operator adjusts constants in calibration step per D-07 |
| A2 | TEXT_ZONE_VARIANCE_HIGH=0.05 row-luma variance is the right scale for distinguishing uniform vs complex zones | Code Examples | Text zone scores wrong — same calibration safety valve |
| A3 | `@mediapipe/face_mesh` FaceMesh promises-over-callbacks pattern (promisify `send()` + `onResults()`) works correctly when called sequentially per frame | Pattern 2 | Cross-talk between frames; resolve via test against `with-face.mp4` fixture |
| A4 | `@mediapipe/tasks-vision` (already installed at 0.10.35) cannot be substituted for `@mediapipe/face_mesh` without API rework | Standard Stack Alternatives | Could reduce dependency count by 1 — but D-06 locks the `face_mesh` approach |
| A5 | `vitest` `unit` project (happy-dom) supports `new ImageData(data, w, h)` constructor for synthetic test data | Pitfall 4 | Tests require switching to browser-mode project if ImageData constructor is also unsupported |
| A6 | face-detection `Face.box` shape is `{ xMin, yMin, width, height }` in pixel coordinates for the `scoreFaceOn` and `scoreRuleOfThirds` predictors | Code Examples / Pitfall 7 | Coordinates wrong — verify against `@tensorflow-models/face-detection@1.0.3` type definitions |

---

## Open Questions

1. **`@mediapipe/tasks-vision` as substitute for `@mediapipe/face_mesh`**
   - What we know: `tasks-vision@0.10.35` is already installed. It has a `FaceLandmarker` that produces landmarks including iris positions.
   - What's unclear: Whether the tasks-vision `FaceLandmarker` produces the same 478-point mesh with iris at indices 468–477, or whether it has a different ordering. Also, D-06 explicitly locks the `face_mesh` legacy approach.
   - Recommendation: Accept D-06. Install `@mediapipe/face_mesh`. If future phases consolidate, migrate to tasks-vision then.

2. **FaceMesh singleton location — `cover.ts` vs `engine.ts`**
   - What we know: CONTEXT.md discretion area says "prefer cover.ts for cohesion — only cover scoring uses it."
   - What's unclear: Whether the D-04 requirement to add to `analyse()` warmup `Promise.allSettled` array is easier to implement if the singleton lives in `engine.ts` (co-located with warmup).
   - Recommendation: Place `getFaceMeshDetector()` in `cover.ts`; import and call it from the warmup array in `engine.ts`. This is a clean cross-module import with no circular dependency risk (engine.ts already imports from types.ts).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@mediapipe/face_mesh` (npm) | Eye-contact predictor | Not yet installed | 0.4.1633559619 (latest) | None — install required |
| `@mediapipe/face_detection` | Existing face detection | ✓ | 0.4.1646425229 | — |
| `@mediapipe/tasks-vision` | — | ✓ (not used in this phase) | 0.10.35 | — |
| Canvas 2D API | All predictors + compositing | ✓ (browser built-in) | — | — |
| jsdelivr CDN | FaceMesh WASM assets | ✓ (verified for face-detection) | — | Serve locally from public/ if CDN unreliable |
| Fixture: `with-face.mp4` | Calibration test | ✓ | — | — |
| Fixture: `no-face.mp4` | No-face degradation test | ✓ | — | — |

**Missing dependencies with no fallback:**
- `@mediapipe/face_mesh` — must be installed before Wave 1 begins.

**Missing dependencies with fallback:**
- jsdelivr CDN for WASM: fallback is copy assets to `frontend/public/mediapipe/face_mesh/` and use `locateFile: (file) => /mediapipe/face_mesh/${file}`. Only needed if CDN is blocked in target deployment environment.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `npm run test:run -- src/lib/cover.test.ts src/components/CoverFramePanel.test.tsx` |
| Full suite command | `npm run test:run` |
| Browser-mode command | `npm run test:browser -- src/lib/cover.calibration.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COVER-01 | `analyse()` returns `coverFrameScores` with 10 elements | unit (browser) | `npm run test:browser -- src/lib/engine.test.ts` | ❌ Wave 0 |
| COVER-02a | `scoreFaceOnFromData` returns 0 for empty bbox, 100 for large face | unit (happy-dom) | `npm run test:run -- src/lib/cover.test.ts` | ❌ Wave 0 |
| COVER-02b | `scoreRuleOfThirds` returns 100 for centroid at power point | unit (happy-dom) | `npm run test:run -- src/lib/cover.test.ts` | ❌ Wave 0 |
| COVER-02c | `scoreContrastFromData` returns 0 for solid color, ~100 for checkerboard | unit (happy-dom) | `npm run test:run -- src/lib/cover.test.ts` | ❌ Wave 0 |
| COVER-02d | `scoreTextZoneFromData` returns high score for uniform-luma band | unit (happy-dom) | `npm run test:run -- src/lib/cover.test.ts` | ❌ Wave 0 |
| COVER-02e | `scoreMotionBlurFromData` returns 0 for solid color, high for sharp edge data | unit (happy-dom) | `npm run test:run -- src/lib/cover.test.ts` | ❌ Wave 0 |
| COVER-02f | `scoreEyeContact` returns 100 when iris centroid at face center, 0 at 3× band | unit (happy-dom) | `npm run test:run -- src/lib/cover.test.ts` | ❌ Wave 0 |
| COVER-03 | `score === round(mean(breakdown values))` for 3+ fabricated inputs | unit (happy-dom) | `npm run test:run -- src/lib/cover.test.ts` | ❌ Wave 0 |
| COVER-04 | CoverFramePanel renders top-3 sorted desc, expand toggle shows frames 4–10 | unit (happy-dom) | `npm run test:run -- src/components/CoverFramePanel.test.tsx` | ❌ Wave 0 |
| COVER-04 | Top-2 badge labels for highest-scoring frame are rendered | unit (happy-dom) | `npm run test:run -- src/components/CoverFramePanel.test.tsx` | ❌ Wave 0 |
| COVER-05 | `cover_text` string appears in preview DOM; empty cover_text → no text node rendered | unit (happy-dom) | `npm run test:run -- src/components/CoverFramePanel.test.tsx` | ❌ Wave 0 |
| COVER-07 | `pickTextColor(0.2)` → `['#ffffff','#000000']`; `pickTextColor(0.8)` → `['#000000','#ffffff']` | unit (happy-dom) | `npm run test:run -- src/lib/cover.test.ts` | ❌ Wave 0 |
| COVER-08 | With empty face results, panel renders "No faces detected" note without throw | unit (happy-dom) | `npm run test:run -- src/components/CoverFramePanel.test.tsx` | ❌ Wave 0 |
| COVER-09 | Same synthetic canvas array → identical `JSON.stringify(coverFrameScores)` on two runs | unit (happy-dom) | `npm run test:run -- src/lib/cover.test.ts` | ❌ Wave 0 |
| COVER-10 | GeneratorPage renders CoverFramePanel between ScorePanel and PlatformCardGrid | unit (happy-dom) | `npm run test:run -- src/pages/GeneratorPage.test.tsx` | see existing |
| COVER-06 + smoke | Four PNG files at 1280×720, 1080×1080, 1080×1920, 1280×720 produced | manual smoke | 12-SUMMARY.md | ❌ Wave 0 |
| COVER-02 calibration | Per-frame score breakdowns logged for 5 fixtures | browser calibration | `npm run test:browser -- src/lib/cover.calibration.test.ts` | ❌ Wave 0 |

### Synthetic Canvas Input Strategy

happy-dom does not support canvas pixel rendering, so all predictor unit tests bypass the canvas adapter:

```typescript
// Pattern: create synthetic ImageData directly
function solidColorData(w: number, h: number, r: number, g: number, b: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = 255
  }
  return data
}

// Solid black → luma stdev 0 → contrast score 0
it('solid black canvas → contrast score 0', () => {
  const d = solidColorData(128, 128, 0, 0, 0)
  expect(scoreContrastFromData(d, 128, 128)).toBe(0)
})

// Checkerboard (alternating 0/255) → max stdev → contrast score 100
it('full checkerboard → contrast score 100', () => {
  const d = new Uint8ClampedArray(128 * 128 * 4)
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const v = (x + y) % 2 === 0 ? 255 : 0
    const i = (y * 128 + x) * 4
    d[i] = v; d[i+1] = v; d[i+2] = v; d[i+3] = 255
  }
  expect(scoreContrastFromData(d, 128, 128)).toBe(100)
})
```

### Manual Smoke Test Requirements

Required in 12-SUMMARY.md before `/gsd-verify-work 12`:

1. Upload `with-face.mp4` → analysis completes → CoverFramePanel appears below ScorePanel
2. Top-3 carousel visible; frame thumbnails rendered; #1 has highest score
3. Expand "Show all 10" reveals 7 additional frames
4. Click "YouTube 1280×720" → PNG file downloaded → verify dimensions via image viewer
5. Click "Instagram 1080×1080" → PNG file downloaded → verify dimensions
6. Click "Story / TikTok 1080×1920" → PNG downloaded → verify dimensions
7. Click "Facebook 1280×720" → PNG downloaded → verify dimensions
8. Overlay text visible on PNG if `cover_text` present
9. Upload `no-face.mp4` → panel renders with "No faces detected" note; top-3 still shows

### Sampling Rate

- **Per task commit:** `npm run test:run -- src/lib/cover.test.ts`
- **Per wave merge:** `npm run test:run` (full Vitest suite, ~206+ tests)
- **Phase gate:** Full suite green before `/gsd-verify-work 12`

### Wave 0 Gaps

- [ ] `frontend/src/lib/cover.test.ts` — unit tests for all 6 predictors + mean formula + determinism + pickTextColor
- [ ] `frontend/src/components/CoverFramePanel.test.tsx` — render tests (happy-dom)
- [ ] `frontend/src/lib/cover.calibration.test.ts` — fixture sweep (browser mode)
- [ ] Engine test stub for COVER-01 (analyse() returns coverFrameScores) — may extend existing engine.test.ts

---

## Security Domain

> `security_enforcement` is not explicitly set to `false` in `.planning/config.json` — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not applicable — no auth changes |
| V3 Session Management | No | Not applicable |
| V4 Access Control | No | Not applicable |
| V5 Input Validation | Yes | `coverText` string must be treated as untrusted input when rendered onto canvas — use `ctx.fillText()` (auto-escaped by canvas API, not `innerHTML`) |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for Canvas Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via cover_text | Spoofing/Tampering | Canvas `fillText()` is immune to HTML injection — text is rasterized as pixels, not interpreted as markup. No additional sanitization needed for canvas-rendered strings. |
| Canvas fingerprinting via `toDataURL` | Information Disclosure | Phase 12 canvases are derived from the user's own video. No cross-origin content is drawn into the canvas. `crossOrigin = 'anonymous'` already set on the video element in extractFramesViaVideo (engine.ts:300). |
| Blob URL leak | Tampering | All `URL.createObjectURL()` calls must be followed by `URL.revokeObjectURL()` after the download is triggered. See Pattern in Download Button code example. |

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/lib/engine.ts` — codebase read: lines 503–523 (`detectFacesAcrossFrames`), lines 557–561 (`AUDIO_THRESHOLDS`), lines 638–657 (BT.601 luma formula), lines 674 (warmup allSettled), lines 74–95 (`getFaceDetector` singleton pattern)
- `frontend/src/lib/types.ts` — codebase read: lines 47–66 (`EngineSignals`), line 118 (`InstagramOutput.cover_text`)
- `frontend/vite.config.ts` — codebase read: `optimizeDeps.exclude` pattern
- `frontend/vitest.config.ts` — codebase read: dual-project structure (unit=happy-dom, browser=Playwright)
- `.planning/phases/12-cover-frame-scoring/12-SPEC.md` — locked COVER-01..COVER-10 requirements + predictor formulas
- `.planning/phases/12-cover-frame-scoring/12-CONTEXT.md` — locked decisions D-01..D-12
- `cdn.jsdelivr.net/npm/@mediapipe/face_mesh/index.d.ts` — TypeScript definitions: `Options.refineLandmarks`, `Results.multiFaceLandmarks`
- `npm view @mediapipe/face_mesh` — version 0.4.1633559619, latest dist-tag [VERIFIED 2026-05-16]
- `npm view @tensorflow-models/face-landmarks-detection` — version 1.0.6, peer dep `@mediapipe/face_mesh: ~0.4.0` [VERIFIED 2026-05-16]
- `frontend/package.json` — installed dependencies [VERIFIED: codebase read]

### Secondary (MEDIUM confidence)
- [mediapipe.readthedocs.io — Face Mesh solution](https://mediapipe.readthedocs.io/en/latest/solutions/face_mesh.html) — iris landmark indices 468–477 when `refineLandmarks: true`
- [Revolut Tech Medium — Canvas Blur Detection](https://medium.com/revolut/canvas-based-javascript-blur-detection-b92ab1075acf) — Laplacian kernel `[0,1,0,1,-4,1,0,1,0]`, BT.601 grayscale, variance formula
- [TF.js face-landmarks-detection README](https://github.com/tensorflow/tfjs-models/blob/master/face-landmarks-detection/README.md) — estimateFaces API, keypoint structure

### Tertiary (LOW confidence)
- [Laplacian variance threshold calibration for normalized luma](https://medium.com/@sagardhungel/laplacian-and-its-use-in-blur-detection-fbac689f0f88) — general guidance; thresholds marked ASSUMED, require calibration against real fixtures
- Row-luma variance as text-zone score — standard image processing principle; specific threshold values ASSUMED, require calibration

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry confirmed, existing package.json verified
- Predictor algorithms: HIGH (formulas) / MEDIUM (thresholds) — formulas from SPEC; thresholds from first-principles with calibration safety valve (D-07)
- FaceMesh API shape: MEDIUM — TypeScript definitions verified, callback pattern confirmed, sequential-frame behavior ASSUMED
- Architecture: HIGH — all integration points verified against actual codebase

**Research date:** 2026-05-16
**Valid until:** 2026-06-16 (30 days — MediaPipe stable; no active development on legacy Solutions API)
