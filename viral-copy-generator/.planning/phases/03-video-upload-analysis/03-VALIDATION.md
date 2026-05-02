---
phase: 3
slug: video-upload-analysis
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-02
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 3 is browser-side: tests run via Vitest browser mode (Wave 0 installs).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest@4.1.5 + @vitest/browser@4.1.5 + playwright@1.59.1 |
| **Config file** | `frontend/vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `cd frontend && npm test -- --run --browser.headless` |
| **Full suite command** | `cd frontend && npm test` |
| **Estimated runtime** | ~30s (browser tests with WebAssembly bootstrap) |

---

## Sampling Rate

- **After every task commit:** Run quick command on the task's test file: `cd frontend && npm test -- {file}`
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60s (browser tests slower than Node tests due to WebAssembly init)

---

## Per-Task Verification Map

To be populated by planner. Each task in 03-XX-PLAN.md must have one of:
- `<automated>` block with a vitest command, OR
- A `Wave 0` reference if its test file/fixture isn't in place yet

Sampling continuity rule: no 3 consecutive tasks without automated verify (would create a feedback gap).

---

## Wave 0 Requirements

Per RESEARCH.md "Wave 0 Gaps" section:

- [ ] `frontend/vitest.config.ts` — vitest browser mode config (playwright provider)
- [ ] `frontend/test/setup.ts` — global test setup
- [ ] `frontend/test/fixtures/` — 5 small fixture videos:
  - [ ] `with-face.mp4` (~2 MB, includes a face, has audio)
  - [ ] `no-audio.mp4` (~1 MB, silent)
  - [ ] `no-face.mp4` (~1 MB, scenery only — matches Pakistani creator niches)
  - [ ] `corrupt.mp4` (intentionally truncated for failure-path tests)
  - [ ] `sample.mov` (1 MB, MOV container for codec coverage)
- [ ] Install: `vitest@4.1.5 @vitest/browser@4.1.5 playwright@1.59.1 happy-dom@20.9.0 @testing-library/react@16.3.2`
- [ ] Add `"test": "vitest"` script to `frontend/package.json`
- [ ] Calibration task: empirically tune A2 spectralFlux beat threshold (0.05 starting point) and A3 RMS silence threshold (0.02 starting point) against the 5 fixtures

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop UX feel | UPLOAD-01 | Browser-driven event timing | Drag a 50 MB file, observe dropzone highlight, drop, see thumbnail |
| 250 MB hard reject UX | UPLOAD-01 | Need a real ≥250 MB file | Pick a known >250 MB file, see clear error message |
| Mobile advisory banner | D-12 | Real device check | Open in iOS Safari, see banner; ffmpeg should still load |
| WebAssembly fallback | ANALYSIS-09 | Need a browser without WASM | Open in IE-mode (or stub `WebAssembly = undefined`), see fallback banner + manual textarea |
| Cancel button feel | D-08 | Visual confirmation that the spinner clears | Click Analyse on a 100 MB file, click Cancel within 5s, verify UI resets |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (vitest config, fixtures, install)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
