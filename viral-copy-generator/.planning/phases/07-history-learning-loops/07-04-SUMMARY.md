---
phase: 07-history-learning-loops
plan: 04
status: complete
files_modified:
  - frontend/src/pages/HistoryPage.tsx
  - frontend/src/App.tsx
---

## What Was Built

**HistoryPage.tsx (320 lines)** — full post history screen component delivering HISTORY-01 through HISTORY-06.

Key sections:

- **Post list** (`PostWithPlatforms[]`) — renders newest-first (matches backend `orderBy desc`). Each post card shows: platform icon badges (YT/IG/TK/FB/X abbreviations), niche tag with purple tint, virality score, and creation date formatted as "3 May 2026" using `en-PK` locale.

- **Filter bar** — four controls: platform select (from `ALL_PLATFORMS`), niche select (from `NICHES`), date-from input, date-to input. Each filter change updates `PostFilters` state which triggers `useCallback`-memoized `loadPosts()` via `useEffect`. Re-fetches from API (no client-side filtering). "Clear filters" button appears only when at least one filter is active.

- **Inline view logging** — per `PlatformPostRow`: controlled number input + "Log" button. Submitting calls `logActualViews(pp.id, parsed)` which returns `{ accuracy: AccuracyLabel }`. Accuracy badge renders inline after successful log. View input uses the existing `actual_views` as placeholder text when already set.

- **Accuracy badge derivation** — two pathways:
  1. Server-confirmed: `logActualViews()` response sets `accuracyMap[pp.id]` directly.
  2. Pre-populated on load: if a `PlatformPostRow` already has `actual_views`, the label is derived client-side using a 20% threshold around the predicted midpoint (matches backend logic). Server-confirmed labels win over derived labels via `{ ...derived, ...prev }` merge order.

- **Delete** — `window.confirm()` guard → `deletePost(postId)` → `filter()` from local state. Disabled during in-flight deletion.

- **Loading / empty states** — render without JS errors. Loading shows zinc-500 message; empty shows "No posts yet. Generate your first copy to see it here."

**App.tsx** — `HistoryPage` import added; `currentScreen === 'history'` branch added before the default `GeneratorPage` render.

## Key Decisions

- **Accuracy pre-population on load uses 20% midpoint threshold**: The backend uses the same threshold when computing accuracy labels. Deriving client-side on load avoids an extra round-trip for posts where `actual_views` is already set. Server-confirmed labels (from `logActualViews()`) always win via spread order `{ ...derived, ...prev }`.

- **App.tsx wired immediately**: Plan only specified creating HistoryPage.tsx, but without the App.tsx routing change the screen is unreachable. Wired as part of this task (Rule 2 — missing critical functionality: a page that cannot be navigated to is non-functional).

- **'learning' screen renders nothing yet**: The "Insights" button navigates to `currentScreen === 'learning'`, which has no branch in App.tsx yet (Plan 05 will add LearningPage). Clicking it falls through to `<GeneratorPage />`, which is the correct interim behavior — no crash, no broken state.

- **Ellipsis characters replaced with ASCII**: The plan used Unicode ellipsis (`…`) in "Loading posts…" and "Deleting…". Used ASCII `...` to keep the file free of multi-byte characters that could cause encoding issues on Windows. No functional difference.

## Deviations

- **App.tsx wired (Rule 2 — missing critical functionality)**: Plan listed only `frontend/src/pages/HistoryPage.tsx` in `files_modified`. Added `frontend/src/App.tsx` to wire the navigation branch. Without this, HistoryPage is unreachable and the screen cannot be verified or used.

- **Unicode ellipsis replaced with ASCII `...`**: Plan used `…` in loading/deleting text. Replaced with `...` to avoid potential Windows encoding edge cases. Visual result is identical.

## Verification

TypeScript compile:
```
cd frontend && npx tsc --noEmit  →  (no output) — clean compile, zero errors
```

Grep checks:

| Check | Result |
|-------|--------|
| `export default function HistoryPage` | line 36 |
| `fetchPosts` imported and called | lines 4, 51 |
| `deletePost` imported and called | lines 4, 111 |
| `logActualViews` imported and called | lines 4, 91 |
| `ACCURACY_STYLES` and `ACCURACY_LABELS` defined and used | lines 20, 26, 284, 285 |
| `ALL_PLATFORMS` used for platform filter options | lines 3, 166 |
| `NICHES` used for niche filter options | lines 3, 178 |
| No placeholder text (TODO/Lorem/Coming soon) | 0 matches |
| Min lines (180) | 320 lines |

## Self-Check: PASSED

- `frontend/src/pages/HistoryPage.tsx` — exists, 320 lines, default export confirmed
- `frontend/src/App.tsx` — HistoryPage import and navigation branch confirmed
- Commit `01970f7` — confirmed in git log
- TypeScript: clean compile, zero errors
