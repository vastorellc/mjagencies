// In-browser video analysis engine — Phase 3
// Plans 03-02 (skeleton), 03-04 (ffmpeg), 03-05 (TF.js), 03-06 (audio)

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'
import * as faceDetection from '@tensorflow-models/face-detection'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import Meyda from 'meyda'
import type { EngineSignals, AnalyseOptions, EnginePreflight, ProgressStep } from './types'

// ============================================================================
// PREFLIGHT — ANALYSIS-09 / D-11
// ============================================================================
export function canRunEngine(): EnginePreflight {
  if (typeof WebAssembly === 'undefined') {
    return { ok: false, reason: 'WebAssembly not available in this browser' }
  }
  if (typeof SharedArrayBuffer === 'undefined') {
    return { ok: false, reason: 'SharedArrayBuffer required (cross-origin isolation missing)' }
  }
  if (typeof window !== 'undefined' && window.crossOriginIsolated !== true) {
    return { ok: false, reason: 'Cross-origin isolation not active — COOP/COEP misconfig' }
  }
  return { ok: true }
}

// ============================================================================
// FFMPEG SINGLETON
// ============================================================================
// Served from public/ — avoids CDN dependency (network-unreliable environments)
const FFMPEG_CORE_JS_URL = '/ffmpeg-core.js'
const FFMPEG_CORE_WASM_URL = '/ffmpeg-core.wasm'
let ffmpegInstance: FFmpeg | null = null
let ffmpegLoadPromise: Promise<FFmpeg> | null = null

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Analysis aborted', 'AbortError')
  }
}

function resetFFmpegSingleton(): void {
  ffmpegInstance = null
  ffmpegLoadPromise = null
}

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  if (ffmpegLoadPromise) return ffmpegLoadPromise
  const pre = canRunEngine()
  if (!pre.ok) throw new Error(`ffmpeg unavailable: ${pre.reason}`)
  ffmpegLoadPromise = (async () => {
    const ff = new FFmpeg()
    await ff.load({
      coreURL: await toBlobURL(FFMPEG_CORE_JS_URL, 'text/javascript'),
      wasmURL: await toBlobURL(FFMPEG_CORE_WASM_URL, 'application/wasm'),
    })
    ffmpegInstance = ff
    return ff
  })()
  return ffmpegLoadPromise
}

// ============================================================================
// TF.JS MODEL SINGLETONS
// ============================================================================
let faceDetectorInstance: faceDetection.FaceDetector | null = null
let faceDetectorPromise: Promise<faceDetection.FaceDetector | null> | null = null
let cocoDetectorInstance: cocoSsd.ObjectDetection | null = null
let cocoDetectorPromise: Promise<cocoSsd.ObjectDetection | null> | null = null

async function getFaceDetector(): Promise<faceDetection.FaceDetector | null> {
  if (faceDetectorInstance) return faceDetectorInstance
  if (faceDetectorPromise) return faceDetectorPromise
  faceDetectorPromise = (async () => {
    try {
      await tf.ready()
      const detector = await faceDetection.createDetector(
        faceDetection.SupportedModels.MediaPipeFaceDetector,
        {
          runtime: 'mediapipe',
          solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection',
          modelType: 'short',
        },
      )
      faceDetectorInstance = detector
      return detector
    } catch {
      return null
    }
  })()
  return faceDetectorPromise
}

async function getCocoDetector(): Promise<cocoSsd.ObjectDetection | null> {
  if (cocoDetectorInstance) return cocoDetectorInstance
  if (cocoDetectorPromise) return cocoDetectorPromise
  cocoDetectorPromise = (async () => {
    try {
      await tf.ready()
      const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
      cocoDetectorInstance = model
      return model
    } catch {
      return null
    }
  })()
  return cocoDetectorPromise
}

// ============================================================================
// WARMUP
// ============================================================================
export async function warmup(): Promise<void> {
  await Promise.allSettled([getFFmpeg(), getFaceDetector(), getCocoDetector()])
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

interface ParsedMeta {
  durationSec: number
  width: number
  height: number
  aspectRatio: number
  fps: number
  bitrate: number
  hasAudio: boolean
  totalFrames: number
}

function parseRationalFps(rate: unknown): number {
  if (typeof rate !== 'string' || !rate.includes('/')) return 0
  const [num, den] = rate.split('/').map(Number)
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0
  return num / den
}

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : 0 }
  return 0
}

function parseMeta(probe: unknown): ParsedMeta {
  const empty: ParsedMeta = { durationSec: 0, width: 0, height: 0, aspectRatio: 0, fps: 0, bitrate: 0, hasAudio: false, totalFrames: 0 }
  if (!probe || typeof probe !== 'object') return empty
  const p = probe as { streams?: unknown[]; format?: { duration?: unknown; bit_rate?: unknown } }
  const streams = Array.isArray(p.streams) ? p.streams : []
  const video = streams.find((s) => (s as { codec_type?: string }).codec_type === 'video') as
    | { width?: unknown; height?: unknown; r_frame_rate?: unknown; nb_frames?: unknown; duration?: unknown; bit_rate?: unknown }
    | undefined
  const audio = streams.find((s) => (s as { codec_type?: string }).codec_type === 'audio')
  const width = video ? toNum(video.width) : 0
  const height = video ? toNum(video.height) : 0
  const fps = video ? parseRationalFps(video.r_frame_rate) : 0
  const durationSec = toNum(p.format?.duration) || (video ? toNum(video.duration) : 0)
  const bitrate = toNum(p.format?.bit_rate) || (video ? toNum(video.bit_rate) : 0)
  const nbFromStream = video ? toNum(video.nb_frames) : 0
  const totalFrames = nbFromStream > 0 ? nbFromStream : (durationSec > 0 && fps > 0 ? Math.floor(durationSec * fps) : 0)
  const aspectRatio = width > 0 && height > 0 ? width / height : 0
  return { durationSec, width, height, aspectRatio, fps, bitrate, hasAudio: Boolean(audio), totalFrames }
}

function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)))
  }
  return btoa(binary)
}

async function safeDelete(ff: FFmpeg, names: string[]): Promise<void> {
  for (const n of names) { try { await ff.deleteFile(n) } catch { /* ignore ENOENT */ } }
}

// ffmpeg wall-clock ceilings — every exec/ffprobe is wrapped in Promise.race against
// these so the engine cannot hang indefinitely on a malformed or pathologically-large video.
const PROBE_TIMEOUT_MS = 30_000
const SCENE_DETECT_TIMEOUT_MS = 60_000

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${label} timeout after ${ms}ms`)),
      ms,
    )
  })
  return Promise.race([p, timeout]).finally(() => {
    if (timeoutId !== null) clearTimeout(timeoutId)
  })
}

// Mutable per-run state shared across ffmpeg stages. When a stage times out, the WASM
// worker is wedged — `poisoned` flips true so subsequent ffmpeg stages short-circuit
// instead of queueing behind the stuck command.
interface FFmpegRunState { poisoned: boolean }

function poisonAndTerminate(ff: FFmpeg, state: FFmpegRunState, source: string): void {
  if (state.poisoned) return
  state.poisoned = true
  // eslint-disable-next-line no-console
  console.warn(`[ffmpeg:${source}] timeout — terminating worker, downstream ffmpeg stages will skip`)
  try { ff.terminate() } catch { /* worker may already be dead */ }
  resetFFmpegSingleton()
}

async function probeVideo(ff: FFmpeg, state: FFmpegRunState): Promise<unknown> {
  if (state.poisoned) return {}
  // D-17 / ANALYSIS-10 — read meta.json UNCONDITIONALLY; ffprobe returns -1 even on success (#817)
  try {
    await withTimeout(
      ff.ffprobe(['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', '-o', 'meta.json', 'input.mp4']),
      PROBE_TIMEOUT_MS,
      'ffprobe',
    )
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[ffmpeg:probe] failed/timeout:', err instanceof Error ? err.message : err)
    poisonAndTerminate(ff, state, 'probe')
    return {}
  }
  try {
    const raw = await ff.readFile('meta.json', 'utf8')
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw as Uint8Array)
    try { return JSON.parse(text) } catch { return {} }
  } catch { return {} }
}

async function detectScenes(ff: FFmpeg, state: FFmpegRunState): Promise<number[]> {
  if (state.poisoned) return []
  const sceneTimestamps: number[] = []
  const onLog = ({ message }: { message: string }) => {
    // eslint-disable-next-line no-console
    console.info(`[ffmpeg:scenes] ${message}`)
    const m = message.match(/pts_time:([0-9.]+)/)
    if (m) { const t = parseFloat(m[1]); if (Number.isFinite(t)) sceneTimestamps.push(t) }
  }
  ff.on('log', onLog)
  try {
    await withTimeout(
      ff.exec(['-i', 'input.mp4', '-filter:v', "select='gt(scene,0.4)',showinfo", '-f', 'null', '-']),
      SCENE_DETECT_TIMEOUT_MS,
      'scene-detect',
    )
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[ffmpeg:scenes] aborted/failed:', err instanceof Error ? err.message : err)
    poisonAndTerminate(ff, state, 'scenes')
  } finally {
    ff.off('log', onLog)
  }
  return Array.from(new Set(sceneTimestamps)).sort((a, b) => a - b)
}

// Frame extraction bounds (T-03-28 mitigation — totalFrames may be 0/NaN/huge)
const FRAME_TARGET = 10
const FRAME_EXTRACT_TIMEOUT_MS = 60_000
const FRAME_FALLBACK_FPS = 30
const FRAME_FALLBACK_DURATION_SEC = 60

// Video-element frame extraction (T-03-28 v2 — replaces ffmpeg.wasm hot path)
// Uses the browser's hardware-accelerated H.264 decoder via HTMLVideoElement.seek +
// requestVideoFrameCallback. Single-threaded WASM @ffmpeg/core hangs for minutes on
// real videos; the native decoder is ~50-100x faster and works on every codec the
// browser plays.
const VIDEO_METADATA_TIMEOUT_MS = 10_000
const VIDEO_SEEK_TIMEOUT_MS = 5_000
const SCENE_DIFF_THRESHOLD = 0.18 // MAD threshold on 32x32 RGB downsample, 0-1 normalized
const SCENE_FINGERPRINT_SIZE = 32

interface ExtractedFrames {
  canvases: HTMLCanvasElement[]
  framesBase64: string[]
  duration: number
  width: number
  height: number
}

async function extractFramesViaVideo(
  file: File,
  count: number,
  signal?: AbortSignal,
): Promise<ExtractedFrames> {
  // eslint-disable-next-line no-console
  console.info(`[engine v3] extractFramesViaVideo — file=${file.name} size=${file.size}B target=${count} frames`)

  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous' // safe for blob: URLs
  // Attach to DOM (hidden) — some Chromium builds won't decode for detached elements
  video.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none'
  document.body.appendChild(video)
  video.src = url

  const empty: ExtractedFrames = { canvases: [], framesBase64: [], duration: 0, width: 0, height: 0 }

  try {
    // eslint-disable-next-line no-console
    console.info('[engine v3] awaiting loadedmetadata...')
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        video.onloadedmetadata = null
        video.onerror = null
      }
      const onAbort = () => { cleanup(); reject(new DOMException('Analysis aborted', 'AbortError')) }
      video.onloadedmetadata = () => {
        // eslint-disable-next-line no-console
        console.info(`[engine v3] loadedmetadata fired — duration=${video.duration} ${video.videoWidth}x${video.videoHeight}`)
        cleanup(); resolve()
      }
      video.onerror = () => {
        // eslint-disable-next-line no-console
        console.error('[engine v3] video.onerror fired:', video.error)
        cleanup(); reject(new Error(`video failed to load: ${video.error?.message ?? 'unknown'} (code ${video.error?.code ?? '?'})`))
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      setTimeout(() => {
        // eslint-disable-next-line no-console
        console.warn(`[engine v3] metadata timeout after ${VIDEO_METADATA_TIMEOUT_MS}ms — readyState=${video.readyState}`)
        cleanup(); reject(new Error(`video metadata timeout after ${VIDEO_METADATA_TIMEOUT_MS}ms (readyState=${video.readyState})`))
      }, VIDEO_METADATA_TIMEOUT_MS)
    })

    const duration = video.duration
    const width = video.videoWidth
    const height = video.videoHeight
    if (!Number.isFinite(duration) || duration <= 0 || width === 0 || height === 0) {
      // eslint-disable-next-line no-console
      console.warn(`[video:frames] invalid metadata — duration=${duration} ${width}x${height} (likely fragmented MP4 without moov atom)`)
      return empty
    }

    // Skip first 2% / last 5% to avoid edit lists, black intro/outro frames
    const start = duration * 0.02
    const end = duration * 0.95
    const stride = (end - start) / Math.max(1, count - 1)

    const canvases: HTMLCanvasElement[] = []
    const framesBase64: string[] = []

    const hasRVFC = typeof (video as HTMLVideoElement & { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback === 'function'

    for (let i = 0; i < count; i++) {
      if (signal?.aborted) throw new DOMException('Analysis aborted', 'AbortError')
      const t = Math.min(start + i * stride, duration - 0.1)

      try {
        await new Promise<void>((resolve, reject) => {
          let done = false
          const finish = () => { if (done) return; done = true; clearTimeout(timeoutId); resolve() }
          const fail = (err: Error) => { if (done) return; done = true; clearTimeout(timeoutId); reject(err) }
          const timeoutId = setTimeout(() => fail(new Error(`seek timeout at ${t.toFixed(2)}s`)), VIDEO_SEEK_TIMEOUT_MS)

          if (hasRVFC) {
            // rVFC fires AFTER the frame is composited — only reliable signal for drawImage
            ;(video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void })
              .requestVideoFrameCallback(finish)
          } else {
            // Fallback: seeked event + one-frame composite delay
            const onSeeked = () => { video.removeEventListener('seeked', onSeeked); setTimeout(finish, 30) }
            const onErr = () => { video.removeEventListener('error', onErr); fail(new Error('seek error')) }
            video.addEventListener('seeked', onSeeked, { once: true })
            video.addEventListener('error', onErr, { once: true })
          }
          video.currentTime = t
        })

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('canvas 2d context unavailable')
        ctx.drawImage(video, 0, 0)
        canvases.push(canvas)
        framesBase64.push(canvas.toDataURL('image/jpeg', 0.85))
        // eslint-disable-next-line no-console
        console.info(`[video:frames] captured frame ${i + 1}/${count} at ${t.toFixed(2)}s`)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err
        // eslint-disable-next-line no-console
        console.warn(`[video:frames] skip frame ${i + 1} at ${t.toFixed(2)}s:`, err instanceof Error ? err.message : err)
      }
    }

    return { canvases, framesBase64, duration, width, height }
  } finally {
    URL.revokeObjectURL(url)
    video.src = ''
    try { video.load() } catch { /* ignore */ }
    try { video.remove() } catch { /* ignore */ }
  }
}

function detectScenesFromCanvases(canvases: HTMLCanvasElement[], duration: number): number[] {
  if (canvases.length < 2) return []
  const tmp = document.createElement('canvas')
  tmp.width = SCENE_FINGERPRINT_SIZE
  tmp.height = SCENE_FINGERPRINT_SIZE
  const tmpCtx = tmp.getContext('2d', { willReadFrequently: true })
  if (!tmpCtx) return []

  const fingerprints: Uint8ClampedArray[] = []
  for (const c of canvases) {
    tmpCtx.clearRect(0, 0, SCENE_FINGERPRINT_SIZE, SCENE_FINGERPRINT_SIZE)
    tmpCtx.drawImage(c, 0, 0, SCENE_FINGERPRINT_SIZE, SCENE_FINGERPRINT_SIZE)
    fingerprints.push(tmpCtx.getImageData(0, 0, SCENE_FINGERPRINT_SIZE, SCENE_FINGERPRINT_SIZE).data)
  }

  const sceneTimestamps: number[] = []
  const pxCount = SCENE_FINGERPRINT_SIZE * SCENE_FINGERPRINT_SIZE
  const maxDiff = pxCount * 3 * 255 // 3 channels (skip alpha) at full diff
  for (let i = 1; i < fingerprints.length; i++) {
    const prev = fingerprints[i - 1]
    const curr = fingerprints[i]
    let total = 0
    for (let p = 0; p < prev.length; p += 4) {
      total += Math.abs(prev[p] - curr[p])
      total += Math.abs(prev[p + 1] - curr[p + 1])
      total += Math.abs(prev[p + 2] - curr[p + 2])
    }
    const mad = total / maxDiff
    if (mad > SCENE_DIFF_THRESHOLD) {
      sceneTimestamps.push((duration * (i + 0.5)) / fingerprints.length)
    }
  }
  return sceneTimestamps
}

async function extractFrames(ff: FFmpeg, meta: ParsedMeta, state: FFmpegRunState = { poisoned: false }): Promise<string[]> {
  if (state.poisoned) return []
  const estTotal =
    meta.totalFrames >= FRAME_TARGET
      ? meta.totalFrames
      : (meta.durationSec > 0 && meta.fps > 0
          ? Math.floor(meta.durationSec * meta.fps)
          : FRAME_FALLBACK_DURATION_SEC * FRAME_FALLBACK_FPS)
  const N = Math.max(1, Math.floor(estTotal / FRAME_TARGET))

  const onLog = ({ message }: { message: string }) => {
    // eslint-disable-next-line no-console
    console.info(`[ffmpeg:frames] ${message}`)
  }
  ff.on('log', onLog)

  try {
    await withTimeout(
      ff.exec([
        '-i', 'input.mp4',
        '-vf', `select='not(mod(n\\,${N}))',scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2`,
        '-frames:v', String(FRAME_TARGET),
        '-vsync', 'vfr', '-q:v', '5', 'frame_%03d.jpg',
      ]),
      FRAME_EXTRACT_TIMEOUT_MS,
      'frame-extract',
    )
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[ffmpeg:frames] aborted/failed:', err instanceof Error ? err.message : err)
    poisonAndTerminate(ff, state, 'frames')
    ff.off('log', onLog)
    return []
  } finally {
    ff.off('log', onLog)
  }

  const frames: string[] = []
  for (let i = 1; i <= FRAME_TARGET; i++) {
    const name = `frame_${String(i).padStart(3, '0')}.jpg`
    try {
      const data = (await ff.readFile(name)) as Uint8Array
      frames.push(`data:image/jpeg;base64,${uint8ToBase64(data)}`)
      await ff.deleteFile(name)
    } catch { break }
  }
  return frames
}

async function decodeFrameToCanvas(dataUri: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      resolve(canvas)
    }
    img.onerror = reject
    img.src = dataUri
  })
}

async function detectFacesAcrossFrames(
  frames: HTMLCanvasElement[],
): Promise<{ faceCount: number; faceConfidence: number }> {
  const detector = await getFaceDetector()
  if (!detector || frames.length === 0) return { faceCount: 0, faceConfidence: 0 }
  let maxFaces = 0
  let totalConf = 0
  let confCount = 0
  for (const canvas of frames) {
    try {
      const result = await detector.estimateFaces(canvas)
      if (result.length > maxFaces) maxFaces = result.length
      for (const face of result) {
        const score = (face as { score?: number[] }).score?.[0] ?? 0
        totalConf += score
        confCount++
      }
    } catch { /* skip frame */ }
  }
  return { faceCount: maxFaces, faceConfidence: confCount > 0 ? totalConf / confCount : 0 }
}

async function detectObjectsAndMotion(
  frames: HTMLCanvasElement[],
): Promise<{ objectLabels: string[]; motionScore: number }> {
  const model = await getCocoDetector()
  if (!model || frames.length === 0) return { objectLabels: [], motionScore: 0 }
  const labelSet = new Set<string>()
  let prevCentroids: Array<{ x: number; y: number }> = []
  let totalDelta = 0
  let deltaCount = 0
  for (const canvas of frames) {
    try {
      const preds = await model.detect(canvas)
      for (const p of preds) labelSet.add(p.class)
      const centroids = preds.map((p) => ({ x: p.bbox[0] + p.bbox[2] / 2, y: p.bbox[1] + p.bbox[3] / 2 }))
      if (prevCentroids.length > 0 && centroids.length > 0) {
        const pairs = Math.min(prevCentroids.length, centroids.length)
        let frameDelta = 0
        for (let i = 0; i < pairs; i++) {
          const dx = centroids[i].x - prevCentroids[i].x
          const dy = centroids[i].y - prevCentroids[i].y
          frameDelta += Math.sqrt(dx * dx + dy * dy)
        }
        totalDelta += frameDelta / pairs / Math.max(canvas.width, canvas.height)
        deltaCount++
      }
      prevCentroids = centroids
    } catch { /* skip frame */ }
  }
  const motionScore = deltaCount > 0 ? Math.min(1, totalDelta / deltaCount) : 0
  return { objectLabels: Array.from(labelSet), motionScore }
}

const AUDIO_BUFFER_SIZE = 1024
const AUDIO_THRESHOLDS = {
  BEAT_FLUX_THRESHOLD: 0.05,
  SILENCE_RMS_THRESHOLD: 0.02,
}
const BEAT_FLUX_THRESHOLD = AUDIO_THRESHOLDS.BEAT_FLUX_THRESHOLD
const SILENCE_RMS_THRESHOLD = AUDIO_THRESHOLDS.SILENCE_RMS_THRESHOLD
const MIN_SILENCE_GAP_SEC = 1.5

interface AudioSignals {
  audioEnergy: number
  beatPresent: boolean
  silenceGapsSec: number[]
  hasAudio: boolean
}

const EMPTY_AUDIO: AudioSignals = { audioEnergy: 0, beatPresent: false, silenceGapsSec: [], hasAudio: false }

async function analyseAudio(file: File): Promise<AudioSignals> {
  const noAudio = EMPTY_AUDIO
  try {
    const arrayBuffer = await file.arrayBuffer()
    const ctx = new OfflineAudioContext(1, 1, 44100)
    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
    } catch {
      return noAudio
    }
    const channelData = audioBuffer.getChannelData(0)
    const sampleRate = audioBuffer.sampleRate
    const windows: number[] = []
    const rmsValues: number[] = []
    const fluxValues: number[] = []
    let prevSpectrum: Float32Array | null = null
    for (let start = 0; start + AUDIO_BUFFER_SIZE <= channelData.length; start += AUDIO_BUFFER_SIZE) {
      const slice = channelData.slice(start, start + AUDIO_BUFFER_SIZE)
      const features = Meyda.extract(['rms', 'spectralFlux', 'amplitudeSpectrum'], slice) as {
        rms: number; spectralFlux: number; amplitudeSpectrum: Float32Array
      } | null
      if (features) {
        rmsValues.push(features.rms ?? 0)
        fluxValues.push(features.spectralFlux ?? 0)
        windows.push(start)
        prevSpectrum = features.amplitudeSpectrum
      }
    }
    if (rmsValues.length === 0) return noAudio
    const avgEnergy = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length
    const avgFlux = fluxValues.reduce((a, b) => a + b, 0) / fluxValues.length
    const silenceGapsSec: number[] = []
    let silenceStart: number | null = null
    const winDuration = AUDIO_BUFFER_SIZE / sampleRate
    for (let i = 0; i < rmsValues.length; i++) {
      if (rmsValues[i] < SILENCE_RMS_THRESHOLD) {
        if (silenceStart === null) silenceStart = windows[i] / sampleRate
      } else {
        if (silenceStart !== null) {
          const gapDuration = windows[i] / sampleRate - silenceStart
          if (gapDuration >= MIN_SILENCE_GAP_SEC) silenceGapsSec.push(gapDuration)
          silenceStart = null
        }
      }
    }
    if (silenceStart !== null) {
      const gapDuration = channelData.length / sampleRate - silenceStart
      if (gapDuration >= MIN_SILENCE_GAP_SEC) silenceGapsSec.push(gapDuration)
    }
    void prevSpectrum
    void winDuration
    return {
      audioEnergy: Math.min(1, avgEnergy),
      beatPresent: avgFlux > BEAT_FLUX_THRESHOLD,
      silenceGapsSec,
      hasAudio: true,
    }
  } catch {
    return noAudio
  }
}

function computeBrightnessAcrossFrames(frames: HTMLCanvasElement[]): number {
  if (frames.length === 0) return 0
  let total = 0
  let count = 0
  for (const canvas of frames) {
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    const offscreen = document.createElement('canvas')
    offscreen.width = 64
    offscreen.height = 64
    const octx = offscreen.getContext('2d')!
    octx.drawImage(canvas, 0, 0, 64, 64)
    const data = octx.getImageData(0, 0, 64, 64).data
    for (let i = 0; i < data.length; i += 16) {
      total += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
      count++
    }
  }
  return count > 0 ? total / count : 0
}

// ============================================================================
// ANALYSE — main entry point
// ============================================================================
export async function analyse(file: File, opts: AnalyseOptions = {}): Promise<EngineSignals> {
  // eslint-disable-next-line no-console
  console.info('[engine v3] analyse() starting — video-element extraction (NOT ffmpeg)')
  const pre = canRunEngine()
  if (!pre.ok) throw new Error(`engine unavailable: ${pre.reason}`)
  const onProgress: (s: ProgressStep) => void = opts.onProgress ?? (() => {})
  const signal = opts.signal
  throwIfAborted(signal)

  // Warm up TF.js models in parallel with metadata probe — ffmpeg.wasm is no longer
  // on the hot path; we use HTMLVideoElement + requestVideoFrameCallback for frame
  // extraction (hardware-accelerated, ~50x faster than single-threaded WASM).
  await Promise.allSettled([getFaceDetector(), getCocoDetector()])
  throwIfAborted(signal)

  onProgress('metadata')
  // Try ffprobe first for rich metadata (fps, bitrate, totalFrames); fall back to
  // video-element metadata if ffprobe times out or the FFmpeg load fails.
  let meta: ParsedMeta = { durationSec: 0, width: 0, height: 0, aspectRatio: 0, fps: 0, bitrate: 0, hasAudio: false, totalFrames: 0 }
  let ff: FFmpeg | null = null
  const runState: FFmpegRunState = { poisoned: false }
  try {
    ff = await withTimeout(getFFmpeg(), 15_000, 'ffmpeg-load')
    const bytes = new Uint8Array(await file.arrayBuffer())
    await ff.writeFile('input.mp4', bytes)
    const probe = await probeVideo(ff, runState)
    meta = parseMeta(probe)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[ffmpeg:probe] failed — falling back to video-element metadata:', err instanceof Error ? err.message : err)
    if (ff) {
      try { ff.terminate() } catch { /* ignore */ }
      resetFFmpegSingleton()
    }
  }
  throwIfAborted(signal)

  try {
    onProgress('frames')
    const { canvases, framesBase64, duration: videoDuration, width: videoWidth, height: videoHeight } =
      await extractFramesViaVideo(file, FRAME_TARGET, signal)

    // Fall back to video-element metadata if ffprobe didn't yield anything
    if (meta.durationSec === 0 && videoDuration > 0) {
      meta = {
        durationSec: videoDuration,
        width: videoWidth,
        height: videoHeight,
        aspectRatio: videoWidth > 0 && videoHeight > 0 ? videoWidth / videoHeight : 0,
        fps: FRAME_FALLBACK_FPS,
        bitrate: 0,
        hasAudio: false, // detected authoritatively via Web Audio API below
        totalFrames: 0,
      }
    }

    onProgress('scenes')
    const sceneTimestamps = detectScenesFromCanvases(canvases, meta.durationSec)
    throwIfAborted(signal)

    onProgress('faces')
    const { faceCount, faceConfidence } = await detectFacesAcrossFrames(canvases)
    throwIfAborted(signal)

    onProgress('objects')
    const { objectLabels, motionScore } = await detectObjectsAndMotion(canvases)
    throwIfAborted(signal)

    onProgress('audio')
    const audio = await analyseAudio(file)
    const hasAudio = audio.hasAudio
    throwIfAborted(signal)

    onProgress('brightness')
    const brightnessScore = computeBrightnessAcrossFrames(canvases)
    throwIfAborted(signal)

    onProgress('done')

    return {
      durationSec: meta.durationSec,
      width: meta.width,
      height: meta.height,
      aspectRatio: meta.aspectRatio,
      fps: meta.fps,
      bitrate: meta.bitrate,
      hasAudio,
      sceneCount: sceneTimestamps.length,
      sceneTimestamps,
      framesBase64,
      faceCount,
      faceConfidence,
      objectLabels,
      motionScore,
      audioEnergy: audio.audioEnergy,
      beatPresent: audio.beatPresent,
      silenceGapsSec: audio.silenceGapsSec,
      brightnessScore,
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (ff) {
        try { ff.terminate() } catch { /* ignore */ }
        resetFFmpegSingleton()
      }
    }
    throw err
  } finally {
    // MEMFS cleanup — bounded so a wedged worker can never hang the analyse() promise.
    if (ff && !runState.poisoned) {
      try {
        await withTimeout(
          (async () => {
            try { await safeDelete(ff!, ['input.mp4', 'meta.json']) } catch { /* ignore */ }
          })(),
          5_000,
          'memfs-cleanup',
        )
      } catch {
        // eslint-disable-next-line no-console
        console.warn('[ffmpeg:cleanup] timeout — terminating worker and resetting singleton')
        try { ff.terminate() } catch { /* ignore */ }
        resetFFmpegSingleton()
      }
    }
  }
}

/** Test-only helper: returns the raw flux + rms series alongside the AudioSignals.
 *  Used by engine.calibration.test.ts to empirically tune A2 + A3 thresholds. */
async function analyseAudioRaw(file: File): Promise<{
  signals: AudioSignals
  meanFlux: number
  meanRms: number
  windowCount: number
}> {
  const arrayBuf = await file.arrayBuffer()
  const tmpCtx = new OfflineAudioContext(1, 1, 44100)
  let audioBuf: AudioBuffer
  try {
    audioBuf = await tmpCtx.decodeAudioData(arrayBuf.slice(0))
  } catch {
    return {
      signals: EMPTY_AUDIO,
      meanFlux: 0, meanRms: 0, windowCount: 0,
    }
  }
  if (audioBuf.numberOfChannels === 0) {
    return { signals: EMPTY_AUDIO, meanFlux: 0, meanRms: 0, windowCount: 0 }
  }
  const channelData = audioBuf.getChannelData(0)
  const fluxes: number[] = []
  const rms: number[] = []
  for (let i = 0; i + AUDIO_BUFFER_SIZE < channelData.length; i += AUDIO_BUFFER_SIZE) {
    const window = channelData.slice(i, i + AUDIO_BUFFER_SIZE)
    const features = Meyda.extract(['rms', 'spectralFlux'], window) as
      | { rms: number; spectralFlux: number }
      | null
    if (!features) continue
    if (Number.isFinite(features.rms)) rms.push(features.rms)
    if (Number.isFinite(features.spectralFlux)) fluxes.push(features.spectralFlux)
  }
  const meanFlux = fluxes.length === 0 ? 0 : fluxes.reduce((a, b) => a + b, 0) / fluxes.length
  const meanRms = rms.length === 0 ? 0 : rms.reduce((a, b) => a + b, 0) / rms.length
  const signals = await analyseAudio(file)
  return { signals, meanFlux, meanRms, windowCount: rms.length }
}

export const __testables = {
  parseMeta, uint8ToBase64, analyseAudioRaw, AUDIO_THRESHOLDS,
  extractFrames,
  FRAME_TARGET, FRAME_EXTRACT_TIMEOUT_MS,
}
export function __resetEngineForTests(): void {
  ffmpegInstance = null
  ffmpegLoadPromise = null
  faceDetectorInstance = null
  faceDetectorPromise = null
  cocoDetectorInstance = null
  cocoDetectorPromise = null
}
