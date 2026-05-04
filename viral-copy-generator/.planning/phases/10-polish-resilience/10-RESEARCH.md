# Phase 10: Polish + Resilience - Research

**Researched:** 2026-05-04
**Domain:** React error boundaries, API error normalization, iOS Safari layout, TF.js memory, Vite bundle optimization
**Confidence:** HIGH

---

## Summary

Phase 10 is a pure polish/resilience phase — no new user-facing features, only quality
hardening across the codebase. The platform already compiles clean (tsc) and all previous
phases pass their automated suites, so this phase focuses on six independent dimensions
of quality that were intentionally deferred until the end.

The good news: the codebase is already partially conformant. `h-[100dvh]` is used on all
six screen pages; `pb-[env(safe-area-inset-bottom)]` is applied to every `<main>` scroll
area; `viewport-fit=cover` is in `index.html`. The AI error catch block in GeneratorPage
already maps known error strings to human-readable messages and gates the retry button on
a `RETRYABLE_ERRORS` set. What is missing: `model_busy` is not in RETRYABLE_ERRORS despite
the ROADMAP requiring it; `oauth_expired` is not returned or surfaced; `parseProviderError`
from the Phase 8 research is not implemented (still raw string-matching in the catch block);
no React error boundaries exist anywhere; `optimizeDeps.exclude` for ffmpeg is absent from
`vite.config.ts`; `engine.ts` does not exist yet (Phase 3 paused); and the ffmpeg progress
handler (when Phase 3 lands) will need the indeterminate-spinner pattern.

Because Phase 3 (Video Upload + Analysis Engine) is paused with engine.ts unimplemented,
TF.js and ffmpeg progress work is scoped to patterns and stubs that will wire in when
Phase 3 resumes. Phase 10 must not block on Phase 3 being complete.

**Primary recommendation:** Implement in four independent waves: (1) API error
normalization + retry logic, (2) OAuth expiry surface path, (3) React error boundaries,
(4) Vite bundle config + iOS fixed-element audit. TF.js and ffmpeg stubs can be Wave 4
since engine.ts is absent.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| API error normalization | Frontend (lib/ai.ts) | — | Errors arrive as thrown exceptions in callAI(); mapping lives closest to the throw site |
| Retry button UX | Frontend (GeneratorPage) | — | UI state: aiErrorKey drives the conditional render |
| OAuth expiry detection | Backend (upload workers) | Frontend (GeneratorPage) | Backend throws structured error; frontend catches and maps |
| React error boundaries | Frontend (App.tsx + pages) | — | Wraps screen-level components to catch uncaught render errors |
| iOS layout (h-[100dvh], safe-area) | Frontend (all pages) | — | CSS/Tailwind — client-side layout concern |
| TF.js tensor dispose | Frontend (engine.ts) | — | In-browser inference; tensor lifecycle is front-end responsibility |
| ffmpeg progress animation | Frontend (GeneratorPage / analysis component) | — | UI: spinner during async analysis operation |
| Vite bundle optimization | Frontend (vite.config.ts) | — | Build-time config; keeps ffmpeg/TF.js out of the main chunk |
| Score calibration badge | Frontend (ScorePanel) | — | Already implemented; Phase 10 verifies correctness only |

---

## Current State Inventory

> Line numbers are exact as of 2026-05-04. Verify with grep before editing.

### 1. AI Error Handling — PARTIAL

**File:** `frontend/src/pages/GeneratorPage.tsx` lines 211–227

Current catch block does raw `msg.includes()` string matching:
```
rate_limited → 'rate_limited'
quota         → 'quota_exhausted'
network/fetch → 'network_error'
invalid_key   → 'invalid_key'
```

**What is MISSING:**
- `model_busy` is not in the current string-matching and not in `RETRYABLE_ERRORS` (line 50: `new Set(['rate_limited', 'network_error'])`) — ROADMAP requires it
- No per-provider structured error parsing (Claude `error.type`, Gemini `error.status`, OpenAI `error.code`)
- The `parseProviderError()` function from Phase 8 RESEARCH.md N5 pattern is never implemented in `frontend/src/lib/ai.ts` — it only has `callAI()`, `parseAIOutput()`, `buildAICallParams()`

**What EXISTS and is correct:**
- `ERROR_MESSAGES` Record at line 40–48 covers all required keys
- `RETRYABLE_ERRORS` Set at line 50 gates the retry button correctly (just missing `model_busy`)
- Retry button conditional at lines 409–417 is correctly structured

### 2. OAuth Expiry Error Path — NOT IMPLEMENTED

**Requirement:** Backend returns `{ code: 'oauth_expired', platform }` → frontend shows "Reconnect [platform] in Settings"

**Backend upload workers (current state):**
- `upload-youtube.ts` line 30: throws `'youtube_not_connected'` — no structured `oauth_expired` response
- `upload-instagram.ts` line 89: throws `'instagram_not_connected'`
- `upload-facebook.ts` line 30: throws `'facebook_not_connected'`
- No worker currently detects an EXPIRED token condition (only missing token)
- Token refresh for YouTube IS present (lines 41-59 in upload-youtube.ts) — but on refresh failure, the error propagates as a raw googleapis error, not `{ code: 'oauth_expired' }`

**Backend schedule route:** Returns pg-boss job ID on success. Worker failures update `platform_posts.upload_status = 'failed'` via `updateUploadStatus()` but the `error_message` column stores the raw error string, not a structured code.

**Frontend (current state):**
- `GeneratorPage.tsx` `handleScheduleConfirm()` lines 289–293: generic catch sets `uploadError` as `err.message`
- No special handling for `oauth_expired` — raw error reaches the UI

**What needs to be built:**
1. Backend: In upload workers, when a token refresh fails (googleapis throws 401/invalid_grant), catch that specific error and re-throw as `new Error('oauth_expired:youtube')` or similar structured string
2. Frontend: In `handleScheduleConfirm`, detect `oauth_expired` prefix → show "Reconnect YouTube in Settings" rather than raw error

### 3. React Error Boundaries — NOT IMPLEMENTED

**No error boundary exists anywhere in the codebase.** Confirmed by grep — zero matches for `ErrorBoundary`, `getDerivedStateFromError`, `componentDidCatch`.

**React 19 status:** Error boundaries still require class components in React 19 [VERIFIED: React 19 blog post]. React 19 added `onCaughtError`/`onUncaughtError` root-level hooks but component-level boundaries still use `getDerivedStateFromError` + `componentDidCatch`.

**Screens that need boundaries (ROADMAP requirement):** Generator, Research, Admin

**Recommended pattern** — minimal class component in `frontend/src/components/ErrorBoundary.tsx`:
```typescript
// Source: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  screenName?: string  // for console context
}

interface State {
  hasError: boolean
  errorMessage: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // DEV-only logging — never expose to user
    if (import.meta.env.DEV) {
      console.error(`[ErrorBoundary:${this.props.screenName ?? 'unknown'}]`, error, info)
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-12">
          <p className="text-sm text-zinc-400 text-center">
            Something went wrong. Reload the page to continue.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-500"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

**Usage in App.tsx** — wrap each screen render:
```typescript
// App.tsx — Generator screen (currently line 104-127)
return (
  <>
    <ErrorBoundary screenName="generator">
      <GeneratorPage onNavigate={setCurrentScreen} />
    </ErrorBoundary>
    {/* ... nav buttons ... */}
  </>
)
// similarly for ResearchPage and AdminPage
```

**CRITICAL:** Do NOT wrap App.tsx itself — the error boundary must be INSIDE the authenticated render so the auth gate still catches unauthenticated access. Wrapping at the screen level is correct.

### 4. Vite Bundle Optimization — NOT IMPLEMENTED

**File:** `frontend/vite.config.ts`

Current config (lines 26-41) has NO `optimizeDeps.exclude`. This means Vite's pre-bundling may attempt to process `@ffmpeg/ffmpeg` and `@ffmpeg/core` — packages that use WebAssembly and must be loaded directly by the browser, not pre-bundled by Vite's esbuild.

**Note:** `@ffmpeg/ffmpeg` and `@ffmpeg/core` are NOT in `frontend/package.json` yet — Phase 3 is paused. However, when Phase 3 installs them, the `vite.config.ts` must have `optimizeDeps.exclude` ready. Phase 10 should add it prophylactically so Phase 3 can simply install the packages and they work without a config change.

**Required addition to vite.config.ts:**
```typescript
export default defineConfig({
  // ... existing plugins + server config ...
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core'],
  },
})
```

TF.js lazy-loading is a Phase 3 concern (engine.ts warm-up on file select). Phase 10 can document the pattern but not implement it since engine.ts doesn't exist.

### 5. iOS Safari Layout — MOSTLY DONE, ONE GAP

**h-[100dvh]:** All six page components confirmed using `h-[100dvh]` [VERIFIED: grep].
- `GeneratorPage.tsx` line 299
- `ResearchPage.tsx` line 122
- `SettingsPage.tsx` line 115
- `HistoryPage.tsx` line 135
- `LearningPage.tsx` line 54
- `AdminPage.tsx` line 192

**pb-[env(safe-area-inset-bottom)]:** All six page `<main>` elements confirmed [VERIFIED: grep].

**viewport-fit=cover:** Present in `index.html` line 4.

**ONE GAP FOUND:** `App.tsx` line 107 renders a `fixed bottom-4 right-4` navigation cluster (Research + Admin buttons). This fixed element is NOT padded with `pb-[env(safe-area-inset-bottom)]`. On iPhone with home indicator, the buttons could be partially obscured.

**Fix needed in App.tsx:**
```typescript
// Current (line 107):
<div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">

// Required — add pb-[env(safe-area-inset-bottom)]:
<div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pb-[env(safe-area-inset-bottom)]">
```

**ScheduleModal** — `fixed inset-0` with flex, content rendered at `items-end` on mobile. The inner card div (`rounded-t-2xl p-5`) does not add safe-area padding. Should add `pb-[env(safe-area-inset-bottom)]` to the inner container.

### 6. TF.js Tensor Dispose — NOT APPLICABLE YET

`engine.ts` does not exist (Phase 3 paused). No TF.js packages are installed in `frontend/package.json`. This work is scoped to when Phase 3 installs `@tensorflow-models/face-detection`, `@tensorflow-models/coco-ssd`, and `@tensorflow/tfjs`.

**Pattern to implement (when engine.ts is built):**
```typescript
// Source: CLAUDE.md critical rule + ROADMAP Phase 10 notes
// tf.tidy() does NOT work with async — use explicit dispose in try/finally

import * as tf from '@tensorflow/tfjs'

async function runFaceDetection(canvas: HTMLCanvasElement): Promise<number> {
  let tensor: tf.Tensor | null = null
  try {
    tensor = tf.browser.fromPixels(canvas)
    // ... run model inference on element directly (not on tensor)
    const predictions = await model.detect(canvas)  // element-passing pattern
    return predictions.length
  } finally {
    tensor?.dispose()
    // DEV-only leak check:
    if (import.meta.env.DEV) {
      console.debug('[tf.memory] numTensors:', tf.memory().numTensors)
    }
  }
}
```

**Wave assignment:** Add Vite `optimizeDeps.exclude` in Phase 10 Wave 1. Actual tensor dispose code belongs in Phase 3 Wave X when engine.ts is built.

### 7. ffmpeg Progress — NOT APPLICABLE YET (same Phase 3 dependency)

No ffmpeg progress handler exists in the frontend (engine.ts absent). When Phase 3 builds the analysis pipeline, the GeneratorPage will need an indeterminate spinner instead of a percentage bar.

**Pattern for when Phase 3 lands:**
```typescript
// In GeneratorPage: analysing state drives spinner
{analysing && (
  <div className="flex items-center gap-2 rounded bg-zinc-800 px-4 py-3 text-sm text-zinc-200">
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
    Analysing video...
  </div>
)}
```

An `animate-spin` spinner (already used in the Generate Copy button at GeneratorPage line 400) is the correct pattern — it shows activity without implying a completion percentage.

### 8. Score Calibration Badge — ALREADY DONE

`ScorePanel.tsx` lines 22-29: calibration badge shows "Calibrated to your data (N posts)" when `dataPoints >= 10` and "Score calibration: N/10 posts logged" for 1-9. The condition and copy exactly match the ROADMAP requirement [VERIFIED: read ScorePanel.tsx].

No changes needed.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.5 | Error boundaries (class component pattern) | Required by project |
| Tailwind CSS | 4.2.4 | iOS safe-area utility classes | Required by project |
| Vite | ^6.4.2 | `optimizeDeps.exclude` for WebAssembly packages | Required by project |
| Vitest | 4.1.5 | Unit + component testing | Required by project |

### No New Dependencies Required
Phase 10 introduces no new npm packages. All work uses what is already installed.
- Error boundaries: React class component (built-in)
- `parseProviderError`: vanilla TypeScript in `frontend/src/lib/ai.ts`
- `optimizeDeps.exclude`: Vite config object
- iOS safe-area: Tailwind utility `pb-[env(safe-area-inset-bottom)]` (CSS env variable — no polyfill needed, supported in all modern mobile browsers [ASSUMED])

---

## Architecture Patterns

### System Architecture Diagram

```
User action (Generate Copy / Upload)
        │
        ▼
  callAI() in ai.ts
        │
  ┌─────┴──────┐
  │  provider  │
  │  switch    │
  └─────┬──────┘
        │ throws on error
        ▼
  handleGenerate() catch block ──► parseProviderError(provider, err)
        │                                    │
        │                          ┌─────────┴──────────┐
        │                          │  AIError { kind,   │
        │                          │   message, retry } │
        │                          └─────────┬──────────┘
        │                                    │
        ▼                                    ▼
  setAiError(message)              setAiErrorKey(kind)
        │                                    │
        ▼                                    ▼
  Error banner renders       Retry button renders (if retryable)


Upload path:
  handleScheduleConfirm()
        │
        │  await uploadFile() + scheduleUpload()
        ▼
  pg-boss job → worker
        │
        │ refresh token fails
        ▼
  Error('oauth_expired:youtube')
        │
        ▼
  updateUploadStatus('failed', message)
        │  (Supabase Realtime push)
        ▼
  uploadStatuses[platform] = 'failed'
        │
        ▼
  uploadError → detect 'oauth_expired' prefix
        │
        ▼
  "Reconnect YouTube in Settings" message


React Error Boundary:
  App.tsx renders screen
        │
        ▼
  <ErrorBoundary screenName="generator">
    <GeneratorPage />          ──► uncaught render error
        │                                   │
        │                         getDerivedStateFromError()
        │                                   │
        ▼                                   ▼
  normal render              fallback UI: "Reload" button
```

### Recommended Project Structure (additions only)
```
frontend/src/
├── components/
│   └── ErrorBoundary.tsx     # NEW — reusable class-component boundary
└── lib/
    └── ai.ts                 # MODIFY — add parseProviderError() export
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error boundary | Custom render hijacking | React class component with `getDerivedStateFromError` | This is the React-standardized API — no library needed |
| iOS safe-area padding | JS-based inset calculation | `env(safe-area-inset-bottom)` CSS variable | Natively supported; JS approach is fragile and delayed |
| AI provider error parsing | Complex regex on raw strings | Per-provider switch with known error shapes | Claude/Gemini/OpenAI each have documented error response schemas |

**Key insight:** Phase 10 is wiring, not building. Every problem already has the right primitive available — it just needs to be applied consistently.

---

## Common Pitfalls

### Pitfall 1: model_busy Not in RETRYABLE_ERRORS
**What goes wrong:** Claude's `overloaded_error` and Gemini's `UNAVAILABLE` both map to `model_busy` per the Phase 8 research pattern. But `model_busy` is absent from `RETRYABLE_ERRORS` in GeneratorPage (line 50). Result: user gets no retry button for a transient overload.
**Why it happens:** `model_busy` was listed in the ROADMAP requirements but the RETRYABLE_ERRORS Set was built before the full error taxonomy was established.
**How to avoid:** When implementing `parseProviderError`, update `RETRYABLE_ERRORS = new Set(['rate_limited', 'model_busy', 'network_error'])`.
**Warning sign:** Test with a mock `overloaded_error` throw — confirm retry button appears.

### Pitfall 2: Error Boundary Placed Too High
**What goes wrong:** Wrapping App.tsx with an ErrorBoundary catches the auth gate, causing a blank "reload" screen instead of a redirect to login for authentication errors.
**Why it happens:** The instinct is to wrap as high as possible.
**How to avoid:** Wrap EACH SCREEN individually inside the authenticated render in App.tsx — after `if (!session) return <LoginPage />`.
**Warning sign:** An unauthenticated supabase error triggers the boundary instead of the login redirect.

### Pitfall 3: Structured Error From Backend Upload Workers Needs Two Layers
**What goes wrong:** The backend worker throws and pg-boss marks the job failed, but the frontend only sees the `upload_status = 'failed'` via Realtime, with `error_message` containing a raw string. If the error_message check for `oauth_expired` is not done in the frontend's Realtime handler (where it has access to `row.error_message`), the user never sees the "Reconnect in Settings" message.
**Why it happens:** The upload error path goes through Realtime, not through the direct API response.
**How to avoid:** In the Realtime subscription handler (GeneratorPage lines 112-116), when `row.upload_status === 'failed'`, also check `row.error_message` for `'oauth_expired'` prefix and set a specific `uploadError` state.

### Pitfall 4: iOS Safe-Area on Fixed Element in App.tsx
**What goes wrong:** The floating Research/Admin nav buttons (`fixed bottom-4`) render over the iPhone home indicator because they have no safe-area padding.
**Why it happens:** The `pb-[env(safe-area-inset-bottom)]` was consistently applied to every `<main>` scroll area but the fixed overlay in App.tsx was added later (Phase 9) without following the same pattern.
**How to avoid:** Any `fixed bottom-*` element must use `pb-[env(safe-area-inset-bottom)]`.

### Pitfall 5: ScheduleModal Bottom Sheet on iOS
**What goes wrong:** The ScheduleModal uses `items-end` on mobile (slide-up sheet pattern). The inner `<div className="rounded-t-2xl p-5">` does not account for safe-area, so the Confirm button may sit behind the home indicator.
**Why it happens:** Same as Pitfall 4 — safe-area applied to page-level `<main>` but not to this specific modal.
**How to avoid:** Add `pb-[env(safe-area-inset-bottom)]` to the ScheduleModal inner container div when in sheet mode.

### Pitfall 6: `parseProviderError` — Accessing Nested Error Properties Safely
**What goes wrong:** Claude SDK wraps errors as `AnthropicError` with `.error.type`; Gemini wraps as `GoogleGenerativeAIError`; OpenAI SDK throws `OpenAI.APIError` with `.code`. Accessing them as `(raw as Record<string, unknown>).error.type` without null-checking throws a secondary TypeError.
**Why it happens:** The Phase 8 RESEARCH.md pattern casts `err` to `Record<string, unknown>` but doesn't show null-path guards.
**How to avoid:**
```typescript
function parseProviderError(provider: AIProvider, err: unknown): AIError {
  if (!navigator.onLine) {
    return { kind: 'network_error', message: 'No internet — check your connection', retryable: true }
  }
  const raw = err as Record<string, unknown>
  const errObj = raw?.['error'] as Record<string, string> | undefined

  if (provider === 'claude') {
    if (errObj?.['type'] === 'authentication_error') return { kind: 'invalid_key', message: 'Invalid Claude API key — update in Settings', retryable: false }
    if (errObj?.['type'] === 'rate_limit_error') return { kind: 'rate_limited', message: 'Claude rate limited — wait and retry', retryable: true }
    if (errObj?.['type'] === 'overloaded_error') return { kind: 'model_busy', message: 'Claude is busy — try again in a moment', retryable: true }
  }
  // ... gemini and openai branches
  return { kind: 'unparseable', message: 'Unexpected error — try again', retryable: true }
}
```

---

## Wave Grouping Recommendation

All six concerns are independent and can be planned as parallel waves:

```
Wave 1 — Error Normalization (2 tasks, frontend only)
  Task A: Add parseProviderError() to frontend/src/lib/ai.ts
          - Exports: parseProviderError(provider, err): AIError
          - Interface: AIError { kind, message, retryable }
  Task B: Wire parseProviderError into GeneratorPage catch block
          - Update RETRYABLE_ERRORS to include 'model_busy'
          - Replace raw string-matching with parseProviderError call

Wave 2 — OAuth Expiry Path (2 tasks, spans backend + frontend)
  Task A: Backend — detect oauth_expired in upload workers
          - YouTube: wrap refreshYouTubeToken() failure → throw Error('oauth_expired:youtube')
          - Instagram: if access token rejected (401) → throw Error('oauth_expired:instagram')
          - Facebook: same pattern for facebook
  Task B: Frontend — surface in GeneratorPage
          - Realtime handler: when status='failed' + error_message starts with 'oauth_expired'
            → setUploadError('Reconnect [platform] in Settings')
          - Direct catch: handleScheduleConfirm() catch also checks for oauth_expired

Wave 3 — React Error Boundaries (2 tasks, frontend only)
  Task A: Create frontend/src/components/ErrorBoundary.tsx (class component)
  Task B: Wrap Generator, Research, Admin screens in App.tsx

Wave 4 — iOS Layout Fix + Bundle Config (2 tasks, independent)
  Task A: Fix App.tsx fixed-nav safe-area padding + ScheduleModal inner container
  Task B: Add optimizeDeps.exclude to vite.config.ts

Wave 5 — Stub stubs for Phase 3 (1 task, documentation + test stubs)
  Task A: Add tensor-dispose pattern comment to vitest.config.ts browser project
          + Add indeterminate spinner to engine analysis state in GeneratorPage
          (No engine.ts yet — just wire the state placeholder)
```

**Dependency graph:**
- Wave 1 and Wave 2 are independent (different code paths)
- Wave 3, Wave 4 are fully independent of all others
- Wave 5 is lowest priority — Phase 3 is paused

---

## Code Examples

### AI Error Normalization (parseProviderError)
```typescript
// Source: Phase 8 RESEARCH.md N5 pattern + ROADMAP Phase 10 notes
// frontend/src/lib/ai.ts — add below existing exports

export type AIErrorKind =
  | 'invalid_key'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'model_busy'
  | 'network_error'
  | 'unparseable'

export interface AIError {
  kind: AIErrorKind
  message: string   // user-facing, never raw SDK message
  retryable: boolean
}

export function parseProviderError(provider: AIProvider, err: unknown): AIError {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { kind: 'network_error', message: 'No internet connection — check your network', retryable: true }
  }

  const raw = err as Record<string, unknown>
  const errObj = raw?.['error'] as Record<string, string> | undefined
  const message = raw?.['message'] as string | undefined ?? ''

  if (provider === 'claude') {
    const type = errObj?.['type']
    if (type === 'authentication_error') return { kind: 'invalid_key', message: 'Invalid Claude API key — update it in Settings', retryable: false }
    if (type === 'rate_limit_error') return { kind: 'rate_limited', message: 'Claude is rate-limited — wait a moment and retry', retryable: true }
    if (type === 'overloaded_error') return { kind: 'model_busy', message: 'Claude is busy — try again in a moment', retryable: true }
  }

  if (provider === 'gemini') {
    const status = errObj?.['status']
    if (status === 'INVALID_ARGUMENT' || message.includes('API key')) return { kind: 'invalid_key', message: 'Invalid Gemini API key — update it in Settings', retryable: false }
    if (status === 'RESOURCE_EXHAUSTED') return { kind: 'quota_exhausted', message: 'Gemini quota exceeded — check your Google AI usage limits', retryable: false }
    if (status === 'UNAVAILABLE') return { kind: 'model_busy', message: 'Gemini is busy — try again in a moment', retryable: true }
    if (message.includes('429') || message.includes('rate')) return { kind: 'rate_limited', message: 'Gemini rate limit reached — wait and retry', retryable: true }
  }

  if (provider === 'openai') {
    const code = errObj?.['code'] ?? (raw?.['code'] as string | undefined)
    if (code === 'invalid_api_key') return { kind: 'invalid_key', message: 'Invalid OpenAI API key — update it in Settings', retryable: false }
    if (code === 'rate_limit_exceeded' || message.includes('429')) return { kind: 'rate_limited', message: 'OpenAI rate limit reached — wait and retry', retryable: true }
    if (code === 'insufficient_quota') return { kind: 'quota_exhausted', message: 'OpenAI credits exhausted — add billing at platform.openai.com', retryable: false }
  }

  // Network errors: fetch throws TypeError with message containing 'fetch' / 'network' / 'ENOTFOUND'
  if (message.includes('fetch') || message.includes('network') || message.includes('ENOTFOUND') || message.includes('Failed to fetch')) {
    return { kind: 'network_error', message: 'Network error — check your connection and retry', retryable: true }
  }

  return { kind: 'unparseable', message: 'Unexpected error — try again', retryable: true }
}
```

### GeneratorPage catch block rewrite
```typescript
// frontend/src/pages/GeneratorPage.tsx — replace lines 211-227

// Update RETRYABLE_ERRORS (line 50):
const RETRYABLE_ERRORS = new Set<AIErrorKind>(['rate_limited', 'model_busy', 'network_error'])

// In handleGenerate() catch block:
} catch (err: unknown) {
  const aiError = parseProviderError(aiProvider, err)
  setAiError(aiError.message)
  setAiErrorKey(aiError.kind)
}
```

### ErrorBoundary component
```typescript
// frontend/src/components/ErrorBoundary.tsx
// Source: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  screenName?: string
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error(`[ErrorBoundary:${this.props.screenName ?? 'unknown'}]`, error, info.componentStack)
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 px-6 bg-zinc-950 text-white">
          <p className="text-sm text-zinc-400 text-center max-w-xs">
            Something went wrong on this screen. Reload to continue.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-500"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

### App.tsx error boundary wiring
```typescript
// App.tsx — wrap Generator, Research, Admin (not the screen switcher itself)
// Generator (currently returned at line 104-127):
return (
  <>
    <ErrorBoundary screenName="generator">
      <GeneratorPage onNavigate={setCurrentScreen} />
    </ErrorBoundary>
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pb-[env(safe-area-inset-bottom)]">
      {/* ... nav buttons ... */}
    </div>
  </>
)

// Research (currently line 98-99):
return (
  <ErrorBoundary screenName="research">
    <ResearchPage onNavigate={setCurrentScreen} />
  </ErrorBoundary>
)

// Admin (currently line 74-77):
if (!isAdmin) return <GeneratorPage onNavigate={setCurrentScreen} />
return (
  <ErrorBoundary screenName="admin">
    <AdminPage onNavigate={setCurrentScreen} />
  </ErrorBoundary>
)
```

### Vite optimizeDeps config
```typescript
// frontend/vite.config.ts — add after server config:
export default defineConfig({
  plugins: [...],
  server: {...},
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core'],
  },
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React class `componentDidCatch` only | React 19 adds `onCaughtError`/`onUncaughtError` root hooks | React 19 (Dec 2024) | Root-level error reporting; component boundaries still need class components |
| `h-screen` for full-height | `h-[100dvh]` (dynamic viewport) | iOS Safari 15.4+ (2022) | Fixes bottom browser chrome clipping bug |
| `env(safe-area-inset-bottom)` with polyfill | Native CSS env variable | Safari 11.2+ / Chrome 69+ | No polyfill needed in 2025 |

---

## Open Questions (RESOLVED)

1. **`oauth_expired` surfacing timing**
   - What we know: The frontend only learns about upload worker failures through Supabase Realtime `platform_posts` row updates. The `error_message` column gets the raw error string from `updateUploadStatus()`.
   - What's unclear: Does the Realtime payload include `error_message` in `payload.new`? It should (the subscription is on `*` events on `platform_posts`), but the current Realtime handler in GeneratorPage (line 113) only extracts `platform` and `upload_status` from `payload.new`.
   - Recommendation: Extend the Realtime handler to also read `error_message` from `payload.new` and check for `oauth_expired` prefix.
   - RESOLVED: Plan 10-01 Task 2 implements the Realtime handler path — `row.error_message` is read from `payload.new` on `upload_status === 'failed'`; this satisfies ROADMAP SC-3. If Assumption A2 fails at runtime (Realtime payload excludes error_message), the implementation will be updated to poll `GET /api/platform-posts/:id` instead.

2. **Phase 3 dependency scope**
   - What we know: TF.js tensor dispose and ffmpeg progress both require engine.ts, which is paused.
   - What's unclear: Will Phase 3 be resumed before or after Phase 10 is verified?
   - Recommendation: Phase 10 adds the Vite `optimizeDeps.exclude` now (anticipatory). The tensor dispose and ffmpeg progress patterns are documented in RESEARCH.md but not tasked for implementation — that belongs in Phase 3 Wave X.
   - RESOLVED: TF.js tensor dispose and ffmpeg indeterminate spinner are scoped to Phase 3 (when engine.ts is built). Phase 10 delivers the `optimizeDeps.exclude` config as Phase 3 readiness.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 10 is code/config changes only (frontend TypeScript + Vite config). No new external CLI tools, services, or runtimes required. All packages already installed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npm run test:run -- --reporter=verbose src/lib/ai.test.ts src/components` |
| Full suite command | `cd frontend && npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-01 | `parseProviderError('claude', {error:{type:'overloaded_error'}})` returns `kind='model_busy', retryable=true` | unit | `cd frontend && npm run test:run -- src/lib/ai.test.ts` | ❌ Wave 0 |
| SC-02 | `parseProviderError('claude', {error:{type:'authentication_error'}})` returns `kind='invalid_key', retryable=false` | unit | same | ❌ Wave 0 |
| SC-03 | `parseProviderError('gemini', {error:{status:'UNAVAILABLE'}})` returns `kind='model_busy', retryable=true` | unit | same | ❌ Wave 0 |
| SC-04 | `parseProviderError('openai', {error:{code:'insufficient_quota'}})` returns `kind='quota_exhausted', retryable=false` | unit | same | ❌ Wave 0 |
| SC-05 | ErrorBoundary renders fallback when child throws | unit (happy-dom) | `cd frontend && npm run test:run -- src/components/ErrorBoundary.test.tsx` | ❌ Wave 0 |
| SC-06 | ErrorBoundary renders children normally when no error | unit (happy-dom) | same | ❌ Wave 0 |
| SC-07 | `parseProviderError` with `navigator.onLine=false` returns `kind='network_error'` | unit | `cd frontend && npm run test:run -- src/lib/ai.test.ts` | ❌ Wave 0 |
| SC-08 | iOS layout: `h-[100dvh]` grep passes on all 6 pages | structural | `grep -r "h-\[100dvh\]" frontend/src/pages/ \| wc -l` should be 6 | manual |
| SC-09 | iOS fixed-nav safe-area: `pb-[env(safe-area-inset-bottom)]` present on fixed div in App.tsx | structural | `grep "pb-\[env(safe-area" frontend/src/App.tsx` | manual |
| SC-10 | Vite config includes `optimizeDeps.exclude` with ffmpeg entries | structural | `grep "optimizeDeps" frontend/vite.config.ts` | manual |

### Sampling Rate
- **Per task commit:** `cd frontend && npm run test:run -- --reporter=verbose src/lib/ai.test.ts`
- **Per wave merge:** `cd frontend && npm run test:run`
- **Phase gate:** Full suite green + structural grep checks before `/gsd-verify-work 10`

### Wave 0 Gaps
- [ ] `frontend/src/lib/ai.test.ts` — extend existing file with `parseProviderError` test suite (SC-01 through SC-04, SC-07)
- [ ] `frontend/src/components/ErrorBoundary.test.tsx` — new file covering SC-05, SC-06
- [ ] No framework install needed — Vitest already configured

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | Phase 10 adds no new inputs |
| V6 Cryptography | no | — |

**Phase 10 security notes:**
- `componentDidCatch` logging is gated on `import.meta.env.DEV` — stack traces never logged in production [VERIFIED: pattern explicitly shown in code examples above]
- `oauth_expired` error message surfaces platform name only (from a hardcoded switch), never raw token data or server error details
- No new API routes, no new data ingress

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `env(safe-area-inset-bottom)` supported natively on all target mobile browsers without polyfill | iOS Safari Layout | Low risk — supported since Safari 11.2 (2018) and Chrome 69 (2018); only very old devices affected |
| A2 | The Supabase Realtime `payload.new` object includes the `error_message` column | OAuth Expiry Path | Medium — if Realtime subscription config excludes that column, the oauth_expired detection won't work; would need to be verified by inspecting the actual payload at runtime |

**If A2 is wrong:** The oauth_expired detection would need to be implemented as a polling fallback (`GET /api/platform-posts/:id` after upload to read error_message) rather than from Realtime payload.

---

## Sources

### Primary (HIGH confidence)
- Codebase read (direct file inspection 2026-05-04) — all current-state findings
- React.dev error boundaries doc — class component requirement confirmed
- ROADMAP.md + STATE.md — phase requirements and current implementation status

### Secondary (MEDIUM confidence)
- Phase 8 RESEARCH.md `.planning/research/phase8-research.md` lines 480-529 — `parseProviderError` pattern with provider-specific error shapes (was researched but never implemented)
- `frontend/src/pages/GeneratorPage.tsx` lines 40-50 — existing ERROR_MESSAGES and RETRYABLE_ERRORS

### Tertiary (LOW confidence)
- ASSUMED: `env(safe-area-inset-bottom)` browser support without polyfill (tagged A1)
- ASSUMED: Supabase Realtime payload includes `error_message` column (tagged A2)

---

## Metadata

**Confidence breakdown:**
- Current state (what exists, what's missing): HIGH — verified by direct file read
- Implementation patterns: HIGH — standard React, Vite, and Tailwind patterns
- Error parsing shapes (Claude/Gemini/OpenAI): MEDIUM — based on Phase 8 research; API error formats can change
- iOS safe-area assumption: HIGH — CSS spec, supported since 2018

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (stable phase — no fast-moving dependencies)
