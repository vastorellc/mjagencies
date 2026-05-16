---
phase: 11
plan: "03"
subsystem: backend
tags: [backend, validate-key, deepseek-baseurl, google-genai-migration, model_not_found, VERIFY-01, VERIFY-02, VERIFY-03]
dependency_graph:
  requires: [11-01]
  provides: [validate-key-model-verification, @google/genai-backend, deepseek-baseurl-fix, ai-proxy-models-lookup]
  affects: [backend/src/routes/ai.ts, backend/src/routes/settings.ts, backend/tests/routes/settings.validate-key.test.ts]
tech_stack:
  added: ["@google/genai@^1.52.0 (backend)"]
  patterns: [models.retrieve, models.get, ValidateKeyResponse, error_kind discriminant, T-11-02 whitelist pre-validation]
key_files:
  created: [backend/tests/routes/settings.validate-key.test.ts]
  modified: [backend/package.json, backend/package-lock.json, backend/src/routes/ai.ts, backend/src/routes/settings.ts]
decisions:
  - "@google/genai installed at ^1.52.0 (latest compat with ^1.51.0 pin — acceptable)"
  - "@google/generative-ai retained — research-ai.ts still uses GoogleGenerativeAI; Phase 11.5 cleanup"
  - "deepseek-v4-flash chosen as proxy default in ai.ts (cost-effective; vision disabled anyway)"
  - "3 models.retrieve/get calls covers all 4 providers (openai+deepseek share OpenAI SDK branch)"
  - "Pre-existing test failures (settings.test, oauth-*.test, admin.test, research-cache.test) are out of scope — they predate Plan 03 and relate to pg-mem schema drift"
metrics:
  duration: "6 minutes"
  completed: "2026-05-16"
  tasks_completed: 3
  files_changed: 5
---

# Phase 11 Plan 03: Backend AI Proxy + Validate-Key Model Verification Summary

Bumped backend hardcoded model IDs to MODELS lookups, fixed DeepSeek baseURL, migrated Google Gemini to `@google/genai`, and extended `POST /api/settings/validate-key` to verify both API key AND model ID with a richer response shape. 19 integration tests lock the contract for all 4 providers × 4+ scenarios.

## What Was Built

### Task 1: @google/genai install + ai.ts MODELS lookups + DeepSeek baseURL fix (c4de8d5)

**Files modified:** `backend/package.json`, `backend/package-lock.json`, `backend/src/routes/ai.ts`

- Installed `@google/genai@^1.52.0` in backend dependencies
- Imported `MODELS` from `'../lib/models.js'` in `ai.ts`
- Replaced `'deepseek-chat'` → `MODELS['deepseek-v4-flash'].id`
- Replaced `'gpt-4.1'` → `MODELS['gpt-5.5'].id`
- Fixed DeepSeek baseURL: `'https://api.deepseek.com/v1'` → `'https://api.deepseek.com'`
- Added 404/model_not_found error mapping in OpenAI.APIError catch block: `userMessage: 'Selected model unavailable. Update in Settings.'`, `retryable: false`
- Removed `(err as any)` cast — uses `(err as { code?: string }).code` (CLAUDE.md no-any rule)

### Task 2: Extend POST /api/settings/validate-key (c54461f)

**Files modified:** `backend/src/routes/settings.ts`

Key changes:
- **Removed:** `import { GoogleGenerativeAI } from '@google/generative-ai'`
- **Added:** `import { GoogleGenAI } from '@google/genai'`
- **Added:** `import { MODELS, defaultModelFor, type ModelCapabilities, type AIProvider } from '../lib/models.js'`
- Extended `ValidateKeyBody` with optional `model_id?: string`
- New `ValidateKeyResponse` interface: `valid`, `key_valid`, `model_valid`, `error_kind`, `error_message`, `error` (back-compat alias), `capabilities?`, `model_id`
- **T-11-02 mitigation:** MODELS whitelist check BEFORE any SDK call — unknown `model_id` returns 400
- **Verification path:** `models.retrieve(modelId)` for OpenAI/Anthropic/DeepSeek; `client.models.get({ model })` for Gemini ($0 cost)
- **DeepSeek baseURL:** `'https://api.deepseek.com'` (no `/v1`)
- **Per-provider error discrimination:**
  - Claude: triple-nested `err.error?.error?.type === 'not_found_error'` (Pitfall 3)
  - OpenAI/DeepSeek: `code === 'model_not_found'` not `type` (Pitfall 4)
  - Gemini: `status === 'NOT_FOUND'` OR `/model.*not found/i.test(message)` (Pitfall 6)
- **T-11-12:** error_message truncated to 500 chars
- **Back-compat:** `error` field alias retained for existing `SettingsPage.tsx:95` caller

### Task 3: 19 GREEN integration tests (7d1c960)

**Files created:** `backend/tests/routes/settings.validate-key.test.ts`

19 tests, 0 failures:
- OpenAI: valid key+model, SDK 404 model_not_found, SDK 401 invalid_key, whitelist rejection
- Claude: valid key+model (vision=true), Pitfall 3 triple-nested 404, SDK 401 auth_error, default model fallback
- Gemini: valid key+model (video=true), Pitfall 6 NOT_FOUND status, API_KEY_INVALID message, whitelist rejection
- DeepSeek: valid key+model (vision=false), SDK 404, SDK 401
- Cross-provider: unknown provider 400, missing api_key 400, back-compat error alias, 401 without auth

## Deviations from Plan

### Note: @google/generative-ai not removed

**During:** Task 1 (`grep -rn "@google/generative-ai" src tests`)

**Found:** `backend/src/lib/research-ai.ts:147-148` still uses `GoogleGenerativeAI` via dynamic import for research AI calls

**Action:** Retained `@google/generative-ai` in `package.json` alongside `@google/genai`. `settings.ts` is fully migrated to `@google/genai`. `research-ai.ts` migration is a Phase 11.5 cleanup task.

**No impact on Plan 03 goals** — validate-key and ai.ts both use `@google/genai` correctly.

### Note: models.retrieve count is 3, not 4

Plan acceptance criteria said ">=4 matches" for `models.retrieve\|models.get`. The implementation has 3 explicit SDK calls because OpenAI and DeepSeek share one handler branch (both use the OpenAI SDK):

```
Line 443: await client.models.retrieve(modelId)  // openai + deepseek branch
Line 446: await client.models.retrieve(modelId)  // claude branch  
Line 450: await client.models.get({ model: modelId })  // gemini branch
```

This is functionally correct for all 4 providers. The intent of the criterion ("one per provider branch") is met.

## Phase 11.5 Cleanup Items

| Item | File | Reason kept |
|------|------|-------------|
| `@google/generative-ai` package | `backend/package.json` | `backend/src/lib/research-ai.ts` (line 147) still uses `GoogleGenerativeAI` via dynamic import for AI-based content research |

## Known Stubs

None — all response fields are real data from MODELS registry and SDK error discrimination logic.

## Threat Flags

No new network endpoints or auth paths introduced beyond the extended validate-key handler (existing route, extended shape).

## Self-Check: PASSED

- backend/src/routes/ai.ts — FOUND, MODELS imports at lines 10 + 87
- backend/src/routes/settings.ts — FOUND, GoogleGenAI at line 4, models.retrieve/get at lines 443/446/450
- backend/tests/routes/settings.validate-key.test.ts — FOUND, 19 tests
- Commit c4de8d5 — FOUND (Task 1)
- Commit c54461f — FOUND (Task 2)
- Commit 7d1c960 — FOUND (Task 3)
- `grep "api.deepseek.com/v1" src/routes/ai.ts src/routes/settings.ts` → 0 matches
- `grep "'gpt-4.1'\|'deepseek-chat'" src/routes/ai.ts src/routes/settings.ts` → 0 matches
- `grep "NEXT_PUBLIC.*KEY" src/routes/ai.ts src/routes/settings.ts` → 0 matches
