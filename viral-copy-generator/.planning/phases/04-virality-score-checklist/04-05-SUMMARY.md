---
phase: 04-virality-score-checklist
plan: 05
subsystem: frontend-ui
tags: [ui, platform-cards, tailwind, react]
requires:
  - frontend/src/lib/score.ts (bandForScore from Plan 04-01)
  - frontend/src/lib/viewRange.ts (viewRangeFor from Plan 04-03)
  - frontend/src/lib/types.ts (Platform, PerPlatformScores, ColorBand from Plan 04-01)
provides:
  - frontend/src/components/PlatformCardGrid.tsx (default export PlatformCardGrid)
  - frontend/src/components/PlatformCardGrid.test.tsx (7 happy-dom tests)
affects:
  - frontend/src/components/ (existing — adds 2 files alongside ScorePanel.*)
tech-stack:
  added: []
  patterns: [pure-presentational-component, full-tailwind-class-strings, lookup-record, data-testid-driven-tests]
key-files:
  created:
    - frontend/src/components/PlatformCardGrid.tsx
    - frontend/src/components/PlatformCardGrid.test.tsx
  modified: []
decisions:
  - "5-card grid uses fixed PLATFORM_ORDER constant (youtube, instagram, tiktok, facebook, x) — stable rendering order required by SCORE-03 and asserted in test 1"
  - "View range comes from viewRangeFor(platform, perPlatform[platform]) — uses each platform's OWN score, not overall (SCORE-04 requirement)"
  - "Full Tailwind class strings stored in PLATFORM_META + BAND_TEXT Record lookups — dynamic class assembly fails Tailwind 4 JIT tree-shake (project-mandated pattern, same as ScorePanel BAND_CLASSES)"
  - "data-testid hooks (platform-card-grid, platform-card-{p}, platform-score-{p}, platform-range-{p}) drive tests; aria-label on circle exposes platform display name for accessibility AND testing"
  - "Responsive layout: grid-cols-2 sm:grid-cols-5 — 2-column wrap on mobile, 5-card horizontal row on sm+ breakpoint (D-22)"
  - "Default export (matches ScorePanel + Phase 2 page conventions) — eases lazy import in 04-08 GeneratorPage integration"
metrics:
  duration_minutes: 2
  completed_date: 2026-05-02
  tasks_completed: 1
  tests_added: 7
  tests_passing: 7
  files_created: 2
  files_modified: 0
---

# Phase 4 Plan 05: PlatformCardGrid Component Summary

Per-platform mini-card grid (D-22 #2) — 5 horizontal cards (YouTube / Instagram / TikTok / Facebook / X), each surfacing 3 facts: 1-letter brand circle, that platform's score (band-colored), and the expected view-range bucket from the D-13 lookup table. Pure React 19 functional component; Tailwind only; consumed by GeneratorPage in Plan 04-08.

## What Shipped

### `frontend/src/components/PlatformCardGrid.tsx`

```typescript
interface Props {
  perPlatform: PerPlatformScores
}

export default function PlatformCardGrid({ perPlatform }: Props): JSX.Element
```

Renders:

1. **Grid container** (D-22 responsive layout): `grid grid-cols-2 gap-2 sm:grid-cols-5` — 2-column wrap on mobile, 5-card row on sm+
2. **5 platform cards** in fixed order (youtube, instagram, tiktok, facebook, x) — each `flex flex-col items-center gap-1 rounded bg-zinc-900 px-2 py-3`
3. **1-letter brand circle** (`h-8 w-8 rounded-full font-bold` + UI-03 brand bg) — Y / I / T / F / X letters with platform-specific backgrounds
4. **Score numeric** (`text-2xl font-bold` + D-23 band text color) — colored by `bandForScore(perPlatform[p])`
5. **View range** (`text-[10px] text-zinc-400`) — string from `viewRangeFor(platform, perPlatform[platform])`

### `frontend/src/components/PlatformCardGrid.test.tsx`

7 happy-dom tests via `@testing-library/react`:

| # | Test | Verifies |
|---|---|---|
| 1 | renders exactly 5 cards in YT/IG/TT/FB/X order | `data-platform` order on cards |
| 2 | shows 1-letter circles Y, I, T, F, X | `getByLabelText('YouTube').textContent` etc. |
| 3 | renders per-platform scores | `platform-score-{p}` text content |
| 4 | view range uses each platform OWN score (SCORE-04) | tt=85→`250k-5M+`, fb=30→`< 500`, yt=65→`10k-100k`, x=50→`500-5k` |
| 5 | applies band-specific score text color (D-23) | `text-emerald-400`, `text-red-500`, `text-green-500`, `text-amber-500` |
| 6 | uses platform-specific circle backgrounds (UI-03) | `bg-red-600`, `bg-pink-500`, `bg-black`, `bg-blue-600`, `bg-black` |
| 7 | grid uses sm:grid-cols-5 layout | `grid` + `sm:grid-cols-5` classes present |

## Confirmed CONTEXT.md Values

| Decision | Value used in code |
|---|---|
| D-22 layout | `grid grid-cols-2 gap-2 sm:grid-cols-5` |
| D-23 red text | `text-red-500` |
| D-23 amber text | `text-amber-500` |
| D-23 green text | `text-green-500` |
| D-23 bright-green text | `text-emerald-400` |
| UI-03 YouTube | `bg-red-600` |
| UI-03 Instagram | `bg-pink-500` |
| UI-03 TikTok | `bg-black` |
| UI-03 Facebook | `bg-blue-600` |
| UI-03 X | `bg-black` |
| D-13 view ranges | sourced verbatim from `viewRangeFor()` (Plan 04-03) |
| SCORE-04 | range uses `perPlatform[platform]`, not overall |

## Tailwind Palette per Band Confirmed

Full class strings live in `PLATFORM_META` and `BAND_TEXT` Record lookups (mirrors ScorePanel's `BAND_CLASSES` pattern). All four band rows + all five platform rows are present as full string literals so the JIT tree-shake includes them in the production CSS:

```typescript
const BAND_TEXT: Record<ColorBand, string> = {
  'red':          'text-red-500',
  'amber':        'text-amber-500',
  'green':        'text-green-500',
  'bright-green': 'text-emerald-400',
}
```

## Verification Results

| Check | Result |
|---|---|
| `npx vitest --run --project=unit src/components/PlatformCardGrid.test.tsx` | 7/7 passed (3.65s) |
| `npx tsc --noEmit -p tsconfig.json` | clean (no errors) |
| `grep PLATFORM_ORDER` matches with order [youtube, instagram, tiktok, facebook, x] | confirmed |
| `grep viewRangeFor` matches in PlatformCardGrid.tsx | confirmed |
| `grep "letter: 'Y'"` matches | confirmed |
| All 7 tests assert distinct behavioral facts | confirmed |

## TDD Gate Compliance

Plan task is `tdd="true"` — RED → GREEN cycle followed:

| Gate | Commit | Outcome |
|---|---|---|
| RED  | `e0c8526` test(04-05): add failing tests | tests existed, failed with "Failed to resolve import './PlatformCardGrid'" — correct RED signal |
| GREEN | `762f324` feat(04-05): implement PlatformCardGrid | 7/7 pass after component creation |
| REFACTOR | n/a | code matches ScorePanel pattern; no refactor commit needed |

## Deviations from Plan

None — plan executed exactly as written. Action block copied verbatim into the codebase. No CLAUDE.md violations: TypeScript strict mode preserved (no `any`), Tailwind-only (no UI library), default export matches Phase 2 page + Plan 04-04 ScorePanel conventions, no auth surface introduced, no localStorage, no fetch — pure presentational.

## Threat Surface Scan

No new network endpoints, auth paths, file-access patterns, or schema changes — pure client-side presentational component. No threat flags.

## Cross-phase Hand-off

- **Plan 04-08** (GeneratorPage integration): `import PlatformCardGrid from '../components/PlatformCardGrid'`; pass `perPlatform={scoreResult.perPlatform}` from `computeScore()` output
- **No Phase 7 dependency** — view-range strings are pure functions of band; no calibration state needed in this component

## Commits

| Task | Hash | Message |
|---|---|---|
| 1 (RED) | `e0c8526` | test(04-05): add failing tests for PlatformCardGrid (RED) |
| 1 (GREEN) | `762f324` | feat(04-05): implement PlatformCardGrid component (GREEN) |

## Self-Check: PASSED

- `frontend/src/components/PlatformCardGrid.tsx` — FOUND
- `frontend/src/components/PlatformCardGrid.test.tsx` — FOUND
- Commit `e0c8526` — FOUND in git log
- Commit `762f324` — FOUND in git log
- All 7 tests passing
- tsc --noEmit clean
- All 4 D-23 band text-color strings greppable verbatim
- All 5 UI-03 circle background strings greppable verbatim
