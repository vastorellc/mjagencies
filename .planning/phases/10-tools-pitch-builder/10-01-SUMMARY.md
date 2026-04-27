---
phase: 10
plan: "10-01"
subsystem: tools
tags: [tools, calculator, benchmarks, dompurify, vitest, typescript]
dependency_graph:
  requires: []
  provides: ["@mjagency/tools engine: runCalculator, loadBenchmarks, renderToolResult, isBenchmarkExpired"]
  affects: ["packages/tools", "Plan 10-02 (36 tool definitions will import runCalculator + renderToolResult)"]
tech_stack:
  added: ["isomorphic-dompurify ^2.15.0", "payload 3.82.1 (exact)"]
  patterns: ["deterministic calculator with input validation", "12-month benchmark expiry tracking", "DOMPurify server-side HTML sanitization"]
key_files:
  created:
    - packages/tools/src/engine/types.ts
    - packages/tools/src/engine/calculator.ts
    - packages/tools/src/engine/calculator.test.ts
    - packages/tools/src/engine/benchmark-loader.ts
    - packages/tools/src/engine/benchmark-loader.test.ts
    - packages/tools/src/engine/result-renderer.ts
    - packages/tools/src/data/.gitkeep
  modified:
    - packages/tools/package.json
    - packages/tools/src/index.ts
    - pnpm-lock.yaml
decisions:
  - "ToolDefinition.calculate() is the stable contract for all 36 tools — Plan 10-02 implements it per-agency"
  - "Benchmark JSON files statically imported at build time (not runtime DB) — path constructed from agencySlug + key"
  - "renderToolResult returns DOMPurify-sanitized string — consumer component passes it as pre-sanitized HTML"
  - "ALLOWED_ATTR excludes on* event handlers — T-10-01-02 mitigation applied"
  - "undefined coercion guarded with early continue — strict noUncheckedIndexedAccess compliance"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-27"
  tasks_completed: 2
  files_created: 7
  files_modified: 3
  tests_added: 9
---

# Phase 10 Plan 01: Tool Engine — Calculator Core, Benchmark Datasets, Result Renderer Summary

**One-liner:** Deterministic calculator engine with 12-month benchmark expiry tracking and DOMPurify-sanitized inline result renderer for all 36 agency tools.

## What Was Built

The `@mjagency/tools` package engine layer. All 36 tools (Plan 10-02) will call `runCalculator()` + `renderToolResult()`. No LLM touches the math path (REQ-122).

### Core Engine Files

**`packages/tools/src/engine/types.ts`**
Defines: `ToolDefinition`, `BenchmarkDataset`, `ToolInput`, `ToolResult`, `ToolInputField`, `ToolOutputMetric`, `CalculatorFn`. These are the stable contracts for all downstream tool implementations.

**`packages/tools/src/engine/calculator.ts`**
`runCalculator()` — validates inputs against `ToolInputField` min/max/type constraints (T-10-01-01 mitigation), coerces string numbers to numeric, calls `tool.calculate()`. Never throws — returns `RunCalculatorOutput | RunCalculatorError`. Deterministic: same inputs always yield same output.

**`packages/tools/src/engine/benchmark-loader.ts`**
`isBenchmarkExpired()` — 12-month expiry check (REQ-124). `loadBenchmarks()` — dynamic import from `src/data/{agencySlug}/{key}.json`. `formatBenchmarkUpdatedLabel()` — "Month Year" display format for expiry badge.

**`packages/tools/src/engine/result-renderer.ts`**
`renderToolResult()` — builds HTML with `id="tool-result"` (REQ-413), `scroll-margin-top: var(--mj-space-16)`, expiry badge (yellow, `role="status"`), all `var(--mj-*)` token references. DOMPurify strips scripts and `on*` event handlers before returning string (T-10-01-02).

**`packages/tools/src/data/.gitkeep`**
Establishes benchmark data directory. Plan 10-02 adds `{agencySlug}/{key}.json` files here.

## Test Coverage

| File | Tests | Result |
|------|-------|--------|
| calculator.test.ts | 5 | All pass |
| benchmark-loader.test.ts | 4 | All pass |
| **Total** | **9** | **All pass** |

Test scenarios: determinism verification, valid input calculation, missing required field, max exceeded, NaN rejection, fresh/11-month/13-month expiry, label formatting.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict undefined assignment in runCalculator**
- **Found during:** T-02 typecheck pass
- **Issue:** `coercedInputs[field.name] = ... raw` could assign `undefined` when input not provided — violates `ToolInput = Record<string, string | number>` (strict `noUncheckedIndexedAccess`)
- **Fix:** Added `if (raw === undefined) continue` guard before coercion
- **Files modified:** `packages/tools/src/engine/calculator.ts`
- **Commit:** eff3c58

### Comment Adjustment

The plan's `result-renderer.ts` code included a JSDoc comment referencing "dangerouslySetInnerHTML" (describing the consumer pattern). Removed this comment to satisfy `grep -r "dangerouslySetInnerHTML" packages/tools/src/engine/` acceptance criteria returning 0 results. Functionally identical.

## Threat Mitigations Applied

| Threat ID | Mitigation Status |
|-----------|------------------|
| T-10-01-01 (Tampering — runCalculator) | Applied — min/max/type/NaN validation before calculate() |
| T-10-01-02 (Info Disclosure — result-renderer) | Applied — DOMPurify, ALLOWED_ATTR excludes on* |
| T-10-01-03 (Spoofing — benchmark-loader) | Applied — path from ToolDefinition (static), not user input |
| T-10-01-04 (EoP — PDF email gate) | N/A this plan — email gate not in T-01/T-02 scope |
| T-10-01-05 (DoS — runCalculator) | Applied — field count bounded by ToolDefinition.fields (static) |

## Known Stubs

None. All engine functions are fully implemented. Benchmark data directory is empty by design — Plan 10-02 adds actual JSON files.

## Threat Flags

None. No new network endpoints, auth paths, or trust-boundary-crossing schema introduced. Tools engine is pure computation.

## Self-Check: PASSED

- packages/tools/src/engine/types.ts: FOUND
- packages/tools/src/engine/calculator.ts: FOUND
- packages/tools/src/engine/calculator.test.ts: FOUND
- packages/tools/src/engine/benchmark-loader.ts: FOUND
- packages/tools/src/engine/benchmark-loader.test.ts: FOUND
- packages/tools/src/engine/result-renderer.ts: FOUND
- packages/tools/src/data/.gitkeep: FOUND
- Commit 1914aab: FOUND
- Commit 81e94ad: FOUND
- Commit eff3c58: FOUND
- 9/9 tests pass
- Typecheck: clean
- dangerouslySetInnerHTML in engine/: 0 results
- jsonwebtoken in tools/: 0 results
- payload 3.82.1 exact: confirmed
