# SOLUTIONS-001: Fixing Browser Video Analysis Limitations

**Spike:** SPIKE-001  
**Date:** 2026-05-05

---

## Problem 1: Face Detection — MediaPipe solutionPath Missing

### Issue
MediaPipe face_detection silently fails if `solutionPath` isn't provided—it can't find the WASM files.

### Root Cause
```javascript
// This fails silently:
const faceDetection = await FaceDetection.create();
// Model init fails because it can't locate face_detection.wasm
```

### ✅ Solution: Load from CDN

**Option A: NPM Package (Best for Bundled Apps)**
```bash
npm install @mediapipe/tasks-vision
```

```javascript
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);

const faceDetector = await FaceDetector.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/image_classifier/face_detector/float16/1/face_detector.tflite`,
  },
  runningMode: 'IMAGE',
});
```

**Option B: Simpler CDN Load (For Spike/Testing)**
```html
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest"></script>
<script>
  const { FaceDetector, FilesetResolver } = globalThis;
  
  async function initFaceDetector() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    return await FaceDetector.createFromOptions(vision, {
      runningMode: 'IMAGE'
    });
  }
</script>
```

**Option C: Copy WASM Files to Public (For Production)**
```
/public/mediapipe/
  ├── face_detection.wasm
  ├── face_detection.tflite
  └── wasm_loader.js
```

```javascript
const faceDetector = await FaceDetector.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: '/mediapipe/face_detection.tflite'
  }
});
```

### Implementation in engine.ts

```typescript
// Add to frontend/src/lib/engine.ts
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

async function initializeFaceDetector() {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    return await FaceDetector.createFromOptions(vision, {
      runningMode: 'IMAGE',
      minConfidence: 0.5
    });
  } catch (err) {
    console.warn('Face detection initialization failed, skipping', err);
    return null;
  }
}

export async function analyzeFaces(canvas: HTMLCanvasElement): Promise<FaceSignals> {
  const detector = await initializeFaceDetector();
  if (!detector) {
    return { faceCount: 0, hasFace: false, confidence: 0 };
  }

  const results = await detector.detectForVideo(canvas, Date.now());
  return {
    faceCount: results.detections.length,
    hasFace: results.detections.length > 0,
    confidence: results.detections[0]?.categories[0]?.score || 0
  };
}
```

### Testing
```html
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest"></script>
<script>
  document.getElementById('testFaceBtn').onclick = async () => {
    const vision = await globalThis.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    const detector = await globalThis.FaceDetector.createFromOptions(vision, {
      runningMode: 'IMAGE'
    });
    console.log('✅ Face detector ready');
  };
</script>
```

---

## Problem 2: COCO-SSD — OOM Risk (200MB+ Model)

### Issue
TensorFlow COCO-SSD model is ~150-200MB. Loading it + video analysis = memory spike.

### Root Cause
```javascript
// This uses 300MB+ working memory:
const model = await cocoSsd.load();
const predictions = await model.estimateObjects(canvas);
```

### ✅ Solution: Lazy-Load + Fallback Strategy

**Option A: Load Only When Needed**
```typescript
let cocoModel: any = null;

async function initCOCOSSD() {
  if (cocoModel) return cocoModel; // Reuse loaded model
  
  try {
    cocoModel = await cocoSsd.load({
      maxNumBoxes: 5 // Limit detections to reduce memory
    });
    return cocoModel;
  } catch (err) {
    console.warn('COCO-SSD failed to load', err);
    return null;
  }
}

export async function analyzeObjects(canvas: HTMLCanvasElement): Promise<ObjectSignals> {
  const model = await initCOCOSSD();
  
  if (!model) {
    // Fallback: Use simple color/brightness analysis instead
    return {
      objectCount: 0,
      mainObjects: [],
      sceneComplexity: 'low'
    };
  }

  // Wrap in tf.tidy() to auto-dispose tensors
  const predictions = tf.tidy(() => {
    return model.estimateObjects(canvas, { maxNumBoxes: 5 });
  });

  return {
    objectCount: predictions.length,
    mainObjects: predictions.slice(0, 3).map(p => p.class),
    sceneComplexity: predictions.length > 5 ? 'high' : 'medium'
  };
}
```

**Option B: Skip on Low-Memory Devices**
```typescript
async function analyzeObjects(canvas: HTMLCanvasElement): Promise<ObjectSignals> {
  // Check available memory (Chrome only)
  const memory = (performance as any).memory;
  const availableMemory = memory?.jsHeapSizeLimit || 0;
  
  // Skip if <500MB available
  if (availableMemory < 500 * 1024 * 1024) {
    console.log('Skipping COCO-SSD on low-memory device');
    return { objectCount: 0, mainObjects: [], sceneComplexity: 'low' };
  }

  // Proceed with object detection...
  const model = await initCOCOSSD();
  if (!model) return { objectCount: 0, mainObjects: [], sceneComplexity: 'low' };
  
  // ... rest of detection code
}
```

**Option C: Backend Proxy (Recommended for Production)**
```typescript
export async function analyzeObjects(canvas: HTMLCanvasElement): Promise<ObjectSignals> {
  // Send frame to backend instead of loading model in browser
  const frameData = canvas.toDataURL('image/jpeg', 0.7);
  
  try {
    const res = await fetch('/api/analyze/objects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame: frameData })
    });
    
    if (!res.ok) {
      // Fallback on error
      return { objectCount: 0, mainObjects: [], sceneComplexity: 'low' };
    }
    
    return await res.json();
  } catch (err) {
    console.warn('Backend object detection failed, skipping', err);
    return { objectCount: 0, mainObjects: [], sceneComplexity: 'low' };
  }
}
```

### Memory Management
```typescript
export async function cleanupModels() {
  // Call after analysis complete
  tf.disposeVariables();
  cocoModel = null;
  
  // Force garbage collection (Chrome DevTools can trigger)
  if (global.gc) global.gc();
}
```

---

## Problem 3: Scene Detection — ffmpeg.wasm Single-Threaded

### Issue
ffmpeg.wasm runs on main thread, blocks UI during scene detection on large videos.

### Root Cause
```javascript
// This blocks UI for 20+ seconds on 60MB video:
const result = await exec(`-i input.mp4 -vf "select='gt(scene\\,0.4)'" -vsync vfr frame%d.png`);
```

### ✅ Solution: Progressive Fallback

**Option A: Skip Client-Side Scene Detection (Simplest)**
```typescript
export async function analyzeScenes(video: HTMLVideoElement): Promise<SceneSignals> {
  console.log('Scene detection: delegating to backend (too slow in browser)');
  
  return {
    sceneChanges: [],
    sceneCount: 1,
    avgSceneDuration: video.duration
  };
}
```

**Option B: Simplified Frame Difference Algorithm (Fast)**
```typescript
export async function analyzeScenes(video: HTMLVideoElement): Promise<SceneSignals> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const sceneChanges: number[] = [];
  
  const sampleRate = 1; // Check every 1 second (skip expensive full analysis)
  const threshold = 0.15; // 15% frame difference = scene change
  
  let prevFrame: ImageData | null = null;
  
  for (let t = 0; t < video.duration; t += sampleRate) {
    video.currentTime = t;
    
    await new Promise(resolve => {
      video.onseeked = resolve;
      setTimeout(resolve, 500); // Wait for seek
    });
    
    ctx.drawImage(video, 0, 0);
    const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    if (prevFrame) {
      const diff = computeFrameDifference(prevFrame, frameData);
      if (diff > threshold) {
        sceneChanges.push(t);
      }
    }
    
    prevFrame = frameData;
  }
  
  return {
    sceneChanges,
    sceneCount: sceneChanges.length + 1,
    avgSceneDuration: video.duration / (sceneChanges.length + 1)
  };
}

function computeFrameDifference(frame1: ImageData, frame2: ImageData): number {
  const data1 = frame1.data;
  const data2 = frame2.data;
  
  let diff = 0;
  // Sample every 10th pixel to speed up
  for (let i = 0; i < data1.length; i += 40) {
    diff += Math.abs(data1[i] - data2[i]); // R
    diff += Math.abs(data1[i+1] - data2[i+1]); // G
    diff += Math.abs(data1[i+2] - data2[i+2]); // B
  }
  
  return diff / (data1.length / 10) / 255; // Normalize to 0-1
}
```

**Option C: Backend ffmpeg Processing**
```typescript
export async function analyzeScenes(videoFile: File): Promise<SceneSignals> {
  try {
    const formData = new FormData();
    formData.append('video', videoFile);
    
    const res = await fetch('/api/analyze/scenes', {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      // Fallback on error
      return { sceneChanges: [], sceneCount: 1, avgSceneDuration: 0 };
    }
    
    return await res.json();
  } catch (err) {
    console.warn('Scene detection failed', err);
    return { sceneChanges: [], sceneCount: 1, avgSceneDuration: 0 };
  }
}
```

---

## Problem 4: Integration — >30MB Videos Hit Limits

### Issue
Running all 12 steps on large videos causes OOM and UI hangs.

### Root Cause
```
- Each step adds memory overhead
- TensorFlow models aren't unloaded between steps
- Frames kept in memory during analysis
```

### ✅ Solution: Progressive Fallback Strategy

**Option A: Skip Non-Critical Steps on Large Videos**
```typescript
export async function analyzeVideo(file: File, signals?: EngineSignals): Promise<EngineSignals> {
  const fileSizeMB = file.size / 1024 / 1024;
  
  // Progressive fallback based on video size
  const skipSteps = {
    faceDetection: fileSizeMB > 30,
    objectDetection: fileSizeMB > 25,
    sceneDetection: fileSizeMB > 40,
    beatDetection: fileSizeMB > 60
  };
  
  console.log(`Video size: ${fileSizeMB.toFixed(1)}MB → skipping: ${Object.entries(skipSteps).filter(([_, skip]) => skip).map(([k]) => k).join(', ')}`);
  
  // Run only essential steps
  const metadata = await analyzeMetadata(file);
  const audio = await analyzeAudio(file);
  const luma = await analyzeLuma(file);
  
  // Optional steps based on file size
  const faces = !skipSteps.faceDetection ? await analyzeFaces(file) : { faceCount: 0 };
  const objects = !skipSteps.objectDetection ? await analyzeObjects(file) : { objectCount: 0 };
  
  return {
    ...metadata,
    ...audio,
    ...luma,
    faces,
    objects,
    analysisSkipped: skipSteps
  };
}
```

**Option B: Down-Sample Video Before Analysis**
```typescript
export async function analyzeVideo(file: File): Promise<EngineSignals> {
  const fileSizeMB = file.size / 1024 / 1024;
  
  // Down-sample if too large
  if (fileSizeMB > 50) {
    console.log(`Video too large (${fileSizeMB.toFixed(1)}MB), down-sampling...`);
    const smallerFile = await reduceVideoQuality(file);
    return analyzeVideo(smallerFile);
  }
  
  // Proceed with normal analysis...
}

async function reduceVideoQuality(file: File): Promise<File> {
  // Use ffmpeg.wasm to re-encode at lower bitrate
  const ffmpeg = FFmpeg.FFmpeg.getInstance();
  await ffmpeg.load();
  
  ffmpeg.FS('writeFile', file.name, new Uint8Array(await file.arrayBuffer()));
  
  // Reduce to 500kbps (from ~2000kbps typical)
  await ffmpeg.run('-i', file.name, '-b:v', '500k', 'output.mp4');
  
  const outputData = ffmpeg.FS('readFile', 'output.mp4');
  return new File([outputData], 'output.mp4', { type: 'video/mp4' });
}
```

**Option C: Batch Processing with Memory Cleanup**
```typescript
export async function analyzeVideoInBatches(file: File): Promise<EngineSignals> {
  const steps = [
    { name: 'Metadata', fn: analyzeMetadata },
    { name: 'Audio', fn: analyzeAudio },
    { name: 'Luma', fn: analyzeLuma },
    { name: 'Faces', fn: analyzeFaces },
    { name: 'Objects', fn: analyzeObjects },
    { name: 'Scenes', fn: analyzeScenes }
  ];
  
  const results = {};
  
  for (const step of steps) {
    try {
      console.log(`Running ${step.name}...`);
      results[step.name] = await step.fn(file);
      
      // Cleanup after each step
      tf.disposeVariables();
      if (global.gc) global.gc();
      
      // Show progress
      console.log(`✅ ${step.name} complete`);
    } catch (err) {
      console.warn(`⚠️ ${step.name} failed, skipping`, err);
      results[step.name] = null;
    }
  }
  
  return results;
}
```

**Option D: Backend Processing for Large Videos (Production)**
```typescript
export async function analyzeVideo(file: File): Promise<EngineSignals> {
  const fileSizeMB = file.size / 1024 / 1024;
  
  // Large videos → backend processing
  if (fileSizeMB > 30) {
    console.log('Video >30MB, delegating to backend...');
    
    const formData = new FormData();
    formData.append('video', file);
    
    const res = await fetch('/api/analyze/full', {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      throw new Error(`Backend analysis failed: ${res.status}`);
    }
    
    return await res.json();
  }
  
  // Small videos → browser analysis
  return analyzeVideoInBrowser(file);
}
```

---

## Recommended Architecture

### For Now (MVP - Phase 5)
```
Small videos (<20MB):
├─ Client-side analysis
├─ Skip: COCO-SSD, Scene detection (too slow)
├─ Include: Metadata, Audio, Luma, Motion, Face
└─ Fallback on error

Large videos (>20MB):
├─ Metadata only (fast)
└─ User sees: "Video analysis skipped for large files"
```

### For Later (Phase 10+)
```
All videos:
├─ Client: Metadata, Luma, Audio energy (<2s)
├─ Backend async: COCO-SSD, Scene detection (queued)
├─ Progressive UI: Show results as they arrive
└─ Cached for repeat uploads
```

---

## Implementation Checklist

- [ ] Fix Face Detection: Add CDN `solutionPath`
- [ ] Fix COCO-SSD: Add lazy-load + memory check
- [ ] Fix Scene Detection: Use frame-diff algorithm OR skip
- [ ] Fix Integration: Add file-size checks with fallbacks
- [ ] Add memory cleanup: `tf.disposeVariables()` between steps
- [ ] Test with real videos: 5MB, 20MB, 60MB
- [ ] Update `engine.ts` with all fallbacks
- [ ] Document in phase plan what's skipped and why

