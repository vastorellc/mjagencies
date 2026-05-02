---
phase: 04-virality-score-checklist
plan: 06
subsystem: ui
tags: [accordion, checklist, tailwind, happy-dom]

requires:
  - phase: 04-virality-score-checklist
    plan: 01
    provides: ChecklistItem, ChecklistCategory, ChecklistStatus types

provides:
  - ChecklistAccordion React component (4 collapsible sections)
  - 12 happy-dom unit tests

affects: [04-08]

tech-stack:
  patterns:
    - useState for expand/collapse per-section (local state, no external)
    - data-testid + data-open + data-status attributes for test assertions
    - summarise() helper distinguishes all-pending from mixed sections

key-files:
  created:
    - frontend/src/components/ChecklistAccordion.tsx
    - frontend/src/components/ChecklistAccordion.test.tsx

key-decisions:
  - "summarise() uses allPending check (every item pending) not just partial-pending — ensures metadata-quality shows '(8 pending)' rather than '(0/0 passed)'"
  - "SECTIONS array drives render order — video-technical, metadata-quality, virality-boosters, niche-pakistan — matching D-22"
  - "defaultExpanded: true for video-technical + virality-boosters (actionable); false for metadata-quality (pending) + niche-pakistan (info)"
  - "Fix message only rendered when status===fail AND fix is non-empty — avoids empty whitespace for failed items with blank fix string"

requirements-completed: [SCORE-05, SCORE-06, SCORE-08]

duration: 5min
completed: 2026-05-02
---

# Phase 4 Plan 06: ChecklistAccordion.tsx

**4-section collapsible checklist accordion; 12 tests pass; tsc clean.**

## Status: COMPLETE

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-02
- **Completed:** 2026-05-02
- **Tests:** 12/12 pass

## Task Commits

1. **Task 1: ChecklistAccordion.tsx + tests** — `09480c2` (feat)

## Files Created/Modified

- `frontend/src/components/ChecklistAccordion.tsx` — 4 SECTIONS constant drives render order; useState initialised from defaultExpanded flags; summarise() computes header count; icons ✓ ✗ … with Tailwind color classes; fix message rendered below failed items
- `frontend/src/components/ChecklistAccordion.test.tsx` — 12 tests covering: section presence, default-expand state, toggle, header summaries (mixed + all-pending), fix message visibility, icons, data-status attributes, collapsed item visibility

## Deviations from Plan

None.

## Test Results

```
Tests  12 passed (12)
```

## Next Phase Readiness

- ✅ 04-07 (GapAnalysisPanel.tsx) can proceed — no dependency on 04-06
- ✅ 04-08 (GeneratorPage integration) will import ChecklistAccordion

---
*Phase: 04-virality-score-checklist*
*Plan 06 completed: 2026-05-02*
