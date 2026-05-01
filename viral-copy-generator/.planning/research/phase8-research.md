# Phase 8 Deep Research — Polish + Resilience

**Phase goal:** The tool runs smoothly under repeated use, on mobile, on iOS Safari, and under
error conditions. ffmpeg Web Worker migration, tensor leak guard, descriptive error states,
mobile layout hardening.

**Researched:** 2026-04-30
**Confidence:** HIGH

---

## Confirmed Approach (no changes needed)

### A1 — ffmpeg.wasm already runs WASM in its built-in worker

`@ffmpeg/ffmpeg` 0.12 **already offloads all WASM execution to an internal worker thread**
(`ffmpeg.worker`). The architecture documentation states: "Offload those task to web worker
(`ffmpeg.worker`) by default to avoid blocking the main thread." [VERIFIED: ffmpegwasm.netlify.app/docs/overview]

The "Web Worker migration" in Phase 8 is NOT about wrapping ffmpeg in a new outer Worker.
It is about **correctly configuring the built-in worker in the Vite build**, specifically the
`classWorkerURL` and `optimizeDeps.exclude` settings. If these are already correct from Phase 3,
no migration is needed — only verification.

**What actually causes UI freeze during analysis:**
- Reading a large `File` object on the main thread (synchronous blob read)
- The `ffmpeg.writeFile()` call — it copies data into the WASM virtual FS before handing off
- JS computation for TF.js inference on the main thread (inference itself is async but model
  input preparation happens synchronously)
- Heavy Canvas operations (drawing 10 frames for luma scoring) blocking the render thread

The WASM execution itself does not block the main thread. The file I/O bookending it does.

**Verdict:** Verify Vite config from Phase 3. If freeze persists, profile with Chrome DevTools
Performance tab to find the specific blocking call. The fix is likely `URL.createObjectURL(file)`
deferral or wrapping the `writeFile` call inside a `setTimeout(0)` yield pattern.

### A2 — Two-phase loading indicator already specified

"Analysing video..." covers the ffmpeg + TF.js + Web Audio phase.
"Generating copy..." covers the AI call phase.
This maps cleanly to Phase 8 requirements. No architectural change needed.

### A3 — react-error-boundary is the right choice

`react-error-boundary` v6.1.1 (current as of 2026-04-30) [VERIFIED: npm registry] supports:
- `ErrorBoundary` component wrapping
- `FallbackComponent` prop for custom fallback UI
- `resetKeys` prop to auto-reset when an array of values changes (e.g., when a new file is selected)
- `onReset` callback for cleanup
React 19 compatible. No class component needed.

### A4 — Bundle size: both large packages are runtime-fetched, not bundled

`@ffmpeg/core` unpacked: ~62 MB [VERIFIED: npm registry dist.unpackedSize].
`@tensorflow/tfjs` unpacked: ~147 MB [VERIFIED: npm registry dist.unpackedSize].

Neither is bundled into the JavaScript chunk. The `.wasm` file (~22 MB) is fetched from CDN
at runtime via `toBlobURL()`. TF.js model weights are downloaded from `storage.googleapis.com`
when models are first loaded. These do not inflate the initial page bundle.

The JavaScript glue code for `@ffmpeg/ffmpeg` is small (< 100 kB). The impact on the
initial bundle is negligible if the Vite `optimizeDeps.exclude` is set correctly (see Issues
section).

---

## Issues Found (must fix in plan)

### I1 — Vite config must exclude ffmpeg packages from pre-bundling

If `@ffmpeg/ffmpeg` and `@ffmpeg/util` are not excluded from Vite's optimizeDeps, Vite
pre-bundles them, which breaks the internal `new Worker('./worker.js')` path resolution.
The worker.js file has a relative path that Vite's module transform breaks. [VERIFIED: multiple
GitHub issues #617, #856, community reports]

Required `vite.config.ts` entries:

```typescript
export default defineConfig({
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
```

**Also required:** Use the ESM distribution (not UMD) when loading from CDN. Vite uses ESM
modules, and the UMD build causes import errors.

```typescript
// Correct for Vite
const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'
await ffmpeg.load({
  coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
  wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
})
```

For **local serving** of worker.js (required if `classWorkerURL` is needed for same-origin
SharedArrayBuffer): copy `node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js` to your public
assets directory and serve it as a static file.

### I2 — tf.tidy() does NOT support async functions

`tf.tidy()` is synchronous-only. Passing an async function to it is silently incorrect — it
returns a Promise, not the tensor value, and cleanup is NOT triggered after the async
operation completes. [VERIFIED: TensorFlow.js official docs, tensors_operations guide]

The analysis loop in `motion.ts` runs TF.js inference asynchronously over 10 frames. The
correct pattern is:

**For each frame (synchronous inference wrapping):**
```typescript
// WRONG — async inside tf.tidy does not clean up
const result = await tf.tidy(async () => {
  const tensor = tf.browser.fromPixels(canvas)
  return model.detect(tensor) // async — cleanup never happens
})

// CORRECT — tf.tidy wraps only the synchronous tensor creation
// async operations use explicit dispose()
async function analyseFrame(canvas: HTMLCanvasElement): Promise<Detection[]> {
  const imageTensor = tf.browser.fromPixels(canvas)
  try {
    const predictions = await model.detect(imageTensor)
    return predictions
  } finally {
    imageTensor.dispose() // explicit dispose — not tf.tidy
  }
}
```

**For synchronous sub-operations (luma scoring, etc.):**
```typescript
const lumaScore = tf.tidy(() => {
  const t = tf.browser.fromPixels(canvas)
  const grey = tf.mean(t, 2)
  return grey.mean().dataSync()[0]
  // t and grey are auto-disposed
})
```

**Dev-mode leak detection:**
```typescript
const before = tf.memory().numTensors
await analyseFrame(canvas)
const after = tf.memory().numTensors
if (after > before) {
  console.warn(`Tensor leak: ${after - before} tensors not disposed`)
}
```

Add `tf.memory().numTensors` checks in `engine.ts` in development builds only
(`import.meta.env.DEV`). Log before and after each full analysis run. Target: numTensors
returns to the same count after analysis as before analysis.

### I3 — API error messages are three different shapes

Each provider returns a structurally different error. A single generic error handler
will miss important distinctions (especially the difference between "invalid key" and
"rate limited" — one requires user action, the other needs a retry).

**Claude (Anthropic):**
```json
{
  "type": "error",
  "error": {
    "type": "authentication_error",     // or rate_limit_error, overloaded_error
    "message": "There's an issue with your API key."
  },
  "request_id": "req_..."
}
```
HTTP status codes: 401 (invalid key), 429 (rate limit), 529 (overloaded), 500 (server error).
[VERIFIED: platform.claude.com/docs/en/api/errors]

**Gemini (Google):**
```json
{
  "error": {
    "code": 400,
    "message": "API key not valid. Please pass a valid API key.",
    "status": "INVALID_ARGUMENT"
  }
}
```
Status values: `INVALID_ARGUMENT` (bad key, 400), `RESOURCE_EXHAUSTED` (rate limit/quota, 429),
`UNAVAILABLE` (model overloaded, 503). [VERIFIED: Google AI docs via web search with
cross-referenced GitHub issues]

**OpenAI:**
```json
{
  "error": {
    "message": "Incorrect API key provided.",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}
```
Error codes: `invalid_api_key` (401), `rate_limit_exceeded` (429), `insufficient_quota` (429
with different meaning — out of credits), `model_not_found` (404). [VERIFIED: developers.openai.com
via web search, community confirmed error code names]

**Required mapping table in `ai.ts`:**

| Condition | User-facing message | Retry eligible |
|-----------|---------------------|----------------|
| Claude 401 / `authentication_error` | "Invalid API key — check Settings" | No |
| Claude 429 / `rate_limit_error` | "Rate limited — wait a moment and try again" | Yes |
| Claude 529 / `overloaded_error` | "Claude is busy — try again in a few seconds" | Yes |
| Gemini `INVALID_ARGUMENT` (400) | "Invalid Gemini API key — check Settings" | No |
| Gemini `RESOURCE_EXHAUSTED` (429) | "Gemini quota exceeded — check your Google AI usage limits" | No (quota) / Yes (rate) |
| Gemini `UNAVAILABLE` (503) | "Gemini model is busy — try again" | Yes |
| OpenAI `invalid_api_key` (401) | "Invalid OpenAI API key — check Settings" | No |
| OpenAI `rate_limit_exceeded` (429) | "Rate limited — wait a moment and try again" | Yes |
| OpenAI `insufficient_quota` (429) | "OpenAI credits exhausted — add billing at platform.openai.com" | No |
| Network error (no status) | "Network error — check your connection and try again" | Yes |

### I4 — OAuth token expiry detection requires a specific backend pattern

When a Google or Meta token expires mid-session, the backend upload proxy receives a 401
from the upstream API. The backend must:

1. Attempt token refresh using the stored refresh token first (automatic, transparent)
2. If refresh also returns 401 (token revoked, not just expired): return a structured error
   to the frontend with a specific error type, not a generic 500

**Backend response when OAuth expired and unrecoverable:**
```json
{
  "error": "oauth_expired",
  "platform": "youtube",
  "message": "YouTube session expired. Reconnect your account in Settings."
}
```

**Frontend handling:**
- Show a non-blocking banner on the relevant platform card: "YouTube disconnected — tap to reconnect"
- The banner links to Settings screen (not a modal — user must complete OAuth flow)
- Manual copy buttons remain active and accessible at all times
- Upload status for that platform shows "Failed" with the reconnect prompt embedded

This is NOT a mid-analysis failure (analysis is fully client-side). It only affects the upload
step. The generated copy is already available to copy-paste before upload is attempted.

### I5 — iOS Safari 100vh bug requires dvh units

Using `h-screen` (which maps to `100vh`) causes layout cutoff on iOS Safari. The browser
chrome (address bar + bottom bar) resizes dynamically, and `100vh` can represent the height
with the bars retracted, causing the bottom of the screen to be hidden when bars are visible.
[VERIFIED: MDN docs, multiple iOS Safari discussions]

**Correct pattern:**
- Replace `h-screen` with `h-[100dvh]` (dynamic viewport height — supported iOS 15.4+)
- For older iOS fallback: `min-h-[100svh] h-[100dvh]` (small viewport height as floor)
- Safe area insets for fixed bottom elements: `pb-[env(safe-area-inset-bottom)]`

Also requires `<meta name="viewport" content="width=device-width, initial-scale=1,
viewport-fit=cover">` to enable safe-area-inset-* environment variables.

Tailwind CSS v4 does not include `h-dvh`, `h-svh` as named utilities by default; use the
bracket notation `h-[100dvh]` unless a custom plugin or arbitrary value is defined.

### I6 — Platform cards on mobile require specific Tailwind structure to prevent overflow

Five platform cards in a scrollable list. The incorrect pattern creates horizontal scroll or
card overflow.

**Incorrect:**
```html
<div class="flex gap-4">  <!-- horizontal layout, causes scroll on mobile -->
  <PlatformCard />
```

**Correct for mobile-first vertical stack:**
```html
<div class="flex flex-col gap-4 w-full overflow-x-hidden">
  <div class="w-full rounded-xl border ...">  <!-- no fixed width on cards -->
    <PlatformCard />
  </div>
```

Key rules:
- Cards: `w-full` not `w-[400px]` or any fixed width
- Container: `overflow-x-hidden` to catch any accidental overflow
- Copy button + upload button on same row: `flex items-center gap-2 flex-wrap` to wrap on
  very narrow screens
- Character counter text: `text-xs` to fit on 320px screens (iPhone SE)
- No `min-w-*` constraints inside cards

### I7 — Progress events from ffmpeg are unreliable for extraction tasks

The ffmpeg `on('progress', { progress, time })` event is documented as "experimental and
might not work for many cases (ex. concat video files, convert image files, ...)."
[VERIFIED: ffmpegwasm.netlify.app/docs/getting-started/usage]

Frame extraction (the primary ffmpeg task in this app) is a "convert image files" case —
one of the explicitly listed unreliable cases. The progress value may only report 0 then 1
(start and end) with nothing in between.

**Correct approach for Phase 8:**
- Use the progress event to animate the loading indicator (any value > 0 = "working")
- Do NOT use progress value to calculate a percentage bar
- The two-phase indicator ("Analysing video..." / "Generating copy...") is sufficient and
  more reliable than a percentage bar
- If a progress pulse animation is desired, use a CSS indeterminate progress bar (`animate-pulse`
  or CSS `@keyframes`) rather than an event-driven percentage

---

## Implementation Notes (specific code patterns)

### N1 — Vite config (final Phase 3/8 verified config)

```typescript
// vite.config.ts
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
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          // Do NOT put @ffmpeg or @tensorflow in manualChunks —
          // they are loaded at runtime from CDN, not bundled
        },
      },
    },
  },
})
```

### N2 — ffmpeg singleton pattern with correct load

```typescript
// frontend/src/lib/video.ts
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

let ffmpegInstance: FFmpeg | null = null

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance

  ffmpegInstance = new FFmpeg()

  // Register progress listener before load
  ffmpegInstance.on('progress', ({ progress }) => {
    // progress is 0-1 (experimental, unreliable for extraction)
    // Use only for animation trigger, not percentage display
    window.dispatchEvent(new CustomEvent('ffmpeg-progress', { detail: progress }))
  })

  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'
  await ffmpegInstance.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    // classWorkerURL only needed if serving worker.js locally
    // classWorkerURL: await toBlobURL('/assets/ffmpeg/worker.js', 'text/javascript'),
  })

  return ffmpegInstance
}
```

### N3 — Tensor leak guard pattern

```typescript
// frontend/src/lib/motion.ts

// Per-frame async analysis — explicit dispose
export async function analyseFrame(
  canvas: HTMLCanvasElement,
  model: ObjectDetection,
): Promise<{ objects: string[]; hasMotion: boolean }> {
  const tensorsBefore = import.meta.env.DEV ? tf.memory().numTensors : 0

  const imageTensor = tf.browser.fromPixels(canvas)
  let predictions: ObjectDetectionResult[]
  try {
    predictions = await model.detect(imageTensor)
  } finally {
    imageTensor.dispose()
  }

  if (import.meta.env.DEV) {
    const tensorsAfter = tf.memory().numTensors
    if (tensorsAfter > tensorsBefore) {
      console.warn(`[TF leak] Frame analysis leaked ${tensorsAfter - tensorsBefore} tensors`)
    }
  }

  return {
    objects: predictions.map(p => p.class),
    hasMotion: predictions.length > 0,
  }
}

// Full analysis run — check at boundary
export async function runMotionAnalysis(frames: HTMLCanvasElement[]): Promise<MotionResult> {
  const tensorsBefore = import.meta.env.DEV ? tf.memory().numTensors : 0

  const results = await Promise.all(frames.map(f => analyseFrame(f, getModel())))

  if (import.meta.env.DEV) {
    const tensorsAfter = tf.memory().numTensors
    console.log(`[TF memory] Before: ${tensorsBefore}, After: ${tensorsAfter}`)
  }

  return aggregateResults(results)
}
```

### N4 — Error boundary placement

```typescript
// frontend/src/pages/Generator.tsx
import { ErrorBoundary } from 'react-error-boundary'

function AnalysisFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error
  resetErrorBoundary: () => void
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p className="font-semibold">Analysis failed</p>
      <p className="mt-1 text-red-600">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-white text-xs font-medium"
      >
        Try again
      </button>
    </div>
  )
}

// In Generator component:
<ErrorBoundary
  FallbackComponent={AnalysisFallback}
  resetKeys={[selectedFile]}  // auto-reset when a new file is selected
  onReset={() => {
    setAnalysisResult(null)
    setGeneratedCopy(null)
  }}
>
  <AnalysisResultSection result={analysisResult} />
</ErrorBoundary>
```

**Boundary placement rules:**
- ONE boundary around the entire analysis output section (score + checklist + platform cards)
- Do NOT put boundaries inside individual platform cards — a card error should reset the
  whole output, not silently show a partial result
- Do NOT put a boundary around the file upload component — file errors should be inline
  validation messages, not caught by ErrorBoundary

### N5 — AI error handler

```typescript
// frontend/src/lib/ai.ts

type AIErrorKind =
  | 'invalid_key'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'model_busy'
  | 'network'
  | 'unknown'

interface AIError {
  kind: AIErrorKind
  message: string   // user-facing
  retryable: boolean
}

export function parseProviderError(provider: 'claude' | 'gemini' | 'openai', err: unknown): AIError {
  const raw = err as Record<string, unknown>

  if (!navigator.onLine) {
    return { kind: 'network', message: 'No internet connection — check your network', retryable: true }
  }

  if (provider === 'claude') {
    const type = (raw?.error as Record<string, string>)?.type
    if (type === 'authentication_error') return { kind: 'invalid_key', message: 'Invalid Claude API key — update it in Settings', retryable: false }
    if (type === 'rate_limit_error') return { kind: 'rate_limited', message: 'Claude is rate-limited — wait a moment and try again', retryable: true }
    if (type === 'overloaded_error') return { kind: 'model_busy', message: 'Claude is busy — try again in a few seconds', retryable: true }
  }

  if (provider === 'gemini') {
    const status = (raw?.error as Record<string, string>)?.status
    if (status === 'INVALID_ARGUMENT') return { kind: 'invalid_key', message: 'Invalid Gemini API key — update it in Settings', retryable: false }
    if (status === 'RESOURCE_EXHAUSTED') return { kind: 'quota_exhausted', message: 'Gemini quota exceeded — check your Google AI usage limits', retryable: false }
    if (status === 'UNAVAILABLE') return { kind: 'model_busy', message: 'Gemini is busy — try again in a few seconds', retryable: true }
  }

  if (provider === 'openai') {
    const code = (raw?.error as Record<string, string>)?.code
    if (code === 'invalid_api_key') return { kind: 'invalid_key', message: 'Invalid OpenAI API key — update it in Settings', retryable: false }
    if (code === 'rate_limit_exceeded') return { kind: 'rate_limited', message: 'OpenAI rate limit reached — wait a moment and try again', retryable: true }
    if (code === 'insufficient_quota') return { kind: 'quota_exhausted', message: 'OpenAI credits exhausted — add billing at platform.openai.com', retryable: false }
  }

  return { kind: 'unknown', message: 'Unexpected error — try again', retryable: true }
}
```

### N6 — Retry button UX

Show retry ONLY for `retryable: true` errors. The retry button must:
- Preserve the current file selection and analysis result
- Only re-run the AI call, not the full analysis pipeline
- Disable itself during the retry (prevent double-click)
- Show a different message if the second attempt also fails ("Still failing —
  check your API key or try again later")

Do NOT auto-retry. Auto-retry without user action creates a confusing spinner loop.

```typescript
function CopyErrorState({ error, onRetry }: { error: AIError; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-800">{error.message}</p>
      {error.retryable && onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs font-medium text-amber-700 underline">
          Try again
        </button>
      )}
      {!error.retryable && (
        <a href="#settings" className="mt-2 block text-xs font-medium text-amber-700 underline">
          Go to Settings
        </a>
      )}
    </div>
  )
}
```

### N7 — Score calibration badge

A small inline badge showing calibration status, no external component library needed.
Appears next to the score card heading.

```tsx
function CalibrationBadge({ dataPoints }: { dataPoints: number }) {
  const isCalibrated = dataPoints >= 10

  return (
    <span
      className={`
        inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium
        ${isCalibrated
          ? 'bg-green-100 text-green-700'
          : 'bg-slate-100 text-slate-500'}
      `}
      title={isCalibrated
        ? `Score calibrated using your ${dataPoints} logged posts`
        : `Baseline formula — log actual views to calibrate (${dataPoints}/10)`}
    >
      {isCalibrated ? `Calibrated (${dataPoints} posts)` : 'Baseline'}
    </span>
  )
}
```

Place directly after the score heading. No modal, no tooltip component library —
native `title` attribute is sufficient for this low-stakes indicator. The tooltip
shows on hover (desktop) and long-press (mobile).

### N8 — iOS Safari mobile layout (full page structure)

```tsx
// App.tsx — root layout
<div className="flex h-[100dvh] flex-col overflow-hidden">
  {/* Top nav bar */}
  <nav className="flex-none border-b bg-white px-4 py-3">
    ...
  </nav>

  {/* Scrollable content area — this is the only element that scrolls */}
  <main className="flex-1 overflow-y-auto overflow-x-hidden pb-[env(safe-area-inset-bottom,16px)]">
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* All screens render here */}
      {activeScreen === 'generator' && <GeneratorScreen />}
      ...
    </div>
  </main>
</div>
```

**Viewport meta tag (index.html):**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

`viewport-fit=cover` is required for `env(safe-area-inset-*)` to take effect on devices
with notches or home indicator bars.

---

## Dependency Checklist (must be true before phase starts)

- [ ] Phase 7 complete: post history screen, learning loops, score calibration data flow all working
- [ ] `react-error-boundary` is installed (v6.1.1 current): `npm install react-error-boundary`
- [ ] Vite config has `optimizeDeps.exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']` from Phase 3
- [ ] COOP/COEP headers confirmed present in both Vite dev config and Nginx production config
- [ ] `@ffmpeg/core` (not `@ffmpeg/core-mt`) confirmed as the active build
- [ ] `tf.memory().numTensors` is logged in DEV mode from Phase 3 implementation
- [ ] `index.html` has `viewport-fit=cover` in the meta viewport tag
- [ ] AI provider error responses have been tested with intentionally wrong keys to confirm error shapes

---

## Estimated Risk: MEDIUM

**Rationale:**
- The ffmpeg "Web Worker migration" is lower risk than it sounds: the WASM already runs in a
  built-in worker. The work is Vite configuration verification, not a new architecture.
- The TF.js tensor fix has a sharp constraint (`tf.tidy()` is sync-only) that requires
  refactoring the frame analysis loop if it was written naively. This is a moderate effort
  rework.
- API error handling is thorough but mechanical — three different shapes, documented above.
- iOS Safari layout is well-understood with `dvh` units. Risk is LOW if the viewport meta
  tag is set correctly.
- The main risk is **test coverage**: Phase 8 is primarily defensive — catching regressions
  that only appear under repeat use, on a phone, or on a specific OS. These are hard to
  verify in automated tests and require real-device testing.

**Highest-risk item:** Confirming `tf.memory().numTensors` is stable across 5 consecutive
analyses. This requires a real video file and a real browser session, not a unit test.

---

## Sources

### Primary (HIGH confidence)
- ffmpegwasm.netlify.app/docs/overview — ffmpeg.wasm built-in worker architecture
- ffmpegwasm.netlify.app/docs/getting-started/usage — progress event API, Vite ESM config
- ffmpegwasm.netlify.app/docs/api/ffmpeg/classes/ffmpeg — FFmpeg class built-in worker
- tensorflow.org/js/guide/tensors_operations — tf.tidy() synchronous-only constraint
- platform.claude.com/docs/en/api/errors — Anthropic error shapes and codes
- npm registry (verified): react-error-boundary@6.1.1, @ffmpeg/ffmpeg@0.12.15, @ffmpeg/core@0.12.10

### Secondary (MEDIUM confidence)
- Multiple GitHub discussions (#617, #856, #798) cross-verified: Vite optimizeDeps.exclude requirement
- Google AI docs (cross-referenced GitHub issues): Gemini error status codes RESOURCE_EXHAUSTED, UNAVAILABLE, INVALID_ARGUMENT
- developers.openai.com + community: OpenAI error codes invalid_api_key, insufficient_quota, rate_limit_exceeded
- MDN + Safari release notes: dvh/svh viewport units iOS 15.4+ support

### Tertiary (LOW confidence — verified by cross-referencing)
- ffmpeg progress event unreliability for image extraction: multiple GitHub issues (#600, #112) confirm this behavior
- Score calibration badge: UI design recommendation, no external authority — based on general UX principle of unobtrusive status indicators
