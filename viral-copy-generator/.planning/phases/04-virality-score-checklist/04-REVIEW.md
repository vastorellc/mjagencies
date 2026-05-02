---
phase: 04-virality-score-checklist
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - frontend/src/lib/score.ts
  - frontend/src/lib/checklist.ts
  - frontend/src/lib/gaps.ts
  - frontend/src/lib/viewRange.ts
  - frontend/src/lib/types.ts
  - frontend/src/components/ScorePanel.tsx
  - frontend/src/components/PlatformCardGrid.tsx
  - frontend/src/components/ChecklistAccordion.tsx
  - frontend/src/components/GapAnalysisPanel.tsx
  - frontend/src/pages/GeneratorPage.tsx
  - frontend/src/lib/score.test.ts
  - frontend/src/lib/checklist.test.ts
  - frontend/src/lib/gaps.test.ts
  - frontend/src/lib/viewRange.test.ts
  - frontend/src/components/ScorePanel.test.tsx
  - frontend/src/components/PlatformCardGrid.test.tsx
  - frontend/src/components/ChecklistAccordion.test.tsx
  - frontend/src/components/GapAnalysisPanel.test.tsx
  - frontend/src/pages/GeneratorPage.test.tsx
findings:
  critical: 0
  warning: 6
  info: 6
  total: 12
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

All 19 source files reviewed at standard depth, covering the virality score engine (`score.ts`), checklist builder (`checklist.ts`), gap analysis (`gaps.ts`), view range lookup (`viewRange.ts`), shared types (`types.ts`), four UI components, one page component, and their full test suites.

The logic is generally solid: signal normalizers are correctly bounded, weight rows all sum to 1.0, NaN edge cases (D-25) are handled consistently, and test coverage is thorough. No security vulnerabilities, no hardcoded secrets, and no XSS vectors were found.

Six warnings were found, split between a logic inconsistency in learned-weight application, dead code in `hookSignal`, an unsafe TypeScript assertion, an unhandled async rejection, and redundant null guards. Six info-level items flag missing explicit return types (violating the CLAUDE.md strict-mode rule) and minor React/HTML hygiene issues.

---

## Warnings

### WR-01: Dead code — `hookSignal` fallback on line 93 is unreachable

**File:** `frontend/src/lib/score.ts:91-93`

**Issue:** The guard on line 91 already returns early when `sceneTimestamps.length === 0`, so `sceneTimestamps[0]` is guaranteed to be defined on line 93. The `?? s.durationSec` fallback can never execute. If the engine ever sets `sceneCount > 0` while `sceneTimestamps` is empty, the guard returns 0 rather than reaching the fallback, so the fallback provides no defensive value — it just obscures the logic.

**Fix:**
```typescript
// Before (line 93):
const firstSceneT = s.sceneTimestamps[0] ?? s.durationSec

// After — the fallback is unreachable; remove it to make intent clear:
const firstSceneT = s.sceneTimestamps[0]  // always defined: length===0 is guarded above
```

---

### WR-02: Logic inconsistency — learned weights are applied to overall score but ignored for all per-platform scores

**File:** `frontend/src/lib/score.ts:207-219`

**Issue:** `computeScore` accepts a `weights: BaselineWeights` parameter (used to carry calibrated learned weights from `applyLearnedWeights`). This parameter is passed only to the `scoreWithWeights` call that computes `overall`. All five per-platform `scoreWithWeights` calls hardcode `PLATFORM_WEIGHTS[platform]`, completely ignoring the calibrated weights. As a result, after Phase 7 wires up learned weights, the overall score will shift with the user's data but the per-platform breakdown will remain static. This creates a visible inconsistency: overall may increase while the platform cards stay unchanged.

The current Phase 7 comment in `GeneratorPage.tsx` does not document this limitation, which risks surprising the Phase 7 implementer.

**Fix:**
If the intent is that learned weights calibrate only the overall score (a valid product decision), document it explicitly:
```typescript
export function computeScore(
  signals: EngineSignals,
  // NOTE: weights applies only to the overall score. Per-platform scores
  // always use PLATFORM_WEIGHTS (fixed weights per D-12). Learned-weight
  // calibration (Phase 7) intentionally affects only overall, not breakdown.
  weights: BaselineWeights = BASELINE_WEIGHTS,
): ScoreResult {
```

If the intent is that learned weights should also affect per-platform scores, pass `weights` to each platform call:
```typescript
youtube: scoreWithWeights(signals, mergeWeights(weights, PLATFORM_WEIGHTS.youtube), 'youtube'),
```
where `mergeWeights` blends baseline learned adjustments with per-platform base weights.

---

### WR-03: Unsafe TypeScript assertion — `{} as BaselineWeights` bypasses strict-mode checks

**File:** `frontend/src/lib/score.ts:185`

**Issue:** `const out = {} as BaselineWeights` asserts an empty object literal as a fully-populated `BaselineWeights`. TypeScript strict mode allows this assertion without verifying that all required keys are present at the time of the cast. If a key is later added to `BaselineWeights` and the `keys` array on line 167 is not updated, the loop silently produces an object missing that key while TypeScript reports no error.

**Fix:**
Use `Partial<BaselineWeights>` during construction, then assert only at the return site where all keys are provably filled:
```typescript
const out: Partial<BaselineWeights> = {}
for (const k of keys) out[k] = raw[k] / sum
return out as BaselineWeights  // safe: the loop above fills every key in `keys`
```

---

### WR-04: Unnecessary type widening and unsafe cast in `ChecklistAccordion` state init

**File:** `frontend/src/components/ChecklistAccordion.tsx:44-48`

**Issue:** The `useState` initializer types `init` as `Record<string, boolean>` (a widened, untyped key), then casts the result with `as Record<ChecklistCategory, boolean>`. If a new `ChecklistCategory` is added to `types.ts` without a corresponding entry in `SECTIONS`, TypeScript will not catch the missing default-expansion value — the cast masks the gap and the component silently renders with `undefined` for that category's expanded state.

**Fix:**
Initialize directly as the target type:
```typescript
const [expanded, setExpanded] = useState<Record<ChecklistCategory, boolean>>(() => {
  const init = {} as Record<ChecklistCategory, boolean>
  for (const s of SECTIONS) init[s.category] = s.defaultExpanded
  return init
})
```
Now TypeScript will flag any `ChecklistCategory` value not covered by `SECTIONS` at compile time.

---

### WR-05: Unhandled promise rejection — `supabase.auth.signOut()` in `GeneratorPage`

**File:** `frontend/src/pages/GeneratorPage.tsx:79`

**Issue:** The "Sign out" button's `onClick` handler calls `supabase.auth.signOut()` and discards the returned `Promise`. If the Supabase call fails (network error, expired session, etc.) the rejection is silently swallowed — no error is surfaced to the user and the button appears to do nothing.

**Fix:**
```typescript
// Replace:
onClick={() => supabase.auth.signOut()}

// With:
onClick={() => { supabase.auth.signOut().catch(console.error) }}

// Or with proper user feedback (preferred once a toast/notification system exists):
onClick={() => {
  supabase.auth.signOut().catch((err: unknown) => {
    console.error('Sign out failed', err)
    // TODO Phase 5+: surface error to user via notification
  })
}}
```

---

### WR-06: Redundant null guards in `GeneratorPage` render condition

**File:** `frontend/src/pages/GeneratorPage.tsx:86`

**Issue:** The condition `!signals || !scoreResult || !checklistItems || !gapMessages` checks four values. However, by the `useMemo` dependency graph: `scoreResult` is `null` only when `signals` is `null`; `checklistItems` is `null` only when `signals` is `null`; `gapMessages` is `null` only when `checklistItems` is `null`. When `signals` is non-null, the other three are always non-null. The three extra checks are logically redundant and create a false impression that `scoreResult`, `checklistItems`, or `gapMessages` could independently be `null` while `signals` is set.

**Fix:**
```typescript
// Replace:
if (!signals || !scoreResult || !checklistItems || !gapMessages) {

// With:
if (!signals || !scoreResult || !checklistItems || !gapMessages) {
  // Note: all four are null-synchronized on signals; the three extra checks are
  // defensive guards only — if signals is non-null, all others are non-null.
```

Or simplify the condition by unwrapping in one place:
```typescript
if (!signals) {
  return (
    <div ...>Upload a short-form video...</div>
  )
}
// Here signals, scoreResult, checklistItems, gapMessages are all non-null.
const result = scoreResult!   // or restructure memos to return {} instead of null
```

---

## Info

### IN-01: `key={idx}` (array index) used as React list key in `GapAnalysisPanel`

**File:** `frontend/src/components/GapAnalysisPanel.tsx:18`

**Issue:** `key={idx}` uses the array index as a React reconciliation key. When `buildGapAnalysis` returns a different set of gaps between renders (e.g., a failure is fixed, reordering the remaining gaps), React may incorrectly reuse DOM nodes and produce stale content or missed animations.

**Fix:**
Use the gap string content itself as the key. Gap strings are deterministic and unique within a render cycle:
```tsx
{gaps.map((gap) => (
  <li key={gap} data-testid={`gap-item-${gaps.indexOf(gap)}`}>
    {gap}
  </li>
))}
```
Or if duplicate gap strings are theoretically possible, prefix with index:
```tsx
{gaps.map((gap, idx) => (
  <li key={`${idx}-${gap}`} data-testid={`gap-item-${idx}`}>
```

---

### IN-02: Header `<button>` elements in `GeneratorPage` missing `type="button"`

**File:** `frontend/src/pages/GeneratorPage.tsx:70-80`

**Issue:** The "Settings" and "Sign out" `<button>` elements do not have an explicit `type` attribute. The HTML default is `type="submit"`, which would trigger form submission if these buttons were ever placed inside a `<form>` element in a future refactor. `ChecklistAccordion` correctly sets `type="button"` on its toggle button.

**Fix:**
```tsx
<button type="button" onClick={() => onNavigate('settings')} ...>
  Settings
</button>
<button type="button" onClick={() => supabase.auth.signOut()} ...>
  Sign out
</button>
```

---

### IN-03: Private helpers `clamp` and `linear` in `score.ts` missing explicit return types

**File:** `frontend/src/lib/score.ts:69,78`

**Issue:** CLAUDE.md mandates explicit return types on all functions. `clamp` and `linear` are missing `: number` annotations.

**Fix:**
```typescript
function clamp(n: number, lo: number, hi: number): number { ... }
function linear(x: number, x0: number, x1: number, y0: number, y1: number): number { ... }
```

---

### IN-04: `summarise` helper in `ChecklistAccordion` missing explicit return type

**File:** `frontend/src/components/ChecklistAccordion.tsx:33`

**Issue:** Per CLAUDE.md, all functions need explicit return types. `summarise` infers `: string` but does not declare it.

**Fix:**
```typescript
function summarise(group: ChecklistItem[]): string {
```

---

### IN-05: `GapAnalysisPanel` default export missing explicit return type

**File:** `frontend/src/components/GapAnalysisPanel.tsx:5`

**Issue:** The component returns either `null` or a `<section>` element. Per CLAUDE.md, explicit return types are required.

**Fix:**
```tsx
export default function GapAnalysisPanel({ gaps }: Props): React.JSX.Element | null {
```

---

### IN-06: All four component default-export functions missing explicit return types

**Files:**
- `frontend/src/components/ScorePanel.tsx:18`
- `frontend/src/components/PlatformCardGrid.tsx:35`
- `frontend/src/components/ChecklistAccordion.tsx:43`
- `frontend/src/pages/GeneratorPage.tsx:37`

**Issue:** Per CLAUDE.md strict-mode rule, all functions require explicit return types. All four component default exports infer their return type rather than declaring it.

**Fix:**
```tsx
// Each component function signature:
export default function ScorePanel({ score, dataPoints }: Props): React.JSX.Element { ... }
export default function PlatformCardGrid({ perPlatform }: Props): React.JSX.Element { ... }
export default function ChecklistAccordion({ items }: Props): React.JSX.Element { ... }
export default function GeneratorPage({ onNavigate, __testSignals }: Props): React.JSX.Element { ... }
```

---

_Reviewed: 2026-05-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
