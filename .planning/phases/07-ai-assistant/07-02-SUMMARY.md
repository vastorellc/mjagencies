---
phase: 07-ai-assistant
plan: "02"
subsystem: ai
tags: [ai, editor-actions, server-actions, litellm, tdd, lexical, anti-fabrication, cost-cap]
dependency_graph:
  requires:
    - packages/ai cost-cap enforcement (07-01)
    - packages/ai model routing by tier (07-01)
    - packages/ai extended generateContent (07-01)
    - apps/web-main requireSession pattern (03-auth)
    - AiPanel.tsx Phase 5 stub (05-central-cms)
    - packages/cms/src/editor/ai-hooks-stub.ts Phase 5 stubs (05-central-cms)
  provides:
    - packages/ai 20 typed editor action functions (editor-actions.ts)
    - apps/web-main 20 'use server' wrappers with requireSession() guards (ai-editor.ts)
    - apps/web-main AiPanel.tsx with real action wiring (4 groups, 20 buttons)
    - packages/cms ai-hooks-stub.ts delegating to @mjagency/ai (isStub: false)
  affects:
    - packages/ai (new file + index.ts exports extended)
    - packages/cms (dependency added, ai-hooks-stub.ts rewritten)
    - apps/web-main (new server actions file, new test, AiPanel.tsx replaced)
tech_stack:
  added:
    - "@mjagency/ai workspace:* added to packages/cms dependencies"
  patterns:
    - TDD red/green cycle (RED commit precedes GREEN commit for Task 1)
    - Dynamic import('@mjagency/ai') in server actions for code splitting
    - requireSession() + agencyId guard on every server action (CLAUDE.md Rule 3)
    - AiBudgetExceededError caught at editor-actions layer — graceful degradation
    - useAllFormFields() to read agency context from Payload form fields
    - var(--mj-*) CSS tokens only in AiPanel.tsx (44 tokens, no hex literals)
key_files:
  created:
    - packages/ai/src/editor-actions.ts
    - packages/ai/src/__tests__/editor-actions.test.ts
    - apps/web-main/src/actions/ai-editor.ts
    - apps/web-main/src/__tests__/ai-editor.test.ts
  modified:
    - packages/ai/src/index.ts
    - apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx
    - packages/cms/src/editor/ai-hooks-stub.ts
    - packages/cms/package.json
decisions:
  - AiBudgetExceededError caught at editor-actions layer (not server action layer) — graceful degradation returns { success: false, error: 'budget-exceeded' } instead of throwing
  - Phase 5 ai-hooks-stub.ts AiActionResult.isStub type changed from 'true' to 'false' (breaking change contained within package — external callers only use the result values, not the type literal)
  - aiSuggestInternalLinks and aiAltText kept as stub in ai-hooks-stub.ts with console.warn — not in Phase 7 feature list (Phase 8 scope)
  - AiPanel.tsx Phase 7: result displayed as read-only textarea for copy-paste; Lexical cursor insertion deferred to Phase 8
  - Dynamic import('@mjagency/ai') in server actions — each function imports only the one needed to avoid loading all 20 functions on every server action invocation
  - packages/cms added @mjagency/ai workspace:* dependency (required by ai-hooks-stub.ts delegation)
metrics:
  duration: "~11 minutes"
  completed_date: "2026-04-27"
  tasks_completed: 3
  files_created: 4
  files_modified: 4
  tests_added: 76
  commits: 4
---

# Phase 07 Plan 02: 20 AI Editor Actions Summary

**One-liner:** 20 typed AI editor action functions in @mjagency/ai, 20 'use server' wrappers with mandatory requireSession() guards, AiPanel.tsx replacement with 4-group toolbar, and ai-hooks-stub.ts delegating to real implementations (isStub: false).

## What Was Built

### packages/ai/src/editor-actions.ts (new)

20 typed async functions each wrapping `generateContent()` via `runAction()` helper:

| Action | Tier | Key behavior |
|--------|------|-------------|
| `aiDraftFromTitle` | tier1-bulk | 2500 maxTokens, anti-fab range reminder |
| `aiRewrite` | tier2-writing | Clarity + flow rewrite |
| `aiShorten` | tier2-writing | ~50% length reduction |
| `aiExpand` | tier2-writing | ~2x length expansion, no exact stats |
| `aiSimplify` | tier1-bulk | 8th-grade reading level |
| `aiFixGrammar` | tier1-bulk | Grammar/spelling/punctuation only |
| `aiToneFormal` | tier1-bulk | Formal, professional tone |
| `aiToneConversational` | tier1-bulk | Friendly, conversational tone |
| `aiTonePersuasive` | tier1-bulk | Persuasive, no fake stats |
| `aiSummarizeParagraph` | tier1-bulk | One-sentence summary, 100 maxTokens |
| `aiMetaDescription` | tier1-bulk | EXACTLY 150-160 chars, 100 maxTokens |
| `aiSuggestH2` | tier1-bulk | 5 H2 headings numbered list, 300 maxTokens |
| `aiWriteFaqAnswer` | tier1-bulk | 2-4 sentence answer, ranges not exact stats |
| `aiGenerateCta` | tier1-bulk | 3 CTA variants max 5 words each |
| `aiTranslateSpanish` | tier1-bulk | Neutral Latin American Spanish |
| `aiAddTransition` | tier1-bulk | One bridge sentence, 100 maxTokens |
| `aiBulletExtract` | tier1-bulk | Max 7 bullets, 12 words each |
| `aiCounterArgument` | tier1-bulk | Strongest steelman counter-argument |
| `aiSuggestStat` | tier1-bulk | **Anti-fab: "DO NOT invent specific numbers"** — suggests stat TYPE and source |
| `aiBrandVoiceRewrite` | tier2-writing | Accepts `brandVoiceContext` in opts for Plan 07-04 |

All functions:
- Return `AiEditorActionResult { success, text, model, error? }`
- Return `{ success: false, error: 'no-litellm' }` when `LITELLM_API_URL` absent
- Catch `AiBudgetExceededError` → `{ success: false, error: 'budget-exceeded', text: 'AI budget exceeded...' }`
- Catch other errors → `{ success: false, error: 'generation-failed' }`

### packages/ai/src/index.ts (modified)

Added export block for all 20 functions and `AiEditorActionResult` type.

### apps/web-main/src/actions/ai-editor.ts (new)

20 `'use server'` wrapper functions, each:
```
const session = await requireSession()           // CLAUDE.md Rule 3 line 1
if (session.agencyId !== input.agencyId) throw   // CLAUDE.md Rule 3 line 2
const { ai<Action> } = await import('@mjagency/ai')
return ai<Action>(input.text, input.agencyId, opts)
```

All 20 functions verified: `grep -c "const session = await requireSession" apps/web-main/src/actions/ai-editor.ts` = **20**.

### apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx (replaced)

Real client component with 4 action groups:
- **Group A "Edit"**: Rewrite, Shorten, Expand, Simplify, Fix Grammar, Brand Voice (6 actions)
- **Group B "Tone"**: Formal, Conversational, Persuasive (3 actions)
- **Group C "Generate"**: Draft from Title, Meta Description, H2 Headings, FAQ Answer, CTA Text, Summarize, Add Transition, Bullet Points, Counter Argument, Suggest Stat (10 actions)
- **Group D "Translate"**: Translate ES (1 action)

Features:
- `useAllFormFields()` reads `agency_id`, `agency_slug`, `brand_voice_context`, `content`
- Loading indicator (aria-live), error boundary (budget-exceeded / no-litellm / generic)
- Read-only result textarea + Phase 8 insertion note
- 44 `var(--mj-*)` tokens, zero hex literals
- No `runStub`, no Phase 5 stub language

### packages/cms/src/editor/ai-hooks-stub.ts (rewritten)

Phase 7 wiring:
- `isStub: false` (was `true`)
- `aiRewrite`, `aiExpand`, `aiShorten`, `aiBrandVoiceRewrite`, `aiTldr`, `aiMetaDescription`, `aiGenerateFaq` all delegate to `@mjagency/ai` via dynamic import
- `aiSuggestInternalLinks`, `aiAltText`: not in Phase 7 list — `console.warn` + empty success (Phase 8 scope)

## Test Counts

| File | Tests | Type |
|------|-------|------|
| packages/ai/src/__tests__/editor-actions.test.ts | 47 | Vitest unit (TDD RED/GREEN) |
| apps/web-main/src/__tests__/ai-editor.test.ts | 29 | Vitest unit (auth guard compliance) |
| **New tests total** | **76** | |
| **@mjagency/ai total** | **87** | (47 new + 40 from 07-01) |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `1d67352` | test | RED — failing tests for 20 AI editor action functions (TDD gate) |
| `e8ebc2b` | feat | GREEN — 20 AI editor action functions in @mjagency/ai |
| `fa4ba44` | feat | 20 AI editor server actions with requireSession() guards |
| `23523aa` | feat | Replace AiPanel stub with real server-action wiring; flip ai-hooks-stub isStub=false |

## TDD Gate Compliance

- RED commit (`1d67352`) precedes GREEN commit (`e8ebc2b`) — TDD gate satisfied.
- RED test failure confirmed: `Failed to load url ../editor-actions.js — Does the file exist?`
- GREEN tests: all 47 new tests pass; 87 total pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Added @mjagency/ai to packages/cms dependencies**
- **Found during:** Task 3 CMS typecheck
- **Issue:** `ai-hooks-stub.ts` now imports from `@mjagency/ai` but `packages/cms/package.json` did not list it as a dependency — TypeScript reported `TS2307: Cannot find module '@mjagency/ai'`.
- **Fix:** Added `"@mjagency/ai": "workspace:*"` to `packages/cms/package.json` dependencies and ran `pnpm install`.
- **Files modified:** `packages/cms/package.json`, `pnpm-lock.yaml`
- **Commit:** `23523aa`

**2. [Rule 1 - Bug] Fixed test mock session type mismatch**
- **Found during:** Task 2 typecheck run
- **Issue:** `MOCK_SESSION` object used `as ReturnType<typeof MOCK_SESSION.valueOf>` cast which resolves to `Object` — TypeScript error TS2345 because `requireSession()` returns `VerifiedAccessPayload` with required fields `sub`, `jti`, `familyId`.
- **Fix:** Added `sub`, `jti`, `familyId` fields to mock session object; changed cast to `as any` for test-only code.
- **Files modified:** `apps/web-main/src/__tests__/ai-editor.test.ts`
- **Commit:** `fa4ba44`

## Known Stubs

- `aiSuggestInternalLinks` in `ai-hooks-stub.ts` — not in Phase 7 feature list; returns empty success with `console.warn`. Phase 8 scope.
- `aiAltText` in `ai-hooks-stub.ts` — not in Phase 7 feature list; returns empty success with `console.warn`. Phase 8 scope.
- AiPanel.tsx "Insert at cursor" functionality — result displayed in read-only textarea only. Lexical cursor insertion is Phase 8 plan scope.

These stubs do not prevent the plan's goal from being achieved — all 20 toolbar actions function and return real AI-generated content when LiteLLM is configured.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: server-action-auth | apps/web-main/src/actions/ai-editor.ts | 20 server actions protected by requireSession() + agencyId guard per CLAUDE.md Rule 3. No bypass path exists. |

## Pre-existing Typecheck Status

Both `pnpm --filter @mjagency/web-main typecheck` and `pnpm --filter @mjagency/cms typecheck` have pre-existing errors from earlier phases (SeoPanel.tsx module resolution, lexical-features.ts feature name changes, db schema RLS types, etc.). Zero new errors introduced by this plan's files.

## Self-Check: PASSED

Files exist:
- packages/ai/src/editor-actions.ts: FOUND
- packages/ai/src/__tests__/editor-actions.test.ts: FOUND
- apps/web-main/src/actions/ai-editor.ts: FOUND
- apps/web-main/src/__tests__/ai-editor.test.ts: FOUND
- apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx: FOUND (replaced)
- packages/cms/src/editor/ai-hooks-stub.ts: FOUND (rewritten)

Commits exist:
- 1d67352 (RED test): FOUND
- e8ebc2b (GREEN implementation): FOUND
- fa4ba44 (server actions): FOUND
- 23523aa (AiPanel + stub): FOUND

Tests: 87/87 passing (@mjagency/ai), 29/29 passing (ai-editor.test.ts).
Typecheck (AI package): exit 0. No new typecheck errors in plan files.
