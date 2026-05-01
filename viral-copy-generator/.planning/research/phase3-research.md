# Phase 3 Deep Research

**Researched:** 2026-04-30
**Domain:** In-browser video analysis — ffmpeg.wasm 0.12.x, TF.js, Web Audio API, Canvas API
**Confidence:** HIGH (all critical paths verified via official docs, npm registry, and GitHub source)

---

## Confirmed Approach (no changes needed)

All ten research questions resolved. The planned stack is correct. No library substitutions needed.

### SAB / Cross-Origin isolation
`@ffmpeg/core` (single-thread) **does NOT require SharedArrayBuffer**. The `@ffmpeg/core-mt` (multi-thread) build requires it. Since the spec locks `@ffmpeg/core`, COOP/COEP headers are still recommended for correctness but ffmpeg will not hard-fail on iOS 14 without them. [VERIFIED: ffmpegwasm.netlify.app/docs/overview, GitHub issues #302 and #337]

### ffmpeg.wasm already runs in a Web Worker by default
The `@ffmpeg/ffmpeg` package spawns `ffmpeg.worker` internally on every `new FFmpeg()`. The main thread is NOT blocked by default in 0.12.x. Phase 8 "Web Worker migration" is therefore a non-issue for Phase 3 — no manual worker setup needed now. [VERIFIED: ffmpegwasm.netlify.app/docs/overview]

### Metadata extraction strategy
The HTML5 `<video>` element's `onloadedmetadata` event gives **duration, videoWidth, videoHeight** for free, before any ffmpeg call fires. ffmpeg.wasm's `ffprobe()` method is used for **fps and bitrate** (not available from the video element). The combination avoids a full ffmpeg `-i` parse just for basic metadata. [VERIFIED: MDN, ffmpegwasm.netlify.app/docs/api]

### TF.js model pre-warming
The recommended pattern is to start `cocoSsd.load()` and `faceDetection.createDetector()` in background as soon as the file is selected — NOT on Analyse click. Both models load in ~2-4 seconds; pre-warming means Analyse is instant. [VERIFIED: official README pattern, confirmed from tfjs-models/coco-ssd/README.md]

### iOS Safari SharedArrayBuffer support
iOS Safari 15.2+ fully supports SharedArrayBuffer. iOS 15.1 and earlier do not. Since we use `@ffmpeg/core` (single-thread), ffmpeg.wasm can still run without SharedArrayBuffer. The fallback is specifically for iOS < 15.2 AND for cases where COOP/COEP headers are missing. [VERIFIED: caniuse.com SharedArrayBuffer table]

### beat detection library
`web-audio-beat-detector` v8.2.36 (latest as of 2026-04-30) is a maintained, actively updated npm package that accepts an `AudioBuffer` and returns BPM. It requires no audio context to remain open during analysis — pass a decoded buffer and get a promise. This is the correct library, not a custom AnalyserNode implementation. [VERIFIED: npm view, GitHub chrisguttandin/web-audio-beat-detector]

---

## Issues Found (must fix in plan)

### Issue 1: ffprobe() return code bug — do not gate logic on return value
`ffmpeg.ffprobe()` returns `-1` even on successful execution (documented in GitHub issue #817 against `@ffmpeg/core@0.12.10`). The output IS written correctly to the virtual filesystem. The fix: always call `readFile()` after `ffprobe()`, regardless of the return code. Do NOT write `if (returnCode !== 0) throw`. Check file existence / parse result instead. [VERIFIED: github.com/ffmpegwasm/ffmpeg.wasm/issues/817]

### Issue 2: ffprobe() requires `-o` flag to write to file — cannot read stdout directly
Unlike CLI ffprobe, the wasm version does not pipe stdout to JavaScript. Output must be directed to a virtual filesystem file using `-o output.txt`. Then read with `ffmpeg.readFile('output.txt', 'utf8')`. The `readFile` call signature: `readFile(path, encoding)` where encoding `'utf8'` returns a string. [VERIFIED: GitHub issue #817 example code, API docs]

### Issue 3: `@ffmpeg/core` version pinned at 0.12.10 — must match in load() call
`npm view @ffmpeg/core version` returns `0.12.10`. The `@ffmpeg/ffmpeg` package is `0.12.15`. The CDN URL used in `toBlobURL()` must reference `@ffmpeg/core@0.12.10`, NOT `@ffmpeg/core@latest`. Mismatched versions cause silent load failure. [VERIFIED: npm registry, official usage docs]

### Issue 4: Vite requires `optimizeDeps.exclude` for ffmpeg packages — missing this = broken build
Without explicitly excluding `@ffmpeg/ffmpeg` and `@ffmpeg/util` from Vite's pre-bundler, the build fails because the pre-bundler cannot handle WASM modules. This must be in `vite.config.ts`. [VERIFIED: multiple Vite+ffmpeg.wasm tutorials, official vue-vite-app example vite.config.ts]

### Issue 5: `tf.tidy()` cannot wrap async calls — use manual `tf.dispose()` for inference
`tf.tidy()` does NOT work with async functions. Since `model.detect()` and `detector.estimateFaces()` are both async, they cannot be wrapped in `tf.tidy()`. The only safe pattern is manual tensor tracking + `tf.dispose()` after each frame, OR passing image elements directly (which avoids creating intermediate tensors). Passing a `<canvas>` or `<img>` element directly to `model.detect()` and `detector.estimateFaces()` is the recommended approach — COCO-SSD and face-detection both accept HTML elements and manage internal tensors themselves. [VERIFIED: tfjs issue #2204, official COCO-SSD README]

### Issue 6: MediaPipe face detection needs `solutionPath` pointing to CDN
The `solutionPath` config option must point to the `@mediapipe/face_detection` CDN URL. Without this, the MediaPipe wasm binary is not found and the detector silently fails to load. Use `solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection'`. If bundling locally, point to `node_modules/@mediapipe/face_detection`. [VERIFIED: tfjs-models/face-detection/src/mediapipe/README.md]

### Issue 7: Scene detection with `select=gt(scene,0.4)` uses `-f null -` output — cannot read scene frames
The standard scene-detection command writes nothing to the virtual FS. Output is captured via the `on('log', ...)` event stream and parsed with a regex for `pts_time`. The plan must listen to log events during the scene detection exec call and accumulate them into a buffer before parsing. [VERIFIED: gist.github.com/dudewheresmycode, ffmpeg-user list, validated ffmpeg filter docs]

### Issue 8: Evenly-spaced frame extraction is sequential by timestamp — avoid `select=` filter for 10 frames
The `select=not(mod(n,...))` filter requires knowing total frame count from metadata first. The simpler, more reliable approach for exactly 10 frames is sequential single-frame extractions: compute 10 timestamps from duration, then call `ffmpeg.exec()` 10 times with `-ss [t] -frames:v 1 frame_N.jpg`. This avoids VSYNC issues and frame count math. Sequential calls on the same loaded instance are fast. [VERIFIED: Transloadit devtips, multiple frame extraction examples]

---

## Implementation Notes (specific code patterns)

### vite.config.ts — exact required configuration

```typescript
// [VERIFIED: official ffmpegwasm vue-vite-app + multiple community examples]
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'esnext',
  },
})
```

### ffmpeg singleton — src/lib/ffmpeg.ts

```typescript
// [VERIFIED: official usage docs + debugplay.com 2025 guide]
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let instance: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

// @ffmpeg/core is 0.12.10 — must match CDN version exactly
const CORE_VERSION = '0.12.10'
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`

export async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg()
    // ffmpeg.wasm 0.12.x already runs in an internal Web Worker — no manual worker needed
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      // NO workerURL — that is core-mt only. Single-thread core has no worker file.
    })
    instance = ffmpeg
    return ffmpeg
  })()

  return loadPromise
}

export async function cleanupFFmpegFiles(ffmpeg: FFmpeg, paths: string[]): Promise<void> {
  for (const path of paths) {
    try { await ffmpeg.deleteFile(path) } catch { /* ignore if file doesn't exist */ }
  }
}
// Note: ffmpeg.terminate() is available but destroys the worker — requires load() again.
// For a singleton, do NOT call terminate() between analyses. Only deleteFile() temp files.
```

### Alternative ?url import pattern (no toBlobURL needed, bundled locally)

```typescript
// [VERIFIED: debugplay.com 2025 guide — works if @ffmpeg/core is a local dep]
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

await ffmpeg.load({ coreURL, wasmURL })
// Advantage: no CDN dependency, works offline
// Disadvantage: adds ~25 MB to bundle assets — use CDN for production
```

### iOS/SharedArrayBuffer detection

```typescript
// [VERIFIED: MDN SharedArrayBuffer, caniuse.com, multiple GitHub discussions]
// @ffmpeg/core (single-thread) does NOT need SAB.
// Show fallback only when the browser lacks support AND we want to warn user.
export function canRunAnalysis(): { ok: boolean; reason?: string } {
  // Primary check: is WASM available at all?
  if (typeof WebAssembly === 'undefined') {
    return { ok: false, reason: 'WebAssembly is not supported in this browser.' }
  }
  // Secondary check: very old iOS (<15) may have partial WASM support
  // For @ffmpeg/core single-thread, SAB is NOT required — do NOT block on it.
  // SAB check is only relevant if we ever switch to core-mt.
  return { ok: true }
}

// The correct detection for SAB (for reference / future core-mt upgrade):
// const hasSAB = typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated === true
// Both conditions must be true — crossOriginIsolated alone is not sufficient.
```

### Video thumbnail + metadata from HTML5 element (before ffmpeg runs)

```typescript
// [VERIFIED: MDN onloadedmetadata, video element spec]
export function extractVideoMetadataFromElement(file: File): Promise<{
  duration: number
  width: number
  height: number
  aspectRatio: string
  thumbnailBlob: Blob
}> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadedmetadata = () => {
      const { duration, videoWidth: width, videoHeight: height } = video
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
      const d = gcd(width, height)
      const aspectRatio = `${width / d}:${height / d}`

      // Seek to frame at 10% to get a good thumbnail
      video.currentTime = duration * 0.1
    }

    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (!blob) { reject(new Error('Thumbnail extraction failed')); return }
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          aspectRatio: `${video.videoWidth / gcd(video.videoWidth, video.videoHeight)}:${video.videoHeight / gcd(video.videoWidth, video.videoHeight)}`,
          thumbnailBlob: blob,
        })
      }, 'image/jpeg', 0.85)
    }

    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Video load failed')) }
    video.src = url
  })
}

// Helper used above
function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b) }
```

### ffprobe for fps + bitrate (ffmpeg.wasm)

```typescript
// [VERIFIED: API docs ffmpegwasm.netlify.app, GitHub issue #817]
// CRITICAL: ignore return code from ffprobe() — it returns -1 even on success (known bug)
export async function extractVideoMetadataFromFFprobe(ffmpeg: FFmpeg, inputFilename: string): Promise<{
  fps: number
  bitrate: number
}> {
  // ffprobe writes to a file via -o flag; stdout is not accessible directly in wasm
  await ffmpeg.ffprobe([
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    inputFilename,
    '-o', 'meta.json',
  ])
  // Do NOT check return code — known bug: returns -1 even on success
  const raw = await ffmpeg.readFile('meta.json', 'utf8') as string
  await ffmpeg.deleteFile('meta.json')

  const meta = JSON.parse(raw)
  const videoStream = meta.streams?.find((s: { codec_type: string }) => s.codec_type === 'video')
  // r_frame_rate is a fraction string like "30000/1001" or "25/1"
  const [num, den] = (videoStream?.r_frame_rate ?? '25/1').split('/').map(Number)
  const fps = Math.round(num / den)
  const bitrate = Math.round(Number(meta.format?.bit_rate ?? 0) / 1000) // kbps

  return { fps, bitrate }
}
```

### Frame extraction — 10 evenly-spaced frames as JPEG

```typescript
// [VERIFIED: Transloadit devtips guide, ffmpegwasm API docs]
// Sequential single-frame extractions. Avoids select= filter complexity and VSYNC issues.
export async function extractFrames(
  ffmpeg: FFmpeg,
  inputFilename: string,
  duration: number,
  count: number = 10
): Promise<Blob[]> {
  const blobs: Blob[] = []
  const interval = duration / (count + 1)

  for (let i = 1; i <= count; i++) {
    const t = interval * i
    const outputName = `frame_${i}.jpg`
    await ffmpeg.exec([
      '-ss', t.toFixed(3),
      '-i', inputFilename,
      '-frames:v', '1',
      '-q:v', '2',         // JPEG quality: 1=best, 31=worst. 2 is near-lossless.
      outputName,
    ])
    const data = await ffmpeg.readFile(outputName) as Uint8Array
    blobs.push(new Blob([data], { type: 'image/jpeg' }))
    await ffmpeg.deleteFile(outputName)
  }

  return blobs
}
// For passing frames to TF.js: create <img> elements from blob URLs, or draw to canvas
// and pass the canvas element to model.detect(canvas). Prefer canvas to avoid DOM nodes.
```

### Scene detection — log capture pattern

```typescript
// [VERIFIED: ffmpeg filter docs, ffmpegwasm on('log') API, gist.github.com/dudewheresmycode]
// Scene detection uses -f null output; results appear in the log stream as pts_time values.
export async function detectSceneChanges(
  ffmpeg: FFmpeg,
  inputFilename: string,
  threshold: number = 0.4
): Promise<number[]> {
  const logLines: string[] = []

  // Temporarily capture log for this operation only
  const logHandler = ({ message }: { message: string }) => {
    logLines.push(message)
  }
  ffmpeg.on('log', logHandler)

  // IMPORTANT: escape comma in filter expression with backslash in the array form
  await ffmpeg.exec([
    '-i', inputFilename,
    '-vf', `select=gt(scene\\,${threshold}),showinfo`,
    '-f', 'null',
    '-',
  ])

  ffmpeg.off('log', logHandler)

  // Parse pts_time values from showinfo output
  // showinfo log lines look like: "n: 42 pts: 1234 pts_time:12.345 ..."
  const timestamps: number[] = []
  for (const line of logLines) {
    const match = line.match(/pts_time:([\d.]+)/)
    if (match) {
      timestamps.push(parseFloat(match[1]))
    }
  }

  return timestamps
}
// Note: threshold 0.3–0.5 is the documented sane range.
// For travel/driving content expect dense scene changes — 0.4 is a good default.
```

### TF.js COCO-SSD initialization and object detection

```typescript
// [VERIFIED: tfjs-models/coco-ssd/README.md]
import '@tensorflow/tfjs-backend-webgl'
import * as cocoSsd from '@tensorflow-models/coco-ssd'

let cocoModel: cocoSsd.ObjectDetection | null = null

// Call this when file is SELECTED, not when Analyse is clicked
export async function prewarmCocoSsd(): Promise<void> {
  if (cocoModel) return
  // 'lite_mobilenet_v2' is fastest; adequate for scene label extraction
  cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
}

// Pass a canvas element — model accepts ImageData, HTMLCanvasElement, HTMLVideoElement, HTMLImageElement
// Passing an element directly avoids creating intermediate tensors the caller must dispose
export async function detectObjects(canvas: HTMLCanvasElement): Promise<cocoSsd.DetectedObject[]> {
  if (!cocoModel) cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
  // model.detect() handles its own tensor lifecycle when given an HTML element
  return cocoModel.detect(canvas, 10, 0.5)
}
```

### Motion score from COCO-SSD bounding box delta

```typescript
// [ASSUMED pattern — no official TF.js "motion score" API exists]
// Motion proxy: compare bounding box centroids of matching classes across frames.
// If no COCO objects detected, fall back to pixel-diff via Canvas API (see below).

interface BBoxCentroid { x: number; y: number; cls: string }

function getCentroids(preds: cocoSsd.DetectedObject[]): BBoxCentroid[] {
  return preds.map(p => ({
    cls: p.class,
    x: p.bbox[0] + p.bbox[2] / 2,
    y: p.bbox[1] + p.bbox[3] / 2,
  }))
}

function euclidean(a: BBoxCentroid, b: BBoxCentroid): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

// Returns 0–1 motion score normalised to frame diagonal
export function computeMotionScore(
  frame1Preds: cocoSsd.DetectedObject[],
  frame2Preds: cocoSsd.DetectedObject[],
  frameWidth: number,
  frameHeight: number
): number {
  const diagonal = Math.sqrt(frameWidth ** 2 + frameHeight ** 2)
  const c1 = getCentroids(frame1Preds)
  const c2 = getCentroids(frame2Preds)

  if (c1.length === 0 || c2.length === 0) return 0

  // Match same class between frames, compute average displacement
  let totalDist = 0
  let matched = 0
  for (const a of c1) {
    const match = c2.find(b => b.cls === a.cls)
    if (match) { totalDist += euclidean(a, match); matched++ }
  }

  return matched > 0 ? Math.min(totalDist / matched / diagonal, 1) : 0
}

// Fallback: pixel-diff via Canvas when COCO-SSD detects nothing
export function pixelDiffMotionScore(canvas1: HTMLCanvasElement, canvas2: HTMLCanvasElement): number {
  const w = canvas1.width, h = canvas1.height
  const ctx1 = canvas1.getContext('2d')!
  const ctx2 = canvas2.getContext('2d')!
  const d1 = ctx1.getImageData(0, 0, w, h).data
  const d2 = ctx2.getImageData(0, 0, w, h).data
  let diff = 0
  // Sample every 4th pixel for performance (every 16th byte = 1 RGBA = 4 bytes, step 16)
  for (let i = 0; i < d1.length; i += 16) {
    diff += Math.abs(d1[i] - d2[i])       // R
    diff += Math.abs(d1[i+1] - d2[i+1])   // G
    diff += Math.abs(d1[i+2] - d2[i+2])   // B
  }
  const maxPossible = (d1.length / 16) * 3 * 255
  return diff / maxPossible // 0–1
}
```

### TF.js face detection with MediaPipe backend

```typescript
// [VERIFIED: tfjs-models/face-detection/src/mediapipe/README.md]
// Required packages:
//   npm install @mediapipe/face_detection @tensorflow/tfjs-core @tensorflow/tfjs-backend-webgl @tensorflow-models/face-detection

import '@mediapipe/face_detection'
import '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgl'
import * as faceDetection from '@tensorflow-models/face-detection'

let faceDetector: faceDetection.FaceDetector | null = null

// Call when file is selected (alongside COCO-SSD pre-warm)
export async function prewarmFaceDetector(): Promise<void> {
  if (faceDetector) return
  const model = faceDetection.SupportedModels.MediaPipeFaceDetector
  faceDetector = await faceDetection.createDetector(model, {
    runtime: 'mediapipe',
    // solutionPath MUST point to the mediapipe package — no path = silent load failure
    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection',
    maxFaces: 1,
    modelType: 'short', // 'short' handles faces up to ~2m — fine for video thumbnails
  })
}

// Returns true if any frame contains a face
export async function detectFacePresence(canvas: HTMLCanvasElement): Promise<boolean> {
  if (!faceDetector) await prewarmFaceDetector()
  const faces = await faceDetector!.estimateFaces(canvas, { flipHorizontal: false })
  return faces.length > 0
}
// Note: context for this project says "no face on camera" for Pakistani travel/scenery content.
// Face presence flag is still computed for the virality score signal (human presence = higher engagement).
```

### TF.js memory management for repeat analyses

```typescript
// [VERIFIED: official TF.js docs, issue #2204, COCO-SSD README note]
// RULE: tf.tidy() does NOT work with async code. Do NOT use it around model.detect().
// SAFE PATTERN: pass HTML elements (canvas/img) directly — models handle internal tensors.
// For any tensor YOU create, call .dispose() explicitly.

// Check for leaks in development:
const before = tf.memory().numTensors
await runFullAnalysis()
const after = tf.memory().numTensors
if (after > before) {
  console.warn(`Tensor leak: ${after - before} tensors not disposed after analysis`)
}

// Disposing models when app unmounts (not needed between analyses — keep alive for speed):
export function disposeTFModels(): void {
  if (cocoModel) { cocoModel.dispose(); cocoModel = null }
  if (faceDetector) { faceDetector.dispose(); faceDetector = null }
}
```

### Beat/audio energy detection

```typescript
// [VERIFIED: npm web-audio-beat-detector v8.2.36, github.com/chrisguttandin]
// web-audio-beat-detector accepts an AudioBuffer — decode audio from file first.

import { analyze } from 'web-audio-beat-detector'

export async function extractAudioSignals(file: File): Promise<{
  hasBeat: boolean
  bpm: number
  hasAudio: boolean
}> {
  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await file.arrayBuffer()
  } catch {
    return { hasBeat: false, bpm: 0, hasAudio: false }
  }

  // OfflineAudioContext: no hardware output, runs faster than real-time
  const audioCtx = new OfflineAudioContext(1, 44100, 44100)
  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  } catch {
    // Video has no audio track — not an error
    return { hasBeat: false, bpm: 0, hasAudio: false }
  }

  // Check audio energy — sum of absolute sample values
  const channelData = audioBuffer.getChannelData(0)
  let energy = 0
  for (let i = 0; i < channelData.length; i += 100) energy += Math.abs(channelData[i])
  const hasAudio = energy / (channelData.length / 100) > 0.01

  if (!hasAudio) return { hasBeat: false, bpm: 0, hasAudio: false }

  try {
    // analyze() resolves with tempo (float). Default range 90–180 BPM.
    const tempo = await analyze(audioBuffer)
    return { hasBeat: tempo > 0, bpm: Math.round(tempo), hasAudio: true }
  } catch {
    // No beat detected — still has audio, just no clear beat
    return { hasBeat: false, bpm: 0, hasAudio: true }
  }
}
```

### Two-phase loading indicator state machine

```typescript
// Phase 1: "Analysing video..." — ffmpeg phase (metadata + frames + scene detection)
// Phase 2: "Generating copy..." — AI phase (Phase 5, not Phase 3)
// Within Phase 3, the indicator stays in Phase 1 throughout.
type AnalysisPhase = 'idle' | 'loading-models' | 'analysing' | 'done' | 'error'
// 'loading-models' fires when file is selected (prewarm starts)
// 'analysing' fires when user clicks Analyse
```

---

## Dependency Checklist (must be true before phase starts)

Before writing any Phase 3 code, ALL of the following must be confirmed:

- [ ] COOP/COEP headers present in `vite.config.ts` server.headers AND confirmed with `curl -I http://localhost:5173` showing both headers
- [ ] `@ffmpeg/ffmpeg@0.12.15` installed (`npm view @ffmpeg/ffmpeg version` returns `0.12.15`)
- [ ] `@ffmpeg/core@0.12.10` installed (NOT core-mt; `npm view @ffmpeg/core version` returns `0.12.10`)
- [ ] `@ffmpeg/util@0.12.2` installed
- [ ] `vite.config.ts` has `optimizeDeps.exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']`
- [ ] `@tensorflow/tfjs@4.22.0` installed
- [ ] `@tensorflow-models/coco-ssd@2.2.3` installed
- [ ] `@tensorflow-models/face-detection@1.0.3` installed
- [ ] `@mediapipe/face_detection@0.4.1646425229` installed
- [ ] `@tensorflow/tfjs-backend-webgl@4.22.0` installed
- [ ] `web-audio-beat-detector@8.2.36` installed
- [ ] ffmpeg.wasm proof-of-concept test: write a temp file + readFile + deleteFile works without error in browser dev console before building the analysis pipeline
- [ ] `ffmpeg.ffprobe()` test: call with `-o meta.json` on a short video, confirm `readFile('meta.json', 'utf8')` returns valid JSON despite return code being -1

### Exact install command

```bash
npm install @ffmpeg/ffmpeg@0.12.15 @ffmpeg/core@0.12.10 @ffmpeg/util@0.12.2
npm install @tensorflow/tfjs@4.22.0 @tensorflow-models/coco-ssd@2.2.3
npm install @tensorflow-models/face-detection@1.0.3 @mediapipe/face_detection
npm install @tensorflow/tfjs-backend-webgl@4.22.0
npm install web-audio-beat-detector@8.2.36
```

---

## Risk Assessment

**Estimated Risk: MEDIUM** (downgraded from HIGH based on findings)

### Why not HIGH:
- `@ffmpeg/core` single-thread does NOT require SharedArrayBuffer — iOS fallback is narrower than feared
- `@ffmpeg/ffmpeg` 0.12.x already uses an internal Web Worker — UI freeze is not a Phase 3 risk
- All library APIs confirmed from official documentation — no speculation required

### Remaining MEDIUM risks:
- **ffprobe() -1 return bug (verified):** Must not gate logic on return code. Known workaround documented above.
- **MediaPipe solutionPath CDN dependency:** If jsDelivr is blocked or slow, face-detection pre-warm fails. Mitigation: fall back gracefully (face_present = null, not false).
- **250 MB file in WASM virtual FS:** Writing a 250 MB file to the Emscripten in-memory FS consumes ~250 MB of browser heap on top of the WASM module itself (~50 MB). On low-RAM devices this can crash the tab. Mitigation: enforce the 250 MB upload cap hard, warn at 200 MB (already in the spec's success criteria).
- **`web-audio-beat-detector` on files with no audio track:** `decodeAudioData` throws — must be caught (documented above).
- **COCO-SSD finds no objects (scenery-only videos):** Motion score falls back to pixel-diff. This is the expected case for travel content — implement fallback proactively, not reactively.

### No longer a risk:
- Web Worker migration (already internal to ffmpeg.wasm 0.12.x)
- iOS SAB hard failure with single-thread core

---

## Sources

### Primary (HIGH confidence)
- `ffmpegwasm.netlify.app/docs/overview` — architecture, worker usage, single vs multi-thread
- `ffmpegwasm.netlify.app/docs/getting-started/usage` — initialization patterns, CDN URLs
- `ffmpegwasm.netlify.app/docs/api/ffmpeg/classes/ffmpeg/` — complete API reference
- `github.com/ffmpegwasm/ffmpeg.wasm/issues/817` — ffprobe() return -1 bug confirmation
- `github.com/tensorflow/tfjs-models/tree/master/face-detection/src/mediapipe/README.md` — MediaPipe backend setup
- `github.com/tensorflow/tfjs-models/blob/master/coco-ssd/README.md` — COCO-SSD API
- `github.com/chrisguttandin/web-audio-beat-detector` — beat detector API
- `caniuse.com/sharedarraybuffer` — iOS Safari SAB support table (15.2+)
- `npm view` — all package versions verified against npm registry

### Secondary (MEDIUM confidence)
- `transloadit.com/devtips/extract-thumbnails-from-videos-in-browsers-with-ffmpeg-wasm` — frame extraction patterns
- `debugplay.com/posts/ffmpeg-react-setup` — 2025 Vite config
- `xup60521.github.io/blog/vite-react-typescript-ffmpeg-wasm` — optimizeDeps pattern
- `gist.github.com/dudewheresmycode/054c8de34762091b43530af248b369e7` — scene detection filter syntax

### Assumptions log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Motion score via COCO-SSD centroid delta is an effective proxy for video motion | Motion score pattern | Score is inaccurate — fall back to pixel-diff (also implemented) |
| A2 | 10 sequential `ffmpeg.exec()` single-frame extractions are fast enough (<15s for 250 MB) | Frame extraction | Analysis feels slow — batch to fewer frames or add Web Worker |
| A3 | `web-audio-beat-detector` gives useful BPM signal on travel/driving audio (non-music) | Beat detection | BPM 0 returned for ambient audio — hasAudio flag is still valid signal |
