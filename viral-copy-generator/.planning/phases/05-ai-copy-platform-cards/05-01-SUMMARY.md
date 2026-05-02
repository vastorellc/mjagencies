---
phase: 05-ai-copy-platform-cards
plan: "01"
subsystem: ai-sdk-setup
tags:
  - sdk-install
  - test-stubs
  - wave-0
  - tdd-red
dependency_graph:
  requires:
    - "04-08 (GeneratorPage integration)"
  provides:
    - "@google/genai@1.51.0 installed in frontend"
    - "@anthropic-ai/sdk@0.92.0 installed in frontend"
    - "openai@6.35.0 installed in backend"
    - "frontend/src/lib/ai.test.ts (RED stubs: AI-06, AI-09, AI-11)"
    - "frontend/src/lib/checklist.test.ts (MQ re-evaluation block appended: D-09..D-12)"
    - "frontend/src/components/PlatformCopyCard.test.tsx (RED stubs: PLATFORM-03, PLATFORM-06, PLATFORM-08, PLATFORM-09)"
    - "backend/src/routes/ai.test.ts (RED stub: T-5-01 API key never in response)"
  affects:
    - "Plans 05-02 through 05-06 (all depend on these SDKs and test stubs)"
tech_stack:
  added:
    - "@google/genai 1.51.0 (new unified Gemini SDK — NOT deprecated @google/generative-ai)"
    - "@anthropic-ai/sdk 0.92.0 (official Claude SDK with dangerouslyAllowBrowser support)"
    - "openai 6.35.0 (backend-only proxy; never in frontend)"
  patterns:
    - "TDD Red-Green-Refactor Wave 0 scaffolding pattern"
    - "Import-fails-RED pattern: tests fail because imported modules don't exist yet"
key_files:
  created:
    - frontend/src/lib/ai.test.ts
    - frontend/src/components/PlatformCopyCard.test.tsx
    - backend/src/routes/ai.test.ts
  modified:
    - frontend/package.json (added @google/genai, @anthropic-ai/sdk at exact pinned versions)
    - backend/package.json (added openai at exact pinned version)
    - frontend/src/lib/checklist.test.ts (MQ re-evaluation describe block appended)
decisions:
  - "@google/genai used (new unified SDK), not @google/generative-ai (deprecated, no ai.files namespace)"
  - "All three package versions pinned exactly (no ^ or ~) per plan and CLAUDE.md supply-chain risk policy"
  - "checklist.test.ts extended by appending, not replacing — existing 42 Phase 4 tests preserved"
  - "Wave 0 RED state is intentional — modules don't exist yet; GREEN achieved in Plans 02-05"
metrics:
  duration: "319s"
  completed_date: "2026-05-02"
  tasks_completed: 2
  tasks_total: 3
  files_created: 3
  files_modified: 3
---

# Phase 5 Plan 01: SDK Install + Wave 0 Test Stubs Summary

Install three pinned AI SDK packages and scaffold four test files in RED state covering all Nyquist Wave 0 requirements from VALIDATION.md.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Install AI SDK packages at pinned versions | d0cbc56 | Done |
| 2 | Scaffold Wave 0 test stubs (RED state, all four files) | c66f54c | Done |
| 3 | Checkpoint: Verify SDKs + Supabase Realtime | — | AWAITING HUMAN |

## What Was Built

### Task 1: SDK Install

Three AI SDK packages installed at exact pinned versions (no `^` or `~`):

- `frontend`: `@google/genai@1.51.0` — new unified Gemini SDK (NOT deprecated `@google/generative-ai`)
- `frontend`: `@anthropic-ai/sdk@0.92.0` — official Claude SDK with `dangerouslyAllowBrowser` support
- `backend`: `openai@6.35.0` — backend-only; never installed in frontend (CORS permanently blocked)

npm adds `^` by default; package.json files were corrected to exact versions after install.

### Task 2: Wave 0 Test Stubs

Four test files created/extended in RED state (failing because implementation modules don't exist yet):

**`frontend/src/lib/ai.test.ts`** (NEW — 7 `it()` blocks):
- `parseAIOutput` — 5 tests covering AI-09: clean JSON, code fences, truncation, malformed, partial hydration
- `buildAICallParams` — 2 tests covering AI-11: second pass drops frames, first pass includes frames
- `getGeminiConfig` — 1 test covering AI-06: both `responseMimeType` AND `responseSchema` present

**`frontend/src/lib/checklist.test.ts`** (EXTENDED — 9 tests appended):
- `buildChecklist MQ re-evaluation` — 9 tests covering AI-10 D-09..D-12:
  - D-09: caption length checks (YouTube title ≤60, Instagram 150-200)
  - D-10: hook presence, CTA presence
  - D-11: hashtag count in band (25-30 IG, skips disabled platforms)
  - D-12: language match, keyword density
- Existing 42 Phase 4 tests preserved and still passing

**`frontend/src/components/PlatformCopyCard.test.tsx`** (NEW — 8 `it()` blocks):
- PLATFORM-03: clipboard copy button writes correct text, shows "Copied!" for 1.5s
- PLATFORM-06: TikTok upload button always disabled with "available once api approved" label
- PLATFORM-08: X card has no upload button
- PLATFORM-09: upload status renders idle/uploading/posted/failed labels; uploading state disables button
- data-testid attribute presence

**`backend/src/routes/ai.test.ts`** (NEW — 2 `it()` blocks):
- T-5-01: POST /api/ai/generate returns 200 with `text` and decrypted API key never in response body
- T-5-01: returns 400 with `error: no_api_key` when user has no API key configured

## RED State Verification

Tests are in the expected RED state:

- `ai.test.ts` — fails: `Cannot find module './ai'` (ai.ts created in Plan 05-03)
- `checklist.test.ts` — 42 pass / 8 fail (MQ items return 'pending', not 'pass'/'fail'; `buildChecklist` doesn't accept `aiOutput` yet — extended in Plan 05-04)
- `PlatformCopyCard.test.tsx` — fails: `Cannot find module './PlatformCopyCard'` (created in Plan 05-05)
- `backend/src/routes/ai.test.ts` — fails: `Cannot find module '../app.js'` export includes `/api/ai` route (Plan 05-02)

This is correct Wave 0 behavior per VALIDATION.md Nyquist requirements.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed npm-added `^` prefix from pinned versions**
- **Found during:** Task 1 verification
- **Issue:** npm install adds `^` prefix by default (`"@anthropic-ai/sdk": "^0.92.0"`), violating the plan's "exact, no ^ or ~" requirement
- **Fix:** Manually edited both `frontend/package.json` and `backend/package.json` to remove the `^` prefix after installation
- **Files modified:** `frontend/package.json`, `backend/package.json`
- **Commit:** d0cbc56

## Known Stubs

None introduced in this plan — all RED test files are intentional stubs with no UI rendering paths. Implementation stubs will be tracked when created in Plans 05-02 through 05-06.

## Threat Flags

None — this plan only installs packages and creates test files. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

Files created/exist:
- FOUND: frontend/src/lib/ai.test.ts
- FOUND: frontend/src/components/PlatformCopyCard.test.tsx
- FOUND: backend/src/routes/ai.test.ts
- FOUND: frontend/src/lib/checklist.test.ts (extended)

Commits exist:
- FOUND: d0cbc56 (chore(05-01): install AI SDK packages at pinned versions)
- FOUND: c66f54c (test(05-01): scaffold Wave 0 test stubs in RED state)
