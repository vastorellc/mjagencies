---
phase: 04-virality-score-checklist
plan: 01
subsystem: frontend-lib
tags: [score, types, pure-functions, calibration, virality]
requires:
  - frontend/src/lib/types.ts (existing exports preserved)
provides:
  - frontend/src/lib/score.ts (computeScore, bandForScore, applyLearnedWeights, BASELINE_WEIGHTS, PLATFORM_WEIGHTS, 7 signal helpers)
  - frontend/src/lib/types.ts (ColorBand, ChecklistStatus, ChecklistCategory, ChecklistItem, EngineSignals, BaselineWeights, LearnedWeights, PerPlatformScores, ScoreResult)
affects:
  - frontend/src/lib/types.ts (extended)
tech-stack:
  added: []
  patterns: [pure-functions, piecewise-linear-curves, weight-table-overrides, EMA-calibration-application]
key-files:
  created:
    - frontend/src/lib/score.ts
    - frontend/src/lib/score.test.ts
  modified:
    - frontend/src/lib/types.ts
decisions:
  - "EngineSignals interface shipped in Phase 4 (not Phase 3) per D-02 cross-phase awareness — Phase 3 will produce this shape"
  - "Delta cap +/-0.15 applied per signal before re-normalisation (LEARNING-07)"
  - "computeScore returns integer-rounded scores via Math.round(clamp(total, 0, 100))"
  - "durationSec === 0 short-circuits to 0 for overall and all 5 platforms (D-25)"
  - "applyLearnedWeights returns the same baseline reference (===) when dataPoints<10 to avoid allocations on every render"
metrics:
  duration_minutes: 4
  completed_date: 2026-05-02
  tasks_completed: 3
  tests_added: 48
  tests_passing: 48
  files_created: 2
  files_modified: 1
---

# Phase 4 Plan 01: Virality Score Library Summary

Pure-function virality score core — types, signal curves, weight tables, color bands, learned-weight calibration. Zero AI cost, zero React/DOM dependencies. Phase 5 reuses these types; Phase 7 will populate `learned_weights` that this layer reads via `applyLearnedWeights`.

## What Shipped

### `frontend/src/lib/types.ts` extensions
Appended (existing exports untouched):
- `ColorBand`, `ChecklistStatus`, `ChecklistCategory`, `ChecklistItem` (D-03)
- `EngineSignals` (Phase 3 producer contract — see D-02 for cross-phase rationale)
- `BaselineWeights`, `LearnedWeights`, `PerPlatformScores`, `ScoreResult`

### `frontend/src/lib/score.ts` API surface

| Export | Type | Purpose |
|---|---|---|
| `BASELINE_WEIGHTS` | `BaselineWeights` | D-04 baseline (hook 0.25, pacing 0.20, face 0.15, audio 0.15, duration_fit 0.10, aspect_ratio 0.10, brightness 0.05) |
| `PLATFORM_WEIGHTS` | `Record<Platform, BaselineWeights>` | D-12 per-platform overrides (5 platforms x 7 signals, each row sums to 1.0) |
| `bandForScore(score)` | `(n) => ColorBand` | D-14: 0-39 red, 40-59 amber, 60-79 green, 80-100 bright-green |
| `applyLearnedWeights(baseline, learned, dataPoints)` | `(...) => BaselineWeights` | D-20: baseline unchanged when <10; clamp +/-0.15 + re-normalise to sum=1.0 when >=10 |
| `computeScore(signals, weights?)` | `(...) => ScoreResult` | D-24: returns `{overall, perPlatform: {youtube, instagram, tiktok, facebook, x}}`, all integer-rounded [0,100] |
| `hookSignal`, `pacingSignal`, `faceSignal`, `audioSignal`, `durationFitSignal`, `aspectRatioSignal`, `brightnessSignal` | `(EngineSignals[, Platform?]) => number` | D-05..D-11 piecewise-linear normalisers, each returns 0-100 |

### `frontend/src/lib/score.test.ts`
48 passing tests across 11 describe blocks. Hand-mocked `EngineSignals` factory — no fixture videos needed (runs under happy-dom unit project).

## Confirmed CONTEXT.md Threshold Values

All numeric thresholds copied verbatim from `04-CONTEXT.md`:

| Decision | Value used in code |
|---|---|
| D-04 baseline weights | hook 0.25, pacing 0.20, face 0.15, audio 0.15, duration_fit 0.10, aspect_ratio 0.10, brightness 0.05 |
| D-05 hook curve | `<=1.0s → 100`, `>=5.0s → 0`, linear in between |
| D-06 pacing curve | `>=0.4 scenes/sec → 100`, `<=0.1 → 0`, linear |
| D-07 face curve | `faceCount=0 → 0`; else `confidence * 100` (0 if undefined) |
| D-08 audio curve | `!hasAudio → 0`; else `energy*60 + (beat?40:0) - (longestGap>1.5 ? 20 : 0)` clamped 0..100 |
| D-09 duration_fit | platform ideals YT 30, IG 30, TT 21, FB 30, X 45; overall 31.2; `diff<=5 → 100`, `diff>=30 → 0` |
| D-10 aspect_ratio | platform ideals 0.5625 except X 1.0; `diff<=0.05 → 100`, `diff>=0.4 → 0`; NaN → 0 |
| D-11 brightness | `0.3..0.7 → 100`; `<=0.1 or >=0.9 → 0`; linear in transition zones |
| D-12 PLATFORM_WEIGHTS | YT/IG/TT/FB/X full table (each row sums to 1.0 — verified via test) |
| D-14 color bands | red 0-39, amber 40-59, green 60-79, bright-green 80-100 |
| D-20 calibration | dataPoints<10 → baseline reference unchanged; >=10 → clamp delta to +/-0.15, sum-normalise to 1.0 (1e-9 tolerance) |
| D-25 edge cases | durationSec=0 → score 0 across all platforms; hasAudio=false → audio=0; NaN aspect → 0; sceneCount=0 → hook=0 + pacing=0; faceCount=0 → face=0 |

## Edge Case Test Coverage (D-25)

All five edge cases verified with non-NaN output:

| Edge case | Test count | Verifies |
|---|---|---|
| `durationSec=0` | 2 | `computeScore` returns 0 for overall + all 5 platforms; `durationFitSignal` returns 0 |
| `hasAudio=false` | 2 | `audioSignal` returns 0; `computeScore` does not crash, overall stays >=0 |
| `NaN aspectRatio` | 2 | `aspectRatioSignal` returns 0; `computeScore` does not produce NaN |
| `sceneCount=0` | 3 | `hookSignal` and `pacingSignal` both return 0; `computeScore` does not crash |
| `faceCount=0` | 3 | `faceSignal` returns 0 (with or without confidence undefined); `computeScore` does not crash |

`Number.isNaN(r.overall) === false` checked for every edge case.

## Calibration Behaviour (D-20)

`applyLearnedWeights` short-circuits to baseline reference (`===`) when `dataPoints<10` or `learned` is null/undefined — avoids allocation on every render in Phase 4 GeneratorPage UI.

When `dataPoints>=10`:
1. Each signal's delta is clamped to `[-0.15, +0.15]` (LEARNING-07 cap).
2. Raw weight = `clamp(baseline + delta, 0, 1)`.
3. Re-normalised: `weight[k] = raw[k] / sum(raw)`.
4. Result sum is 1.0 within 1e-9 tolerance (verified via test).

If all-zero deltas (degenerate case), falls back to baseline.

## Verification Results

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | clean (no errors) |
| `npx vitest --run --project=unit src/lib/score.test.ts` | 48/48 passed (3.19s) |
| `grep -c "export " score.ts` | 12 (>=11 required) |
| `grep ": any" score.ts` | 0 (TS strict, no any) |
| `describe(` blocks | 11 (>=10 required) |
| `it(` calls | 44 (+5 it.each rows = 48 tests; >=30 required) |
| `D-25` references in tests | 11 (>=5 required) |

## Deviations from Plan

None — plan executed exactly as written. Action blocks for all 3 tasks copied verbatim into the codebase; numeric thresholds match CONTEXT.md letter-for-letter.

## Commits

| Task | Hash | Message |
|---|---|---|
| 1 | `9e48960` | feat(04-01): extend types.ts with Phase 4 score + checklist types |
| 2 | `953d229` | feat(04-01): implement score.ts pure-function module |
| 3 | `9f4331d` | test(04-01): comprehensive Vitest unit suite for score.ts |

## Cross-phase Hand-off

- **Phase 3** (deferred at Wave 0): when `engine.ts` ships, it must `import type { EngineSignals } from './types'` — that's the contract this plan locked.
- **Phase 4 next plans** (02 → checklist.ts, 03 → gaps.ts, 04 → ScorePanel UI): import `bandForScore`, `computeScore`, `BASELINE_WEIGHTS`, `PLATFORM_WEIGHTS`, `applyLearnedWeights` from `./score`.
- **Phase 5** (AI Copy + Platform Cards): reuses `Platform`, `EngineSignals`, `ScoreResult` types.
- **Phase 7** (Learning Loop): writes `settings.learned_weights` JSONB matching `LearnedWeights` shape; this layer applies it via `applyLearnedWeights(baseline, settings.learned_weights, dataPoints)`.

## Self-Check: PASSED

- `frontend/src/lib/types.ts` — FOUND (modified)
- `frontend/src/lib/score.ts` — FOUND
- `frontend/src/lib/score.test.ts` — FOUND
- Commit `9e48960` — FOUND in git log
- Commit `953d229` — FOUND in git log
- Commit `9f4331d` — FOUND in git log
- All 48 tests passing
- tsc --noEmit clean
