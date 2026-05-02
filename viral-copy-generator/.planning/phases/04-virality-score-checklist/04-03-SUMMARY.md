---
phase: 04-virality-score-checklist
plan: 03
subsystem: scoring
tags: [pure-functions, gap-analysis, view-range, vitest, typescript, d-13, d-19]

# Dependency graph
requires:
  - phase: 04-virality-score-checklist
    provides: "ChecklistItem + Platform + ColorBand types (Plan 01); buildChecklist three-state output (Plan 02); bandForScore from score.ts (Plan 01)"
provides:
  - "buildGapAnalysis(checklist) -> string[] — D-19 gap analysis filter (SCORE-07)"
  - "viewRangeFor(platform, score) -> string — D-13 per-platform view-range lookup (SCORE-04)"
  - "VIEW_RANGES constant — Record<Platform, Record<ColorBand, string>>; 5 platforms x 4 bands = 20 cells, D-13 verbatim"
affects: [04-04-PLAN, 04-05-PLAN, 04-06-PLAN, 04-07-PLAN, 04-08-PLAN, 05-ai-copy-platform-cards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function lookup table — Record<Platform, Record<ColorBand, string>> with verbatim strings"
    - "Filter+group pure function — Map<Category, T[]> seeded from a fixed group order; flatten in same order"
    - "TDD RED -> GREEN — failing import test first, minimal implementation, test green"

key-files:
  created:
    - "frontend/src/lib/gaps.ts"
    - "frontend/src/lib/gaps.test.ts"
    - "frontend/src/lib/viewRange.ts"
    - "frontend/src/lib/viewRange.test.ts"
  modified: []

key-decisions:
  - "GAP_GROUP_ORDER excludes 'metadata-quality' — these items are always 'pending' (Phase 5 fills) so filtering by group order naturally drops them; double defensive against fail+empty-fix cases"
  - "viewRangeFor takes Platform and that platform's own score (SCORE-04) — caller passes perPlatform[platform], NOT overall score; D-13 ranges calibrated per-platform"
  - "VIEW_RANGES strings copied verbatim from CONTEXT.md D-13 — no string concatenation or interpolation; downstream UI receives exact constant"
  - "Instagram and Facebook share identical view tiers per D-13 (both Meta algorithmic, declining organic reach); test asserts parity to lock the table shape"

patterns-established:
  - "TDD RED: test imports module that does not exist; vitest fails with 'Failed to resolve import' — proves test will fail; commit as test() commit"
  - "TDD GREEN: minimal implementation; tests pass; tsc clean; commit as feat() commit"
  - "Lookup tables as Record<K, Record<K2, V>> — type-safe, exhaustive at compile time"
  - "Defensive filter chains in gap analysis — status check, fix non-empty check, category-allowed check (via map lookup)"

requirements-completed: [SCORE-04, SCORE-07]

# Metrics
duration: 4min
completed: 2026-05-02
---

# Phase 4 Plan 03: gaps.ts + viewRange.ts Summary

**Pure-function gap analysis (D-19) and per-platform view-range lookup (D-13) — completes the Wave 1 scoring library; UI in Wave 2 consumes these.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-02T03:34:44Z
- **Completed:** 2026-05-02T03:38:05Z
- **Tasks:** 2 (both TDD: RED + GREEN)
- **Files created:** 4

## Accomplishments

- `buildGapAnalysis` (gaps.ts): rule-based filter that turns the 21-item checklist into an ordered list of fix strings — surfaces only `status='fail'` items with non-empty `fix`; metadata-quality items skipped; group order video-technical -> virality-boosters -> niche-pakistan; insertion order preserved within each group (SCORE-07).
- `viewRangeFor` + `VIEW_RANGES` (viewRange.ts): D-13 lookup table with all 20 cells (5 platforms x 4 bands) embedded verbatim; `viewRangeFor(platform, score)` derives the band via `bandForScore` and returns the table cell; SCORE-04 caller contract documented in JSDoc (caller passes `perPlatform[platform]`, not overall).
- 42 new Vitest cases (9 gaps + 33 viewRange) all green; full unit suite 131/131 green; tsc clean.

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1 RED — buildGapAnalysis tests:** `ada9ada` (test)
2. **Task 1 GREEN — gaps.ts implementation:** `ec97824` (feat)
3. **Task 2 RED — viewRangeFor tests:** `1715f57` (test)
4. **Task 2 GREEN — viewRange.ts implementation:** `8683f3c` (feat)

_Plan metadata commit (this SUMMARY + STATE + ROADMAP) follows separately._

## Files Created/Modified

- `frontend/src/lib/gaps.ts` — `buildGapAnalysis(ChecklistItem[]) -> string[]`; D-19 filter + group ordering.
- `frontend/src/lib/gaps.test.ts` — 9 cases: empty, no-fail, fail+empty-fix, metadata-quality skip, pass+non-empty-fix skip, group ordering, intra-category insertion order, mixed-category interleaving.
- `frontend/src/lib/viewRange.ts` — `VIEW_RANGES` constant + `viewRangeFor(platform, score)`; D-13 verbatim strings.
- `frontend/src/lib/viewRange.test.ts` — 33 cases: 24 it.each boundary-score lookups across 5 platforms, plus table-shape sanity (5-platform key set, all 4 bands populated, TikTok=highest tier, X=smallest, IG/FB parity).

## Decisions Made

- **Group order constant `GAP_GROUP_ORDER` excludes 'metadata-quality'**: this gives a clean "naturally excluded" path (the per-category map has no bucket for it, so the filter loop drops it). Defensive against future bugs where a metadata-quality item's status might transiently be 'fail' (e.g., during AI-copy generation in Phase 5) — they still won't surface in the gap list.
- **`viewRangeFor` does no per-platform score selection** — purely Platform + score -> string lookup. The score-selection responsibility (overall vs. per-platform) sits with the caller; SCORE-04 is enforced by JSDoc + future UI integration tests in Wave 2 plans.
- **Test asserts IG/FB tier parity** — locks D-13 design intent (both Meta algorithmic surfaces) so any future divergence forces a deliberate, test-failure-flagged change.
- **9 gap-analysis cases** beyond the 6 acceptance-criteria minimum — added empty-checklist, pass+non-empty-fix-defensive, and full-mix-interleave cases to harden the boundary behaviour.

## Deviations from Plan

None — plan executed exactly as written. Implementation matches the verbatim code blocks in 04-03-PLAN.md; test count slightly exceeds the plan minimum (9 vs 6 for gaps; 33 vs 25 for viewRange) to cover defensive edges (`empty input`, `pass with non-empty fix`, table-shape consistency). All additions are additive; no behavioural changes from the spec.

## Issues Encountered

None.

## User Setup Required

None — pure TypeScript modules, no external services.

## Self-Check: PASSED

- [x] `frontend/src/lib/gaps.ts` exists; exports `buildGapAnalysis`
- [x] `frontend/src/lib/gaps.test.ts` exists; 9 it() cases (>= 6 required)
- [x] `frontend/src/lib/viewRange.ts` exists; exports `VIEW_RANGES` and `viewRangeFor`
- [x] `frontend/src/lib/viewRange.test.ts` exists; 33 cases pass
- [x] D-13 strings present verbatim: `'250k-5M+'`, `'25k-250k+'`, `'100k-1M+'`
- [x] Commits on main: `ada9ada`, `ec97824`, `1715f57`, `8683f3c` (all in `git log`)
- [x] `npx tsc --noEmit` exits 0
- [x] `npx vitest --run --project=unit` 131/131 pass (89 prior + 42 new)

## Next Phase Readiness

Wave 1 of Phase 4 is now functionally complete (score.ts + checklist.ts + gaps.ts + viewRange.ts). Wave 2 (UI components: ScorePanel, ChecklistPanel, GapAnalysisPanel, PlatformCardSkeleton) is unblocked — all four pure modules export typed interfaces consumable by React components. No engine signals required (Phase 3 fixtures still deferred); UI plans will mock `EngineSignals` for component tests.

---
*Phase: 04-virality-score-checklist*
*Plan: 03*
*Completed: 2026-05-02*
