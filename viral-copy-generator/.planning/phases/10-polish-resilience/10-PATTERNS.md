# Phase 10: Polish + Resilience - Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 7 (2 new, 5 modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/lib/ai.ts` | utility | transform | `frontend/src/lib/ai.ts` (existing functions) | exact — adding to same file |
| `frontend/src/pages/GeneratorPage.tsx` | component | request-response | `frontend/src/pages/GeneratorPage.tsx` (existing catch blocks) | exact — modifying existing lines |
| `frontend/src/components/ErrorBoundary.tsx` | component | event-driven | `frontend/src/components/ScorePanel.tsx` (class-like TSX conventions) | role-match |
| `frontend/src/App.tsx` | component | request-response | `frontend/src/App.tsx` (existing screen-switch renders) | exact — modifying existing lines |
| `frontend/src/pages/ResearchPage.tsx` | component | request-response | `frontend/src/pages/AdminPage.tsx` | role-match |
| `frontend/src/pages/AdminPage.tsx` | component | request-response | `frontend/src/pages/ResearchPage.tsx` | role-match |
| `frontend/vite.config.ts` | config | — | `frontend/vite.config.ts` (existing plugin additions) | exact — adding one key |

---

## Pattern Assignments

### `frontend/src/lib/ai.ts` — add `parseProviderError()`

**Analog:** `frontend/src/lib/ai.ts` (lines 1–4 for import conventions; lines 139–159 for TypeScript interface + export function shape)

**Imports pattern** (lines 1–4) — copy this import style for new type exports:
```typescript
import { GoogleGenAI, type Content } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'
import type { AIOutput, AIProvider, AIProxyBody } from './types'
import { proxyAIGenerate } from './api'
```
New types (`AIErrorKind`, `AIError`) follow the same inline-interface pattern as `AICallParamsInput` / `AICallParams` (lines 139–148) — no separate types file needed.

**Interface + function export pattern** (lines 139–159):
```typescript
export interface AICallParamsInput {
  provider: AIProvider
  prompt: string
  frames?: string[]
  isSecondPass: boolean
}

export interface AICallParams {
  provider: AIProvider
  prompt: string
  frames?: string[]
}

export function buildAICallParams(input: AICallParamsInput): AICallParams {
  return {
    provider: input.provider,
    prompt: input.prompt,
    frames: input.isSecondPass ? undefined : input.frames,
  }
}
```
`parseProviderError` follows the same shape: export interface first, then export function.

**Provider switch pattern** (lines 177–282) — the `switch (provider)` with `case 'claude'`, `case 'gemini'`, `case 'openai'`, `default: never` exhaustive guard is the established provider-routing pattern. `parseProviderError` uses the same switch skeleton.

**Error handling within provider branches** (lines 192–196 — Gemini FAILED state):
```typescript
if (fileInfo.state === 'FAILED') {
  throw new Error('gemini_file_processing_failed')
}
```
The codebase throws `Error` with string codes for known error conditions. `parseProviderError` reads those same string codes back from `err.message` as a fallback.

**Null-safe nested property access pattern** — RESEARCH.md Pitfall 6 documents the required guard:
```typescript
const raw = err as Record<string, unknown>
const errObj = raw?.['error'] as Record<string, string> | undefined
const message = raw?.['message'] as string | undefined ?? ''
```
Use optional chaining on every nested access. Never `(err as any).error.type` — that throws if `.error` is undefined.

---

### `frontend/src/pages/GeneratorPage.tsx` — wire `parseProviderError`, retry fix, oauth_expired

**Analog:** `frontend/src/pages/GeneratorPage.tsx` (self — targeted edits at known lines per RESEARCH.md)

**Constants pattern** (lines 40–50) — `ERROR_MESSAGES` Record and `RETRYABLE_ERRORS` Set are at module scope, before the component function. New `AIErrorKind` import joins the existing import list at line 22:
```typescript
import { callAI } from '../lib/ai'
// becomes:
import { callAI, parseProviderError } from '../lib/ai'
import type { AIErrorKind } from '../lib/ai'
```

**RETRYABLE_ERRORS fix** (line 50) — change from:
```typescript
const RETRYABLE_ERRORS = new Set(['rate_limited', 'network_error'])
```
to:
```typescript
const RETRYABLE_ERRORS = new Set<AIErrorKind>(['rate_limited', 'model_busy', 'network_error'])
```
Type-parameter `<AIErrorKind>` matches the pattern in the codebase of always parameterising generic collections (e.g. `useState<boolean>`, `Record<string, string>`).

**Catch block replacement** (lines 211–227) — current raw string-matching:
```typescript
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : 'unknown_error'
  let errorKey = 'unparseable'
  if (msg.includes('invalid_api_key') || msg.includes('401') || msg.includes('invalid key')) {
    errorKey = 'invalid_key'
  } else if (msg.includes('rate_limit') || msg.includes('429') || msg.includes('rate limit')) {
    errorKey = 'rate_limited'
  } else if (msg.includes('quota') || msg.includes('402')) {
    errorKey = 'quota_exhausted'
  } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('ENOTFOUND')) {
    errorKey = 'network_error'
  }
  setAiError(ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unparseable)
  setAiErrorKey(errorKey)
}
```
Replace body with:
```typescript
} catch (err: unknown) {
  const aiError = parseProviderError(aiProvider, err)
  setAiError(aiError.message)
  setAiErrorKey(aiError.kind)
}
```
The `finally` block at lines 225–227 stays unchanged (`setAiLoading(false)`).

**Retry button pattern** (lines 406–418) — already correct structure; no change needed beyond `RETRYABLE_ERRORS` having `'model_busy'`:
```typescript
{aiError && (
  <div>
    <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{aiError}</p>
    {aiErrorKey && RETRYABLE_ERRORS.has(aiErrorKey) && (
      <button
        type="button"
        onClick={() => { void handleGenerate() }}
        className="mt-1 rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
      >
        Try Again
      </button>
    )}
  </div>
)}
```

**Realtime handler** (lines 112–116) — extend `payload.new` type and add `error_message` check:
```typescript
// Current:
const row = payload.new as { platform: string; upload_status: string }
setUploadStatuses(prev => ({ ...prev, [row.platform]: row.upload_status }))

// Required:
const row = payload.new as { platform: string; upload_status: string; error_message?: string }
if (row.upload_status === 'failed' && row.error_message?.startsWith('oauth_expired')) {
  const platform = row.error_message.split(':')[1] ?? row.platform
  setUploadError(`Reconnect ${platform} in Settings to resume uploads.`)
}
setUploadStatuses(prev => ({ ...prev, [row.platform]: row.upload_status }))
```

**handleScheduleConfirm catch** (lines 289–293) — add oauth_expired check:
```typescript
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : 'upload_failed'
  if (msg.startsWith('oauth_expired')) {
    const platform = msg.split(':')[1] ?? scheduleModal?.platform ?? 'platform'
    setUploadError(`Reconnect ${platform} in Settings to resume uploads.`)
  } else {
    setUploadError(msg)
  }
  setUploadStatuses(prev => ({ ...prev, [platform]: 'failed' }))
}
```

---

### `frontend/src/components/ErrorBoundary.tsx` — new React class component

**Analog:** `frontend/src/components/ScorePanel.tsx` — for Tailwind + TypeScript conventions (bg-zinc-950, text-white, text-zinc-400, rounded-lg, bg-purple-600 button pattern); `frontend/src/components/GapAnalysisPanel.tsx` — for minimal functional shape.

**Tailwind class conventions from ScorePanel.tsx** — dark theme palette used across all components:
- Container: `bg-zinc-950 text-white`
- Muted text: `text-zinc-400`
- Full-height: `h-[100dvh]` (CLAUDE.md critical rule — never `h-screen`)
- Primary button: `rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-500`

**Test file shape** (ScorePanel.test.tsx lines 1–8) — component tests use this import header:
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScorePanel from './ScorePanel'
```
`ErrorBoundary.test.tsx` follows the same pattern, adding `vi` for the throw-mock.

**Full ErrorBoundary component pattern** (from RESEARCH.md, verified against React 19 docs and codebase Tailwind conventions):
```typescript
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

**Critical notes for this file:**
- `getDerivedStateFromError` does NOT receive the error (unused param would trigger `@typescript-eslint/no-unused-vars`). Drop the parameter: `static getDerivedStateFromError(): State`.
- `componentDidCatch` logging is gated on `import.meta.env.DEV` — never log stack traces in production.
- Use `h-[100dvh]` not `h-screen` (CLAUDE.md rule + all other pages follow this).
- No default export — named export `ErrorBoundary` matches `ScorePanel`'s default but class components in this codebase are always named exports (confirmed by grep: zero existing class components, so follow the standard TS convention of named export for class).

---

### `frontend/src/App.tsx` — ErrorBoundary wrapping + safe-area fix

**Analog:** `frontend/src/App.tsx` (self — targeted edits at known lines)

**Import addition pattern** (line 11 area) — imports follow alphabetical grouping: React hooks, Supabase, then pages, then components, then types:
```typescript
// After existing component imports (line 10), add:
import { ErrorBoundary } from './components/ErrorBoundary'
```

**Screen render wrapping pattern** (lines 74–100) — three screens need wrapping. Current admin render (lines 74–77):
```typescript
if (currentScreen === 'admin') {
  if (!isAdmin) return <GeneratorPage onNavigate={setCurrentScreen} />
  return <AdminPage onNavigate={setCurrentScreen} />
}
```
Becomes:
```typescript
if (currentScreen === 'admin') {
  if (!isAdmin) return <GeneratorPage onNavigate={setCurrentScreen} />
  return (
    <ErrorBoundary screenName="admin">
      <AdminPage onNavigate={setCurrentScreen} />
    </ErrorBoundary>
  )
}
```
Same pattern for `research` (line 98–100) and the default Generator return (lines 104–126).

**CRITICAL — do not wrap the auth gate.** The `if (!session) return <LoginPage />` (line 69) must stay outside all ErrorBoundary wrappers. Boundaries go INSIDE the authenticated block only.

**Fixed nav safe-area fix** (line 107) — current:
```typescript
<div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
```
Add `pb-[env(safe-area-inset-bottom)]`:
```typescript
<div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pb-[env(safe-area-inset-bottom)]">
```
This is the only `fixed bottom-*` element in App.tsx. The pattern for safe-area padding is already established in every page's `<main>` element (e.g. GeneratorPage line 334: `pb-[env(safe-area-inset-bottom)]`).

**Generator screen return with ErrorBoundary** (lines 104–126) — the fragment `<>...</>` already wraps GeneratorPage + fixed nav div. ErrorBoundary wraps only GeneratorPage, not the fixed nav div (nav buttons must survive a GeneratorPage crash):
```typescript
return (
  <>
    <ErrorBoundary screenName="generator">
      <GeneratorPage onNavigate={setCurrentScreen} />
    </ErrorBoundary>
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pb-[env(safe-area-inset-bottom)]">
      {/* ... existing buttons unchanged ... */}
    </div>
  </>
)
```

---

### `frontend/src/pages/ResearchPage.tsx` — wrap in ErrorBoundary

**Analog:** `frontend/src/pages/AdminPage.tsx` (same role, same Props interface shape)

The only change to ResearchPage.tsx itself is the App.tsx wrapper — ResearchPage does not need internal modifications for Phase 10. The ErrorBoundary is applied in App.tsx at the call site (line 98–100), not inside ResearchPage.tsx.

If a ResearchPage-internal change is needed (e.g. a safe-area audit), the `<main>` element follows the established pattern from GeneratorPage line 334:
```typescript
<main className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
```
RESEARCH.md confirms ResearchPage already has this (verified grep).

---

### `frontend/src/pages/AdminPage.tsx` — wrap in ErrorBoundary

**Analog:** Same as ResearchPage — App.tsx wraps it, no internal AdminPage changes needed for Phase 10.

AdminPage line 192 already uses `h-[100dvh]` (verified by RESEARCH.md grep). No layout changes required.

---

### `frontend/vite.config.ts` — add `optimizeDeps.exclude`

**Analog:** `frontend/vite.config.ts` (self — lines 26–41, add one key)

**Current config structure** (lines 26–41):
```typescript
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crossOriginIsolationPlugin,
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

**Required addition** — append `optimizeDeps` after `server`:
```typescript
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crossOriginIsolationPlugin,
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core'],
  },
})
```
No imports change — `defineConfig` accepts `optimizeDeps` natively. The packages are not installed yet (Phase 3 paused) but the config must be ready prophylactically so Phase 3 can install them without a config change.

---

## Shared Patterns

### Tailwind Dark Theme
**Source:** All page components (GeneratorPage, AdminPage, HistoryPage, etc.)
**Apply to:** `ErrorBoundary.tsx` fallback UI
```
bg-zinc-950   — page background
text-white    — primary text
text-zinc-400 — secondary/muted text
bg-zinc-800   — card/surface
bg-purple-600 hover:bg-purple-500  — primary button
rounded-lg    — standard border radius
```

### iOS Safe-Area Pattern
**Source:** `frontend/src/pages/GeneratorPage.tsx` line 334
**Apply to:** App.tsx fixed nav div (line 107); ScheduleModal inner container
```typescript
// On every scrollable <main>:
className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]"

// On every fixed bottom element:
className="fixed bottom-4 ... pb-[env(safe-area-inset-bottom)]"
```

### Full-Height Layout
**Source:** All 6 page components (verified by RESEARCH.md grep)
**Apply to:** ErrorBoundary fallback container (must match the screen it replaces)
```typescript
className="flex h-[100dvh] flex-col ..."
// NEVER h-screen — iOS Safari viewport bug (CLAUDE.md critical rule)
```

### Spinner Pattern
**Source:** `frontend/src/pages/GeneratorPage.tsx` lines 399–401
**Apply to:** Any loading state in Phase 10 scope (indeterminate analysis spinner)
```typescript
<span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
```

### Vitest Component Test Header
**Source:** `frontend/src/components/ScorePanel.test.tsx` lines 1–3
**Apply to:** `frontend/src/components/ErrorBoundary.test.tsx`
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'
```
Tests run in `happy-dom` environment (unit project in vitest.config.ts line 31–36 — `src/**/*.test.{ts,tsx}` excluding engine tests).

### Unit Test for Pure Functions
**Source:** `frontend/src/lib/ai.test.ts` lines 1–8
**Apply to:** `parseProviderError` tests appended to `frontend/src/lib/ai.test.ts`
```typescript
import { describe, it, expect, vi } from 'vitest'
import { parseAIOutput, buildAICallParams, getGeminiConfig, parseProviderError } from './ai'
```
Add new `describe('parseProviderError')` block after existing describes. Do not replace existing tests.

---

## No Analog Found

No files are without analogs in this phase. All patterns have direct codebase matches.

---

## Metadata

**Analog search scope:** `frontend/src/` (all subdirectories)
**Files read:** 10 (ai.ts, GeneratorPage.tsx, App.tsx, vite.config.ts, vitest.config.ts, ai.test.ts, ScorePanel.test.tsx, GapAnalysisPanel.test.tsx, ResearchPage.tsx header, AdminPage.tsx header)
**Pattern extraction date:** 2026-05-04
