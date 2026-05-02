---
phase: 05-ai-copy-platform-cards
plan: 06
status: complete
completed: 2026-05-02
wave: 4
---

# 05-06 Summary — GeneratorPage Full Phase 5 Integration

## What Was Built

### Task 1: `GET /api/settings/key` backend route

Added to `backend/src/routes/settings.ts` after the main GET / handler:
- Dedicated endpoint that decrypts and returns the API key to the authenticated owner
- Returns `{ api_key: null }` if no key saved; 500 on decrypt failure
- Key never appears in general `GET /settings` response (T-5-01)
- Auth enforced by existing `authMiddleware` on all `/api/settings` routes

### Task 2: `frontend/src/pages/GeneratorPage.tsx` full rewrite

Phase 5 state additions (alongside existing signals/learnedWeights/dataPoints):
- `userId` — populated from `supabase.auth.getSession()` on mount; updated via `onAuthStateChange`
- `selectedFile` — File | null from file picker input
- `description` — string from textarea (0–280 chars)
- `aiOutput` — AIOutput | null; populated after callAI resolves
- `settingsData` — SettingsResponse | null; fetched on mount (non-blocking D-13)
- `aiLoading`, `aiError`, `aiErrorKey` — generation UI state
- `postId` — string | null; set after first createPost success (D-14)
- `uploadStatuses` — Record<platform, UploadStatus>; updated via Realtime
- `isFirstGenerationRef` — useRef<boolean> tracking first-gen flag

Key behaviors:
- **D-13**: `fetchSettings()` called on mount with `.catch(() => {})` non-blocking; fallbacks used until response arrives
- **D-14**: `createPost()` called inside `handleGenerate()` on first generation only (`isFirstGenerationRef`)
- **D-15**: Realtime `useEffect([postId, userId])` subscribes synchronously; cleanup returned synchronously (not inside .then())
- **CLAUDE.md compliance**: `fetchApiKey()` called inside `handleGenerate()` immediately before `callAI()` — key used in function scope then discarded, never stored in React state
- **D-05**: `Get Better Version` passes `isSecondPass: true` → `scriptOutline` injected into prompt; frames omitted (50% cheaper)
- **AI-10**: `buildChecklist` receives `aiOutput ?? undefined` as third param; MQ items flip from pending to pass/fail
- **D-08**: File picker + textarea always rendered; Generate Copy disabled when both empty
- **Error copy**: Seven exact strings from UI-SPEC.md; retry button for `rate_limited` and `network_error` only

### Test Fixes

- `GeneratorPage.test.tsx` supabase mock extended: `getSession`, `onAuthStateChange`, `channel`, `removeChannel`
- "renders placeholder copy" test updated: new UI always shows upload area instead of placeholder message

## Acceptance Criteria Verified

| Check | Result |
|-------|--------|
| `callAI` in GeneratorPage | 2 matches |
| `buildPrompt` in GeneratorPage | 2 matches |
| `fetchSettings` in GeneratorPage | 2 matches |
| `fetchApiKey` in GeneratorPage | 3 matches |
| `createPost` in GeneratorPage | 2 matches |
| `isSecondPass` in GeneratorPage | 4 matches |
| `platform-posts-realtime` in GeneratorPage | 1 match |
| `PlatformCopyCard` in GeneratorPage | 3 matches |
| `api_key_plain` in GeneratorPage | 0 matches |
| `GET /settings/key` in settings.ts | 1 match |

## Test Results

- Frontend full suite: 206/206 GREEN (11 test files)
- Backend full suite: 49 passed, 2 skipped (pre-existing skips)
- tsc frontend: clean
- tsc backend: clean

## Commits

- `pending` — feat(05-06): GeneratorPage full Phase 5 integration + GET /settings/key
