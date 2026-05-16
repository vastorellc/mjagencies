---
phase: 11
plan: 02
subsystem: frontend-models
tags: [models, frontend, parseProviderError, model_not_found, tdd, parity]
dependency_graph:
  requires:
    - backend/shared/model-ids.json (Plan 01)
    - backend/src/lib/models.ts (Plan 01)
  provides:
    - frontend/src/lib/models.ts
    - frontend/src/lib/models.test.ts
    - frontend/src/lib/ai.ts (model_not_found discriminant + MODELS integration)
    - frontend/src/lib/ai.parseProviderError.test.ts
  affects:
    - Plan 06 (Settings UI — imports MODELS_BY_PROVIDER for model dropdown)
    - GeneratorPage (Phase 10-wired error banner now surfaces model_not_found)
tech_stack:
  added: []
  patterns:
    - Frontend MODELS constant parallel to backend with shared JSON manifest parity enforcement
    - model_not_found discriminant per-provider using provider-specific error shape detection
    - defaultModelFor() replacing hardcoded stale model IDs in callAI()
key_files:
  created:
    - frontend/src/lib/models.ts
    - frontend/src/lib/models.test.ts
    - frontend/src/lib/ai.parseProviderError.test.ts
  modified:
    - frontend/src/lib/ai.ts
decisions:
  - AIProvider imported from ./types in frontend/src/lib/models.ts (not redefined) — re-exported for convenience so callers can do import type { AIProvider } from './models'
  - parseProviderError signature is (provider, err) — plan test examples used reversed args; adapted tests to match actual signature
  - MODELS import in ai.ts used in comment reference for DeepSeek vision capability check; tsc clean (no unused-import error in strict mode for value imports used in JSDoc/comments)
  - Claude model_not_found detection uses OR condition (triple-nested type OR top-level status=404) to cover both Claude SDK v4 shapes
  - OpenAI and DeepSeek share the same detection pattern (OpenAI SDK) but produce provider-specific messages
metrics:
  duration: "~5 minutes"
  completed_date: "2026-05-16"
  tasks_completed: 3
  files_created: 3
  files_modified: 1
---

# Phase 11 Plan 02: Frontend MODELS Parity + parseProviderError model_not_found Summary

Frontend MODELS constant at parity with backend (same 8 model IDs, same defaults, byte-equivalent capability matrix) and model_not_found discriminant added to parseProviderError for all 4 providers, with stale gemini-2.5-flash and claude-sonnet-4-5 IDs removed.

## What Was Built

### Task 1: frontend/src/lib/models.ts + parity test

**frontend/src/lib/models.ts** — 8-entry MODELS constant with byte-equivalent structure to `backend/src/lib/models.ts`. Key differences from backend version:
- `AIProvider` imported from `./types` (not redefined) — re-exported for convenience
- No `.js` import suffix (Vite extensionless resolution)
- File header parity comment: `// PARITY: must export identical MODELS keys to backend/src/lib/models.ts`

Exports: `MODELS`, `MODELS_BY_PROVIDER`, `defaultModelFor()`, `ModelEntry`, `ModelCapabilities`

**frontend/src/lib/models.test.ts** — 4 parity tests, all GREEN:
- MODELS keys equal manifest IDs sorted
- Every model has expected shape (provider regex, tier regex, text=true, numeric prices)
- MODELS_BY_PROVIDER has >=1 entry per provider
- defaultModelFor returns correct flagship per provider

Parity confirmation:
- `Object.keys(MODELS).length === 8` ✓
- `defaultModelFor('claude')` returns `'claude-sonnet-4-6'` ✓
- `defaultModelFor('openai')` returns `'gpt-5.5'` ✓
- `defaultModelFor('gemini')` returns `'gemini-3.1-pro-preview'` ✓
- `defaultModelFor('deepseek')` returns `'deepseek-v4-pro'` ✓

### Task 2: model_not_found in ai.ts

**AIErrorKind union** — `'model_not_found'` added before `'unparseable'` (position matches research spec).

**parseProviderError extensions:**

| Provider | Detection Method | Message |
|----------|-----------------|---------|
| Claude | `err.error.error.type === 'not_found_error'` OR `status === 404` (Pitfall 3 triple-nesting) | "Selected Claude model unavailable. Update model in Settings." |
| OpenAI | `err.error.code === 'model_not_found'` OR `status === 404` (Pitfall 4 — type is misleading) | "Selected OpenAI model unavailable. Update model in Settings." |
| DeepSeek | Same OpenAI-SDK pattern | "Selected DeepSeek model unavailable. Update model in Settings." |
| Gemini | `status === 'NOT_FOUND'` OR `status === 404` OR `/model.*not found/i` message regex (Pitfall 6 — no typed NotFoundError) | "Selected Gemini model unavailable. Update model in Settings." |

**Legacy model ID removal:**
- `grep "gemini-2.5-flash" frontend/src/lib/ai.ts` → 0 matches ✓
- `grep "claude-sonnet-4-5" frontend/src/lib/ai.ts` → 0 matches ✓

Replacements:
- `model: 'gemini-2.5-flash'` → `model: defaultModelFor('gemini')` (resolves to `gemini-3.1-pro-preview`)
- `model: 'claude-sonnet-4-5'` → `model: defaultModelFor('claude')` (resolves to `claude-sonnet-4-6`)

**model_not_found occurrences in ai.ts:** 8 (union member + 4 provider return statements + comment annotations)
**MODELS/defaultModelFor occurrences:** 4 (import line + 2 usage sites + 1 comment reference)

### Task 3: ai.parseProviderError.test.ts

24 tests covering 4 providers × 5+ error shapes, all GREEN:

| Provider | Tests | Key Pitfall Verified |
|----------|-------|---------------------|
| Claude | 5 | Pitfall 3: triple-nesting err.error.error.type |
| OpenAI | 5 | Pitfall 4: code-based detection not type |
| DeepSeek | 5 | Same OpenAI-SDK pattern; DeepSeek message |
| Gemini | 5 | Pitfall 6: no typed NotFoundError; regex fallback |
| All providers | 4 | retryable=false for model_not_found |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 8b141ea | feat(11-02): create frontend/src/lib/models.ts + parity test |
| Task 2 | b41ec69 | feat(11-02): add model_not_found to parseProviderError + remove stale model IDs |
| Task 3 | 6eb08f0 | test(11-02): parseProviderError coverage — 4 providers × 5+ error shapes (VERIFY-04) |

## Test Results

- `npm run test:run -- --project unit src/lib/models.test.ts` → 4/4 PASS
- `npm run test:run -- --project unit src/lib/ai.parseProviderError.test.ts` → 24/24 PASS
- `npm run test:run -- --project unit` (full unit suite) → 344/344 PASS, 0 failures
- `npm run build` → SUCCESS (manifest import test-only; not in production bundle)
- `npx tsc --noEmit` → CLEAN (no errors, no any types)

## Deviations from Plan

**1. [Rule 1 - Adaptation] parseProviderError test argument order**
- **Found during:** Task 3
- **Issue:** Plan's test examples showed `parseProviderError(raw, 'claude')` (raw first) but the actual function signature is `parseProviderError(provider: AIProvider, err: unknown)` (provider first). The plan explicitly states "Adjust the import of `parseProviderError` to match the actual export shape".
- **Fix:** All 24 test calls use the correct `parseProviderError(provider, raw)` order matching the actual function signature.
- **Files modified:** frontend/src/lib/ai.parseProviderError.test.ts

## Known Stubs

None — all 3 tasks are fully wired. MODELS is a real constant, not stub data. parseProviderError changes are real discriminant logic, not placeholders.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary surfaces introduced.

T-11-03 mitigated: All user-facing messages in parseProviderError are hardcoded strings — raw SDK error bodies never interpolated into messages.
T-11-10 mitigated: model_not_found message says "Update in Settings" — does not include user-supplied model ID (avoids reflected-XSS surface).

## Self-Check: PASSED

Files exist:
- frontend/src/lib/models.ts ✓
- frontend/src/lib/models.test.ts ✓
- frontend/src/lib/ai.parseProviderError.test.ts ✓
- frontend/src/lib/ai.ts (modified) ✓

Commits exist:
- 8b141ea ✓
- b41ec69 ✓
- 6eb08f0 ✓
