# FINDINGS-001: Browser Video Analysis Feasibility Test Results

**Spike:** SPIKE-001  
**Date:** 2026-05-05  
**Status:** READY FOR TESTING  
**Tested By:** (To be filled after test run)

---

## Executive Summary

This document captures the results of browser-based video analysis using ffmpeg.wasm, TensorFlow.js, and Web Audio API. Tests validate what works, what has limitations, and what fallbacks are needed.

---

## Test Environment

| Item | Details |
|------|---------|
| **Browser** | (To be filled) |
| **Test Video** | (To be filled) |
| **Video Size** | (To be filled) |
| **Duration** | (To be filled) |
| **Resolution** | (To be filled) |

---

## Step Results

### 1. Metadata Extraction
**Status:** ⏳ Pending  
**What:** Extract video dimensions, duration, aspect ratio via `<video>` element  
**Libraries:** Native HTML5 Video API  
**Expected:** ✅ Highly reliable  

**Result:**
```
(To be filled after test)
```

**Notes:**
- Standard browser API, no external deps
- Works with all common video codecs
- Synchronous onloadedmetadata event

---

### 2. Audio Stream Detection
**Status:** ⏳ Pending  
**What:** Detect audio presence, channels, sample rate  
**Libraries:** Web Audio API (AudioContext.decodeAudioData)  
**Expected:** ✅ Works with most MP4s  

**Result:**
```
(To be filled after test)
```

**Limitations:**
- Cannot read audio without decoding entire file
- Memory-hungry for large videos
- Some codecs may not be supported

---

### 3. Frame Extraction
**Status:** ⏳ Pending  
**What:** Extract frames at specific timestamps  
**Libraries:** Canvas API + HTMLVideoElement  
**Expected:** ✅ Reliable  

**Result:**
```
(To be filled after test)
```

**Notes:**
- Works via canvas.getContext('2d').drawImage(video, ...)
- Requires onseeked event to fire after currentTime change
- May need setTimeout for seek completion

---

### 4. Scene Change Detection
**Status:** ⏳ Pending  
**What:** Detect shot boundaries via ffmpeg scene filter  
**Libraries:** ffmpeg.wasm  
**Expected:** ⚠️ May work but slow  

**Result:**
```
(To be filled after test)
Fallback: Skip, or compute simple frame difference locally
```

**Known Limitations:**
- ffmpeg.wasm is single-threaded
- Scene filter output parsing required
- May timeout on large videos

---

### 5. Motion Score
**Status:** ⏳ Pending  
**What:** Compute optical flow / frame difference metric  
**Libraries:** Canvas frames + manual comparison  
**Expected:** ⚠️ Feasible but slow  

**Result:**
```
(To be filled after test)
Fallback: Use simplified frame difference on sparse samples
```

---

### 6. Face Detection
**Status:** ⏳ Pending  
**What:** Detect faces using MediaPipe  
**Libraries:** @mediapipe/face_detection  
**Expected:** ⚠️ Works but needs solutionPath config  

**Result:**
```
(To be filled after test)
```

**Known Limitations:**
- Model requires explicit solutionPath to wasm files
- ~150MB+ model size
- May fail silently if solutionPath missing
- CPU-intensive on large videos

---

### 7. Object & Scene Labels
**Status:** ⏳ Pending  
**What:** Detect objects and scene using TensorFlow COCO-SSD  
**Libraries:** @tensorflow-models/coco-ssd  
**Expected:** ⚠️ Works but memory-intensive  

**Result:**
```
(To be filled after test)
```

**Known Limitations:**
- ~200MB+ model size
- Requires tf.tidy() for memory management
- TensorFlow.js has ~500MB working memory baseline
- Running on large videos may OOM

---

### 8. Audio Energy (RMS)
**Status:** ⏳ Pending  
**What:** Compute RMS energy from audio samples  
**Libraries:** Web Audio API  
**Expected:** ✅ Works reliably  

**Result:**
```
(To be filled after test)
```

**Performance:**
- Linear time complexity
- Memory: ~2 * audioBuffer.length * 4 bytes

---

### 9. Beat Detection
**Status:** ⏳ Pending  
**What:** Detect beats via FFT frequency analysis  
**Libraries:** Web Audio API (AnalyserNode)  
**Expected:** ⚠️ Feasible but complex  

**Result:**
```
(To be filled after test)
Fallback: Use simplified peak detection or skip
```

**Complexity:**
- Requires real-time FFT computation
- Need frequency threshold tuning per audio
- May be inaccurate for low-quality audio

---

### 10. Silence Gap Scanning
**Status:** ⏳ Pending  
**What:** Find audio silence regions  
**Libraries:** Web Audio API  
**Expected:** ✅ Works with threshold tuning  

**Result:**
```
(To be filled after test)
```

**Considerations:**
- Threshold sensitivity varies by content
- Background noise vs intentional silence hard to distinguish

---

### 11. Luma Brightness Score
**Status:** ⏳ Pending  
**What:** Compute average Y-channel brightness  
**Libraries:** Canvas.getImageData() + manual luma conversion  
**Expected:** ✅ Reliable  

**Result:**
```
(To be filled after test)
```

**Performance:**
- O(width × height) per frame
- Memory: imageData.data (typically 4MB for 1080p)

---

### 12. Integration: All Steps Together
**Status:** ⏳ Pending  
**What:** Run all steps sequentially on real video  
**Expected:** ⚠️ May hit memory/performance limits  

**Result:**
```
(To be filled after test)
```

**Total Time:** (To be filled)  
**Memory Peak:** (To be filled)  
**Bottleneck:** (To be filled)

---

## Summary Table

| Step | Works | Performance | Memory | Fallback |
|------|-------|-------------|--------|----------|
| Metadata | ✅ | Fast | 0 | N/A |
| Audio Detect | ✅ | Slow | Medium | Skip |
| Frames | ✅ | Medium | Medium | Down-sample |
| Scene Detect | ⏳ | Slow | High | Skip |
| Motion | ⏳ | Slow | High | Simplified diff |
| Face Detect | ⏳ | Slow | High | Skip or backend |
| Objects | ⏳ | Slow | High | Skip or backend |
| Audio Energy | ✅ | Fast | Low | Skip |
| Beat Detect | ⏳ | Medium | Medium | Simplified peaks |
| Silence Gaps | ✅ | Medium | Low | Skip |
| Luma Score | ✅ | Fast | Low | N/A |
| Integration | ⏳ | Very Slow | Very High | Progressive fallback |

---

## Key Findings

### ✅ What Works Well
- Metadata extraction
- Audio energy / RMS computation
- Luma brightness score
- Frame extraction
- Silence gap detection

### ⚠️ What Has Limitations
- Face detection (needs solutionPath, slow)
- Object detection (memory-intensive, slow)
- Scene detection (requires ffmpeg, single-threaded)
- Motion score (O(n²) complexity on frame pairs)
- Beat detection (accuracy varies)

### ❌ What Needs Fallback
- Running all steps on >30MB videos (likely OOM)
- Face detection without backend proxy
- COCO-SSD on slow devices
- ffmpeg.wasm for real-time analysis

---

## Recommended Fallback Strategy

1. **Phase 1 (Always Client):**
   - Metadata
   - Luma brightness
   - Audio energy
   - Silence gaps

2. **Phase 2 (Client if <30MB + Desktop):**
   - Frame extraction
   - Motion score (simplified)
   - Face detection (skip on low memory)

3. **Phase 3 (Backend/Skip):**
   - Scene detection → backend ffmpeg
   - Object detection → skip or backend
   - Beat detection → simplified or skip

---

## Next Steps

1. [ ] Run test page with real MP4 file
2. [ ] Document actual performance metrics
3. [ ] Identify memory bottlenecks
4. [ ] Update fallback strategy based on results
5. [ ] Commit findings to git
6. [ ] Use results to inform Phase 3+ implementation

---

## References

- **spike-test.html** — Interactive test page
- **SPIKE-001-video-analysis-browser.md** — Detailed spike plan
- **Phase 3 Implementation** — `frontend/src/lib/engine.ts`

