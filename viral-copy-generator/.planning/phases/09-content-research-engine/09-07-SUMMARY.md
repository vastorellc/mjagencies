---
phase: "09"
plan: "07"
subsystem: frontend/pages
tags: [research-page, calendar-tab, saved-tab, app-navigation, wave-7, checkpoint-approved]
dependency_graph:
  requires:
    - 09-06 (ResearchPage skeleton with Ideas + Hashtags tabs, App.tsx research branch)
    - 09-05 (types.ts CalendarDay/CalendarSlot/SavedIdea interfaces, api.ts fetchSavedIdeas)
  provides:
    - CalendarTab component: 7-day PKT content calendar with posting slots and assigned ideas (RESEARCH-12)
    - SavedTab component: saved idea list with all ContentIdeaData fields and Unsave toggle (RESEARCH-13)
    - Research floating nav button in App.tsx (purple, visible to all authenticated users)
    - Complete ResearchPage.tsx with all 4 tabs fully implemented
  affects:
    - frontend/src/pages/ResearchPage.tsx (CalendarTab + SavedTab added — 591 lines)
    - frontend/src/App.tsx (Research floating nav button added)
tech_stack:
  added: []
  patterns:
    - CalendarTab sub-component with CalendarDay[] prop (7 day cards, slots mapped inline)
    - SavedTab sub-component with SavedIdea[] prop + onSaveToggle callback
    - Empty-state messaging in both tabs (no placeholder text)
    - Floating button flex-col stack: Admin (conditional) + Research (always) — bottom-right fixed
    - DOW_LABELS indexed by day.dow for day header display
key_files:
  created: []
  modified:
    - frontend/src/pages/ResearchPage.tsx (CalendarTab + SavedTab + tab wiring)
    - frontend/src/App.tsx (Research floating nav button)
decisions:
  - "Research floating button uses purple-900 bg to distinguish from zinc-800 Admin button — follows ResearchPage purple accent established in tab indicators"
  - "Admin and Research buttons stacked in a single flex-col div rather than separate fixed divs — cleaner layout, prevents overlap"
  - "CalendarTab renders day cards vertically (not a CSS grid table) — consistent with the plan spec and RESEARCH.md Open Question 3 resolution"
  - "SavedTab fetches on activeTab change via existing useEffect in ResearchPage — no additional fetch trigger needed in SavedTab itself"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-05-04"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 2
---

# Phase 9 Plan 07: Calendar + Saved Tabs + Research Nav — Summary

**One-liner:** ResearchPage.tsx completed with CalendarTab (7-day PKT grid, per-slot platform/hour/idea rendering) and SavedTab (saved ideas with full ContentIdeaData schema and Unsave toggle); App.tsx updated with purple Research floating button visible to all authenticated users.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Complete Calendar and Saved tabs in ResearchPage.tsx | 6ff65bb | frontend/src/pages/ResearchPage.tsx |
| 2 | Wire ResearchPage into App.tsx navigation (Research button) | ef7a7d5 | frontend/src/App.tsx |

## Task 3: Checkpoint — Human Verification Approved ✓

Task 3 is a `checkpoint:human-verify` gate. Human approved 2026-05-04.

**What was built:**

Complete Content Research Engine (Phase 9):
- Research screen accessible via floating purple "Research" button from GeneratorPage
- 4-tab interface: Ideas, Hashtags, Calendar, Saved
- Ideas tab: niche selector, trend count badge, AI-powered content idea cards with hooks/angle/outline/gaps/hashtags/strength bar
- Hashtags tab: ranked hashtag intelligence with inline-style score bars, source color coding (green=both/blue=user/gray=external)
- Calendar tab: 7-day PKT content calendar with posting slots and assigned ideas
- Saved tab: saved idea list with unsave button
- Freshness indicator: "Last updated: Xh ago" below header
- On-demand refresh button
- Both backend (7 Express routes) and frontend wired end-to-end

## Decisions Made

1. **Purple Research button distinguishes from Admin button** — purple-900 bg with purple-700 border matches the ResearchPage tab accent color established in 09-06, making the entry point visually coherent.

2. **Admin + Research buttons in single flex-col container** — the Admin button (conditional on isAdmin) and Research button (always visible) are stacked in one `fixed bottom-4 right-4` div using `flex flex-col items-end gap-2`. This eliminates potential overlap compared to separate fixed elements.

3. **CalendarTab renders CalendarSlot.hour with zero-padding** — `slot.hour < 10 ? \`0${slot.hour}\` : slot.hour` ensures "08:00" not "8:00" for clean alignment with font-mono.

4. **SavedTab uses saved.idea.platforms not saved.platforms** — `SavedIdea.idea.platforms` (from ContentIdeaData) is the canonical platform list; `saved.platforms` (top-level denormalized field) is also available but the idea-level field is richer.

## Verification Results

```
grep -n "CalendarTab|SavedTab" ResearchPage.tsx           → lines 243, 248, 368, 369, 373, 433, 434, 439
grep -n "calendar.map|calendar.length" ResearchPage.tsx   → lines 374, 389
grep -n "savedIdeas.map|savedIdeas.length" ResearchPage.tsx → lines 440, 452, 455
grep -n "Unsave" ResearchPage.tsx                         → line 465
grep -n "w-[" ResearchPage.tsx                            → 0 matches (clean)
grep -n "ResearchPage" App.tsx                            → lines 10, 99
grep -n "currentScreen === 'research'" App.tsx            → line 98
grep -n "setCurrentScreen.*research" App.tsx              → line 119
cd frontend && npx tsc --noEmit                           → CLEAN (zero errors)
npm run build                                             → built in 8.19s, clean
```

## Deviations from Plan

**Task 2 deviation (Rule 2 — auto-detected):** Plan 09-07 Task 2 described adding the ResearchPage import and research screen branch to App.tsx. However, Plan 09-06 had already added both (import on line 10, screen branch on lines 98-100). Only the floating Research button was missing. Task 2 was executed by adding only the missing button — not re-adding already-present elements. This is the correct behavior, not an error.

No other deviations.

## Known Stubs

None. All 4 tabs are fully implemented:
- Ideas tab: full IdeaCard with ContentIdeaData schema (from 09-06)
- Hashtags tab: HashtagsTab with inline score bars and standalone fetch fallback (from 09-06)
- Calendar tab: CalendarTab with 7-day grid (implemented in this plan)
- Saved tab: SavedTab with full idea fields and Unsave button (implemented in this plan)

Note: IdeaCard "Save" button uses `idea.id ?? String(i)` — `idea.id` is populated by the POST /generate response (Plan 09-04 inserts to content_ideas and returns UUIDs). The index fallback handles the edge case where ID is absent. This is noted in the plan as a known non-requirement gap.

## Threat Surface Scan

No new network endpoints or auth paths introduced. This plan adds frontend UI components and a nav button only. The Unsave flow calls `POST /api/research/ideas/:id/save` (Plan 09-04) which enforces `AND eq(content_ideas.user_id, userId)` ownership check before updating — T-09-18 mitigation is in the backend route, not this frontend plan.

## Self-Check: PASSED

Files created/modified:
- frontend/src/pages/ResearchPage.tsx: FOUND (591 lines)
- frontend/src/App.tsx: FOUND (Research button present)

Commits:
- 6ff65bb: FOUND (feat(09-07): complete Calendar and Saved tabs in ResearchPage)
- ef7a7d5: FOUND (feat(09-07): add Research floating nav button to App.tsx)
