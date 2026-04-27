---
phase: 06-seo-plugin-engine
plan: "02"
subsystem: seo
tags: [seo, vitest, tdd, plugin-engine, typescript, regex, pure-function]

# Dependency graph
requires:
  - phase: 06-01
    provides: registerPlugin/runPluginEngine engine skeleton, LexicalExtracts interface, SeoClassicDefaults, PLUGIN_DEFAULTS, Vitest config

provides:
  - scoreSeoClassic pure function with 7 weighted sub-factors (0–100 score)
  - SeoClassicConfig + SeoClassicResult interfaces
  - seo-classic plugin self-registration via registerPlugin at module load
  - 16 Vitest test cases covering all sub-factors, config overrides, edge cases

affects:
  - 06-03 (aio-citations plugin follows same registerPlugin pattern)
  - 06-04 (geo-chunking plugin follows same registerPlugin pattern)
  - apps/web-main SeoPanel (now returns real seo-classic scores when index.ts is imported)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD cycle: test(RED) → feat(GREEN) → refactor(REFACTOR) in 3 atomic commits"
    - "Plugin self-registration: registerPlugin() called at module bottom, triggered by export in index.ts"
    - "Circular ESM import avoidance: side-effect plugin registration via index.ts export chain (not engine.ts import)"
    - "DoS mitigation: plainText.slice(0, 50000) before keyword regex"
    - "Keyword regex escaping: /[.*+?^${}()|[\\]\\\\]/g replace before new RegExp()"

key-files:
  created:
    - packages/seo/src/plugins/seo-classic.ts
    - packages/seo/src/__tests__/seo-classic.test.ts
  modified:
    - packages/seo/src/engine.ts (comment update noting circular dep design decision)
    - packages/seo/src/index.ts (added scoreSeoClassic + SeoClassicConfig/SeoClassicResult exports)

key-decisions:
  - "Side-effect plugin registration placed in index.ts export chain (not engine.ts bottom import) to avoid circular ESM dependency — engine.ts must be fully initialized before seo-classic.ts calls registerPlugin()"
  - "PluginDefaults not re-exported from engine.ts — seo-classic.ts uses only registerPlugin + PluginResult from engine.ts"
  - "Finding messages use config values (not hardcoded defaults) for titleMinChars/titleMaxChars/metaDescMinChars/metaDescMaxChars"

requirements-completed:
  - REQ-070
  - REQ-071
  - REQ-072

# Metrics
duration: 5min
completed: 2026-04-27
---

# Phase 06 Plan 02: seo-classic Scoring Plugin Summary

**Pure seo-classic scoring function with 7 weighted sub-factors (title, meta, keyword density, word count, H1, H2, internal links) using TDD — 16 tests, all passing, self-registering with the plugin engine**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-27T01:41:09Z
- **Completed:** 2026-04-27T01:45:54Z
- **Tasks:** 3 (RED + GREEN + REFACTOR)
- **Files modified:** 4

## Accomplishments

- seo-classic plugin implemented as a pure function — no I/O, no Redis, no network calls
- 7 weighted sub-factors: title-length (20), meta-description (15), keyword-density (20), word-count (25 graduated), h1-presence (10), h2-presence (5), internal-links (5)
- DoS mitigation applied: plainText clamped at 50,000 chars before keyword regex (threat T-06-02-02)
- Keyword regex escapes special characters (threat T-06-02-01)
- TDD gate compliance: RED (5f36788) → GREEN (bfad31f) → REFACTOR (d655aec)

## Task Commits

Each phase committed atomically:

1. **RED — seo-classic test cases (failing)** - `5f36788` (test)
2. **GREEN — seo-classic scoring plugin (all tests pass)** - `bfad31f` (feat)
3. **REFACTOR — seo-classic finding messages plain English** - `d655aec` (refactor)

## Files Created/Modified

- `packages/seo/src/plugins/seo-classic.ts` — scoreSeoClassic pure function + SeoClassicConfig/SeoClassicResult interfaces + registerPlugin() call at module load
- `packages/seo/src/__tests__/seo-classic.test.ts` — 16 Vitest tests covering all 7 sub-factors, perfect/empty content, config overrides, partial credit cases
- `packages/seo/src/index.ts` — Added `export { scoreSeoClassic }` and `export type { SeoClassicConfig, SeoClassicResult }` (triggers side-effect plugin registration)
- `packages/seo/src/engine.ts` — Comment update only (circular dep design decision documented)

## Decisions Made

- Side-effect plugin registration lives in `index.ts` export chain, not in `engine.ts` as a bottom import. Reason: ESM `import` statements are hoisted regardless of position. When `engine.ts` imports `seo-classic.ts` at the bottom, the circular dependency causes `registerPlugin` to be `undefined` when `seo-classic.ts` module code runs. The `index.ts` approach ensures `engine.ts` is fully initialized before `seo-classic.ts` is evaluated.
- `PluginDefaults` is NOT imported in `seo-classic.ts` (not exported from `engine.ts`). The plugin receives the already-resolved `SeoClassicConfig` as its `config.seo_classic` sub-object.
- Config values used in finding messages rather than hardcoded numbers — supports agency overrides in displayed text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Circular ESM import: registerPlugin was undefined at module init**
- **Found during:** GREEN phase (first test run)
- **Issue:** Plan specified `import './plugins/seo-classic.js'` at bottom of `engine.ts`. In ESM, all `import` statements are hoisted before any module code runs. This created a cycle: `engine.ts` → `seo-classic.ts` → `engine.ts`, where `registerPlugin` was `undefined` when `seo-classic.ts` tried to call it (engine.ts not yet initialized). Result: `TypeError: registerPlugin is not a function` in plugin-engine.test.ts.
- **Fix:** Removed the bottom import from `engine.ts`. Plugin registration is triggered by the `export { scoreSeoClassic } from './plugins/seo-classic.js'` line in `index.ts`. When `index.ts` is imported (e.g., by the SeoPanel server action), `engine.ts` is already loaded (from earlier `export { runPluginEngine }` line), so `registerPlugin` is fully available when `seo-classic.ts` module code runs.
- **Files modified:** `packages/seo/src/engine.ts` (removed circular import), `packages/seo/src/index.ts` (export triggers side-effect)
- **Verification:** 25/25 tests pass; `plugin-engine.test.ts` still passes (it imports `engine.ts` directly, not `index.ts`, so the "returns zero scores" test still works as intended)
- **Committed in:** `bfad31f` (GREEN commit)

**2. [Rule 1 - Bug] PluginDefaults not exported from engine.ts**
- **Found during:** GREEN phase (typecheck)
- **Issue:** Plan template shows `import type { PluginDefaults, PluginResult } from '../engine.js'` — but `PluginDefaults` is not exported from `engine.ts` (it's imported there from `plugin-defaults.ts` as a local type). TypeScript error: `Module '"../engine.js"' declares 'PluginDefaults' locally, but it is not exported.`
- **Fix:** Changed import to only import `PluginResult` from `engine.js` (which IS exported). `SeoClassicConfig` interface in `seo-classic.ts` already has all the fields needed; `PluginDefaults` is not referenced in the function signatures.
- **Files modified:** `packages/seo/src/plugins/seo-classic.ts`
- **Verification:** `pnpm --filter @mjagency/seo typecheck` exits 0
- **Committed in:** `bfad31f` (GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs from plan template assumptions)
**Impact on plan:** Both fixes necessary for correct ESM module initialization and type safety. No scope creep. The functional behavior is identical to what the plan specified.

## TDD Gate Compliance

- RED gate: commit `5f36788` (`test(06-02)`) — tests written, all failing (module not found)
- GREEN gate: commit `bfad31f` (`feat(06-02)`) — all 25 tests passing after GREEN
- REFACTOR gate: commit `d655aec` (`refactor(06-02)`) — finding messages use config values; 25/25 tests still passing

All three gates present in correct order. TDD cycle complete.

## Issues Encountered

- Circular ESM dependency between `engine.ts` and `seo-classic.ts` required a design adjustment. Plugin registration now triggered via `index.ts` export instead of `engine.ts` side-effect import. This is architecturally cleaner and consistent with the intent (consumers import from `index.ts`, not `engine.ts` directly).

## Known Stubs

None. scoreSeoClassic is fully implemented. `runPluginEngine` now returns real seo-classic scores when called via `index.ts` (which triggers the side-effect registration).

## User Setup Required

None — pure function, no external service configuration required.

## Next Phase Readiness

- Plan 06-03 (aio-citations) can follow the same pattern: create test file, implement, export from `index.ts`
- Plugin registry pattern validated: `registerPlugin()` + `export from index.ts` = automatic engine wiring
- `pnpm --filter @mjagency/seo test` passing (25/25); `typecheck` passing — clean baseline for 06-03

---
*Phase: 06-seo-plugin-engine*
*Completed: 2026-04-27*
