---
phase: 10-polish-resilience
plan: "01"
subsystem: error-handling
tags: [ai-errors, oauth, upload-workers, realtime, tdd]
dependency_graph:
  requires: []
  provides:
    - parseProviderError export in frontend/src/lib/ai.ts
    - AIErrorKind type in frontend/src/lib/ai.ts
    - oauth_expired:platform structured error codes from upload workers
  affects:
    - frontend/src/pages/GeneratorPage.tsx
    - backend/src/lib/upload-youtube.ts
    - backend/src/lib/upload-instagram.ts
    - backend/src/lib/upload-facebook.ts
tech_stack:
  added: []
  patterns:
    - parseProviderError normalises per-provider SDK error shapes into a typed AIError struct
    - oauth_expired:platform prefix convention enables frontend Realtime handler to detect token expiry without polling
    - RETRYABLE_ERRORS Set typed as Set<AIErrorKind> to enforce compile-time safety on retry decisions
key_files:
  created: []
  modified:
    - frontend/src/lib/ai.ts
    - frontend/src/lib/ai.test.ts
    - frontend/src/pages/GeneratorPage.tsx
    - backend/src/lib/upload-youtube.ts
    - backend/src/lib/upload-instagram.ts
    - backend/src/lib/upload-facebook.ts
decisions:
  - Added no_api_key and post_save_failed to AIErrorKind union to satisfy tsc after aiErrorKey state type was tightened to AIErrorKind | null
  - navigator.onLine restore in SC-07 test uses explicit value: true fallback when original descriptor is undefined (inherited property on navigator prototype)
metrics:
  duration: "~5 minutes"
  completed: "2026-05-04"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 6
---

# Phase 10 Plan 01: Structured AI Error Parsing + OAuth Expiry Surfacing Summary

**One-liner:** Structured per-provider AI error normalisation via `parseProviderError` export + `oauth_expired:platform` token-expiry surfacing from upload workers to frontend Realtime handler.

## What Was Built

Replaced raw string-matching in GeneratorPage's catch block with a typed `parseProviderError(provider, err): AIError` function exported from `ai.ts`. Added `model_busy` to the retryable error set so the "Try Again" button appears for Claude overload errors. All three upload workers now emit `oauth_expired:platform` as the structured `error_message` column value on token refresh failure, and the GeneratorPage Realtime handler plus the `handleScheduleConfirm` catch block both detect this prefix and surface a descriptive "Reconnect in Settings" message to the user.

## Tasks

### Task 1: Add parseProviderError to ai.ts + extend ai.test.ts (TDD)
**Commit:** d087ffd

**RED phase:** Appended 10 failing test cases to `ai.test.ts` covering SC-01 through SC-04 and SC-07. Confirmed all new tests failed with "parseProviderError is not a function".

**GREEN phase:** Added `parseProviderError`, `AIErrorKind`, and `AIError` exports to `ai.ts`. Per-provider routing:
- Claude: `authentication_error` → `invalid_key`, `rate_limit_error` → `rate_limited`, `overloaded_error` → `model_busy`
- Gemini: `UNAUTHENTICATED`/`PERMISSION_DENIED` → `invalid_key`, `RESOURCE_EXHAUSTED` → `quota_exhausted`, `UNAVAILABLE` → `model_busy`
- OpenAI: `invalid_api_key` → `invalid_key`, `rate_limit_exceeded` → `rate_limited`, `insufficient_quota` → `quota_exhausted`
- Network: `navigator.onLine === false` checked first; message containing `fetch`/`ENOTFOUND`/`Failed to fetch` → `network_error`
- Fallback: `unparseable` (retryable: true)

All 18 tests pass GREEN. Frontend tsc clean.

### Task 2: Wire parseProviderError + oauth_expired surfacing
**Commit:** 27edf69

**GeneratorPage.tsx:**
- Import `parseProviderError` and `import type { AIErrorKind }` from `../lib/ai`
- `RETRYABLE_ERRORS` typed as `Set<AIErrorKind>(['rate_limited', 'model_busy', 'network_error'])`
- `aiErrorKey` state typed as `AIErrorKind | null`
- `handleGenerate` catch block replaced with `parseProviderError(aiProvider, err)` — raw string-matching removed entirely
- Realtime handler extended to detect `row.error_message?.startsWith('oauth_expired:')` on failed uploads
- `handleScheduleConfirm` catch extended with `msg.startsWith('oauth_expired:')` branch

**Backend workers:**
- `upload-youtube.ts`: `refreshYouTubeToken` call wrapped in try/catch; on failure throws `oauth_expired:youtube`
- `upload-instagram.ts`: outer catch maps 400/401/OAuthException to `oauth_expired:instagram`
- `upload-facebook.ts`: outer catch maps 400/401/OAuthException to `oauth_expired:facebook`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added no_api_key and post_save_failed to AIErrorKind union**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** After tightening `aiErrorKey` state to `AIErrorKind | null`, two existing `setAiErrorKey('no_api_key')` and `setAiErrorKey('post_save_failed')` calls in GeneratorPage failed tsc because those literals were not in the AIErrorKind union
- **Fix:** Added `'no_api_key'` and `'post_save_failed'` to the `AIErrorKind` union type in `ai.ts`
- **Files modified:** `frontend/src/lib/ai.ts`
- **Commit:** 27edf69

**2. [Rule 1 - Bug] navigator.onLine restore fallback in SC-07 test**
- **Found during:** Task 1 test run — "unknown error shape" test received `network_error` instead of `unparseable` because navigator.onLine was not restored after the SC-07 test
- **Issue:** `Object.getOwnPropertyDescriptor(navigator, 'onLine')` returns `undefined` when the property is inherited (not own), so `if (original)` never ran the restore
- **Fix:** Added `else` branch that restores to `{ value: true, configurable: true }` when `original` is undefined
- **Files modified:** `frontend/src/lib/ai.test.ts`
- **Commit:** d087ffd (included in GREEN phase)

## Verification Results

```
Structural checks — all pass:
- grep "model_busy" GeneratorPage.tsx → line 51 (RETRYABLE_ERRORS)
- grep "parseProviderError" ai.ts → lines 290, 311
- grep "oauth_expired:youtube" upload-youtube.ts → line 48
- grep "oauth_expired:instagram" upload-instagram.ts → line 141
- grep "oauth_expired:facebook" upload-facebook.ts → line 108
- grep "oauth_expired:" GeneratorPage.tsx → 2 matches (lines 117, 288)
- grep "msg.includes" GeneratorPage.tsx → no matches (raw string-matching removed)

Tests: 218/218 passed (frontend full suite)
Frontend tsc --noEmit: clean (pre-existing ErrorBoundary.test.tsx errors not caused by this plan)
Backend tsc --noEmit: clean
```

## Known Stubs

None. All error kinds have complete implementations. The `oauth_expired:platform` convention is real code, not placeholder.

## Threat Flags

No new threat surface introduced beyond what was documented in the plan's threat model:
- T-10-01: user-facing messages in parseProviderError are hardcoded literals — no raw SDK payloads exposed
- T-10-02: oauth_expired:platform stores platform name only — no token values
- T-10-03: frontend only checks startsWith prefix — no eval, plain text state

## Self-Check: PASSED

Files confirmed to exist:
- frontend/src/lib/ai.ts (contains parseProviderError export)
- frontend/src/lib/ai.test.ts (contains parseProviderError test blocks)
- frontend/src/pages/GeneratorPage.tsx (contains model_busy, oauth_expired: patterns)
- backend/src/lib/upload-youtube.ts (contains oauth_expired:youtube)
- backend/src/lib/upload-instagram.ts (contains oauth_expired:instagram)
- backend/src/lib/upload-facebook.ts (contains oauth_expired:facebook)

Commits confirmed:
- d087ffd — Task 1 (TDD: RED stubs + GREEN parseProviderError)
- 27edf69 — Task 2 (GeneratorPage wiring + upload worker oauth_expired surfacing)
