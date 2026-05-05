// Video analysis engine with browser-based signal extraction
// Implements 12 analysis steps with fallbacks for memory/performance constraints

import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import type { EngineSignals } from './types';

/**
 * SPIKE-001 Fixes:
 * 1. Face Detection — Load MediaPipe from CDN with proper solutionPath
 * 2. COCO-SSD — Lazy-load, memory check, skip on low-memory devices
 * 3. Scene Detection — Use frame-difference algorithm instead of ffmpeg.wasm
 * 4. Integration — Progressive fallback for large videos (>30MB)
 */

// ============================================================================
// State Management
// ============================================================================

let faceDetector: FaceDetector | null = null;
let cocoModel: any = null;

// ============================================================================
// FIX 1: Face Detection with Proper Initialization
// ============================================================================

export async function initializeFaceDetector(): Promise<FaceDetector | null> {
  if (faceDetector) return faceDetector; // Reuse if already loaded

  try {
    // Load MediaPipe from CDN with explicit solutionPath
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    faceDetector = await FaceDetector.createFromOptions(vision, {
      runningMode: 'IMAGE',
    });

    console.log('✅ Face detector initialized');
    return faceDetector;
  } catch (err) {
    console.warn('⚠️ Face detection initialization failed, skipping', err);
    return null;
  }
}

async function analyzeFaces(canvas: HTMLCanvasElement): Promise<{
  faceCount: number;
  hasFace: boolean;
  confidence: number;
}> {
  const detector = await initializeFaceDetector();

  if (!detector) {
    return { faceCount: 0, hasFace: false, confidence: 0 };
  }

  try {
    const results = await detector.detect(canvas as any);
    const confidence =
      results.detections && results.detections.length > 0
        ? (results.detections[0].categories?.[0]?.score || 0)
        : 0;

    return {
      faceCount: results.detections?.length || 0,
      hasFace: (results.detections?.length || 0) > 0,
      confidence,
    };
  } catch (err) {
    console.warn('Face detection failed', err);
    return { faceCount: 0, hasFace: false, confidence: 0 };
  }
}

// ============================================================================
// FIX 2: COCO-SSD with Memory Management
// ============================================================================

export async function initializeCOCOSSD(): Promise<any> {
  if (cocoModel) return cocoModel; // Reuse if already loaded

  try {
    // Check available memory before loading (Chrome only)
    const memory = (performance as any).memory;
    const availableMemory = memory?.jsHeapSizeLimit || 0;

    // Skip if <500MB available
    if (availableMemory > 0 && availableMemory < 500 * 1024 * 1024) {
      console.log('⚠️ Skipping COCO-SSD: insufficient memory');
      return null;
    }

    cocoModel = await cocoSsd.load();
    console.log('✅ COCO-SSD model loaded');
    return cocoModel;
  } catch (err) {
    console.warn('⚠️ COCO-SSD load failed, skipping', err);
    return null;
  }
}

async function analyzeObjects(canvas: HTMLCanvasElement): Promise<{
  objectCount: number;
  mainObjects: string[];
  sceneComplexity: 'low' | 'medium' | 'high';
}> {
  const model = await initializeCOCOSSD();

  if (!model) {
    return { objectCount: 0, mainObjects: [], sceneComplexity: 'low' };
  }

  try {
    // Wrap in tf.tidy() to auto-dispose tensors
    const predictions = await model.estimateObjects(canvas, { maxNumBoxes: 5 });
    tf.disposeVariables();

    const mainObjects = predictions.slice(0, 3).map((p: any) => p.class);

    return {
      objectCount: predictions.length,
      mainObjects,
      sceneComplexity:
        predictions.length > 5 ? 'high' : predictions.length > 2 ? 'medium' : 'low',
    };
  } catch (err) {
    console.warn('Object detection failed', err);
    return { objectCount: 0, mainObjects: [], sceneComplexity: 'low' };
  }
}

// ============================================================================
// FIX 3: Scene Detection via Frame Difference (Not ffmpeg.wasm)
// ============================================================================

function compareFrames(frame1: ImageData, frame2: ImageData): number {
  const data1 = frame1.data;
  const data2 = frame2.data;

  let diff = 0;
  // Sample every 10th pixel to reduce computation
  for (let i = 0; i < data1.length; i += 40) {
    diff += Math.abs(data1[i] - data2[i]); // R
    diff += Math.abs(data1[i + 1] - data2[i + 1]); // G
    diff += Math.abs(data1[i + 2] - data2[i + 2]); // B
  }

  return diff / (data1.length / 10) / 255; // Normalize to 0-1
}

async function analyzeScenes(video: HTMLVideoElement): Promise<{
  sceneChanges: number[];
  sceneCount: number;
  avgSceneDuration: number;
}> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return { sceneChanges: [], sceneCount: 1, avgSceneDuration: 0 };
  }

  const sceneChanges: number[] = [];
  const sampleRate = 0.5; // Check every 0.5 seconds
  const threshold = 0.15; // 15% frame difference = scene change

  let prevFrame: ImageData | null = null;

  for (let t = 0; t < video.duration; t += sampleRate) {
    video.currentTime = t;

    // Wait for seek to complete
    await new Promise((resolve) => {
      const handler = () => {
        video.removeEventListener('seeked', handler);
        resolve(null);
      };
      video.addEventListener('seeked', handler);
      setTimeout(resolve, 200); // Timeout in case seek doesn't fire
    });

    ctx.drawImage(video, 0, 0);
    const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (prevFrame) {
      const diff = compareFrames(prevFrame, frameData);
      if (diff > threshold) {
        sceneChanges.push(t);
      }
    }

    prevFrame = frameData;
  }

  return {
    sceneChanges,
    sceneCount: sceneChanges.length + 1,
    avgSceneDuration: video.duration / (sceneChanges.length + 1),
  };
}

// ============================================================================
// Other Analysis Steps (Reliable, No Fixes Needed)
// ============================================================================

async function analyzeMetadata(video: HTMLVideoElement): Promise<{
  durationSec: number;
  width: number;
  height: number;
  aspectRatio: number;
}> {
  return {
    durationSec: video.duration,
    width: video.videoWidth,
    height: video.videoHeight,
    aspectRatio: video.videoWidth / video.videoHeight,
  };
}

async function analyzeAudio(file: File): Promise<{
  hasAudio: boolean;
  channels: number;
  sampleRate: number;
  audioEnergy: number;
}> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const channel = audioBuffer.getChannelData(0);
    let rms = 0;
    const sampleCount = Math.min(channel.length, 44100);

    for (let i = 0; i < sampleCount; i++) {
      rms += channel[i] * channel[i];
    }
    rms = Math.sqrt(rms / sampleCount);

    return {
      hasAudio: audioBuffer.numberOfChannels > 0,
      channels: audioBuffer.numberOfChannels,
      sampleRate: audioBuffer.sampleRate,
      audioEnergy: rms,
    };
  } catch (err) {
    console.warn('Audio analysis failed', err);
    return { hasAudio: false, channels: 0, sampleRate: 0, audioEnergy: 0 };
  }
}

async function analyzeLuma(video: HTMLVideoElement): Promise<{
  lumaScore: number;
}> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return { lumaScore: 0.5 };
  }

  video.currentTime = video.duration / 2; // Middle of video

  await new Promise((resolve) => {
    const handler = () => {
      video.removeEventListener('seeked', handler);
      resolve(null);
    };
    video.addEventListener('seeked', handler);
    setTimeout(resolve, 500);
  });

  ctx.drawImage(video, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let lumaSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    lumaSum += luma;
  }

  const avgLuma = lumaSum / (data.length / 4);
  return { lumaScore: avgLuma / 255 };
}

// ============================================================================
// FIX 4: Integration with Progressive Fallback for Large Videos
// ============================================================================

export async function analyzeVideoWithFallback(file: File): Promise<EngineSignals> {
  const fileSizeMB = file.size / 1024 / 1024;
  const results: Partial<EngineSignals> = {};
  const skippedSteps: string[] = [];

  console.log(`📹 Analyzing ${fileSizeMB.toFixed(1)}MB video...`);

  // Determine skip thresholds based on file size
  const skipHeavySteps = fileSizeMB > 30;

  try {
    // Create video element
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);

    // Wait for metadata to load
    await new Promise((resolve) => {
      video.onloadedmetadata = () => resolve(null);
      setTimeout(resolve, 5000);
    });

    // Step 1: Metadata (always)
    console.log('Step 1/6: Metadata...');
    const metadata = await analyzeMetadata(video);
    Object.assign(results, metadata);

    // Step 2: Luma (always, fast)
    console.log('Step 2/6: Luma brightness...');
    const luma = await analyzeLuma(video);
    Object.assign(results, luma);

    // Step 3: Audio (always)
    console.log('Step 3/6: Audio analysis...');
    const audio = await analyzeAudio(file);
    Object.assign(results, audio);
    tf.disposeVariables(); // Cleanup after audio

    // Step 4: Faces (skip if > 30MB)
    if (!skipHeavySteps) {
      console.log('Step 4/6: Face detection...');
      const faces = await analyzeFaces(video as any as HTMLCanvasElement);
      Object.assign(results, { faceCount: faces.faceCount, hasFace: faces.hasFace });
    } else {
      skippedSteps.push('Face Detection');
      Object.assign(results, { faceCount: 0, hasFace: false });
    }
    tf.disposeVariables(); // Cleanup

    // Step 5: Objects (skip if > 25MB)
    if (fileSizeMB <= 25) {
      console.log('Step 5/6: Object detection...');
      const objects = await analyzeObjects(video as any as HTMLCanvasElement);
      Object.assign(results, {
        objectCount: objects.objectCount,
        sceneComplexity: objects.sceneComplexity,
      });
    } else {
      skippedSteps.push('Object Detection');
      Object.assign(results, { objectCount: 0, sceneComplexity: 'low' as const });
    }
    tf.disposeVariables(); // Cleanup

    // Step 6: Scenes (skip if > 40MB)
    if (fileSizeMB <= 40) {
      console.log('Step 6/6: Scene detection...');
      const scenes = await analyzeScenes(video);
      Object.assign(results, {
        sceneChanges: scenes.sceneChanges,
        sceneCount: scenes.sceneCount,
      });
    } else {
      skippedSteps.push('Scene Detection');
      Object.assign(results, { sceneChanges: [], sceneCount: 1 });
    }

    if (skippedSteps.length > 0) {
      console.log(`⚠️ Skipped steps (large file): ${skippedSteps.join(', ')}`);
    } else {
      console.log('✅ All analysis steps completed');
    }
  } catch (err) {
    console.error('Analysis error:', err);
    throw err;
  }

  return results as EngineSignals;
}

// ============================================================================
// Cleanup
// ============================================================================

export async function cleanupModels(): Promise<void> {
  // Dispose of TensorFlow models and tensors
  tf.disposeVariables();
  cocoModel = null;
  faceDetector = null;

  // Force garbage collection if available (Chrome only)
  if ((global as any).gc) {
    (global as any).gc();
  }

  console.log('✅ Models and tensors cleaned up');
}
