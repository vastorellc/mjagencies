---
plan: 12-01
phase: 12-launch-qa-seeds-runbooks-sla
subsystem: qa-testing
status: complete
wave: 2
tags: [playwright, e2e, qa-matrix, admin-view, payload]
dependency_graph:
  requires: [12-07]
  provides: [qa-matrix-types, e2e-suites, qa-report-view]
  affects: [packages/cms, packages/testing, packages/ui, all 12 agency apps]
tech_stack:
  added: [@playwright/test, qa-matrix types]
  patterns: [per-agency E2E skip guard, admin view gated by requireSession+super_admin, no inline styles]
key_files:
  created:
    - packages/testing/src/qa-matrix/types.ts
    - packages/testing/src/qa-matrix/index.ts
    - apps/web-ai/tests/e2e/agency.spec.ts
    - apps/web-branding/tests/e2e/agency.spec.ts
    - apps/web-construction/tests/e2e/agency.spec.ts
    - apps/web-dental/tests/e2e/agency.spec.ts
    - apps/web-ecommerce/tests/e2e/agency.spec.ts
    - apps/web-financial/tests/e2e/agency.spec.ts
    - apps/web-fitness/tests/e2e/agency.spec.ts
    - apps/web-homeservices/tests/e2e/agency.spec.ts
    - apps/web-legal/tests/e2e/agency.spec.ts
    - apps/web-realestate/tests/e2e/agency.spec.ts
    - apps/web-restaurant/tests/e2e/agency.spec.ts
    - apps/web-spa/tests/e2e/agency.spec.ts
    - 12x apps/{slug}/tests/e2e/playwright.config.ts
    - packages/cms/src/admin-views/QaReportView.tsx
    - packages/cms/src/admin-views/qa-report-view-config.ts
  modified:
    - packages/testing/src/index.ts
    - packages/cms/src/config/build-payload-config.ts
    - packages/cms/src/index.ts
    - packages/ui/src/dashboard/dashboard.css
decisions:
  - E2E skip guard uses E2E_BASE_URL (not PLAYWRIGHT_AVAILABLE) so unit CI skips E2E tests cleanly
  - Phase 11 deferred CCPA erasure test annotated in all 12 specs with matching 11-VERIFICATION.md reference
  - QaReportView reads from .planning/qa-results.json if present; shows empty state if absent
  - All styles via CSS classes (dashboard-page, dashboard-table, rum-pill variants) — zero inline styles
  - rum-pill--pass/fail/skip/pending CSS variants added to dashboard.css (Rule 2 deviation — missing from existing CSS)
  - web-construction and web-spa test directories created alongside new app scaffold dirs
metrics:
  duration: 22m
  completed: 2026-04-28
  tasks_completed: 2
  files_created: 29
  files_modified: 4
---

# Phase 12 Plan 01: QA Matrix Types + E2E Suites + QaReportView Summary

Per-agency Playwright E2E test suites (5 tests × 12 agencies = 60 total tests) and the QA Report View admin page backed by qa-matrix types from @mjagency/testing.

## Objective Achieved

All 3 deliverables complete: qa-matrix types package, 12 per-agency E2E suites, QaReportView admin page registered at /admin/qa-report.

## Files Created

- `packages/testing/src/qa-matrix/types.ts` — QaCheckCategory, QaCheckState, QaCheckResult, QaMatrixRow, QaReport
- `packages/testing/src/qa-matrix/index.ts` — re-exports types with .js ESM extension
- `12x apps/{slug}/tests/e2e/agency.spec.ts` — 5 E2E tests per agency: home 200, auth redirect, contact form, booking, CCPA erasure
- `12x apps/{slug}/tests/e2e/playwright.config.ts` — per-agency Playwright configs (testDir: '.', fullyParallel: true, chromium)
- `packages/cms/src/admin-views/QaReportView.tsx` — 12x10 matrix table, requireSession + super_admin guard, no inline styles
- `packages/cms/src/admin-views/qa-report-view-config.ts` — AdminViewConfig at /qa-report exact

## Files Modified

- `packages/testing/src/index.ts` — added `export * from './qa-matrix/index.js'`
- `packages/cms/src/config/build-payload-config.ts` — added qaReportView import + `QaReport: qaReportView` in admin.components.views
- `packages/cms/src/index.ts` — added qaReportView export
- `packages/ui/src/dashboard/dashboard.css` — added rum-pill--pass/fail/skip/pending variants, dashboard-table-wrapper, dashboard-page__subtitle

## Key Decisions

- E2E skip guard uses `E2E_BASE_URL` (not `PLAYWRIGHT_AVAILABLE`) — plan spec explicitly requires this; unit CI has no `E2E_BASE_URL` set so suites skip cleanly
- Phase 11 deferred CCPA erasure test annotated in all 12 specs: `// Phase 11 deferred: live erasure form presence — REQ-150, 11-VERIFICATION.md line 29`
- `QaReportView` reads `.planning/qa-results.json` via `existsSync` + `readFileSync`; renders empty state if file absent
- All badge styling via external CSS classes only (`rum-pill rum-pill--pass`, etc.) — CSP nonce would block inline styles per CLAUDE.md §7

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing CSS] Added rum-pill badge variants for QA states**
- **Found during:** Task 2
- **Issue:** `dashboard.css` only had `rum-pill--healthy`, `rum-pill--warning`, `rum-pill--poor` variants. The plan requires `rum-pill--pass`, `rum-pill--fail`, `rum-pill--skip`, `rum-pill--pending` for QaReportView badges. Without these, badges would render with no color styling.
- **Fix:** Added 4 new CSS variants to `packages/ui/src/dashboard/dashboard.css` using `var(--mj-color-success)`, `var(--mj-color-error)`, `var(--mj-color-warning)`, `var(--mj-color-text-secondary)` tokens. Zero hex literals (Phase 4 AJV compliance).
- **Files modified:** `packages/ui/src/dashboard/dashboard.css`
- **Commit:** 8b00f38

**2. [Rule 2 - Missing CSS] Added dashboard-table-wrapper class**
- **Found during:** Task 2
- **Issue:** QaReportView uses `className="dashboard-table-wrapper"` for responsive overflow scroll on the wide 12-column table. Class was absent from dashboard.css.
- **Fix:** Added `.dashboard-table-wrapper { overflow-x: auto; width: 100%; }` to dashboard.css.
- **Files modified:** `packages/ui/src/dashboard/dashboard.css`
- **Commit:** 8b00f38

**3. [Rule 2 - Missing CSS] Added dashboard-page__subtitle class**
- **Found during:** Task 2
- **Issue:** QaReportView uses `className="dashboard-page__subtitle"` for the summary line ("12 agencies × 10 checks = 120 checks total..."). Class was absent from dashboard.css.
- **Fix:** Added `.dashboard-page__subtitle` with `--mj-text-size-base` / `--mj-weight-normal` / `--mj-color-text-secondary` tokens.
- **Files modified:** `packages/ui/src/dashboard/dashboard.css`
- **Commit:** 8b00f38

**4. [Rule 3 - Structural] Created app directories for web-construction and web-spa**
- **Found during:** Task 1
- **Issue:** `apps/web-construction` and `apps/web-spa` did not exist as app directories (only listed in plan's 12-CONTEXT.md as canonical agency slugs). E2E test files require a target directory.
- **Fix:** Created `apps/web-construction/tests/e2e/` and `apps/web-spa/tests/e2e/` with spec + playwright config files. Minimal directory scaffold sufficient for test files to exist at the correct path.
- **Commit:** 22ff735

## Known Stubs

None. QaReportView renders empty state with "QA matrix is not yet populated" message when `.planning/qa-results.json` is absent. This is intentional and documented behavior — the file is populated by running `turbo test` with the full QA suite.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes beyond those already in the plan's threat model (T-12-01-01 through T-12-01-04 all mitigated as specified).

## Verification

- 12 `agency.spec.ts` files exist with 5 tests each (60 E2E tests total)
- `QaReportView.tsx` has `import 'server-only'` as first import
- `QaReportView.tsx` calls `requireSession()` as first function body statement
- `QaReportView.tsx` gates on `session.role !== 'super_admin'` with `redirect('/admin')`
- Zero `style=` attributes in `QaReportView.tsx`
- `th scope="col"` on Agency + 10 check columns (rendered via map from `QA_CHECKS` array)
- `th scope="row"` on each agency name cell (rendered via map from `AGENCY_SLUGS` array)
- `QaReport: qaReportView` registered in `build-payload-config.ts` admin.components.views
- `qaReportView` exported from `packages/cms/src/index.ts`
- Empty state copy: "QA matrix is not yet populated. Run the full QA suite with turbo test to generate results."

## Self-Check: PASSED

Files verified to exist:
- packages/testing/src/qa-matrix/types.ts — FOUND
- packages/testing/src/qa-matrix/index.ts — FOUND
- apps/web-ai/tests/e2e/agency.spec.ts — FOUND
- apps/web-ecommerce/tests/e2e/agency.spec.ts — FOUND
- apps/web-spa/tests/e2e/agency.spec.ts — FOUND
- packages/cms/src/admin-views/QaReportView.tsx — FOUND
- packages/cms/src/admin-views/qa-report-view-config.ts — FOUND

Commits verified:
- 22ff735 (Task 1) — feat(qa): add qa-matrix types and 12 per-agency Playwright E2E suites
- 8b00f38 (Task 2) — feat(qa): add QaReportView admin page with 12x10 matrix and view registration
