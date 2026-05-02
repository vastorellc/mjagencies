---
phase: 04-virality-score-checklist
plan: 04
subsystem: frontend-ui
tags: [ui, score, tailwind, react, calibration]
requires:
  - frontend/src/lib/score.ts (bandForScore from Plan 04-01)
  - frontend/src/lib/types.ts (ColorBand from Plan 04-01)
provides:
  - frontend/src/components/ScorePanel.tsx (default export ScorePanel)
  - frontend/src/components/ScorePanel.test.tsx (13 happy-dom tests)
affects:
  - frontend/src/components/ (new directory)
tech-stack:
  added: []
  patterns: [pure-presentational-component, full-tailwind-class-strings, lookup-record, data-testid-driven-tests]
key-files:
  created:
    - frontend/src/components/ScorePanel.tsx
    - frontend/src/components/ScorePanel.test.tsx
  modified: []
decisions:
  - "Full Tailwind class strings stored in BAND_CLASSES Record<ColorBand, string> — dynamic class assembly fails Tailwind 4 JIT tree-shake (project rule, restated in CONTEXT.md note)"
  - "data-testid hooks ('score-panel', 'score-ring', 'calibration-footer') drive tests without coupling to text — band data also exposed via data-band attribute for direct assertion"
  - "Component is pure: no useState, no useEffect, no fetch — Phase 7 just passes a fresh dataPoints prop"
  - "Default export (matches Phase 2 SettingsPage / LoginPage pattern) — eases lazy import in 04-08 GeneratorPage integration"
metrics:
  duration_minutes: 2
  completed_date: 2026-05-02
  tasks_completed: 2
  tests_added: 13
  tests_passing: 13
  files_created: 2
  files_modified: 0
---

# Phase 4 Plan 04: ScorePanel Component Summary

Hero virality-score visualization — colored ring + numeric centered + calibration footer per D-21/D-22/D-23. Pure React 19 functional component; Tailwind only; no UI library. Consumed by GeneratorPage in Plan 04-08.

## What Shipped

### `frontend/src/components/ScorePanel.tsx`

```typescript
interface Props {
  score: number          // 0..100, integer
  dataPoints: number     // count of view-logged posts (Phase 7 will populate)
}

export default function ScorePanel({ score, dataPoints }: Props): JSX.Element
```

Renders:

1. **Hero ring** (D-22): `flex h-32 w-32 items-center justify-center rounded-full border-8` + band-driven palette classes
2. **Score numeric** centered inside ring: `text-4xl font-bold leading-none`
3. **"Virality score"** caption below ring: `text-xs uppercase tracking-wide text-zinc-400`
4. **Calibration footer** (D-21, conditional): `text-xs text-zinc-500`

### `frontend/src/components/ScorePanel.test.tsx`

13 happy-dom tests via `@testing-library/react`:

| # | Test | Verifies |
|---|---|---|
| 1 | renders score numeric | `<span>72</span>` in DOM |
| 2 | red band (score=20) | `data-band="red"`, `bg-red-500`, `border-red-600` |
| 3 | amber band (score=50) | `data-band="amber"`, `bg-amber-500` |
| 4 | green band (score=72) | `data-band="green"`, `bg-green-500` |
| 5 | bright-green band (score=88) | `data-band="bright-green"`, `bg-emerald-400`, `border-emerald-500` |
| 6 | boundary score=39 → red | D-14 boundary |
| 7 | boundary score=40 → amber | D-14 boundary |
| 8 | boundary score=80 → bright-green | D-14 boundary |
| 9 | ring classes (D-22 spec) | `w-32`, `h-32`, `rounded-full`, `border-8` |
| 10 | dataPoints=0 hides footer | `queryByTestId('calibration-footer')` is null |
| 11 | dataPoints=5 shows progress | "Score calibration: 5/10 posts logged" |
| 12 | dataPoints=25 shows calibrated | "Calibrated to your data (25 posts)" |
| 13 | dataPoints=10 boundary | "Calibrated to your data (10 posts)" |

## Confirmed CONTEXT.md Values

All copy strings + Tailwind class fragments verbatim from `04-CONTEXT.md`:

| Decision | Value used in code |
|---|---|
| D-22 hero ring | `h-32 w-32 rounded-full border-8` |
| D-23 red | `bg-red-500 text-white border-red-600` |
| D-23 amber | `bg-amber-500 text-white border-amber-600` |
| D-23 green | `bg-green-500 text-white border-green-600` |
| D-23 bright-green | `bg-emerald-400 text-white border-emerald-500` |
| D-21 dataPoints=0 | footer not rendered |
| D-21 0<dp<10 | `Score calibration: ${dp}/10 posts logged` |
| D-21 dp>=10 | `Calibrated to your data (${dp} posts)` |

`grep` confirms all four band class strings present verbatim in ScorePanel.tsx.

## Tailwind Palette per Band Confirmed

The full class strings live in a single `BAND_CLASSES: Record<ColorBand, string>` lookup. This is the project-mandated pattern (Phase 4 CONTEXT.md "Critical Bugs to Avoid" — dynamic Tailwind classes are not generated at build time). All four band rows are present as full string literals so the JIT tree-shake includes them in the production CSS.

```typescript
const BAND_CLASSES: Record<ColorBand, string> = {
  'red':          'bg-red-500 text-white border-red-600',
  'amber':        'bg-amber-500 text-white border-amber-600',
  'green':        'bg-green-500 text-white border-green-600',
  'bright-green': 'bg-emerald-400 text-white border-emerald-500',
}
```

## Verification Results

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | clean (no errors) |
| `npx vitest --run --project=unit src/components/ScorePanel.test.tsx` | 13/13 passed (3.30s) |
| `grep BAND_CLASSES` | matches |
| `grep "bg-red-500 text-white border-red-600"` | matches |
| `grep "bg-emerald-400 text-white border-emerald-500"` | matches |
| `grep "h-32 w-32"` | matches (D-22) |
| `grep "border-8"` | matches |
| `grep "Calibrated to your data"` | matches |
| `grep "Score calibration"` | matches |
| `it(` count | 13 (≥10 required) |

## Deviations from Plan

None — plan executed exactly as written. Both action blocks copied verbatim into the codebase. No CLAUDE.md violations: TypeScript strict mode preserved (no `any`), Tailwind-only (no UI library), default export matches Phase 2 page conventions, no localStorage, no auth surface introduced.

## Cross-phase Hand-off

- **Plan 04-08** (GeneratorPage integration): `import ScorePanel from '../components/ScorePanel'`; pass `score={scoreResult.overall}` and `dataPoints={settings.dataPoints ?? 0}`
- **Phase 7** (Learning Loop): once view-logged post counts populate `settings.dataPoints`, the ring caption automatically transitions through D-21 states with no Phase 4 code change

## Commits

| Task | Hash | Message |
|---|---|---|
| 1 | `3e13fd8` | feat(04-04): ScorePanel component with colored ring + calibration footer |
| 2 | `1621103` | test(04-04): ScorePanel render tests under happy-dom |

## Self-Check: PASSED

- `frontend/src/components/ScorePanel.tsx` — FOUND
- `frontend/src/components/ScorePanel.test.tsx` — FOUND
- Commit `3e13fd8` — FOUND in git log
- Commit `1621103` — FOUND in git log
- All 13 tests passing
- tsc --noEmit clean
- All 4 D-23 band class strings greppable verbatim
