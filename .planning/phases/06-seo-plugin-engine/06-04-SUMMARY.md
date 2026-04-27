---
phase: 06-seo-plugin-engine
plan: "04"
subsystem: seo
tags: [seo, vitest, tdd, plugin-engine, typescript, regex, geo, pure-function]

# Dependency graph
requires:
  - phase: 06-01
    provides: registerPlugin/runPluginEngine engine skeleton, LexicalExtracts interface, GeoChunkingDefaults, PLUGIN_DEFAULTS, Vitest config
  - phase: 06-02
    provides: ESM circular import pattern (index.ts export chain), TDD commit conventions
  - phase: 06-03
    provides: aio-citations plugin as second working example of same registration pattern

provides:
  - scoreGeoChunking pure function (geographic content density scoring 0–100)
  - GeoChunkingConfig + GeoChunkingResult interfaces
  - geo-chunking plugin self-registration via registerPlugin at module load (triggered by index.ts export)
  - 19 Vitest test cases covering all scoring scenarios, edge cases, case sensitivity, word boundary

affects:
  - apps/web-main SeoPanel (now returns real geo-chunking scores when index.ts is imported)
  - runPluginEngine now returns real scores for all three plugins: seo-classic, aio-citations, geo-chunking

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD cycle: test(RED) → feat(GREEN) → refactor(REFACTOR) in 3 atomic commits"
    - "Plugin self-registration: registerPlugin() called at module bottom, triggered by export in index.ts"
    - "Circular ESM import avoidance: side-effect plugin registration via index.ts export chain (same as 06-02/06-03)"
    - "DoS mitigation: city name special chars escaped via /[.*+?^${}()|[\\]\\\\]/g before new RegExp() (T-06-04-01)"
    - "Word-boundary regex: \\b<city>\\b with 'g' flag for full content scan"
    - "Case-insensitive matching: fullText lowercased + city pattern lowercased before match"

key-files:
  created:
    - packages/seo/src/plugins/geo-chunking.ts
    - packages/seo/src/__tests__/geo-chunking.test.ts
  modified:
    - packages/seo/src/index.ts (added scoreGeoChunking + GeoChunkingConfig/GeoChunkingResult exports)

key-decisions:
  - "geo-chunking registration triggered by index.ts export chain (not engine.ts side-effect import) — same pattern as seo-classic and aio-citations (avoids circular ESM dependency)"
  - "PluginDefaults not imported in geo-chunking.ts (not exported from engine.ts) — only PluginResult + registerPlugin imported"
  - "Non-applicable short-circuit (pageType != services) checked BEFORE empty targetCities check — preserves correct score=100 for blog/home/etc. regardless of city config"
  - "fullText built from heading texts + paragraphs (not plainText field) — matches algorithm spec exactly"
  - "Empty pageType string triggers geo-not-applicable path (empty string !== 'services')"

requirements-completed:
  - REQ-070
  - REQ-071
  - REQ-072

# Metrics
duration: 3min
completed: 2026-04-27
---

# Phase 06 Plan 04: geo-chunking Scoring Plugin Summary

**Pure geo-chunking scoring function counting city entity mentions in page content to score geographic density (0–100) — completes the three-plugin SEO engine, using TDD with 19 tests, self-registering with the plugin engine via index.ts export chain**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-27T01:58:24Z
- **Completed:** 2026-04-27T02:01:14Z
- **Tasks:** 3 (RED + GREEN + REFACTOR)
- **Files modified:** 3

## Accomplishments

- geo-chunking plugin implemented as a pure function — no I/O, no Redis, no network calls
- Scoring algorithm: fullText = (headings + paragraphs).join(' ').toLowerCase(), then per-city word-boundary regex match count → score = Math.min(100, Math.round((totalMentions / chunkCountMin) * 100))
- Two special cases handled: empty targetCities → score=0 + geo-cities-not-configured; non-service page (requiredOnServicePages=true) → score=100 + geo-not-applicable
- DoS mitigation applied: city names escape special regex characters before compile (threat T-06-04-01)
- Word-boundary matching: `\baustin\b` matches "Austin" but not "Austins"
- Case-insensitive matching: fullText lowercased + city pattern lowercased
- TDD gate compliance: RED (8f71806) → GREEN (ee55b9c) → REFACTOR (a3c7524)
- All three plugins now registered in engine: seo-classic, aio-citations, geo-chunking
- runPluginEngine now returns real scores for all three plugins

## Task Commits

Each phase committed atomically:

1. **RED — geo-chunking test cases (failing)** — `8f71806` (test)
2. **GREEN — geo-chunking scoring plugin (all tests pass)** — `ee55b9c` (feat)
3. **REFACTOR — geo-chunking finding messages verified plain English** — `a3c7524` (refactor)

## Files Created/Modified

- `packages/seo/src/plugins/geo-chunking.ts` — scoreGeoChunking pure function + GeoChunkingConfig/GeoChunkingResult interfaces + registerPlugin() call at module load
- `packages/seo/src/__tests__/geo-chunking.test.ts` — 19 Vitest tests covering empty cities, non-service pages, scoring algorithm, per-city findings, case-insensitive matching, word boundary enforcement, geoMentionCount field
- `packages/seo/src/index.ts` — Added `export { scoreGeoChunking }` and `export type { GeoChunkingConfig, GeoChunkingResult }` (triggers side-effect plugin registration)

## Decisions Made

- geo-chunking plugin registration via index.ts export chain (same as seo-classic and aio-citations from 06-02/06-03). The ESM circular import fix is consistent across all three plugin plans.
- Non-applicable short-circuit checked first (before empty targetCities) — ensures a blog page with no cities configured still returns score=100 (not score=0 with geo-cities-not-configured), which is the correct behavior.
- fullText built from `extracts.headings.map(h => h.text) + extracts.paragraphs` (not `extracts.plainText`) — this is explicitly specified in the algorithm and matches the plan spec.

## Deviations from Plan

None — plan executed exactly as written. The ESM registration pattern (index.ts export chain vs engine.ts side-effect import) was pre-documented in the plan based on the 06-02 SUMMARY findings.

## TDD Gate Compliance

- RED gate: commit `8f71806` (`test(06-04)`) — 19 tests written, all failing (module not found)
- GREEN gate: commit `ee55b9c` (`feat(06-04)`) — all 64 tests passing (19 geo-chunking + 45 pre-existing)
- REFACTOR gate: commit `a3c7524` (`refactor(06-04)`) — finding messages verified plain English; 64/64 tests still passing

All three gates present in correct order. TDD cycle complete.

## Test Results

- RED: 1 failed suite (module not found), 45 tests passing (pre-existing)
- GREEN: 5/5 test files passing, 64/64 tests passing
- REFACTOR: 5/5 test files passing, 64/64 tests passing (no code changes)
- `pnpm --filter @mjagency/seo typecheck` exits 0

## Three-Plugin Engine Status

All three plugins now registered and returning real scores:

| Plugin | Registered | Status |
|--------|-----------|--------|
| seo-classic | Yes | `export { scoreSeoClassic }` in index.ts (06-02) |
| aio-citations | Yes | `export { scoreAioCitations }` in index.ts (06-03) |
| geo-chunking | Yes | `export { scoreGeoChunking }` in index.ts (06-04) |

`runPluginEngine()` now returns real scores for all three when called via index.ts.

## Threat Model Coverage

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-06-04-01 | Mitigated | `city.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` before `new RegExp()` |
| T-06-04-02 | Accepted | Config from agency-namespaced settings; no cross-agency risk |

## Known Stubs

None. scoreGeoChunking is fully implemented. `runPluginEngine` now returns real geo-chunking scores when called via `index.ts`.

## User Setup Required

None — pure function, no external service configuration required. Agency must configure `targetCities` in their SEO settings to get non-zero geo scores (by design — empty targetCities is a valid "not configured yet" state).

## Next Phase Readiness

- Plans 06-05 (self-learning loop / GSC-GA4 signals) can build on the complete 3-plugin engine
- All three plugins tested and passing; `typecheck` clean — solid baseline for 06-05
- `runPluginEngine` now returns real scores for all three bars in SeoPanel

---
*Phase: 06-seo-plugin-engine*
*Completed: 2026-04-27*

## Self-Check: PASSED

Files verified:
- packages/seo/src/plugins/geo-chunking.ts: EXISTS
- packages/seo/src/__tests__/geo-chunking.test.ts: EXISTS
- .planning/phases/06-seo-plugin-engine/06-04-SUMMARY.md: EXISTS

Commits verified:
- 8f71806: EXISTS (RED gate)
- ee55b9c: EXISTS (GREEN gate)
- a3c7524: EXISTS (REFACTOR gate)

Tests: 64/64 passing
Typecheck: exits 0
