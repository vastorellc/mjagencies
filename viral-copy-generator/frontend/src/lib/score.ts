import type {
  Platform,
  EngineSignals,
  BaselineWeights,
  LearnedWeights,
  ColorBand,
  ScoreResult,
  PerPlatformScores,
} from './types'

// ============================================================================
// Baseline weights (D-04) — sum 1.0
// ============================================================================
export const BASELINE_WEIGHTS: BaselineWeights = {
  hook: 0.25,
  pacing: 0.20,
  face: 0.15,
  audio: 0.15,
  duration_fit: 0.10,
  aspect_ratio: 0.10,
  brightness: 0.05,
}

// ============================================================================
// Per-platform weight overrides (D-12) — each row sums to 1.0
// ============================================================================
export const PLATFORM_WEIGHTS: Record<Platform, BaselineWeights> = {
  youtube:   { hook: 0.25, pacing: 0.20, face: 0.10, audio: 0.20, duration_fit: 0.10, aspect_ratio: 0.10, brightness: 0.05 },
  instagram: { hook: 0.30, pacing: 0.20, face: 0.15, audio: 0.10, duration_fit: 0.10, aspect_ratio: 0.10, brightness: 0.05 },
  tiktok:    { hook: 0.30, pacing: 0.25, face: 0.10, audio: 0.15, duration_fit: 0.05, aspect_ratio: 0.10, brightness: 0.05 },
  facebook:  { hook: 0.20, pacing: 0.15, face: 0.25, audio: 0.15, duration_fit: 0.10, aspect_ratio: 0.10, brightness: 0.05 },
  x:         { hook: 0.30, pacing: 0.20, face: 0.15, audio: 0.05, duration_fit: 0.15, aspect_ratio: 0.10, brightness: 0.05 },
}

// ============================================================================
// Platform-ideal duration / aspect ratio (D-09, D-10)
// ============================================================================
const IDEAL_DURATION_SEC: Record<Platform, number> = {
  youtube: 30,
  instagram: 30,
  tiktok: 21,
  facebook: 30,
  x: 45,
}
const OVERALL_IDEAL_DURATION_SEC = (30 + 30 + 21 + 30 + 45) / 5 // 31.2

const IDEAL_ASPECT: Record<Platform, number> = {
  youtube: 0.5625,
  instagram: 0.5625,
  tiktok: 0.5625,
  facebook: 0.5625,
  x: 1.0,
}
const OVERALL_IDEAL_ASPECT = 0.5625 // most platforms vertical

// ============================================================================
// Color band (D-14)
// ============================================================================
export function bandForScore(score: number): ColorBand {
  if (score >= 80) return 'bright-green'
  if (score >= 60) return 'green'
  if (score >= 40) return 'amber'
  return 'red'
}

// ============================================================================
// Helpers
// ============================================================================
function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo
  if (n < lo) return lo
  if (n > hi) return hi
  return n
}

// Linear interpolation between (x0,y0) and (x1,y1), clamped to [y0,y1] outside the range.
// Used for piecewise normalisers (D-05..D-11).
function linear(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (Number.isNaN(x)) return y0
  if (x0 === x1) return y0
  const t = (x - x0) / (x1 - x0)
  const y = y0 + t * (y1 - y0)
  return clamp(y, Math.min(y0, y1), Math.max(y0, y1))
}

// ============================================================================
// Signal normalisers (D-05..D-11) — each returns 0..100
// ============================================================================

// D-05: hook — first scene change time
export function hookSignal(s: EngineSignals): number {
  if (s.sceneCount === 0 || s.sceneTimestamps.length === 0) return 0
  const firstSceneT = s.sceneTimestamps[0] ?? s.durationSec
  if (firstSceneT <= 1.0) return 100
  if (firstSceneT >= 5.0) return 0
  return linear(firstSceneT, 1.0, 5.0, 100, 0)
}

// D-06: pacing — scenes per second
export function pacingSignal(s: EngineSignals): number {
  if (s.sceneCount === 0 || s.durationSec <= 0) return 0
  const scenesPerSec = s.sceneCount / Math.max(s.durationSec, 1)
  if (scenesPerSec >= 0.4) return 100
  if (scenesPerSec <= 0.1) return 0
  return linear(scenesPerSec, 0.1, 0.4, 0, 100)
}

// D-07: face — face presence + confidence
export function faceSignal(s: EngineSignals): number {
  if (s.faceCount === 0) return 0
  const conf = s.faceConfidence
  if (conf === undefined || Number.isNaN(conf)) return 0
  return clamp(conf * 100, 0, 100)
}

// D-08: audio — energy + beat - silence penalty
export function audioSignal(s: EngineSignals): number {
  if (!s.hasAudio) return 0
  let score = clamp(s.audioEnergy, 0, 1) * 60 + (s.beatPresent ? 40 : 0)
  const longestGap = s.silenceGapsSec.length > 0 ? Math.max(...s.silenceGapsSec) : 0
  if (longestGap > 1.5) score -= 20
  return clamp(score, 0, 100)
}

// D-09: duration_fit — closeness to platform-ideal length
export function durationFitSignal(s: EngineSignals, platform?: Platform): number {
  if (s.durationSec <= 0) return 0
  const ideal = platform ? IDEAL_DURATION_SEC[platform] : OVERALL_IDEAL_DURATION_SEC
  const diff = Math.abs(s.durationSec - ideal)
  if (diff <= 5) return 100
  if (diff >= 30) return 0
  return linear(diff, 5, 30, 100, 0)
}

// D-10: aspect_ratio — closeness to platform-ideal aspect
export function aspectRatioSignal(s: EngineSignals, platform?: Platform): number {
  if (Number.isNaN(s.aspectRatio)) return 0
  const ideal = platform ? IDEAL_ASPECT[platform] : OVERALL_IDEAL_ASPECT
  const diff = Math.abs(s.aspectRatio - ideal)
  if (diff <= 0.05) return 100
  if (diff >= 0.4) return 0
  return linear(diff, 0.05, 0.4, 100, 0)
}

// D-11: brightness — healthy luma 0.3..0.7
export function brightnessSignal(s: EngineSignals): number {
  const b = s.brightnessScore
  if (Number.isNaN(b)) return 0
  if (b >= 0.3 && b <= 0.7) return 100
  if (b <= 0.1 || b >= 0.9) return 0
  if (b < 0.3) return linear(b, 0.1, 0.3, 0, 100)
  return linear(b, 0.7, 0.9, 100, 0)
}

// ============================================================================
// Calibration (D-20) — apply learned-weight deltas if user has >=10 data points
// ============================================================================
const DELTA_CAP = 0.15 // ROADMAP LEARNING-07 cap

export function applyLearnedWeights(
  baseline: BaselineWeights,
  learned: LearnedWeights | null | undefined,
  dataPoints: number,
): BaselineWeights {
  if (dataPoints < 10 || !learned) return baseline

  const keys: (keyof BaselineWeights)[] = [
    'hook', 'pacing', 'face', 'audio', 'duration_fit', 'aspect_ratio', 'brightness',
  ]

  // 1. clamp each delta and add to baseline; floor at 0 (no negative weights)
  const raw: Record<keyof BaselineWeights, number> = {
    hook: 0, pacing: 0, face: 0, audio: 0, duration_fit: 0, aspect_ratio: 0, brightness: 0,
  }
  let sum = 0
  for (const k of keys) {
    const delta = clamp(learned[k] ?? 0, -DELTA_CAP, DELTA_CAP)
    const v = clamp(baseline[k] + delta, 0, 1)
    raw[k] = v
    sum += v
  }

  // 2. re-normalise so weights sum to 1.0
  if (sum === 0) return baseline // degenerate — fall back to baseline
  const out = {} as BaselineWeights
  for (const k of keys) out[k] = raw[k] / sum
  return out
}

// ============================================================================
// computeScore — overall + 5 platform variants (D-24)
// ============================================================================
function scoreWithWeights(s: EngineSignals, w: BaselineWeights, platform?: Platform): number {
  // D-25: durationSec === 0 → overall 0
  if (s.durationSec <= 0) return 0
  const total =
    hookSignal(s)            * w.hook            +
    pacingSignal(s)          * w.pacing          +
    faceSignal(s)            * w.face            +
    audioSignal(s)           * w.audio           +
    durationFitSignal(s, platform) * w.duration_fit  +
    aspectRatioSignal(s, platform) * w.aspect_ratio  +
    brightnessSignal(s)      * w.brightness
  return Math.round(clamp(total, 0, 100))
}

export function computeScore(
  signals: EngineSignals,
  weights: BaselineWeights = BASELINE_WEIGHTS,
): ScoreResult {
  const overall = scoreWithWeights(signals, weights)
  const perPlatform: PerPlatformScores = {
    youtube:   scoreWithWeights(signals, PLATFORM_WEIGHTS.youtube,   'youtube'),
    instagram: scoreWithWeights(signals, PLATFORM_WEIGHTS.instagram, 'instagram'),
    tiktok:    scoreWithWeights(signals, PLATFORM_WEIGHTS.tiktok,    'tiktok'),
    facebook:  scoreWithWeights(signals, PLATFORM_WEIGHTS.facebook,  'facebook'),
    x:         scoreWithWeights(signals, PLATFORM_WEIGHTS.x,         'x'),
  }
  return { overall, perPlatform }
}
