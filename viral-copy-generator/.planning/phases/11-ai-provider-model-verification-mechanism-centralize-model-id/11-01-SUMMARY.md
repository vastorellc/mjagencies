---
phase: 11
plan: 01
subsystem: backend-models
tags: [models, constants, manifest, wave0, requirements, tdd]
dependency_graph:
  requires: []
  provides:
    - backend/shared/model-ids.json
    - backend/src/lib/models.ts
    - backend/src/test/lib/models.test.ts
    - Wave 0 test stubs for Plans 03, 04, 05
  affects:
    - Plans 03-06 (all import MODELS / reference manifest)
tech_stack:
  added: []
  patterns:
    - Parallel MODELS constants (backend + frontend) with shared JSON manifest for parity enforcement
    - Wave 0 RED-state it.todo stubs for Nyquist test sampling
key_files:
  created:
    - backend/shared/model-ids.json
    - backend/src/lib/models.ts
    - backend/src/test/lib/models.test.ts
    - backend/src/test/lib/provider-health-check.test.ts
    - backend/src/test/db/admin-provider-health.test.ts
    - backend/tests/routes/settings.validate-key.test.ts
  modified:
    - .planning/REQUIREMENTS.md (updated during planning — VERIFY-01..06 + Phase 11 traceability row)
decisions:
  - AIProvider redefined in backend/src/lib/models.ts (parallel definition, not imported from frontend — separate package, no shared types between frontend and backend)
  - model-ids.json uses bare sorted array (not wrapped object) — parity oracle, both sides sort before compare
  - defaultModelFor picks first flagship entry per provider, falls back to first entry if none
  - Wave 0 stubs use it.todo (not it.skip) so Vitest shows 33 todo in run output — tracked but unblocking
metrics:
  duration: "~8 minutes"
  completed_date: "2026-05-16"
  tasks_completed: 4
  files_created: 6
---

# Phase 11 Plan 01: Model Constants Foundation + Wave 0 Stubs Summary

Backend single source of truth for 8 May-2026 AI model IDs with shared parity manifest and Wave 0 RED-state test stubs for all downstream plans.

## What Was Built

### Task 1: REQUIREMENTS.md VERIFY section
VERIFY-01..VERIFY-06 were appended to `.planning/REQUIREMENTS.md` under a new `### VERIFY — AI Provider + Model Verification` section during the planning phase (commit `53c30c5`). Phase 11 traceability row added. All 6 requirement IDs are now available for Plans 02-06 to reference in their frontmatter.

### Task 2: backend/shared/model-ids.json
Sorted JSON array of exactly 8 model IDs matching the verified May-2026 lineup from `.planning/notes/2026-05-15-ai-models-current-state.md`:
- claude-opus-4-7
- claude-sonnet-4-6
- deepseek-v4-flash
- deepseek-v4-pro
- gemini-3.1-flash-lite
- gemini-3.1-pro-preview
- gpt-5.5
- gpt-5.5-pro

Parity oracle used by both frontend and backend test suites to assert no drift.

### Task 3: backend/src/lib/models.ts
Full MODELS constant with 8 entries, capability matrix, pricing, tier classification, and notes per model. Exports:
- `MODELS: Record<string, ModelEntry>` — 8 entries
- `MODELS_BY_PROVIDER: Record<AIProvider, ModelEntry[]>` — derived grouping
- `defaultModelFor(provider): string` — returns flagship tier or first entry
- Types: `AIProvider`, `ModelEntry`, `ModelCapabilities`

Verified defaultModelFor returns:
- claude → claude-sonnet-4-6 (flagship)
- openai → gpt-5.5 (flagship)
- gemini → gemini-3.1-pro-preview (flagship)
- deepseek → deepseek-v4-pro (flagship)

### Task 4: Wave 0 Test Stubs
Four test files created:

**GREEN (5 passing tests):** `backend/src/test/lib/models.test.ts`
- Parity assertion: Object.keys(MODELS).sort() equals manifest IDs sorted
- Provider validation, tier validation, text capability, MODELS_BY_PROVIDER coverage, defaultModelFor correctness

**RED stubs (33 it.todo total):**
- `backend/tests/routes/settings.validate-key.test.ts` — 12 stubs for Plan 03 (VERIFY-03)
- `backend/src/test/db/admin-provider-health.test.ts` — 8 stubs for Plan 04
- `backend/src/test/lib/provider-health-check.test.ts` — 13 stubs for Plan 05 (VERIFY-05)

Test run result: **5 passed, 33 todo, 0 failed**

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 2 | 5bc5e8b | feat(11-01): create backend/shared/model-ids.json manifest |
| Task 3 | 233d537 | feat(11-01): create backend/src/lib/models.ts |
| Task 4 | 3872c4c | test(11-01): Wave 0 test stubs + parity test |

## Deviations from Plan

None — plan executed exactly as written.

Note: Task 1 (REQUIREMENTS.md) was completed during the planning phase (commit 53c30c5) — the file was already committed with all VERIFY entries before execution began. No re-commit needed; the plan's acceptance criteria passed (7 VERIFY-0[1-6] matches, 1 ### VERIFY section, Phase 11 traceability row).

## Known Stubs

Wave 0 it.todo stubs in three test files are intentional placeholders tracking Plans 03, 04, and 05 acceptance criteria. These are tracked in test output as "33 todo" and will be converted to real tests in their respective plans.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary surfaces introduced. model-ids.json is a read-only checked-in file (T-11-01 parity test enforces tamper detection).

## Self-Check

PASSED
