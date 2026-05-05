# SPIKE-001: Browser Video Analysis Feasibility Study

**Date:** 2026-05-05  
**Status:** IN PROGRESS  
**Goal:** Validate that ffmpeg.wasm + TensorFlow.js + Web Audio API can handle 20 video analysis steps in-browser with real MP4 files. Identify limitations and fallback strategies.

---

## Spike Objective

Test all video analysis steps that are currently implemented in `frontend/src/lib/engine.ts`:

1. **Metadata Extraction** — duration, width, height, aspect ratio
2. **Scene Change Detection** — ffmpeg scene filter output
3. **First 3s Hook Detection** — motion in opening frames
4. **Motion Score** — average motion between frames
5. **Face Detection** — MediaPipe face_detection model
6. **Object & Scene Labels** — TensorFlow.js COCO-SSD model
7. **Audio Presence** — detect audio stream in MP4
8. **Audio Energy** — compute RMS energy from audio samples
9. **Beat Detection** — detect prominent peaks in frequency spectrum
10. **Silence Gap Scanning** — find gaps where audio energy < threshold
11. **Luma Brightness Score** — average Y-channel brightness
12. **Additional signals** — aspect ratio, duration ranges, etc.

---

## Testing Strategy

### Phase 1: Metadata & Audio (Low Risk)
- ffmpeg.wasm: extract metadata, duration, dimensions
- Web Audio API: decode audio from MP4, get sample rate, channel count
- Expected: ✅ Should work reliably

### Phase 2: Computer Vision (Medium Risk)
- ffmpeg.wasm: scene detection via scene filter
- TensorFlow.js: face detection + COCO-SSD inference
- MediaPipe: face_detection model initialization
- Expected: ⚠️ May work but could have performance/initialization issues

### Phase 3: Audio Analysis (Medium Risk)
- Web Audio API: PCM samples, FFT analysis
- Beat detection via frequency analysis
- Silence detection via RMS thresholds
- Expected: ⚠️ Should work but may need tuning for real-world audio

### Phase 4: Integration (High Risk)
- All 12 steps running sequentially on real MP4
- Memory management (tf.tidy, tensor disposal)
- Performance on 5-60MB video files
- Fallback strategy when any step fails
- Expected: ❌ May hit resource limits, need progressive fallback

---

## Test Files & Environment

**Test Video:** 
- Source: User-uploaded MP4 (real test data)
- Formats tested: MP4 (H.264 + AAC typical)
- Sizes: 5MB, 20MB, 60MB (if available)

**Expected Limitations:**
- ffmpeg.wasm: single-thread only, ~20s per video analysis CPU time
- TensorFlow.js: ~500MB working memory for models
- Web Audio API: 44.1kHz or 48kHz audio common
- Browser: Safari < 14 may not support WebCodecs

---

## Success Criteria

- [ ] **Metadata Extraction** works on real MP4 (duration, dimensions)
- [ ] **Scene Detection** produces non-empty output for typical video
- [ ] **Motion Score** computes without crashing
- [ ] **Face Detection** initializes and runs (even if slow)
- [ ] **COCO-SSD** initializes and produces labels
- [ ] **Audio Energy** computes from MP4 audio stream
- [ ] **Beat Detection** identifies peaks without crashing
- [ ] **Silence Gaps** marked correctly (e.g., intro silence)
- [ ] **Luma Score** computes from video frames
- [ ] **Performance** < 60s for typical 20MB video (or timeout gracefully)
- [ ] **Error Handling** clear fallback when any step fails
- [ ] **Memory** no leaks over 3+ consecutive analyses

---

## Findings Template

After each phase, document:
- ✅ **What works** — reliable steps, typical performance
- ⚠️ **What's limited** — slow, memory-hungry, browser compat issues
- ❌ **What fails** — reasons, error messages, partial/no output
- 🔧 **Fallback needed** — skip, mock, backend proxy, etc.

---

## Experiment Checklist

- [ ] Create test HTML with all 12 steps
- [ ] Load real MP4 via file input
- [ ] Log each step: start time, end time, output shape/values
- [ ] Capture errors with full error messages
- [ ] Measure memory before/after each step
- [ ] Test with 3 different video sizes
- [ ] Test with video without audio (edge case)
- [ ] Test with video with only silence (edge case)
- [ ] Document fallback strategy for each failure mode
- [ ] Commit findings to .planning/spikes/FINDINGS-001.md

---

## Risk Assessment

**High Risk Items:**
1. TensorFlow model loading > 500MB total
2. ffmpeg.wasm scene detection on 60MB video hangs
3. Face detection model `solutionPath` initialization fails
4. Web Audio context audio data not extractable from MP4

**Medium Risk Items:**
1. Memory not freed after analysis (tensor leaks)
2. Performance > 60s makes UX unusable
3. Browser compatibility (Safari, Firefox audio handling)

**Low Risk Items:**
1. Basic metadata extraction
2. Frame canvas drawing
3. Luma brightness computation

---

## Timeline

- **Setup** (5 min): Create test page, load real MP4
- **Phase 1 Testing** (10 min): Metadata + audio basics
- **Phase 2 Testing** (15 min): Computer vision (face, COCO-SSD)
- **Phase 3 Testing** (10 min): Audio analysis (energy, beats)
- **Integration Testing** (15 min): All steps together, error recovery
- **Documentation** (10 min): Write FINDINGS-001.md

**Total:** ~65 minutes

---

## Next Steps

1. Create `spike-test.html` with interactive test controls
2. Load real MP4 from user file input
3. Run all 12 steps, log results to console
4. Document findings in FINDINGS-001.md
5. Commit to git with SPIKE-001 reference
6. Update MANIFEST.md with spike results

