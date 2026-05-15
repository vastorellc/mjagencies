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

async function probeVideo(ff: FFmpeg): Promise<unknown> {
  // D-17 / ANALYSIS-10 — read meta.json UNCONDITIONALLY; ffprobe returns -1 even on success (#817)
  await ff.ffprobe(['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', '-o', 'meta.json', 'input.mp4'])
  const raw = await ff.readFile('meta.json', 'utf8')
  const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw as Uint8Array)
  try { return JSON.parse(text) } catch { return {} }
}

async function detectScenes(ff: FFmpeg): Promise<number[]> {
  const sceneTimestamps: number[] = []
  const onLog = ({ message }: { message: string }) => {
    const m = message.match(/pts_time:([0-9.]+)/)
    if (m) { const t = parseFloat(m[1]); if (Number.isFinite(t)) sceneTimestamps.push(t) }
  }
  ff.on('log', onLog)
  try {
    await ff.exec(['-i', 'input.mp4', '-filter:v', "select='gt(scene,0.4)',showinfo", '-f', 'null', '-'])
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

async function extractFrames(ff: FFmpeg, meta: ParsedMeta): Promise<string[]> {
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

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    const exec = ff.exec([
      '-i', 'input.mp4',
      '-vf', `select='not(mod(n\\,${N}))',scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2`,
      '-frames:v', String(FRAME_TARGET),
      '-vsync', 'vfr', '-q:v', '5', 'frame_%03d.jpg',
    ])
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`frame-extract timeout after ${FRAME_EXTRACT_TIMEOUT_MS}ms`)),
        FRAME_EXTRACT_TIMEOUT_MS,
      )
    })
    await Promise.race([exec, timeout])
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[ffmpeg:frames] aborted/failed:', err instanceof Error ? err.message : err)
    return []
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId)
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
  const pre = canRunEngine()
  if (!pre.ok) throw new Error(`engine unavailable: ${pre.reason}`)
  const onProgress: (s: ProgressStep) => void = opts.onProgress ?? (() => {})
  const signal = opts.signal
  throwIfAborted(signal)

  await warmup()
  throwIfAborted(signal)

  const ff = await getFFmpeg()
  const bytes = new Uint8Array(await file.arrayBuffer())
  await ff.writeFile('input.mp4', bytes)
  throwIfAborted(signal)

  try {
    onProgress('metadata')
    const probe = await probeVideo(ff)
    throwIfAborted(signal)
    const meta = parseMeta(probe)

    onProgress('scenes')
    const sceneTimestamps = await detectScenes(ff)
    throwIfAborted(signal)

    onProgress('frames')
    const framesBase64 = await extractFrames(ff, meta)
    throwIfAborted(signal)

    // Decode frames to canvases for TF.js + brightness
    const canvases: HTMLCanvasElement[] = []
    for (const uri of framesBase64) {
      try { canvases.push(await decodeFrameToCanvas(uri)) } catch { /* skip */ }
    }
    throwIfAborted(signal)

    onProgress('faces')
    const { faceCount, faceConfidence } = await detectFacesAcrossFrames(canvases)
    throwIfAborted(signal)

    onProgress('objects')
    const { objectLabels, motionScore } = await detectObjectsAndMotion(canvases)
    throwIfAborted(signal)

    onProgress('audio')
    const audio = await analyseAudio(file)
    // audio.hasAudio is the authoritative source (decodeAudioData-based), overrides ffprobe hasAudio
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
    // On AbortError, terminate the WASM worker and reset the singleton so the next run is fresh.
    if (err instanceof DOMException && err.name === 'AbortError') {
      try { ff.terminate() } catch { /* worker may already be dead */ }
      resetFFmpegSingleton()
    }
    throw err
  } finally {
    // Best-effort MEMFS cleanup. After terminate(), these will throw — safeDelete swallows errors.
    try { await safeDelete(ff, ['input.mp4', 'meta.json']) } catch { /* ignore */ }
    for (let i = 1; i <= FRAME_TARGET; i++) {
      try { await safeDelete(ff, [`frame_${String(i).padStart(3, '0')}.jpg`]) } catch { /* ignore */ }
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
