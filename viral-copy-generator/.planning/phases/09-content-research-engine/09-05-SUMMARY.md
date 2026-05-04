---
phase: "09"
plan: "05"
subsystem: frontend/lib
tags: [types, api-client, research, contract-layer, wave-5]
dependency_graph:
  requires:
    - 09-04 (researchRouter with 6 endpoints — API shape to match)
  provides:
    - Screen type extended with 'research'
    - 8 Phase 9 type interfaces exported from types.ts
    - 6 research API client functions exported from api.ts
  affects:
    - frontend/src/lib/types.ts (Screen union + Phase 9 section appended)
    - frontend/src/lib/api.ts (import block extended + Phase 9 section appended)
tech_stack:
  added: []
  patterns:
    - fail-open API client pattern (fetchSavedIdeas, fetchResearchHashtags — return [] on error)
    - fire-and-forget POST pattern (refreshTrends — throws on failure for error display)
    - apiFetch wrapper with auth header injection (consistent with all prior phases)
key_files:
  created: []
  modified:
    - frontend/src/lib/types.ts (Screen union extended + 8 Phase 9 interfaces)
    - frontend/src/lib/api.ts (import block + 6 research client functions)
decisions:
  - "fetchSavedIdeas fail-open (returns []) — saved ideas are non-critical; display failure must not block research tab render"
  - "fetchResearchHashtags fail-open (returns []) — hashtag tab degrades gracefully if standalone endpoint fails"
  - "refreshTrends throws on failure — it is an explicit user action; error must surface to UI for feedback"
  - "Phase 9 types match backend response shapes from research.ts exactly — content_ideas .returning() UUIDs are on id? optional field"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-05-04"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 2
---

# Phase 9 Plan 05: Frontend Types + API Client Contract Summary

**One-liner:** types.ts extended with 'research' Screen and 8 Phase 9 interfaces (TrendItem, ContentIdeaData, HashtagIntel, CalendarSlot, CalendarDay, ResearchTrendsResponse, ResearchGenerateResponse, SavedIdea); api.ts extended with 6 research client functions (fetchResearchTrends, generateResearchIdeas, fetchSavedIdeas, saveIdea, refreshTrends, fetchResearchHashtags) — full type contract for Plans 09-06 and 09-07.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend types.ts with Screen 'research' and Phase 9 type interfaces | 58b25f5 | frontend/src/lib/types.ts |
| 2 | Extend api.ts with 6 research client functions | d7ab9c6 | frontend/src/lib/api.ts |

## Decisions Made

1. **fetchSavedIdeas fail-open (returns [])** — Saved ideas are decorative/optional relative to the primary research flow. A failure fetching saved ideas must not prevent the ResearchPage from rendering.

2. **fetchResearchHashtags fail-open (returns [])** — Same rationale: the hashtag tab degrades gracefully if the standalone endpoint is unavailable. The generate endpoint also returns hashtags, so the tab has a fallback data source.

3. **refreshTrends throws on failure** — Unlike the fail-open functions, `refreshTrends` is an explicit user-triggered action. The caller needs the error to show feedback in the UI (e.g., "Refresh failed — try again").

4. **Phase 9 types match 09-04 backend shapes exactly** — The `id?` field in ContentIdeaData is optional because it is absent in raw AI parse output but present after the `/generate` endpoint inserts to content_ideas with `.returning({id})`.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

```
grep -n "'research'" frontend/src/lib/types.ts     → line 1: Screen union includes 'research'
grep -n "ResearchTab" frontend/src/lib/types.ts     → line 373: 4-tab type
grep -n "ContentIdeaData" frontend/src/lib/types.ts → line 383: full idea interface
grep -n "HashtagIntel" frontend/src/lib/types.ts    → line 398: ranking interface
grep -n "CalendarDay" frontend/src/lib/types.ts     → line 413: calendar interface
grep -n "SavedIdea" frontend/src/lib/types.ts       → line 433: saved idea interface
grep -n "fetchResearchTrends" frontend/src/lib/api.ts   → line 350
grep -n "generateResearchIdeas" frontend/src/lib/api.ts → line 358
grep -n "fetchSavedIdeas" frontend/src/lib/api.ts   → line 369: fail-open try/catch returns []
grep -n "saveIdea" frontend/src/lib/api.ts          → line 381
grep -n "refreshTrends" frontend/src/lib/api.ts     → line 390
grep -n "fetchResearchHashtags" frontend/src/lib/api.ts → line 396: fail-open try/catch returns []
grep -c "export" frontend/src/lib/api.ts            → 32 (6 new exports added)
cd frontend && npx tsc --noEmit                     → CLEAN (zero errors)
```

## Known Stubs

None. All types and API functions are complete. Functions map 1:1 to backend endpoints from Plan 09-04.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. This plan adds client-side type definitions and API client functions only. Backend security (niche allowlist, user_id ownership checks, RLS) from Plan 09-04 applies when these functions are called.

## Self-Check: PASSED
