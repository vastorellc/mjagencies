---
phase: 07-history-learning-loops
plan: 03
status: complete
files_modified:
  - frontend/src/lib/types.ts
  - frontend/src/lib/api.ts
---

## What Was Built

**types.ts extensions:**

- `Screen` type extended from `'generator' | 'settings'` to include `'history' | 'learning'` — both HistoryPage and LearningPage can now be set as `currentScreen` without TypeScript errors.
- `PlatformPostRow` interface — full DB row shape returned inside each post from `GET /api/posts`.
- `PostWithPlatforms` interface — top-level post shape with nested `platforms: PlatformPostRow[]` array, matching the Plan 01 backend response exactly.
- `AccuracyLabel` type alias (`'overperformed' | 'matched' | 'underperformed'`) matching the backend computation in `platformPosts.ts`.
- `LogViewsResponse` interface — `{ ok, accuracy }` shape from `POST /api/platform-posts/:id/views`.
- `TopHook`, `TopHashtag` interfaces — response shapes from `/api/learning/hooks` and `/api/learning/hashtags`.
- `PostingTimeSlot` interface — dow/hour/platform/avg_views/post_count shape from `/api/learning/posting-times`.
- `NichePerformance` interface — niche/avg_views/max_views/total_posts from `/api/learning/niche-performance`.
- `LearningWeightsResponse` interface — learned_weights/data_points/is_calibrated from `/api/learning/weights`.
- `LearningData` interface — `{ topHooks, topHashtags }` container passed into `buildPrompt()` for LEARNING-06 injection.
- `PostFilters` interface — optional platform/niche/from/to query params for HistoryPage filter bar.

**api.ts additions (8 new exported functions):**

- `fetchPosts(filters?)` — GET /api/posts with URLSearchParams construction; throws on non-OK.
- `deletePost(postId)` — DELETE /api/posts/:id; throws on non-OK.
- `logActualViews(platformPostId, actualViews)` — POST /api/platform-posts/:id/views with JSON body; returns `LogViewsResponse`.
- `fetchTopHooks(niche?)` — GET /api/learning/hooks; **fail-open**: wraps full function in try/catch and returns `[]` on any error.
- `fetchTopHashtags(niche?, platform?)` — GET /api/learning/hashtags; **fail-open**: same try/catch pattern, returns `[]` on any error.
- `fetchPostingTimes(platform?)` — GET /api/learning/posting-times; returns `[]` on non-OK.
- `fetchNichePerformance()` — GET /api/learning/niche-performance; returns `[]` on non-OK.
- `fetchLearningWeights()` — GET /api/learning/weights; returns `{ learned_weights: null, data_points: 0, is_calibrated: false }` on non-OK (safe defaults for callers).

The existing import statement at the top of api.ts was extended to include all 8 new Phase 7 types — no second import from the same module.

## Key Decisions

- **Fail-open with try/catch for fetchTopHooks and fetchTopHashtags**: The plan required these two functions to never throw, since they are called before AI generation. A bare `if (!res.ok) return []` would still throw if `apiFetch()` itself throws a network error (e.g., ECONNREFUSED). Wrapping the entire function body in try/catch ensures the fail-open guarantee holds even on network failures, satisfying T-07-17 (DoS accept disposition) and the plan's CRITICAL note.

- **AccuracyLabel values match backend casing**: The backend in Plan 01 computes `'overperformed' | 'matched' | 'underperformed'` (all lowercase). The plan's `must_haves` spec listed `'Overperformed' | 'Matched' | 'Underperformed'` (title case) in a shorthand summary but the interfaces section shows the actual backend response as lowercase. Used lowercase to match the backend implementation. Plan 04 components that render the label will capitalize at display time.

- **Single consolidated import statement**: Per plan instruction, all Phase 7 types are imported alongside existing types in the single `import type { ... } from './types'` statement at line 1 of api.ts. No duplicate module import is created.

## Deviations

- **fetchTopHooks and fetchTopHashtags wrapped in try/catch instead of bare `if (!res.ok) return []`**: The plan code used `if (!res.ok) return []` only. Enhanced to full try/catch to guarantee fail-open behavior on network-level errors as well as HTTP errors. This is a correctness improvement (Rule 2 — missing error handling) that satisfies the CRITICAL requirement that these functions never block AI generation.

## Verification

```
npx tsc --noEmit  →  (no output) — clean compile, zero errors
```

Grep results (all passed):

| Check | Pattern | Result |
|-------|---------|--------|
| Screen extended | `history.*learning` in types.ts line 1 | PASS |
| PostWithPlatforms exported | `export interface PostWithPlatforms` | PASS (line 210) |
| LearningData exported | `export interface LearningData` | PASS (line 271) |
| PostFilters exported | `export interface PostFilters` | present |
| All 8 Phase 7 functions | `export async function fetch*` / `deletePost` / `logActualViews` | PASS (lines 115-222) |
| Fail-open returns | `return \[\]` in api.ts | 7 occurrences including lines 165, 169, 186, 190 |
| No duplicate import | Single `import type { ... } from './types'` | PASS |

## Self-Check: PASSED

- `frontend/src/lib/types.ts` — exists, Screen updated, 12 new Phase 7 types appended
- `frontend/src/lib/api.ts` — exists, import extended, 8 new functions appended
- Commit `bb6e1c6` — confirmed in git log
- TypeScript: clean compile, zero errors
