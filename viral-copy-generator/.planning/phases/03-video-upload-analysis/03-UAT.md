---
status: complete
phase: 03-video-upload-analysis
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md, 03-07-SUMMARY.md, 03-08-SUMMARY.md, 03-09-SUMMARY.md
started: 2026-05-15T23:30:00Z
updated: 2026-05-15T23:32:00Z
---

## Current Test

[testing complete]

## Tests

### 1. End-to-end analysis on real video
expected: |
  Pick real ~20+ MB MP4 → click Analyse → engine runs to completion within seconds (not minutes) → Done state shows populated EngineSignals (framesBase64.length 1-10, faceCount, hasAudio, sceneCount, audioEnergy, brightnessScore all set) → no hang on any step
result: pass
reported: "everything perfect now"

### 2. Cross-cutting flows (Cancel, Re-pick, 250 MB reject)
expected: |
  - Cancel mid-analysis: click Cancel during 'Extracting frames' → UI snaps back to picked state, next Analyse click starts fresh within 5s
  - Re-pick after done: drag a new file onto the dropzone after a done state → done JSON disappears, new picked state begins
  - 250 MB hard reject: pick a > 250 MB file → upload-error banner appears, no analysis attempt
result: pass
reported: "pass"

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

<!-- No gaps -->
