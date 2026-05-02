# Phase 3: Video Upload + Analysis Engine - Research

**Researched:** 2026-05-02
**Domain:** In-browser video analysis (ffmpeg.wasm + TensorFlow.js + MediaPipe + Web Audio + Canvas)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Upload UX
- **D-01:** Upload zone is a contained dropzone card on GeneratorPage (not full-page overlay). After file selection, the same card morphs into preview + analysis-result panel. Single screen, single state machine.
- **D-02:** Both drag-drop and file picker entry points (UPLOAD-01). Drag overlay highlights when file is over dropzone.
- **D-03:** 200 MB warning is a non-blocking advisory banner that stays visible during analysis. 250 MB rejection is a blocking error with a "compress with HandBrake or CapCut" hint.
- **D-04:** Optional description textarea (UPLOAD-03) sits below the thumbnail/metadata strip. Empty by default with placeholder "Optional: brief description — helps AI when video is ambiguous". 2-line max (textarea `rows={2}` + soft 280-char limit).

#### Loading & Progress
- **D-05:** Two-phase indicator (ANALYSIS-08). Phase 1 = "Analysing video…" with rotating sub-labels: "Extracting metadata…" → "Extracting frames…" → "Detecting faces…" → "Computing audio energy…" → "Computing motion score…" → "Computing brightness…". Fade transitions, one step at a time. Phase 2 = "Generating copy…" (Phase 5 work).
- **D-06:** Determinate progress (percent) NOT required — step labels alone provide enough confidence. Avoid fake percent estimates.
- **D-07:** TF.js + MediaPipe model preload starts silently in the background as soon as user picks/drops a file. Visual cue ("Preparing models…") appears ONLY if user clicks Analyse before preload finished.

#### Cancellation & State
- **D-08:** Visible Cancel button next to spinner during analysis. Click → abort. ffmpeg.wasm has no graceful cancel API, so in-flight WASM calls run to completion in background but results discarded; UI returns immediately to pre-analysis state.
- **D-09:** Re-pick flow: when user drops/picks a new file *after* analysis completes, wipe results and reset to post-pick / pre-analysis state. No confirm modal.

#### Failure & Fallback UX
- **D-10:** Single inline error card replaces spinner on failure: human-readable cause + Retry button + "Skip analysis" link + collapsible "Tell me more" with raw error.
- **D-11:** WebAssembly absence (ANALYSIS-09) detected on mount via `typeof WebAssembly === 'undefined'`. Banner above upload card: "This browser can't run video analysis. You can still write copy from a description below." Analyse button hidden; description textarea enlarged (5 rows); "Generate Copy" button takes its place (Phase 5 wires).

#### Mobile Posture
- **D-12:** Desktop-first. Non-blocking advisory banner on viewports < 768 px or mobile UA: "Best on desktop — analysis uses significant memory and CPU." Don't block mobile flows; OOM handled by D-10 failure card path.
- **D-13:** Touch interactions: drag-drop is desktop-only; file picker is the only entry point on touch devices. Detect via `'ondragstart' in document.body` or pointer-type media query.

#### Engine Architecture
- **D-14:** `frontend/src/lib/engine.ts` is single orchestrator owning ffmpeg.wasm singleton, TF.js model handles, and analysis state machine. Exposes one async function `analyse(file: File, onProgress: (step: string) => void): Promise<EngineSignals>`. All raw API surfaces (ffmpeg, TF.js, Web Audio, Canvas) stay encapsulated inside engine.ts.
- **D-15:** `EngineSignals` TypeScript interface lives at `frontend/src/lib/types.ts`. Every Phase 4+ consumer imports from there.
- **D-16:** Tensor lifecycle: TF.js models receive HTML elements directly (`model.detect(canvasOrImg)`) — no manually created tensors. If unavoidable, dispose with `try { ... } finally { tensor.dispose() }` (NOT `tf.tidy` — async incompatible).
- **D-17:** ffprobe call always reads `meta.json` from virtual FS regardless of return code (ANALYSIS-10 / GitHub #817).
- **D-18:** Scene detection runs in a separate ffmpeg pass with `log` event listener; no scene-output file. Frame extraction runs in another pass writing JPEGs to virtual FS, read back as Uint8Arrays.

#### Persistence
- **D-19:** Analysis results live in React state during the session. No localStorage, no IndexedDB, no backend roundtrip. ANALYSIS-07 locks "no video file sent to any server during analysis phase".

### Claude's Discretion
- Component decomposition (`UploadDropzone`, `VideoPreview`, `AnalyseButton`, `AnalysisProgress`, `AnalysisError`) — planner decides
- Tailwind class structure — match existing GeneratorPage.tsx + SettingsPage.tsx patterns
- Error message copy — follow Phase 1's tone (LoginPage error styling)
- Beat detection library choice (`meyda` vs `music-tempo`) — researcher locks below
- Frame extraction interval (every Nth frame) — researcher picks below

### Deferred Ideas (OUT OF SCOPE)
- Bulk video processing (v2 backlog)
- Cloud-side analysis fallback for weak hardware (future phase if usage justifies)
- Resume in-flight analysis after page refresh (not worth IndexedDB complexity for v1)
- Real-time preview during analysis (frames as they're extracted) (defer to polish phase)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UPLOAD-01 | Drag-and-drop OR file picker, MP4/MOV, ≤250 MB hard, 200 MB warn | HTML5 `<input type="file" accept="video/mp4,video/quicktime">` + `dragover`/`drop` events; size check pre-load |
| UPLOAD-02 | Thumbnail + duration/resolution/aspect from HTML5 video element | `video.onloadedmetadata` exposes `videoWidth/videoHeight/duration`; canvas `drawImage(video, ...)` for thumbnail at `currentTime = duration*0.1` |
| UPLOAD-03 | Optional 2-line description textarea | Plain `<textarea rows={2}>` — no library |
| ANALYSIS-01 | ffmpeg.wasm metadata extraction (duration/res/fps/bitrate/audio/scene count) | `ffmpeg.ffprobe(['-v','quiet','-print_format','json','-show_streams','-o','meta.json','input.mp4'])` + read `meta.json` unconditionally (#817) |
| ANALYSIS-02 | 10 representative frames | `select='not(mod(n\,N))',scale=512:512` — N computed from total frames; output JPEGs to MEMFS, read as Uint8Array, base64-encode |
| ANALYSIS-03 | Scene detection from log stream | `ffmpeg.on('log', ...)` listener parsing `pts_time:` from `select=gt(scene\,0.4),showinfo -f null -` |
| ANALYSIS-04 | Face presence (MediaPipe), object labels (COCO-SSD), motion score | `faceDetection.createDetector(MediaPipeFaceDetector, {runtime:'mediapipe', solutionPath:'.../@mediapipe/face_detection'})` + `cocoSsd.load()` + bbox centroid delta |
| ANALYSIS-05 | Audio energy + beat presence + silence gaps | OfflineAudioContext → Meyda `extract(['energy','rms','spectralFlux'], buffer)`; silence: rms < threshold for ≥ minDuration |
| ANALYSIS-06 | Brightness (luma) via Canvas | `ctx.getImageData()` → average BT.601 luma per sampled pixels |
| ANALYSIS-07 | All in-browser, no video to server | Engine.ts pure client; only Supabase auth pings backend |
| ANALYSIS-08 | Two-phase loading indicator | React state machine; Phase 1 step labels rotate (D-05) |
| ANALYSIS-09 | Graceful WebAssembly absence | `typeof WebAssembly === 'undefined'` + `crossOriginIsolated` check |
| ANALYSIS-10 | ffprobe output read unconditionally | Confirmed via GitHub #817 (still open Jan 2025) |
</phase_requirements>

## Summary

Phase 3 builds a single-screen, in-browser video analysis pipeline orchestrated by `frontend/src/lib/engine.ts`. The pipeline composes five tools — **ffmpeg.wasm 0.12.15 single-thread** (metadata, scene cuts, frame extraction), **TensorFlow.js 4.22.0 + MediaPipe Face Detection 1.0.3** (face presence), **COCO-SSD 2.2.3** (object labels + motion score via centroid delta), **Meyda 5.6.3 on a OfflineAudioContext** (audio energy / beat / silence), and **Canvas 2D** (luma brightness) — into a single `EngineSignals` object that Phase 4 (score) and Phase 5 (AI prompt) consume.

The 13 known landmines from CLAUDE.md are pre-locked: ffmpeg single-thread only (`@ffmpeg/core` not `-mt`), `ffprobe` returns -1 even on success (read output unconditionally per GitHub #817 — issue is still **open** as of January 2025), scene detection is parsed from the **log stream** not a file, `tf.tidy()` is async-incompatible (use try/finally + tensor.dispose), MediaPipe `solutionPath` is mandatory, COOP/COEP `crossOriginIsolated` must be true at runtime (already wired in `vite.config.ts` via `configureServer` plugin from Phase 1).

**Primary recommendation:** Lock the stack as `@ffmpeg/ffmpeg@0.12.15` + `@ffmpeg/core@0.12.10` + `@ffmpeg/util@0.12.2` + `@tensorflow/tfjs@4.22.0` + `@tensorflow/tfjs-backend-webgl@4.22.0` + `@tensorflow-models/face-detection@1.0.3` + `@tensorflow-models/coco-ssd@2.2.3` + `@mediapipe/face_detection@~0.4.x` + `meyda@5.6.3`. Use `select='not(mod(n\,N))'` filter where `N = max(1, floor(totalFrames / 10))` for 10-frame extraction. Choose **Meyda over music-tempo** (richer feature set, actively maintained, native Web Audio integration, ~80kB gzipped).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File picker + drag-drop | Browser | — | UPLOAD-01 — pure DOM event handling |
| HTML5 `onloadedmetadata` thumbnail + duration/res/aspect | Browser | — | UPLOAD-02 — instant, no compute needed |
| ffmpeg.wasm metadata + frames + scene detection | Browser (WASM) | — | ANALYSIS-01–03,07 — required in-browser |
| TF.js face / object detection / motion | Browser (WebGL) | — | ANALYSIS-04 — required in-browser; webgl backend |
| Meyda audio energy / beat / silence | Browser (Web Audio) | — | ANALYSIS-05 — required in-browser |
| Canvas brightness (luma) | Browser (Canvas 2D) | — | ANALYSIS-06 — pure pixel math |
| EngineSignals storage during session | Browser (React state) | — | D-19 — no DB write Phase 3 |
| Auth gate on GeneratorPage | API/Backend | Browser (Supabase SDK) | Existing AUTH-02 — Phase 1 wired |
| Video upload to disk | API/Backend | — | Deferred to Phase 5/6 (post save) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @ffmpeg/ffmpeg | 0.12.15 | WASM ffmpeg orchestrator (load, exec, FS) | [VERIFIED: npm view, latest 2025-01-07] Industry standard; only mature WASM port of ffmpeg |
| @ffmpeg/core | 0.12.10 | Single-threaded WASM core (the .js + .wasm files) | [VERIFIED: npm] Single-thread mandatory — `-mt` fails on Chromium [CITED: CLAUDE.md] |
| @ffmpeg/util | 0.12.2 | `fetchFile` + `toBlobURL` helpers | [VERIFIED: npm] Companion package; `toBlobURL` bypasses CORS for cross-origin core load [CITED: ffmpegwasm.netlify.app/docs/getting-started/usage] |
| @tensorflow/tfjs | 4.22.0 | TF.js core + default backend bundle | [VERIFIED: npm view, current latest] |
| @tensorflow/tfjs-backend-webgl | 4.22.0 | WebGL backend (100× faster than CPU) | [VERIFIED: npm peerDependencies of face-detection — `^4.21.0` required] |
| @tensorflow-models/face-detection | 1.0.3 | MediaPipe + TF.js face detection wrapper | [VERIFIED: npm view] |
| @mediapipe/face_detection | ~0.4.1646425229 | MediaPipe solution files (with `solutionPath`) | [VERIFIED: peerDependencies of face-detection 1.0.3 specify `~0.4.0`] [CITED: tfjs-models/face-detection/src/mediapipe/detector.ts confirms `solutionPath` option exists] |
| @tensorflow-models/coco-ssd | 2.2.3 | Object detection (80 COCO classes) | [VERIFIED: npm view] |
| meyda | 5.6.3 | Web Audio feature extraction (energy, RMS, spectral flux) | [VERIFIED: npm view, latest stable; v6 still in beta] [CITED: meyda.js.org/audio-features] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tensorflow/tfjs-converter | 4.22.0 | Required peer dep for both face-detection + coco-ssd | Pulled by tfjs metapackage; explicit install only if tree-shaking |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| meyda | music-tempo | [VERIFIED: npm] music-tempo @1.0.3, last published 2017 — abandoned. Meyda has active maintenance, richer features (energy + RMS + spectralFlux all needed for Phase 4 score), built for OfflineAudioContext. **Choose Meyda.** |
| MediaPipe runtime | runtime: 'tfjs' | [CITED: github.com/tensorflow/tfjs-models/face-detection] `runtime: 'tfjs'` avoids the `solutionPath` dependency (no MediaPipe CDN load) but uses a heavier model and is generally slower. **Stay with `runtime: 'mediapipe'`** to match CLAUDE.md lock. |
| coco-ssd `lite_mobilenet_v2` (default) | mobilenet_v2 | [CITED: github.com/tensorflow/tfjs-models/coco-ssd] Default `lite_mobilenet_v2` is 2× faster, accuracy adequate for high-level labels (ANALYSIS-04 just needs presence + bbox for motion). **Stay with default.** |
| @vitest/browser | Plain Vitest with happy-dom | Browser mode runs in real Chromium via Playwright — only path to truly exercise ffmpeg.wasm + WebGL. happy-dom can't run WASM with SharedArrayBuffer. **Use `@vitest/browser` for engine.ts integration tests; happy-dom for component tests.** |

**Installation:**
```bash
npm install @ffmpeg/ffmpeg@0.12.15 @ffmpeg/core@0.12.10 @ffmpeg/util@0.12.2 \
  @tensorflow/tfjs@4.22.0 @tensorflow/tfjs-backend-webgl@4.22.0 \
  @tensorflow-models/face-detection@1.0.3 @tensorflow-models/coco-ssd@2.2.3 \
  @mediapipe/face_detection meyda@5.6.3

# Dev dependencies for engine integration tests
npm install -D @vitest/browser@4.1.5 vitest@4.1.5 playwright@1.59.1
```

**Version verification (run before locking PLAN versions):**
```bash
npm view @ffmpeg/ffmpeg version          # confirmed 0.12.15 (2025-01-07)
npm view @ffmpeg/core version            # confirmed 0.12.10 (2023-12-25)
npm view @tensorflow/tfjs version        # confirmed 4.22.0
npm view @tensorflow-models/face-detection version  # confirmed 1.0.3
npm view @tensorflow-models/coco-ssd version        # confirmed 2.2.3
npm view meyda version                   # confirmed 5.6.3
```

[VERIFIED: npm registry queried 2026-05-02]

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       GeneratorPage.tsx (UI)                              │
│   ┌────────────────┐    ┌──────────────────┐    ┌─────────────────────┐  │
│   │ UploadDropzone │ -> │ VideoPreview     │ -> │ AnalyseButton +     │  │
│   │ (drop/picker)  │    │ + Description    │    │ AnalysisProgress    │  │
│   └────────┬───────┘    └──────────────────┘    └──────────┬──────────┘  │
│            │ File                                            │            │
└────────────┼────────────────────────────────────────────────┼────────────┘
             ▼                                                ▼
   ┌─────────────────────┐                       ┌────────────────────────┐
   │ HTML5 video element │ ── duration/res ────► │   engine.ts orchestr.  │
   │ + canvas drawImage  │ ── thumbnail ──────►  │                        │
   └─────────────────────┘                       │  analyse(file,onStep): │
                                                 │   -> EngineSignals     │
                                                 └──────────┬─────────────┘
                                                            │
        ┌───────────────────────────────────────────────────┼─────────────────────────┐
        ▼                ▼                ▼                 ▼                ▼         ▼
  ┌──────────┐    ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌─────────┐  ┌──────┐
  │ ffmpeg.  │    │ TF.js +    │   │ TF.js +    │   │ Meyda on   │   │ Canvas  │  │Motion│
  │ wasm     │    │ MediaPipe  │   │ COCO-SSD   │   │ Offline    │   │ 2D      │  │score │
  │ singleton│    │ face       │   │ objects    │   │ AudioCtx   │   │ luma    │  │(bbox │
  │          │    │ detector   │   │ detector   │   │            │   │         │  │delta)│
  │ - probe  │    │            │   │            │   │ - energy   │   │ - 0..1  │  │      │
  │ - frames │    │ - faceCount│   │ - labels   │   │ - rms      │   │ score   │  │      │
  │ - scenes │    │ - confidence│  │ - bboxes   │   │ - silence  │   │         │  │      │
  └─────┬────┘    └──────┬─────┘   └──────┬─────┘   └─────┬──────┘   └────┬────┘  └───┬──┘
        │                │                │               │               │            │
        └────────────────┴────────────────┴───────────────┴───────────────┴────────────┘
                                              │
                                              ▼
                              ┌──────────────────────────────────┐
                              │ EngineSignals  (types.ts)        │
                              │  → React state in GeneratorPage  │
                              │  → consumed Phase 4 + Phase 5    │
                              └──────────────────────────────────┘
```

Data flow:
1. User drops/picks file → File object held in component state
2. HTML5 `<video src={URL.createObjectURL(file)}>` fires `onloadedmetadata` → instant duration/width/height/aspect (UPLOAD-02)
3. Canvas `drawImage(videoEl, ...)` at `currentTime = duration*0.1` produces thumbnail (UPLOAD-02)
4. **Background pre-warm** (D-07): `engine.warmup()` loads ffmpeg.wasm core + TF.js models in parallel — non-blocking
5. User clicks Analyse → `engine.analyse(file, onStep)` runs the pipeline sequentially with progress callbacks
6. Returns `EngineSignals` → stored in React state → Phase 4 (score) + Phase 5 (AI prompt) consume

### Recommended Project Structure

```
frontend/src/
├── pages/
│   └── GeneratorPage.tsx        # Phase 3 — fleshed out with upload + analyse UI
├── components/                   # NEW directory in Phase 3
│   ├── UploadDropzone.tsx       # Drag-drop + file picker; emits File
│   ├── VideoPreview.tsx          # Thumbnail + metadata + description textarea
│   ├── AnalyseButton.tsx         # Disabled until file picked; aria-busy during run
│   ├── AnalysisProgress.tsx      # Spinner + rotating step label + Cancel button
│   ├── AnalysisError.tsx         # Failure card (D-10) — Retry / Skip / Tell me more
│   └── WasmFallbackBanner.tsx    # ANALYSIS-09 banner + enlarged textarea
├── lib/
│   ├── engine.ts                 # NEW — single orchestrator (D-14)
│   ├── types.ts                  # ADD EngineSignals interface (D-15)
│   ├── supabase.ts               # existing
│   └── env.ts                    # existing
└── App.tsx                       # unchanged
```

### Pattern 1: ffmpeg.wasm Singleton with toBlobURL Loading

**What:** A single `FFmpeg` instance, loaded once at module init, reused across analyses.
**When to use:** Always — `new FFmpeg()` per analysis would re-download the .wasm core (~30 MB) every time.
**Source:** [CITED: ffmpegwasm.netlify.app/docs/getting-started/usage]

```typescript
// lib/engine.ts
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL, fetchFile } from '@ffmpeg/util'

let ffmpegInstance: FFmpeg | null = null
let ffmpegLoadPromise: Promise<FFmpeg> | null = null

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  if (ffmpegLoadPromise) return ffmpegLoadPromise

  ffmpegLoadPromise = (async () => {
    const ff = new FFmpeg()

    // Pin core version to avoid surprise upgrades
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd'
    await ff.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    ffmpegInstance = ff
    return ff
  })()

  return ffmpegLoadPromise
}
```

**Note on hosting the core files:** The CDN approach above is the simplest. To eliminate CDN dependency and improve cold-start, copy `ffmpeg-core.js` + `ffmpeg-core.wasm` from `node_modules/@ffmpeg/core/dist/umd/` to `frontend/public/ffmpeg/` and use `baseURL = '/ffmpeg'` (toBlobURL still required because of CORS-related browser checks even on same origin). Decision deferred to planner — start with CDN for plan simplicity, switch to local if first run is slow.

### Pattern 2: ffprobe with Bug #817 Workaround (ANALYSIS-10)

**What:** Always read the output file regardless of return code.
**When to use:** Every ffprobe call in the codebase.
**Source:** [CITED: github.com/ffmpegwasm/ffmpeg.wasm/issues/817 — open Jan 2025]

```typescript
async function probeVideo(ff: FFmpeg, fileBytes: Uint8Array): Promise<ProbeResult> {
  await ff.writeFile('input.mp4', fileBytes)
  // Return code is ignored — bug #817 returns -1 even on success
  await ff.ffprobe([
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    '-o', 'meta.json',         // -o flag is REQUIRED — see CLAUDE.md
    'input.mp4',
  ])
  // Read unconditionally — D-17, ANALYSIS-10
  const raw = await ff.readFile('meta.json', 'utf8')
  return JSON.parse(raw as string)
}
```

### Pattern 3: Scene Detection via Log Stream (ANALYSIS-03)

**What:** Attach a log listener BEFORE running exec; parse `pts_time:` from `showinfo` output.
**When to use:** Scene detection only — frame extraction has its own pass.
**Source:** [CITED: CLAUDE.md Phase 3 rules + ffmpeg.wasm docs `ffmpeg.on('log',...)`]

```typescript
async function detectScenes(ff: FFmpeg): Promise<number[]> {
  const sceneTimestamps: number[] = []

  const onLog = ({ message }: { message: string }) => {
    // showinfo emits e.g.: "[Parsed_showinfo_1 @ 0x...] n:0 pts:... pts_time:1.234 ..."
    const m = message.match(/pts_time:([0-9.]+)/)
    if (m) sceneTimestamps.push(parseFloat(m[1]))
  }
  ff.on('log', onLog)

  try {
    // Pipe to null sink; we only care about log output
    await ff.exec([
      '-i', 'input.mp4',
      '-filter:v', "select='gt(scene,0.4)',showinfo",
      '-f', 'null',
      '-',
    ])
  } finally {
    ff.off('log', onLog) // Detach to avoid leaking listeners across analyses
  }

  return sceneTimestamps
}
```

### Pattern 4: Frame Extraction (ANALYSIS-02)

**What:** Compute interval N from total frames so output is ~10 frames; write JPEGs to MEMFS, read back as base64.
**Source:** [CITED: ffmpeg select filter docs]

```typescript
async function extractFrames(
  ff: FFmpeg,
  totalFrames: number,
  fps: number,
): Promise<string[]> {
  // Aim for ~10 frames spaced evenly across the video
  // For a 30s @ 30fps video: totalFrames = 900 → N = 90 → 10 frames
  // For a 15s @ 30fps reel: totalFrames = 450 → N = 45 → 10 frames
  // For a 90s @ 30fps reel: totalFrames = 2700 → N = 270 → 10 frames
  const N = Math.max(1, Math.floor(totalFrames / 10))

  await ff.exec([
    '-i', 'input.mp4',
    '-vf', `select='not(mod(n\\,${N}))',scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2`,
    '-vsync', 'vfr',
    '-q:v', '5',                  // JPEG quality 1-31, 5 is good balance
    'frame_%03d.jpg',
  ])

  const frames: string[] = []
  // ffmpeg's select filter may emit slightly more or fewer than 10 — read until ENOENT
  for (let i = 1; i <= 15; i++) {
    const name = `frame_${String(i).padStart(3, '0')}.jpg`
    try {
      const data = (await ff.readFile(name)) as Uint8Array
      frames.push(`data:image/jpeg;base64,${uint8ToBase64(data)}`)
      await ff.deleteFile(name)
    } catch {
      break
    }
  }
  return frames.slice(0, 10)
}
```

**Frame count justification:** N = floor(totalFrames / 10) is the simplest deterministic formula. For typical 15-90s vertical reels, totalFrames is 450-2700 (at 30fps), yielding ~10 frames consistently. Edge case: 5-second video at 30fps → totalFrames = 150, N = 15 → 10 frames (still correct). Frames < 10 only happens if totalFrames < 10 (impossible for real video).

### Pattern 5: TF.js + MediaPipe Face Detection with Element-Passing (D-16)

**What:** Pass HTML elements directly; never create manual tensors. Use `try/finally` for any unavoidable manual disposal.
**Source:** [CITED: github.com/tensorflow/tfjs-models/face-detection/src/mediapipe/detector.ts]

```typescript
import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgl'
import * as faceDetection from '@tensorflow-models/face-detection'

let faceDetector: faceDetection.FaceDetector | null = null

async function getFaceDetector() {
  if (faceDetector) return faceDetector

  await tf.setBackend('webgl')
  await tf.ready()

  faceDetector = await faceDetection.createDetector(
    faceDetection.SupportedModels.MediaPipeFaceDetector,
    {
      runtime: 'mediapipe',
      // MANDATORY — omitting causes silent init failure (CLAUDE.md)
      solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection',
      modelType: 'short',  // 'short' = best for ≤2m subjects; 'full' = up to 5m
    },
  )
  return faceDetector
}

async function detectFaces(canvas: HTMLCanvasElement) {
  const det = await getFaceDetector()
  // Pass element directly — model manages tensors internally
  const faces = await det.estimateFaces(canvas)
  return faces  // Array of { box: { xMin, yMin, width, height }, keypoints }
}
```

### Pattern 6: COCO-SSD Object Detection + Motion Score

**Source:** [CITED: github.com/tensorflow/tfjs-models/coco-ssd]

```typescript
import * as cocoSsd from '@tensorflow-models/coco-ssd'

let cocoDetector: cocoSsd.ObjectDetection | null = null

async function getCocoDetector() {
  if (cocoDetector) return cocoDetector
  cocoDetector = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
  return cocoDetector
}

async function computeMotionAndLabels(frames: HTMLCanvasElement[]) {
  const det = await getCocoDetector()
  const labelSet = new Set<string>()
  const centroids: Array<{ x: number; y: number } | null> = []

  for (const c of frames) {
    // detect(canvas, maxBoxes, minScore)
    const preds = await det.detect(c, 5, 0.5)
    preds.forEach(p => labelSet.add(p.class))
    if (preds.length === 0) {
      centroids.push(null)
      continue
    }
    // Use largest-area bbox as the primary subject
    const top = preds.sort((a, b) => b.bbox[2] * b.bbox[3] - a.bbox[2] * a.bbox[3])[0]
    const [x, y, w, h] = top.bbox
    centroids.push({ x: (x + w / 2) / c.width, y: (y + h / 2) / c.height })
  }

  // Motion = mean Euclidean distance of consecutive centroids, normalised 0..1
  let total = 0
  let pairs = 0
  for (let i = 1; i < centroids.length; i++) {
    const a = centroids[i - 1]
    const b = centroids[i]
    if (!a || !b) continue
    total += Math.hypot(a.x - b.x, a.y - b.y)
    pairs++
  }
  const motionScore = pairs === 0 ? 0 : Math.min(1, total / pairs * 4)
  return { objectLabels: Array.from(labelSet), motionScore }
}
```

**Edge cases handled:**
- No objects detected in a frame → centroid `null`, skipped in delta sum
- Single frame analyzed → `pairs = 0` → motionScore = 0 (graceful)
- All frames empty → motionScore = 0

### Pattern 7: Audio Analysis via OfflineAudioContext + Meyda

**What:** Decode the audio track once into a Float32Array, then run Meyda extractors on overlapping windows. AnalyserNode is for real-time playback; **OfflineAudioContext** is correct for static analysis.
**Source:** [CITED: meyda.js.org + MDN OfflineAudioContext]

```typescript
import Meyda from 'meyda'

interface AudioSignals {
  audioEnergy: number       // 0..1 normalised
  beatPresent: boolean      // mean spectralFlux > threshold
  silenceGapsSec: number[]  // durations of contiguous low-RMS regions
  hasAudio: boolean
}

async function analyseAudio(file: File): Promise<AudioSignals> {
  const arrayBuf = await file.arrayBuffer()

  // Use OfflineAudioContext to decode audio at native sample rate
  const tmpCtx = new OfflineAudioContext(1, 1, 44100)
  let audioBuf: AudioBuffer
  try {
    audioBuf = await tmpCtx.decodeAudioData(arrayBuf.slice(0))  // slice — buffer is consumed
  } catch {
    return { audioEnergy: 0, beatPresent: false, silenceGapsSec: [], hasAudio: false }
  }

  if (audioBuf.numberOfChannels === 0) {
    return { audioEnergy: 0, beatPresent: false, silenceGapsSec: [], hasAudio: false }
  }

  const channelData = audioBuf.getChannelData(0)
  const sampleRate = audioBuf.sampleRate
  const bufferSize = 1024
  const energies: number[] = []
  const fluxes: number[] = []
  const rmsSeries: number[] = []

  for (let i = 0; i + bufferSize < channelData.length; i += bufferSize) {
    const window = channelData.slice(i, i + bufferSize)
    const features = Meyda.extract(['energy', 'rms', 'spectralFlux'], window) as
      | { energy: number; rms: number; spectralFlux: number }
      | null
    if (!features) continue
    energies.push(features.energy)
    rmsSeries.push(features.rms)
    fluxes.push(features.spectralFlux)
  }

  const meanEnergy = energies.reduce((a, b) => a + b, 0) / Math.max(1, energies.length)
  const audioEnergy = Math.min(1, meanEnergy / bufferSize)  // Meyda energy range 0..bufferSize
  const meanFlux = fluxes.reduce((a, b) => a + b, 0) / Math.max(1, fluxes.length)
  const beatPresent = meanFlux > 0.05  // empirical threshold — tune in Phase 4

  // Silence gaps: windows where RMS < 0.02 for >= 1.5s contiguous
  const windowSec = bufferSize / sampleRate
  const silenceThreshold = 0.02
  const minGapSec = 1.5
  const gaps: number[] = []
  let runStart: number | null = null
  for (let i = 0; i < rmsSeries.length; i++) {
    if (rmsSeries[i] < silenceThreshold) {
      if (runStart === null) runStart = i
    } else if (runStart !== null) {
      const dur = (i - runStart) * windowSec
      if (dur >= minGapSec) gaps.push(dur)
      runStart = null
    }
  }
  if (runStart !== null) {
    const dur = (rmsSeries.length - runStart) * windowSec
    if (dur >= minGapSec) gaps.push(dur)
  }

  return { audioEnergy, beatPresent, silenceGapsSec: gaps, hasAudio: true }
}
```

### Pattern 8: Brightness (Luma) via Canvas

**What:** Draw a frame onto a small canvas, sample every Nth pixel, average using BT.601 weights.

```typescript
function computeBrightness(canvas: HTMLCanvasElement): number {
  const small = document.createElement('canvas')
  small.width = 64
  small.height = 64
  const ctx = small.getContext('2d')!
  ctx.drawImage(canvas, 0, 0, 64, 64)
  const data = ctx.getImageData(0, 0, 64, 64).data

  let sum = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4 * 4) {  // sample every 4th pixel
    const r = data[i], g = data[i + 1], b = data[i + 2]
    sum += 0.299 * r + 0.587 * g + 0.114 * b      // BT.601 luma
    count++
  }
  return sum / count / 255  // normalise to 0..1
}
```

### Pattern 9: WebAssembly + Cross-Origin Isolation Fallback (ANALYSIS-09 / D-11)

**Source:** [CITED: developer.mozilla.org/SharedArrayBuffer + ffmpegwasm.netlify.app]

```typescript
// lib/engine.ts
export function canRunEngine(): { ok: true } | { ok: false; reason: string } {
  if (typeof WebAssembly === 'undefined') {
    return { ok: false, reason: 'WebAssembly not available in this browser' }
  }
  if (typeof SharedArrayBuffer === 'undefined') {
    return { ok: false, reason: 'SharedArrayBuffer required (cross-origin isolation missing)' }
  }
  if (window.crossOriginIsolated !== true) {
    return { ok: false, reason: 'Cross-origin isolation not active — COOP/COEP misconfig' }
  }
  return { ok: true }
}
```

**Note:** All three checks should run on mount. The third check (`crossOriginIsolated`) catches the most common production deploy mistake: COOP/COEP headers stripped by CDN or CloudFront. Phase 1 wired Vite + Nginx already; this guard catches regressions.

### Anti-Patterns to Avoid

- **`tf.tidy()` around an async function:** [CITED: CLAUDE.md] tidy doesn't await; tensors created inside the awaited code are not tracked. Use `try { ... } finally { tensor.dispose() }` for any manual tensor.
- **Re-instantiating `FFmpeg()` per analysis:** Re-downloads the 30 MB core every time. Singleton pattern only.
- **Reading ffprobe output gated on return code:** [CITED: GitHub #817] Returns -1 even on success. Read unconditionally.
- **Parsing scene detection from a temp file:** [CITED: CLAUDE.md] Output is in the log stream, not a file. The `-f null -` sink discards everything except logs.
- **Forgetting `solutionPath` in MediaPipe init:** [CITED: CLAUDE.md] Silent init failure — model loads no weights, returns empty results indefinitely.
- **Using `server.headers` in Vite for COOP/COEP:** [CITED: vitejs/vite#16536, CLAUDE.md] Breaks HMR. Phase 1 used `configureServer` plugin — keep it.
- **Calling `decodeAudioData` on a buffer that's already been consumed:** ArrayBuffers are transferred in some contexts. Use `arrayBuffer.slice(0)` to give a fresh copy.
- **`AnalyserNode.getByteTimeDomainData` for offline analysis:** AnalyserNode is real-time only. Use OfflineAudioContext + decoded buffer for static files.
- **`ScriptProcessorNode`:** Deprecated. Don't use even if Stack Overflow shows it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video metadata extraction | Custom MP4 parser | ffmpeg.wasm `ffprobe` | MP4/MOV box parsing has 100+ edge cases; codec-aware bitrate extraction needs the demuxer |
| Frame extraction | Pause `<video>` at intervals + canvas grab | ffmpeg `select` filter | HTML5 video seek is async/unreliable; ffmpeg gives frame-accurate output |
| Scene change detection | Pixel-diff between frames | ffmpeg `scene` filter | Production-grade detector with proper motion-compensated diff |
| Face detection | Custom CNN | MediaPipe Face Detector | TF.js abstraction; tested across thousands of faces; runs at 30+ fps in WebGL |
| Object detection | Custom model | COCO-SSD lite_mobilenet_v2 | Pre-trained on 80 classes; 2 MB model; sub-100ms inference per frame |
| Audio FFT / energy / spectral flux | Raw Web Audio FFT | Meyda | Already windowed; covers 20+ features; battle-tested algorithm implementations |
| Beat detection from scratch | Onset detection | Meyda `spectralFlux` | Spectral flux is the standard onset/beat indicator; further BPM tracking deferred to v2 |
| Drag-drop polish (animations, multi-file) | react-dropzone | Native HTML5 | Single-file, simple use case; no library overhead — match Phase 1 "Tailwind only" rule |
| File-size formatting | Custom | `Intl.NumberFormat` | Built-in; locale-aware |

**Key insight:** Every signal in `EngineSignals` already has a 100× more accurate, faster, smaller-bundle implementation in the standard stack. Hand-rolling any of them is a guaranteed time-sink.

## Common Pitfalls

### Pitfall 1: COOP/COEP regression breaks SharedArrayBuffer silently
**What goes wrong:** ffmpeg.wasm load() hangs forever or throws "SharedArrayBuffer is not defined".
**Why it happens:** Adding a third-party script (analytics, fonts) without `Cross-Origin-Resource-Policy: cross-origin` strips cross-origin isolation; CloudFront/Cloudflare proxies sometimes drop the headers.
**How to avoid:** Verify `window.crossOriginIsolated === true` at engine init; surface as user-visible error via D-11 fallback path. Add a Vitest browser-mode regression test that asserts `crossOriginIsolated === true` after the dev server starts.
**Warning signs:** ffmpeg load promise pending > 10s; dev tools console "SharedArrayBuffer" warning.

### Pitfall 2: ffmpeg.wasm MEMFS leaks between analyses
**What goes wrong:** Repeated analyses fill the WASM heap → OOM or weird residual data.
**Why it happens:** `writeFile`/`exec` outputs accumulate in the virtual filesystem; ffmpeg.wasm does NOT reset MEMFS between calls — singleton FFmpeg keeps state forever.
**How to avoid:** After every analysis, call `await ff.deleteFile(...)` for every input/output (input.mp4, meta.json, frame_*.jpg). Wrap in `try/finally` so cleanup runs on error too.
**Warning signs:** Tab memory grows monotonically across 5+ analyses; eventually `RangeError: Out of Memory`.

### Pitfall 3: TF.js tensor leak from async tidy misuse
**What goes wrong:** `tf.memory().numTensors` grows unbounded; eventually WebGL context lost.
**Why it happens:** `tf.tidy()` does not await — tensors created inside the async callback are not tracked. [CITED: CLAUDE.md, Phase 10 notes]
**How to avoid:** D-16 — pass HTML elements; if a manual tensor is unavoidable, use `try { ... } finally { tensor.dispose() }`. In DEV, log `tf.memory().numTensors` before and after each analysis to catch regressions.
**Warning signs:** Browser tab freezes after 3-5 analyses; "WebGL context lost" warning.

### Pitfall 4: MediaPipe init silently returns empty results
**What goes wrong:** `estimateFaces()` returns `[]` for every frame even with obvious faces.
**Why it happens:** `solutionPath` not set or wrong CDN URL. MediaPipe loads its own WASM/model files via this path; missing path = no model.
**How to avoid:** D-16 / CLAUDE.md mandates `solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection'`. Add a smoke test that runs detection on a known face image and asserts faceCount > 0.
**Warning signs:** Always 0 faces; no error in console; network tab shows MediaPipe CDN 404s.

### Pitfall 5: `ffprobe` output read failure silently produces empty signals
**What goes wrong:** Wrapping the `readFile('meta.json')` in `if (returnCode === 0)` means it's never called → falls back to defaults that don't match the actual video → broken Phase 4 score.
**Why it happens:** GitHub #817 — return code is always -1, even on success. Devs reading the docs assume normal Unix conventions.
**How to avoid:** D-17 — read unconditionally. Add an integration test with a known MP4 that asserts duration ≈ expected.
**Warning signs:** All videos report `durationSec: 0`; metadata fields all defaults.

### Pitfall 6: `decodeAudioData` errors crash the whole analysis
**What goes wrong:** Video has no audio track or unsupported codec → `decodeAudioData` throws → entire analysis fails instead of just `hasAudio: false`.
**Why it happens:** `decodeAudioData` rejects on any decode failure; without try/catch the rejection bubbles up.
**How to avoid:** Wrap in try/catch; on failure return `{ audioEnergy: 0, beatPresent: false, silenceGapsSec: [], hasAudio: false }`. ANALYSIS-05 acceptance criteria allow no-audio videos.
**Warning signs:** "Encoding error" in console; analysis fails for valid no-audio drone footage.

### Pitfall 7: User cancels mid-analysis but ffmpeg keeps running
**What goes wrong:** Per D-08, no graceful cancel; in-flight WASM calls finish in background but UI moves on. If user clicks Analyse again before the first run finishes, two ffmpeg execs collide on the same MEMFS files.
**Why it happens:** ffmpeg.wasm has no abort/kill API in 0.12.x.
**How to avoid:** Use a generation counter. Each analyse() bumps it; results are discarded if the captured generation no longer matches. **Critically: serialise `ff.exec()` calls — wait for the previous analysis's promise before starting a new one**, even if the UI has "moved on". A simple `let activeRun: Promise<void> | null` that newer runs await-then-discard.
**Warning signs:** "ffmpeg is busy" runtime errors; corrupt output frames.

### Pitfall 8: iOS Safari OOM on large videos
**What goes wrong:** 200 MB MP4 → ffmpeg MEMFS holds the whole file → Safari kills the tab.
**Why it happens:** iOS Safari WASM heap ceiling ~ 1-2 GB; loaded video + frames + ffmpeg working memory can exceed it.
**How to avoid:** Honour D-12 advisory banner; surface OOM via D-10 failure path — wrap engine.analyse() in try/catch and route any error containing "OOM"/"out of memory"/"RangeError" to the same fallback. The Skip Analysis path lets the user proceed without engine signals.
**Warning signs:** Tab reload mid-analysis on iPhone; "A problem repeatedly occurred" iOS Safari error.

### Pitfall 9: Vite dev HMR breaks COOP/COEP plugin
**What goes wrong:** Adding `server.headers` to vite.config.ts (the obvious fix) breaks Vite HMR websocket.
**Why it happens:** [CITED: vitejs/vite#16536]. Phase 1 already wired the correct `configureServer` plugin — make sure no one regresses to `server.headers`.
**How to avoid:** Code review check. Add a comment in vite.config.ts (already there per Phase 1).

### Pitfall 10: HTML5 video metadata not loaded yet when computing thumbnail
**What goes wrong:** `videoEl.currentTime = duration * 0.1` set immediately after `URL.createObjectURL` returns NaN or the wrong frame.
**Why it happens:** `videoEl.duration` is NaN until `loadedmetadata` fires. Setting currentTime before that does nothing.
**How to avoid:** Wrap in `videoEl.onloadedmetadata = () => { videoEl.currentTime = videoEl.duration * 0.1 }` and grab thumbnail in `onseeked`. Two-step.

## Code Examples

### Example: EngineSignals interface for types.ts

```typescript
// frontend/src/lib/types.ts — append to existing file

/** Output of the in-browser analysis pipeline (Phase 3).
 *  Consumed by Phase 4 (score formula), Phase 5 (AI prompt context). */
export interface EngineSignals {
  // ===== ffmpeg metadata (ANALYSIS-01) =====
  durationSec: number          // 0 if probe failed
  width: number                // pixels; 0 if unknown
  height: number               // pixels; 0 if unknown
  aspectRatio: number          // width/height; 0 if width === 0
  fps: number                  // frames per second
  bitrate: number              // bits per second; 0 if unknown
  hasAudio: boolean

  // ===== Scene detection (ANALYSIS-03) =====
  sceneCount: number           // = sceneTimestamps.length
  sceneTimestamps: number[]    // seconds, ascending

  // ===== Frames (ANALYSIS-02) =====
  framesBase64: string[]       // ~10 frames as data:image/jpeg;base64,... URIs

  // ===== TF.js (ANALYSIS-04) =====
  faceCount: number            // max faces detected in any analysed frame
  faceConfidence: number       // mean confidence 0..1
  objectLabels: string[]       // unique COCO classes detected
  motionScore: number          // 0..1 normalised bbox centroid delta

  // ===== Web Audio / Meyda (ANALYSIS-05) =====
  audioEnergy: number          // 0..1 normalised
  beatPresent: boolean
  silenceGapsSec: number[]     // each entry is a contiguous silence duration

  // ===== Canvas (ANALYSIS-06) =====
  brightnessScore: number      // 0..1 BT.601 luma average
}
```

### Example: engine.ts skeleton

```typescript
// frontend/src/lib/engine.ts
import type { EngineSignals } from './types'

export type ProgressStep =
  | 'metadata' | 'frames' | 'scenes'
  | 'faces' | 'objects' | 'audio' | 'brightness' | 'done'

export interface AnalyseOptions {
  onProgress?: (step: ProgressStep) => void
  signal?: AbortSignal   // honoured per D-08 (best-effort — see Pitfall 7)
}

export async function analyse(
  file: File,
  opts: AnalyseOptions = {},
): Promise<EngineSignals> {
  const { onProgress = () => {} } = opts
  const ff = await getFFmpeg()
  const bytes = new Uint8Array(await file.arrayBuffer())
  await ff.writeFile('input.mp4', bytes)

  try {
    onProgress('metadata')
    const probe = await probeVideo(ff, bytes)
    const meta = parseMeta(probe)

    onProgress('scenes')
    const sceneTimestamps = await detectScenes(ff)

    onProgress('frames')
    const framesBase64 = await extractFrames(ff, meta.totalFrames, meta.fps)

    onProgress('faces')
    const { faceCount, faceConfidence } = await detectFacesAcrossFrames(framesBase64)

    onProgress('objects')
    const { objectLabels, motionScore } = await detectObjectsAndMotion(framesBase64)

    onProgress('audio')
    const audio = await analyseAudio(file)

    onProgress('brightness')
    const brightnessScore = await computeBrightnessAcrossFrames(framesBase64)

    onProgress('done')

    return {
      ...meta,
      sceneCount: sceneTimestamps.length,
      sceneTimestamps,
      framesBase64,
      faceCount, faceConfidence,
      objectLabels, motionScore,
      ...audio,
      brightnessScore,
    }
  } finally {
    // MEMFS cleanup (Pitfall 2)
    await safeDelete(ff, ['input.mp4', 'meta.json'])
    for (let i = 1; i <= 15; i++) {
      await safeDelete(ff, [`frame_${String(i).padStart(3, '0')}.jpg`])
    }
  }
}

export async function warmup(): Promise<void> {
  // Pre-warm in parallel — D-07
  await Promise.all([
    getFFmpeg(),
    getFaceDetector(),
    getCocoDetector(),
  ])
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@ffmpeg/ffmpeg < 0.12` (createFFmpeg API) | `@ffmpeg/ffmpeg ≥ 0.12` (`new FFmpeg()` + `toBlobURL`) | Aug 2023 | All v0.11 tutorials are wrong API |
| `tf.fromPixels` + manual tensors | Element-passing to `model.estimateFaces(canvas)` | TF.js 4.x | Cleaner code; safer memory |
| `tf.tidy()` (sync only) | Explicit `.dispose()` in finally | TF.js 4.x async era | tidy still useful for sync code only |
| MediaPipe direct (`@mediapipe/face_detection` calls) | `@tensorflow-models/face-detection` wrapper | 2022 | Single API surface; both backends |
| `ScriptProcessorNode` for audio FFT | `OfflineAudioContext` + Meyda | Web Audio API spec | ScriptProcessorNode deprecated |
| AnalyserNode for static-file analysis | OfflineAudioContext for static, AnalyserNode for live | — | Common confusion; OfflineAudioContext is the correct tool here |
| `ffmpeg-core-mt` (multithread) | `ffmpeg-core` (single-thread) | CLAUDE.md lock | Chromium fails on -mt |

**Deprecated / outdated:**
- `music-tempo` npm package — last published 2017, abandoned. Don't use.
- `ScriptProcessorNode` — deprecated in Web Audio API; replaced by AudioWorkletNode (live) / OfflineAudioContext (static).

## Runtime State Inventory

> Phase 3 is greenfield (creates engine.ts + UI components; no rename or migration). Section omitted.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (build-time install) | npm install of all packages | ✓ | (project uses Node 22 per PROJECT.md) | — |
| Chrome / Chromium dev browser | Manual smoke testing of engine | ✓ assumed (developer machine) | — | — |
| @vitest/browser + Playwright | Engine integration tests | ✗ not yet installed | — | Phase 3 plan must install (devDep) |
| @ffmpeg/core CDN (jsdelivr.net) | Runtime ffmpeg-core load via toBlobURL | ✓ public CDN | pin to 0.12.10 | If CDN flaky, copy core files to `frontend/public/ffmpeg/` (deferred decision) |
| MediaPipe CDN (cdn.jsdelivr.net/npm/@mediapipe/face_detection) | MediaPipe `solutionPath` | ✓ public CDN | ~0.4.1646... | Copy to public/ if CDN unreliable |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- `@vitest/browser` — install in Phase 3 PLAN as devDep (used for engine tests; not blocking dev)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (new — Phase 3 introduces frontend tests) |
| Browser provider | @vitest/browser 4.1.5 + Playwright 1.59.1 (chromium) |
| Config file | `frontend/vitest.config.ts` (NEW — Wave 0) |
| Quick run command | `npm --prefix frontend run test -- --run engine.test.ts` |
| Full suite command | `npm --prefix frontend run test -- --run` |
| Component tests (DOM-only) | happy-dom 20.9.0 environment |
| Engine tests (real browser) | `@vitest/browser` env (chromium) — required for WebAssembly + WebGL + crossOriginIsolated |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPLOAD-01 | Drag-drop + file picker, 250 MB hard reject, 200 MB warn | unit (component) | `vitest run UploadDropzone.test.tsx` | ❌ Wave 0 |
| UPLOAD-02 | HTML5 metadata extraction + thumbnail | unit (component) | `vitest run VideoPreview.test.tsx` | ❌ Wave 0 |
| UPLOAD-03 | Description textarea 280 chars cap | unit (component) | `vitest run VideoPreview.test.tsx` | ❌ Wave 0 |
| ANALYSIS-01 | ffmpeg.wasm metadata extraction | integration (browser) | `vitest run --browser engine.metadata.test.ts` | ❌ Wave 0 |
| ANALYSIS-02 | ~10 frames extracted | integration (browser) | `vitest run --browser engine.frames.test.ts` | ❌ Wave 0 |
| ANALYSIS-03 | Scene timestamps from log stream | integration (browser) | `vitest run --browser engine.scenes.test.ts` | ❌ Wave 0 |
| ANALYSIS-04 | Face / objects / motion | integration (browser) | `vitest run --browser engine.tfjs.test.ts` | ❌ Wave 0 |
| ANALYSIS-05 | Audio energy / beat / silence | integration (browser) | `vitest run --browser engine.audio.test.ts` | ❌ Wave 0 |
| ANALYSIS-06 | Brightness 0..1 | unit (with canvas mock) | `vitest run engine.brightness.test.ts` | ❌ Wave 0 |
| ANALYSIS-07 | No network requests for video file | integration (browser) | `vitest run --browser engine.network.test.ts` (asserts no fetch outside ffmpeg/MediaPipe CDN) | ❌ Wave 0 |
| ANALYSIS-08 | Two-phase loading + step labels rotate | unit (component) | `vitest run AnalysisProgress.test.tsx` | ❌ Wave 0 |
| ANALYSIS-09 | WebAssembly absence fallback | unit (with `delete window.WebAssembly` mock) | `vitest run engine.fallback.test.ts` | ❌ Wave 0 |
| ANALYSIS-10 | ffprobe read unconditionally | integration (browser) — same as ANALYSIS-01 | `vitest run --browser engine.metadata.test.ts` | ❌ Wave 0 |
| Tensor leak regression | tf.memory().numTensors stable across 3 runs | integration (browser) | `vitest run --browser engine.leak.test.ts` | ❌ Wave 0 |
| MEMFS leak regression | ffmpeg heap stable across 3 runs | integration (browser) | `vitest run --browser engine.leak.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Quick suite — only the test files for the task being committed (`vitest run <pattern>`)
- **Per wave merge:** Full suite — `npm --prefix frontend run test -- --run` (all unit + browser tests; ~3-5 minutes)
- **Phase gate:** Full suite green + manual smoke test on 5 fixture videos (mp4-with-face, mov-no-audio, mp4-corrupt, mp4-static-no-motion, mp4-large-100mb) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `frontend/vitest.config.ts` — new file (Vitest 4 + browser provider config)
- [ ] `frontend/test/fixtures/` — 5 small fixture videos checked into git (≤2MB each, sample MP4/MOV)
  - sample-with-face.mp4 (10s talking head)
  - sample-no-audio.mp4 (10s silent drone)
  - sample-no-face.mp4 (10s scenery)
  - sample-corrupt.mp4 (truncated, for failure-path tests)
  - sample-mov.mov (5s small QuickTime container)
- [ ] `frontend/test/setup.ts` — globals + mock for window.WebAssembly removal
- [ ] Install: `npm i -D vitest@4.1.5 @vitest/browser@4.1.5 playwright@1.59.1 happy-dom@20.9.0 @testing-library/react@16.3.2`
- [ ] `package.json` — add `"test": "vitest"` script

## Security Domain

`security_enforcement` is not set in `.planning/config.json` → treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing Phase 1 — Supabase JWT on every route. Phase 3 doesn't add backend routes; GeneratorPage already auth-gated by App.tsx |
| V3 Session Management | yes | Existing Phase 1 — Supabase session via SDK |
| V4 Access Control | partial | No new authorization needed — analysis is purely client-side per ANALYSIS-07 (no server video upload until Phase 5) |
| V5 Input Validation | **yes** | File type + size validation before passing to ffmpeg.wasm — see threats below |
| V6 Cryptography | n/a | No crypto in Phase 3 |
| V11 Business Logic | yes | 250 MB hard cap and MP4/MOV-only filter must be client-enforced (defence in depth even though Phase 5 adds server-side check) |
| V12 File Handling | **yes** | Untrusted user video → ffmpeg.wasm. WASM sandbox is the security boundary. **No file ever sent to backend in Phase 3** (ANALYSIS-07) |

### Known Threat Patterns for in-browser video processing

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious video crashes ffmpeg.wasm tab | DoS | WASM is sandboxed — worst case is tab crash. D-10 failure card recovers UI. Hard size cap (250 MB) bounds memory pressure. |
| File-type spoof (.mp4 extension, actually script) | Tampering | `accept="video/mp4,video/quicktime"` + `file.type` MIME check + ffmpeg fail-fast on invalid container |
| Description textarea XSS | Injection | Description is rendered only as plain text in React (auto-escaped); never `dangerouslySetInnerHTML`. 280-char soft cap. |
| Frame base64 leaking via console/log | Info Disclosure | No `console.log(framesBase64)` in production. Engine only logs step names. |
| Cross-origin isolation downgrade attack | Tampering | `crossOriginIsolated` runtime check (Pattern 9) — fail closed if missing |
| MediaPipe / ffmpeg CDN compromise | Tampering | Pin exact versions in package.json; consider Subresource Integrity (SRI) for CDN script loads (deferred — `toBlobURL` blob method makes SRI awkward; revisit Phase 10 polish) |
| Object URL memory leak (createObjectURL) | DoS | Call `URL.revokeObjectURL(url)` on file change / unmount |

## Project Constraints (from CLAUDE.md)

Extracted from `viral-copy-generator/CLAUDE.md` — these are **enforcement-grade** constraints the planner must encode into PLAN steps:

### From "Video Analysis (Phase 3+)" section
- `@ffmpeg/core` single-thread only — `@ffmpeg/core-mt` fails on Chromium → **lock `@ffmpeg/core@0.12.10` (single-thread)**
- ffprobe always read output from virtual FS file — return code is -1 even on success → **never gate `readFile('meta.json')` on return code**
- Scene detection output is in the log stream — parse `ffmpeg.on('log', ...)`, not a file
- `tf.tidy()` does NOT work with async — use `tensor.dispose()` in `try/finally`
- MediaPipe face-detection: `solutionPath` is MANDATORY or init silently fails

### From "Frontend" section
- No routing library — `useState` screen switching → engine UI lives inside GeneratorPage; no React Router
- No UI component library — Tailwind CSS only → no shadcn/MUI/Chakra
- `h-[100dvh]` not `h-screen` (iOS Safari viewport bug)
- `viewport-fit=cover` in meta viewport tag

### From "Auth" section
- Every route is auth-gated. App.tsx already enforces — Phase 3 inherits via existing GeneratorPage gate
- Never store tokens in localStorage. (No token handling in Phase 3.)

### From "Per-User Data Isolation" section
- All DB tables have `user_id UUID REFERENCES auth.users(id)` and RLS — Phase 3 does not write to DB (D-19), so no concern; Phase 5 inherits

### From "Security" section
- COOP/COEP: `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` on every response
- Vite COOP/COEP: use `configureServer` plugin (NOT `server.headers` — breaks HMR) — already in place from Phase 1

### From "Content Rules" section
- NEVER generate placeholder text, "TODO", "Coming soon", "Lorem ipsum"
- All copy must be real and complete (applies to error messages, banners — no `"TODO: error"`)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Meyda `energy` value range is 0..bufferSize, normalisation `/ bufferSize` is sensible | Pattern 7 audio analysis | Low — Phase 4 score formula will tune the curve regardless; just need monotonicity |
| A2 | spectralFlux > 0.05 is a reasonable beat presence threshold | Pattern 7 audio analysis | Medium — empirical, will need tuning against fixture videos in Wave 0 |
| A3 | RMS < 0.02 is a reasonable silence threshold | Pattern 7 audio analysis | Medium — same as A2; tuning needed |
| A4 | Motion score normalisation `* 4` produces a well-distributed 0..1 range | Pattern 6 motion | Medium — empirical magic number; Phase 4 normalisation curve will absorb any range issues |
| A5 | iOS Safari WASM heap ceiling ~ 1-2 GB on iPhone 12+ | Pitfall 8 | Low — D-12 advisory + D-10 fallback handles OOM gracefully regardless |
| A6 | `accept="video/mp4,video/quicktime"` covers MOV correctly across browsers | UPLOAD-01 | Low — well-documented; .mov is `video/quicktime` MIME |
| A7 | Coco-SSD `lite_mobilenet_v2` is sufficient label quality for ANALYSIS-04 | Pattern 6 | Low — only used as feature input, not user-visible |
| A8 | Frame extraction filter `select='not(mod(n\,N))',scale=512:512` produces valid JPEGs in 0.12.x | Pattern 4 | Low — standard ffmpeg pattern; verify in Wave 0 fixture test |
| A9 | jsdelivr CDN reliability acceptable for `@ffmpeg/core@0.12.10` and `@mediapipe/face_detection` | Stack | Low — alt: serve from `public/`. Decision deferred to PLAN. |
| A10 | Vitest 4.1.5 + @vitest/browser is stable enough for engine integration tests | Validation Architecture | Low — official-stable since Vitest 4. Fallback: Playwright-only e2e tests |

**Confirmation needed:** A2/A3 should be tuned against the 5 fixture videos in Wave 0 — flag this for the planner to schedule a calibration task.

## Open Questions (RESOLVED)

1. **Should ffmpeg-core be self-hosted (`public/ffmpeg/`) vs CDN-loaded?**
   - What we know: CDN is simpler and Phase 1 has no perf budget yet. Self-host eliminates CDN dependency and lets us add SRI eventually.
   - What's unclear: Does jsdelivr have rate limits that would bite at scale? Unknown.
   - **RESOLVED:** Start with CDN (toBlobURL, baseURL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd`). Plan 03-02 implements this. Revisit in Phase 10 polish if user reports show slow first-load. Adding self-hosting later is a 5-line change.

2. **Should beat detection use `spectralFlux` only, or add tempo (BPM) tracking?**
   - What we know: Meyda doesn't ship a BPM tracker — only the building blocks. Phase 4 score formula treats beat as binary (`beatPresent`).
   - What's unclear: Does Phase 4 derive value from BPM number vs binary?
   - **RESOLVED:** Binary `beatPresent` only in Phase 3. Plan 03-06 uses spectralFlux mean threshold. If Phase 4 wants BPM, add `web-audio-beat-detector` library or similar in Phase 10 polish.

3. **How to handle videos shorter than ~3 seconds?**
   - What we know: For 90 frames total at 30fps, N = 9 → ~10 frames. For < 30 frames (1s video), N = 3 → ~10 frames may be visually identical.
   - What's unclear: ROADMAP doesn't specify a minimum duration.
   - **RESOLVED:** Soft warning if `durationSec < 5` ("Very short videos may not produce reliable analysis") — non-blocking advisory. Implementation lives in 03-07 (GeneratorPage state machine surfaces warning when EngineSignals.durationSec < 5).

4. **Pre-warm timing — block Analyse button or let it queue?**
   - What we know: D-07 says background pre-warm; "Preparing models…" appears only if user clicks Analyse before pre-warm done.
   - What's unclear: If user clicks Analyse during pre-warm, does the click queue (analyse() awaits warmup()) or block?
   - **RESOLVED:** Queue. `analyse()` calls `await warmup()` internally, which resolves immediately if already warm. UI shows "Preparing models…" while waiting. Plan 03-02 implements this pattern; Plan 03-07 surfaces the lazy "Preparing models…" label only when the queue is non-empty.

5. **Worker thread for engine.ts?**
   - What we know: ffmpeg.wasm 0.12.x already runs in its own internal worker. TF.js uses WebGL on main thread. Meyda is sync.
   - What's unclear: Does main-thread blocking on Meyda windows cause UI jank?
   - **RESOLVED:** No worker for v1. engine.ts runs on main thread (ffmpeg.wasm has its own internal worker, TF.js uses WebGL). Profile in Phase 10 polish; if Meyda windows cause UI jank, move audio analysis to a worker then.

## Sources

### Primary (HIGH confidence)
- npm registry: `@ffmpeg/ffmpeg@0.12.15` (2025-01-07), `@ffmpeg/core@0.12.10`, `@ffmpeg/util@0.12.2`, `@tensorflow/tfjs@4.22.0`, `@tensorflow-models/face-detection@1.0.3` peerDeps confirmed `@mediapipe/face_detection ~0.4.0` + `@tensorflow/tfjs-backend-webgl ^4.21.0`, `@tensorflow-models/coco-ssd@2.2.3`, `meyda@5.6.3`, `vitest@4.1.5`, `@vitest/browser@4.1.5`, `playwright@1.59.1` — all verified via `npm view`
- ffmpeg.wasm official docs — https://ffmpegwasm.netlify.app/docs/getting-started/usage/ (load + toBlobURL pattern, log listener, FS API)
- TensorFlow.js model README — https://github.com/tensorflow/tfjs-models/blob/master/face-detection/README.md (createDetector API, runtime: 'mediapipe')
- COCO-SSD README — https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd (load config, detect signature, bbox format)
- MediaPipe detector source — https://github.com/tensorflow/tfjs-models/blob/master/face-detection/src/mediapipe/detector.ts (confirms `solutionPath` option)
- GitHub issue ffmpeg.wasm #817 — https://github.com/ffmpegwasm/ffmpeg.wasm/issues/817 (ffprobe -1 bug, opened 2025-01-13, **still open**)
- Project CLAUDE.md "Video Analysis (Phase 3+)" — locks single-thread, ffprobe workaround, scene log parsing, tf.tidy async incompatibility, MediaPipe solutionPath
- Project ROADMAP.md "Phase 3" — locks goal, key implementation notes, success criteria
- Phase 1 vite.config.ts — confirms COOP/COEP `configureServer` plugin in place

### Secondary (MEDIUM confidence)
- Meyda audio features page — https://meyda.js.org/audio-features (energy / RMS / spectralFlux semantics; bufferSize default 512)
- MDN SharedArrayBuffer + Window.crossOriginIsolated — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
- Vitest browser mode docs — https://vitest.dev/guide/browser/ (stable since Vitest 4)

### Tertiary (LOW confidence — flagged for validation)
- Empirical thresholds: spectralFlux > 0.05 (beatPresent), rms < 0.02 (silence) — A2/A3, calibrate in Wave 0
- Motion score normalisation factor `* 4` — A4, will be absorbed by Phase 4 curve
- iOS Safari WASM heap ceiling ~1-2 GB — A5, observational; D-10 fallback covers regardless

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via `npm view` 2026-05-02; CLAUDE.md locks single-thread + MediaPipe runtime
- Architecture: HIGH — single-orchestrator pattern (D-14) is unambiguous; integration points well-defined
- Pitfalls: HIGH — 10 pitfalls each tied to either CLAUDE.md, GitHub issue, or official docs
- Code examples: MEDIUM — patterns are correct but exact thresholds (silence, beat) need fixture-based tuning in Wave 0

**Research date:** 2026-05-02
**Valid until:** 2026-06-02 (30-day window — stack is stable; ffmpeg/TF.js move slowly)

## RESEARCH COMPLETE
