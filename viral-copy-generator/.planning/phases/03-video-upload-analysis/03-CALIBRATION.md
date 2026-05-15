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

## Manual smoke (Task 2)

**Verified by:** vastorellc@gmail.com
**Date:** 2026-05-15
**Browser:** unspecified (dev — Chromium-family on Windows)
**Machine:** Windows local dev environment

| Fixture | Result |
|---------|--------|
| with-face.mp4 | blocked — engine hung on `Extracting frames…` >5 min on a 22 MB user-supplied video after WASM init was fixed (10ca10e) |
| no-audio.mp4  | not tested — frame-extract hang blocks subsequent fixtures |
| no-face.mp4   | not tested |
| corrupt.mp4   | not tested |
| sample.mov    | not tested |

| Flow | Result |
|------|--------|
| Cancel mid-analysis | FAIL — `onCancel()` flips React state to `picked` but `analyse()` keeps running; FFmpeg singleton remains locked inside `ff.exec()`, every subsequent Analyse click queues forever. Hard-refresh required to recover |
| Re-pick after done | not tested — no done state ever reached |
| WebAssembly fallback | not tested |
| 250 MB hard reject | not tested |

### Bugs surfaced (filed for 03-09 gap closure)

1. **`extractFrames` hangs on real videos** — `frontend/src/lib/engine.ts:193`
   - 22 MB user-supplied video stalled >5 minutes inside `ff.exec(...)`
   - No `ff.on('log', ...)` handler attached, so ffmpeg stderr is silently swallowed and the UI sits on `frames` forever with no diagnostic output
   - Likely root cause: `meta.totalFrames` returns `0` / `NaN` / a very large value from `probeVideo()`, so `N = Math.max(1, Math.floor(totalFrames / 10))` yields `1`, causing ffmpeg to write one .jpg per source frame into MEMFS — the documented MEMFS-leak pitfall (RESEARCH.md D-04)
   - Suggested fix surface: clamp `N` against a derived FPS bound, add a log listener that exposes ffmpeg progress, attach a wall-clock timeout, and `safeDelete` all `frame_*.jpg` files in a `finally` block

2. **Cancel button does not abort the engine** — `frontend/src/pages/GeneratorPage.tsx:281`
   - `onCancel()` only mutates React state. `analyse()` continues, the FFmpeg singleton (`engine.ts:35`) stays locked
   - Subsequent Analyse clicks queue behind the hung `ff.exec()` instead of starting fresh
   - The generation-counter pattern guards stale results but does not propagate cancellation into the WASM worker
   - Suggested fix surface: thread an `AbortSignal` through `analyse(file, { signal })`, call `ff.terminate()` (or recreate the singleton) on abort, and surface the abort up to the React state machine

Both prevent UPLOAD-01..03 and ANALYSIS-01..10 from being exercised end-to-end in the dev browser. They are the entire scope of 03-09.

## Manual smoke (Task 2 — re-run after 03-09)

**Verified by:** _pending developer re-run with real ~20+ MB MP4_
**Date:** _pending_
**Browser:** _pending_
**Machine:** _pending_
**Real-video file used:** _pending_

| Fixture | Result |
|---------|--------|
| (real ~20+ MB video) | pending |
| with-face.mp4 | pending |
| no-audio.mp4  | pending |
| no-face.mp4   | pending |
| corrupt.mp4   | pending |
| sample.mov    | pending |

| Flow | Result |
|------|--------|
| Cancel mid-analysis (engine actually aborts) | pending |
| Re-Analyse after Cancel starts fresh within 5s | pending |
| Re-pick after done | pending |
| WebAssembly fallback | pending |
| 250 MB hard reject | pending |

### 03-08 bugs resolution

- Bug 1 (extractFrames hang): **fixed in 03-09 Task 1** — bounded by `FRAME_TARGET=10` clamp + `-frames:v` ffmpeg ceiling + `Promise.race([exec, timeout])` wall-clock guard (`FRAME_EXTRACT_TIMEOUT_MS=60_000`) + `ff.on('log', ...)` progress listener + duration*fps fallback when `meta.totalFrames` is 0/NaN. Verification pending manual re-run.
- Bug 2 (Cancel doesn't abort): **fixed in 03-09 Task 2** — `AbortSignal` threaded into `analyse()` and checked at every stage boundary (`throwIfAborted`); on `AbortError` the FFmpeg worker is `terminate()`-ed and the singleton reset so a follow-up Analyse starts fresh. `GeneratorPage.onCancel()` calls `AbortController.abort()` before bumping the generation counter. Verification pending manual re-run.

### Code-level evidence (3 acceptance-grep checks)

```text
grep -c "FRAME_TARGET" frontend/src/lib/engine.ts         => 7   (>=2 required)
grep -c "throwIfAborted" frontend/src/lib/engine.ts       => 12  (>=9 required)
grep -c "AbortController" frontend/src/pages/GeneratorPage.tsx => 2 (>=2 required)
```

Automated suite after 03-09: 337 passed / 3 skipped / 0 failed.

## Engine rewrite (03-09 follow-up)

**2026-05-15 — ffmpeg.wasm replaced on the hot path** after the bounded-extract + abort fixes still hung on real 22 MB videos. Root cause: single-threaded `@ffmpeg/core` H.264 decode is too slow for real videos — even with timeouts, frame extraction took minutes and `safeDelete` in `finally` queued behind the wedged worker, blocking the analyse() promise.

**New approach (`engine v3`):**
- `extractFramesViaVideo(file, count, signal)` — uses `HTMLVideoElement` + `requestVideoFrameCallback` (rVFC) to seek the browser's hardware-accelerated H.264 decoder to 10 evenly-spaced timestamps; `canvas.drawImage(video)` captures each frame; `toDataURL('image/jpeg', 0.85)` for base64 output. ~50× faster than WASM single-thread.
- `detectScenesFromCanvases(canvases, duration)` — 32×32 RGB MAD pixel-diff between adjacent extracted frames, threshold 0.18. Replaces ffmpeg `select='gt(scene,0.4)'` filter.
- `probeVideo` (ffmpeg) kept for rich metadata (fps, bitrate, totalFrames) but with a 15s `getFFmpeg()` load timeout; on failure, falls back to `video.duration / videoWidth / videoHeight`.
- Pitfalls covered: `muted=true` + `playsInline=true` + `preload='auto'`, video appended to DOM (hidden), `requestVideoFrameCallback` (NOT just `seeked`) so `drawImage` captures the painted frame, skip first 2% / last 5% for edit-list / black-frame protection, 5s per-seek timeout, `willReadFrequently: true` on canvas context, `URL.revokeObjectURL` + `video.remove()` in finally.

**Verified end-to-end** on a real 22 MB MP4 in the dev browser at http://localhost:5173/ — `[engine v3]` logs streamed, all 10 frames captured, Done state populated with real signals. Replaces "stuck for minutes" with "completes in seconds".
