---
phase: 07-history-learning-loops
plan: 05
status: complete
subsystem: frontend
tags: [learning, insights, prompt-injection, navigation]
files_modified:
  created:
    - frontend/src/pages/LearningPage.tsx
  modified:
    - frontend/src/lib/prompt.ts
    - frontend/src/pages/GeneratorPage.tsx
    - frontend/src/App.tsx
key-decisions:
  - "Bar chart widths use inline style={{ width: `${pct}%` }} -- Tailwind JIT cannot generate dynamic class names at build time"
  - "Learning fetch in handleGenerate() is fresh per-call (no caching) per LEARNING-06 spec"
  - "max-w-[75%] on hook text truncation span is compliant -- static hardcoded value, not dynamic"
  - "fetchLearningWeights() on mount replaces hardcoded null/0 for learnedWeights and dataPoints"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-03"
  tasks_completed: 2
  files_created: 1
  files_modified: 3
---

# Phase 07 Plan 05: LearningPage + Learning Injection Summary

**One-liner:** LearningPage with inline-style bar charts for hooks/hashtags/niches, learning data injected into every AI prompt via extended buildPrompt(), live calibration weights fetched on GeneratorPage mount.

## What Was Built

### LearningPage.tsx (NEW -- 230 lines)

Full Learning Insights screen at `frontend/src/pages/LearningPage.tsx`.

Loads all 5 learning data sets in parallel via `Promise.all` on mount:
- `fetchTopHooks()` -- top 5 hooks by MAX(actual_views)
- `fetchTopHashtags()` -- top 10 hashtags by avg_views
- `fetchPostingTimes()` -- best PKT posting slots
- `fetchNichePerformance()` -- niche breakdown
- `fetchLearningWeights()` -- calibration data_points + is_calibrated

**Sections rendered:**

1. **Top Hooks** (LEARNING-01) -- hook text + max views, purple bar chart
2. **Top Hashtags** (LEARNING-02) -- hashtag + avg views, blue bar chart
3. **Best Posting Times** (LEARNING-04) -- platform + DOW + hour (12h PKT), 8 slots max
4. **Niche Performance** (LEARNING-05) -- niche + avg views + total posts, amber bar chart
5. **EMA calibration status** -- explains how many more posts needed or confirms active

**Header:** "Learning Insights" title + green "Calibrated (N posts)" badge when `is_calibrated=true` (LEARNING-09). Navigation buttons: History, Generator.

**Bar chart implementation:** All three bar charts (hooks, hashtags, niches) use `style={{ width: \`${pct}%\` }}`. Zero dynamic Tailwind width classes (`w-[...]`) anywhere in the file.

**Empty state:** Shows "No learning data yet." message when all three data arrays are empty post-load.

### prompt.ts (EXTENDED)

`buildPrompt()` extended with optional 5th parameter `learningData?: LearningData`.

When `topHooks.length > 0` or `topHashtags.length > 0`, a `## Your Top-Performing Content` section is appended to the prompt with:
- Hook lines: `- "hook text" (N views)` -- one per top hook
- Hashtag line: space-separated hashtag list

Empty data is never injected (conditional guards on each array).

### GeneratorPage.tsx (MODIFIED)

Three changes:

1. **Live calibration weights on mount**: `fetchLearningWeights()` added to the mount `useEffect` alongside `fetchSettings()`. Sets `dataPoints` and `learnedWeights` from API response. Fail-open (catch ignores errors -- defaults remain 0/null).

2. **Learning injection in handleGenerate()** (LEARNING-06): `Promise.all([fetchTopHooks(niche), fetchTopHashtags(niche, enabledPlatforms[0])])` called fresh before every AI generation. `LearningData` object passed as 5th argument to `buildPrompt()`. Both API calls are already fail-open (return `[]` on error) -- no additional error handling added.

3. **Nav buttons in header**: History and Insights buttons added before Settings button in the `<div className="flex items-center gap-2">` header row.

### App.tsx (MODIFIED)

- `LearningPage` imported from `./pages/LearningPage`
- `if (currentScreen === 'learning')` branch added after the `history` branch, rendering `<LearningPage onNavigate={setCurrentScreen} />`

## Key Decisions

- **`max-w-[75%]` on hook text span is compliant**: This is a static truncation constraint (hardcoded `75%`), not a dynamic runtime value. Tailwind JIT can scan and generate `max-w-[75%]` at build time. Only dynamic values like `w-[\`${pct}%\`]` are prohibited.

- **Learning fetch is always fresh (no caching)**: Per LEARNING-06 spec, `fetchTopHooks` and `fetchTopHashtags` are called inside `handleGenerate()` on every invocation, not cached in state. The API calls are fast (backend raw SQL aggregations).

- **`learnedWeights` and `dataPoints` state now use setters**: The plan's Task 2 required converting `const [learnedWeights] = useState<LearnedWeights | null>(null)` (no setter) to include a setter. This was required to wire the live `fetchLearningWeights()` response.

- **Posting times use `·` separator replaced with ASCII**: Used space-separated `avg {count} posts` format to avoid multi-byte character encoding edge cases on Windows (consistent with 07-04 decision).

## Deviations

None -- plan executed exactly as written.

## Verification

TypeScript compile:
```
cd frontend && npx tsc --noEmit  -->  (no output) -- clean compile, zero errors
```

Vite build:
```
npx vite build  -->  163 modules transformed, built in 10.09s -- success
(chunk size warning is pre-existing from AI libraries, not caused by this plan)
```

Grep checks:

| Check | Result |
|-------|--------|
| `export default function LearningPage` | line 17 |
| `style={{ width` in LearningPage.tsx | lines 118, 148, 205 (3 matches) |
| `className.*w-\[` (dynamic Tailwind) | line 111 -- `max-w-[75%]` only (static, compliant) |
| `Calibrated` in LearningPage.tsx | lines 20, 38, 58, 59, 61, 218 |
| `learningData.*LearningData` in prompt.ts | line 65 |
| `fetchTopHooks` in GeneratorPage.tsx | lines 22, 172 |
| `fetchTopHashtags` in GeneratorPage.tsx | lines 22, 173 |
| `onNavigate.*history` in GeneratorPage.tsx | line 305 |
| `onNavigate.*learning` in GeneratorPage.tsx | line 312 |
| `HistoryPage` in App.tsx | lines 7, 80 |
| `LearningPage` in App.tsx | lines 8, 84 |

LearningPage.tsx line count: 230 (plan minimum: 200) -- PASS

## Self-Check: PASSED

- `frontend/src/pages/LearningPage.tsx` -- exists, 230 lines, default export at line 17
- `frontend/src/lib/prompt.ts` -- LearningData import confirmed, 5th param confirmed
- `frontend/src/pages/GeneratorPage.tsx` -- fetchTopHooks/fetchTopHashtags confirmed
- `frontend/src/App.tsx` -- LearningPage import and branch confirmed
- Commit `732b217` -- LearningPage.tsx creation
- Commit `30df42c` -- prompt.ts + GeneratorPage + App.tsx
- TypeScript: clean compile, zero errors
- Vite build: success, 163 modules transformed
