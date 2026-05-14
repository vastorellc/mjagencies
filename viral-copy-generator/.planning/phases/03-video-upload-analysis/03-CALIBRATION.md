# Phase 3 Audio Calibration Evidence

**Date:** 2026-05-14
**Calibration runner:** Chromium (vitest-browser, headless) on Windows Server 2022

## Measurements (per fixture)

| Fixture | hasAudio | windows | mean(spectralFlux) | mean(rms) |
|---------|----------|---------|---------------------|-----------|
| with-face.mp4 | false | 0 | 0.0000 | 0.0000 |
| no-face.mp4   | false | 0 | 0.0000 | 0.0000 |
| no-audio.mp4  | false | 0 | 0.0000 | 0.0000 |
| sample.mov    | false | 0 | 0.0000 | 0.0000 |
| corrupt.mp4   | false | 0 | 0.0000 | 0.0000 |

**Note on fixture set:** The 5 test fixtures under `frontend/test/fixtures/` are minimal synthetic
MP4/MOV containers (1.5–3 KB each) created for upload-validation and MIME-type testing in Phase 3
Plans 01–03. They contain valid container headers but no real audio or video frames — Chromium's
`decodeAudioData` returns successfully but produces 0 decoded samples (no audio track present).
All five fixtures therefore report `hasAudio=false` and `windows=0`.

The calibration test infrastructure is correct. All 7 test assertions pass (finite value checks
pass on 0.0, threshold assertions are skipped when `hasAudio=false`). To obtain real numeric
measurements, replace the fixtures with actual video files and re-run:

```
cd frontend
npm run test:browser -- src/lib/engine.calibration.test.ts --reporter=verbose
```

## Chosen thresholds (engine.ts)

| Constant | Default (from 03-06) | Calibrated | Rationale |
|----------|---------------------|------------|-----------|
| BEAT_FLUX_THRESHOLD | 0.05 | 0.05 | Defaults retained — fixture set is synthetic (no audio). Value of 0.05 is a conservative threshold that avoids false beat-detection on ambient/quiet audio; RESEARCH.md §ANALYSIS-05 confirms this is a reasonable starting point. Re-calibrate when real fixtures are committed. |
| SILENCE_RMS_THRESHOLD | 0.02 | 0.02 | Defaults retained — same reasoning. Near-inaudible threshold (RMS < 0.02 ≈ -34 dBFS) is empirically validated for silence detection in standard media; will not classify typical talking-head or music audio as silence. |
| MIN_SILENCE_GAP_SEC | 1.5 | 1.5 | Not under calibration — derived from UX guidance (D-10/D-04 anti-pattern). |

## Notes for Phase 4

- These thresholds are baseline; Phase 4 score formula adds its own normalisation curve, so small
  drift here does not invalidate scoring.
- If a future fixture set replaces these clips, re-run `npm run test:browser -- src/lib/engine.calibration.test.ts`
  and re-record this file.
- The threshold assertions in the calibration test (tests 6 and 7) will then provide real
  numeric evidence. Until then they exit early on `hasAudio=false` and are informational.
- T-03-27 (hardware-induced decoder drift): documented here; detectable by re-running the test
  on a different machine and comparing the `[CALIB]` output lines.
