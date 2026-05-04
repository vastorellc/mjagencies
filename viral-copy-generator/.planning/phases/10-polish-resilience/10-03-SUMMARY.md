---
phase: 10-polish-resilience
plan: "03"
subsystem: frontend
tags:
  - ios-safe-area
  - vite-config
  - mobile-ux
  - polish

dependency_graph:
  requires:
    - "10-02"
  provides:
    - ios-safe-area-fixed-overlays
    - vite-optimizeDeps-ffmpeg
  affects:
    - frontend/src/App.tsx
    - frontend/src/components/ScheduleModal.tsx
    - frontend/vite.config.ts

tech_stack:
  added: []
  patterns:
    - "pb-[env(safe-area-inset-bottom)] on fixed bottom overlay elements"
    - "optimizeDeps.exclude for WebAssembly packages in Vite"

key_files:
  created: []
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/ScheduleModal.tsx
    - frontend/vite.config.ts

decisions:
  - "Added pb-[env(safe-area-inset-bottom)] to both fixed overlay elements rather than the page-level <main> (which already had it) — consistent with the pattern used across all 6 page components"
  - "optimizeDeps.exclude added prophylactically before Phase 3 installs @ffmpeg packages — zero runtime cost, prevents future Phase 3 build failure"

metrics:
  duration: "~10 minutes"
  completed: "2026-05-04T06:24:10Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 10 Plan 03: iOS Safe-Area Fixed Overlays + Vite optimizeDeps Summary

iOS safe-area padding applied to two fixed overlay elements missed in earlier phases (App.tsx nav cluster, ScheduleModal inner card), plus prophylactic Vite `optimizeDeps.exclude` for Phase 3 WebAssembly packages.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add pb-[env(safe-area-inset-bottom)] to fixed overlay elements | ade818d | frontend/src/App.tsx, frontend/src/components/ScheduleModal.tsx |
| 2 | Add optimizeDeps.exclude to vite.config.ts | e184415 | frontend/vite.config.ts |

## What Was Built

**Task 1 — iOS safe-area on fixed overlays:**
- `App.tsx` line 118: added `pb-[env(safe-area-inset-bottom)]` to the `fixed bottom-4 right-4` nav cluster div (Research + Admin buttons). On iPhone, these buttons now clear the home indicator.
- `ScheduleModal.tsx` line 70: added `pb-[env(safe-area-inset-bottom)]` to the inner card container, after `p-5` and before `sm:rounded-2xl`. The `sm:` responsive variant remains after `rounded-t-2xl` for correct specificity. On iPhone in sheet mode (items-end), the Confirm button now clears the home indicator.

**Task 2 — Vite optimizeDeps.exclude:**
- Added `optimizeDeps.exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core']` after the `server` block in vite.config.ts. Prevents Vite's esbuild pre-bundler from attempting to process WebAssembly packages when Phase 3 installs them. These packages are not yet in package.json — this is a Phase 3 readiness config entry.

## Verification Results

All success criteria confirmed:

| Check | Result |
|-------|--------|
| `pb-[env(safe-area-inset-bottom)]` in App.tsx fixed div | PASS |
| `pb-[env(safe-area-inset-bottom)]` in ScheduleModal inner card | PASS |
| `optimizeDeps` in vite.config.ts | PASS |
| `@ffmpeg/ffmpeg` in vite.config.ts exclude list | PASS |
| `@ffmpeg/core` in vite.config.ts exclude list | PASS |
| h-[100dvh] grep on frontend/src/pages/ — 6 app screens (no regressions) | PASS |
| `npx tsc --noEmit` exits 0 | PASS |
| `npm run build` exits 0 | PASS |

**Note on h-[100dvh] count:** The structural grep returns 7 (not 6) because LoginPage.tsx has also used `h-[100dvh]` since Phase 1. The RESEARCH.md count of 6 referred to the 6 app screens (Generator, Research, Settings, History, Learning, Admin) — LoginPage is a separate auth gate screen. No regressions: no page files were modified by this plan.

## Deviations from Plan

None — plan executed exactly as written.

- The fixed nav cluster div was at line 118 in the actual file (plan referenced "approx line 107"), but the className string matched exactly and the edit succeeded.
- ScheduleModal inner card div was at line 70 exactly as specified.
- vite.config.ts structure matched the plan's expected current structure exactly.

## Known Stubs

None — this plan makes no data connections or UI content changes.

## Threat Flags

None — CSS env() variable and Vite config changes; no new trust boundaries introduced.

## Self-Check

Checking created/modified files exist:

- FOUND: frontend/src/App.tsx
- FOUND: frontend/src/components/ScheduleModal.tsx
- FOUND: frontend/vite.config.ts
- FOUND: .planning/phases/10-polish-resilience/10-03-SUMMARY.md
- FOUND: commit ade818d (Task 1)
- FOUND: commit e184415 (Task 2)

## Self-Check: PASSED
