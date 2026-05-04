---
phase: "09"
plan: "06"
subsystem: frontend/pages
tags: [research-page, ideas-tab, hashtags-tab, content-ideas, gap-warnings, freshness, wave-6]
dependency_graph:
  requires:
    - 09-05 (types.ts + api.ts contract layer — Screen 'research', ContentIdeaData, HashtagIntel, all 6 API functions)
  provides:
    - ResearchPage component with 4-tab skeleton (ideas, hashtags, calendar placeholder, saved placeholder)
    - Ideas tab with IdeaCard (all ContentIdeaData fields, gap warnings, 3 hook variants, script outline, b-roll, platforms, hashtags)
    - Hashtags tab with HashtagIntel ranked list (inline-style score bars, source color coding)
    - Freshness indicator (RESEARCH-15)
    - Niche selector dropdown triggering useEffect re-fetch
    - Refresh button calling refreshTrends()
    - App.tsx wired with 'research' screen branch
  affects:
    - frontend/src/pages/ResearchPage.tsx (created — 449 lines)
    - frontend/src/App.tsx (ResearchPage import + research screen branch)
tech_stack:
  added: []
  patterns:
    - 4-tab sub-nav with activeTab useState (same pattern as AdminPage AdminTab)
    - useEffect on niche change (cache-first trend fetch, RESEARCH-06)
    - useEffect on activeTab=saved (lazy-load saved ideas)
    - inline style bar width (never dynamic Tailwind w-[] class — same as LearningPage)
    - IdeaCard collapsible sub-component with expanded state
    - HashtagsTab sub-component with standalone fallback fetch
    - freshnessLabel() computing Xh ago from ISO fetchedAt (RESEARCH-15)
    - h-[100dvh] layout (not h-screen — iOS Safari bug)
key_files:
  created:
    - frontend/src/pages/ResearchPage.tsx
  modified:
    - frontend/src/App.tsx (import + research screen branch)
decisions:
  - "Calendar and Saved tab bodies are plan-07 placeholders — split keeps each plan under 50% context target per objective"
  - "HashtagsTab has standalone fetchResearchHashtags fallback — if user visits Hashtags before generating ideas, tab still populates"
  - "App.tsx research branch added in same commit as ResearchPage — wiring is part of the plan 09-06 scope per STATE.md"
  - "DOW_LABELS retained in ResearchPage import scope for Plan 09-07 calendar use (noUnusedLocals not set)"
metrics:
  duration: "~4 minutes"
  completed_date: "2026-05-04"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 1
---

# Phase 9 Plan 06: ResearchPage.tsx — Ideas + Hashtags Tabs Summary

**One-liner:** ResearchPage.tsx created with 4-tab skeleton (Ideas + Hashtags fully implemented, Calendar + Saved as 09-07 placeholders), IdeaCard with full ContentIdeaData schema including gap warnings and 3 hook variants, HashtagsTab with inline-style score bars; wired into App.tsx as the 'research' screen.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ResearchPage skeleton + Ideas tab (+ App.tsx wiring) | fdfb47e | frontend/src/pages/ResearchPage.tsx, frontend/src/App.tsx |

## Decisions Made

1. **Calendar and Saved tab bodies are plan-07 placeholders** — The plan objective explicitly states this split to keep each plan under the 50% context target. Calendar shows "Generate ideas first to populate the calendar." and Saved shows "Loading saved ideas..." as placeholder text that will be replaced in 09-07.

2. **HashtagsTab has standalone fetchResearchHashtags fallback** — If the user navigates to the Hashtags tab without first generating ideas (which also returns hashtags), the component calls `fetchResearchHashtags(niche)` directly. This makes the Hashtags tab independently functional.

3. **App.tsx research branch added in same commit** — The STATE.md explicitly describes this plan as "ResearchPage.tsx skeleton wired into App.tsx". Both files are atomic parts of the same task.

4. **IdeaCard uses `idea.id ?? String(i)` for save toggle** — The `id` field on ContentIdeaData is optional (absent in raw AI parse, present after `/generate` DB insert per Plan 09-04). The index fallback handles the edge case.

## Verification Results

```
grep -n "h-[100dvh]" ResearchPage.tsx           → line 122: confirmed (not h-screen)
grep -n "style=.*width" ResearchPage.tsx         → lines 288, 433: two inline-style bars
grep -n "w-[" ResearchPage.tsx                   → no output (no dynamic Tailwind width classes)
grep -n "gapWarnings" ResearchPage.tsx           → lines 247, 248, 254: gap warning render
grep -n "hookVariants" ResearchPage.tsx          → lines 259, 261: 3 hooks mapped
grep -n "fetchedAt|freshnessLabel" ResearchPage.tsx → confirmed (RESEARCH-15)
cd frontend && npx tsc --noEmit                  → CLEAN (zero errors)
npm run build                                    → built in 8.53s, 2 files (87 modules)
wc -l ResearchPage.tsx                          → 449 lines (required: min 150)
```

## Deviations from Plan

None — plan executed exactly as written. App.tsx wiring added per STATE.md description which explicitly mentioned "wired into App.tsx" as part of plan 09-06 scope.

## Known Stubs

Calendar tab and Saved tab bodies are intentional plan-split placeholders, not data stubs:

| Location | Type | Reason |
|----------|------|--------|
| ResearchPage.tsx line ~195 (calendar tab) | UI placeholder | Implemented in Plan 09-07 per plan objective |
| ResearchPage.tsx line ~203 (saved tab) | UI placeholder | Implemented in Plan 09-07 per plan objective |

These do NOT block the plan's goal (Ideas + Hashtags tabs ship fully functional). Plan 09-07 will replace both placeholder divs with full implementations.

## Threat Surface Scan

No new network endpoints or auth paths introduced. This plan adds a frontend component only. The component calls existing backend endpoints from Plan 09-04 (all auth-gated via `authMiddleware`). AI-generated text (title, angle, hooks) renders as React text nodes — no `dangerouslySetInnerHTML` used, satisfying T-09-15 (accept disposition).

## Self-Check: PASSED
