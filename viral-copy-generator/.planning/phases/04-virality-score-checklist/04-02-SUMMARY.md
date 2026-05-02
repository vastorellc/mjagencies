---
phase: 04-virality-score-checklist
plan: 02
subsystem: frontend-lib
tags: [checklist, pure-functions, niche-pakistan, three-state]
requires:
  - frontend/src/lib/types.ts (ChecklistItem, ChecklistCategory, ChecklistStatus, EngineSignals, Niche, Platform shipped by 04-01)
provides:
  - frontend/src/lib/checklist.ts (buildChecklist, ChecklistOptions)
affects: []
tech-stack:
  added: []
  patterns: [pure-functions, three-state-checklist, fix-message-interpolation, info-only-rows]
key-files:
  created:
    - frontend/src/lib/checklist.ts
    - frontend/src/lib/checklist.test.ts
  modified: []
decisions:
  - "ChecklistOptions field names locked as `niche` + `enabledPlatforms` (not snake_case settings shape) — Phase 4 caller responsible for mapping settings.default_niche → options.niche"
  - "beat_aligned_audio + no_long_silence return 'pending' (not 'fail') when hasAudio=false (D-25); keeps gap analysis from surfacing them as fixable"
  - "vertical_for_reels_shorts is 'pass' (info-only) when no short-form platform enabled — avoids penalising Twitter-only users"
  - "no_face_niche_ok is always 'pass' (info row); label switches to reassurance copy only when faceCount=0 AND niche ∈ {travel, hotels, cars, bikes}"
  - "fmt1/fmt2/fmtInt format helpers return 'unknown' for non-finite numbers — protects fix-string interpolation from NaN/Infinity"
  - "Items emitted via items.push() in fixed order: 5 video-tech → 8 metadata → 5 virality → 3 niche; ordering test enforces it"
metrics:
  duration_minutes: 4
  completed_date: 2026-05-02
  tasks_completed: 2
  tests_added: 41
  tests_passing: 41
  files_created: 2
  files_modified: 0
---

# Phase 4 Plan 02: Checklist Library Summary

Pure-function 21-item three-state checklist (`pass | fail | pending`) over `EngineSignals` plus user `ChecklistOptions`. Phase 4 ships the 8 Metadata Quality items as `pending`; Phase 5 will promote them after AI output arrives. All fix strings interpolate actual signal values (durations, aspects, scene timestamps, gaps) so the gap-analysis panel (04-03) and the accordion UI (04-06) can render them verbatim.

## What Shipped

### `frontend/src/lib/checklist.ts` API surface

| Export | Type | Purpose |
|---|---|---|
| `ChecklistOptions` | `{ niche: Niche; enabledPlatforms: Platform[] }` | Caller-supplied user context. Caller maps `settings.default_niche → options.niche`. |
| `buildChecklist(signals, options)` | `(EngineSignals, ChecklistOptions) => ChecklistItem[]` | Returns exactly 21 items in stable order across 4 categories. |

### `frontend/src/lib/checklist.test.ts`

41 passing tests across 5 describe blocks. Hand-mocked `EngineSignals` factory — runs under happy-dom unit project. Zero fixture videos required.

## 21-Item Enumeration

### D-15 Video Technical (5 items, evaluating)
| ID | Pass condition | Fix template (interpolated) |
|---|---|---|
| `aspect_ratio_vertical` | `aspectRatio < 0.6` (NaN → fail) | `Aspect is {fmt2(aspectRatio)}; vertical (9:16 = 0.5625) gets ~3× more reach on Reels and Shorts.` (NaN: `Aspect ratio could not be determined.`) |
| `duration_in_band` | `10 ≤ durationSec ≤ 90` | `Length is {fmt1(durationSec)}s; short-form sweet spot is 10-90s.` |
| `has_audio` | `hasAudio === true` | `Video has no audio track. Even ambient sound or music helps autoplay-with-sound platforms.` |
| `brightness_healthy` | `0.3 ≤ brightnessScore ≤ 0.7` | `Brightness is {fmt2(brightnessScore)}; aim for 0.3-0.7 (avoid washed-out or too-dark footage).` |
| `resolution_min` | `width ≥ 720` | `Resolution is {fmtInt(width)}×{fmtInt(height)}; minimum 720p for clean upscaling on platform delivery.` |

### D-16 Metadata Quality (8 items, ALL `pending` with empty fix in Phase 4)
- `caption_length_youtube`, `caption_length_instagram`, `caption_length_tiktok`
- `hashtag_count_in_band`, `hook_in_first_line`, `cta_present`, `language_match_niche`, `description_keyword_density`

Phase 5 promotes these to pass/fail after AI generates the captions.

### D-17 Virality Boosters (5 items, evaluating with two D-25 hooks)
| ID | Pass condition | D-25 hook |
|---|---|---|
| `strong_hook` | `sceneTimestamps[0] !== undefined && sceneTimestamps[0] < 1.5` | `sceneCount=0 → fail` with `none` substituted for first-scene time |
| `multiple_scene_cuts` | `sceneCount ≥ 3` | `sceneCount=0 → fail` |
| `motion_present` | `motionScore > 0.15` | — |
| `beat_aligned_audio` | `hasAudio && beatPresent` | `hasAudio=false → pending` (skipped, gap analysis won't surface) |
| `no_long_silence` | `hasAudio && max(silenceGapsSec) < 1.5` | `hasAudio=false → pending` (skipped) |

### D-18 Niche-Pakistan (3 items, mixed evaluating + info-only)
| ID | Logic |
|---|---|
| `vertical_for_reels_shorts` | `pass` if no short-form platform enabled (info-only). Else `pass` if `aspectRatio < 0.6`, else `fail`. Fix: `Vertical (9:16) is required for IG Reels and TikTok native feed.` |
| `no_face_niche_ok` | Always `pass` (info row). Label switches: when `faceCount=0` AND `niche ∈ {travel, hotels, cars, bikes}` → `No-face content matches travel/hotel/drive niche — algorithm penalty offset by niche relevance.`; else generic `No-face niche check`. |
| `pkt_posting_window_hint` | Always `pass` (info row). Label: `Peak PKT posting window: 8-10pm — schedule via auto-upload (Phase 6).` |

## Edge Case Handling (D-25)

| Edge case | Behaviour | Test count |
|---|---|---|
| `aspectRatio = NaN` | `aspect_ratio_vertical` fails with `Aspect ratio could not be determined.` (no NaN leakage into fix string) | 1 |
| `durationSec = 0` | `duration_in_band` fails (0 is outside 10..90 band) | 1 |
| `hasAudio = false` | `has_audio` fails; `beat_aligned_audio` and `no_long_silence` return `pending` (gap analysis skips them) | 3 |
| `sceneCount = 0` | `strong_hook` fails with `none` for first-scene time; `multiple_scene_cuts` fails | 1 |
| Non-finite signal values | `fmt1/fmt2/fmtInt` return `unknown` (protects fix strings from `NaN`/`Infinity` leakage) | implicit |

## Format Helpers

Three deterministic helpers normalize numeric fixed-point output:
- `fmt1(n)` → `n.toFixed(1)` for finite numbers (`5.0s`, `2.5s`)
- `fmt2(n)` → `n.toFixed(2)` for finite numbers (`0.85`, `1.00`, `0.05`)
- `fmtInt(n)` → `Math.round(n).toString()` (`480`, `640`, `1`)
- All return `'unknown'` for `!Number.isFinite(n)` — guards against NaN/Infinity leakage into UI strings.

## Verification Results

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | clean (no errors) |
| `npx vitest --run --project=unit src/lib/checklist.test.ts` | 41/41 passed (~2.8s) |
| `grep -c "items.push(" checklist.ts` | 36 (>=21 required) |
| `grep -c "'metadata-quality'" checklist.ts` | 8 (>=8 required) |
| Unique item IDs | 21 (5 video-tech + 8 metadata + 5 virality + 3 niche) |
| `grep -c "it(" checklist.test.ts` | 33 (>=30 required) |
| `grep -c "describe(" checklist.test.ts` | 5 (>=5 required) |
| `grep -c "D-25" checklist.test.ts` | 7 (>=4 required) |
| `grep ": any" checklist.ts` | 0 (TS strict, no any) |

## Deviations from Plan

None — plan executed exactly as written. Action blocks for both tasks copied verbatim into the codebase; all 21 IDs, fix templates, and edge-case branches match CONTEXT.md D-15..D-18 + D-25 letter-for-letter.

## Commits

| Task | Hash | Message |
|---|---|---|
| 1 | `e2b32ba` | feat(04-02): implement checklist.ts with 21-item three-state checklist |
| 2 | `4c0f8b2` | test(04-02): comprehensive Vitest unit suite for checklist.ts |

## Cross-phase Hand-off

- **04-03 (gaps.ts)** consumes `ChecklistItem[]` and filters to `status === 'fail' && fix !== ''` items — Phase 4 already produced fix strings with interpolated values, so 04-03 just needs string mapping + ordering.
- **04-06 (ChecklistAccordion.tsx)** renders the 4 category buckets; counts `(X/Y passed)` map naturally over the returned array.
- **Phase 5 (AI Copy)** will re-run `buildChecklist` after AI output and promote the 8 Metadata Quality items from `pending` to `pass | fail` — no Phase 4 code rewrite needed.

## Self-Check: PASSED

- `frontend/src/lib/checklist.ts` — FOUND
- `frontend/src/lib/checklist.test.ts` — FOUND
- Commit `e2b32ba` — FOUND in git log
- Commit `4c0f8b2` — FOUND in git log
- All 41 tests passing
- tsc --noEmit clean
- 21 unique checklist IDs greppable
