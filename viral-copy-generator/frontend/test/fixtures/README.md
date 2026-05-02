# Phase 3 Test Fixtures

> **Status: NOT YET PROVISIONED.** Phase 3 paused at Wave 0 Task 3 — see `.planning/phases/03-video-upload-analysis/03-01-SUMMARY.md`.

This directory holds the 5 fixture videos required by the in-browser engine test suite (Plans 03-02..03-08). They cannot be authored by Claude — they require real video content to exercise ffmpeg.wasm + TF.js + Web Audio against representative inputs.

## Required files

| File | ≤ Size | What it tests | Suggested source |
|------|--------|---------------|------------------|
| `with-face.mp4` | 2 MB | MediaPipe face detection (ANALYSIS-04), full metadata pipeline (ANALYSIS-01), frame extraction (ANALYSIS-02) | Self-recorded talking-head clip, ≤10s, 720p or smaller, encoded H.264 + AAC |
| `no-audio.mp4` | 1 MB | `hasAudio: false` path, silence-gap detection (ANALYSIS-05) | Drone clip / muted phone clip / video with audio stripped via `ffmpeg -i in.mp4 -an out.mp4` |
| `no-face.mp4` | 1 MB | `faceCount: 0` is not an error (Pakistani niche match — travel/hotels/drives/scenery) | Travel/hotel/drive clip from your real content; should have visual motion + audio |
| `corrupt.mp4` | 100 KB | Failure-path card (D-10 in `03-CONTEXT.md`) | Truncate any of the others: `head -c 51200 with-face.mp4 > corrupt.mp4` |
| `sample.mov` | 1 MB | MOV/QuickTime codec coverage (UPLOAD-01 accepts `video/quicktime`) | Any QuickTime export from iPhone or `ffmpeg -i source.mp4 -c copy sample.mov` |

## Sourcing options

- **Self-record** with phone camera, trim with HandBrake / CapCut / `ffmpeg` to ≤2 MB
- **Pexels / Pixabay CC0 stock** — re-encode to ~640×360 with `ffmpeg -i in.mp4 -vf scale=640:-2 -b:v 500k -c:v libx264 -c:a aac -b:a 64k out.mp4`
- **For `corrupt.mp4`** — take any other fixture and truncate

## Why these specific shapes

- `with-face.mp4` is the happy path — exercises every signal end-to-end
- `no-audio.mp4` exercises Web Audio's missing-audio branch (Plan 03-06)
- `no-face.mp4` matches the **actual** Pakistani creator profile (travel, hotels, cars, bikes — no face on camera per `PROJECT.md`); ensures Phase 4 score doesn't penalise no-face videos
- `corrupt.mp4` exercises the D-10 inline error card with Retry + Skip-analysis link
- `sample.mov` exercises the MOV demux path (different from MP4 internally, even if visually identical)

## What blocks until these land

- Plan 03-04 — ffmpeg metadata + scene + frame tests fail without `with-face.mp4`
- Plan 03-05 — TF.js face/object/motion tests fail without `with-face.mp4` and `no-face.mp4`
- Plan 03-06 — Audio (Meyda) + brightness tests fail without `with-face.mp4` and `no-audio.mp4`
- Plan 03-07 — UI integration smoke test
- Plan 03-08 — A2 (beat threshold) and A3 (silence threshold) calibration must run against real audio; without fixtures, thresholds are guesses

## Resuming Phase 3

Once these 5 files are present:

```
/gsd-execute-phase 3
```

The runner will detect that 03-01 is partial, resume from Task 3 (which becomes a no-op since fixtures are now present), execute Task 4 (smoke test), then continue with Plans 03-02..03-08.
