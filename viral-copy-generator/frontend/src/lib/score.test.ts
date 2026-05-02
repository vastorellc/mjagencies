import { describe, it, expect } from 'vitest'
import {
  computeScore,
  bandForScore,
  applyLearnedWeights,
  BASELINE_WEIGHTS,
  PLATFORM_WEIGHTS,
  hookSignal,
  pacingSignal,
  faceSignal,
  audioSignal,
  durationFitSignal,
  aspectRatioSignal,
  brightnessSignal,
} from './score'
import type { EngineSignals, LearnedWeights } from './types'

// Hand-mock factory — matches Phase 3 EngineSignals shape exactly.
function mockSignals(overrides: Partial<EngineSignals> = {}): EngineSignals {
  return {
    durationSec: 25,
    width: 1080,
    height: 1920,
    aspectRatio: 0.5625,
    fps: 30,
    bitrate: 5_000_000,
    hasAudio: true,
    audioEnergy: 0.7,
    beatPresent: true,
    silenceGapsSec: [0.3, 0.5],
    sceneCount: 8,
    sceneTimestamps: [0.8, 3.5, 7.0, 11.0, 14.5, 18.0, 21.5, 24.0],
    faceCount: 1,
    faceConfidence: 0.9,
    objectLabels: ['person', 'car'],
    motionScore: 0.4,
    brightnessScore: 0.5,
    framesBase64: [],
    ...overrides,
  }
}

// ============================================================================
// bandForScore (D-14)
// ============================================================================
describe('bandForScore', () => {
  it('red 0-39', () => {
    expect(bandForScore(0)).toBe('red')
    expect(bandForScore(39)).toBe('red')
  })
  it('amber 40-59', () => {
    expect(bandForScore(40)).toBe('amber')
    expect(bandForScore(59)).toBe('amber')
  })
  it('green 60-79', () => {
    expect(bandForScore(60)).toBe('green')
    expect(bandForScore(79)).toBe('green')
  })
  it('bright-green 80-100', () => {
    expect(bandForScore(80)).toBe('bright-green')
    expect(bandForScore(100)).toBe('bright-green')
  })
})

// ============================================================================
// Signal curves (D-05..D-11) — anchor points
// ============================================================================
describe('hookSignal (D-05)', () => {
  it('100 when first scene at 0.5s (<= 1.0s)', () => {
    expect(hookSignal(mockSignals({ sceneTimestamps: [0.5, 2, 4] }))).toBe(100)
  })
  it('0 when first scene at 5s (>= 5.0s)', () => {
    expect(hookSignal(mockSignals({ sceneTimestamps: [5.0, 10] }))).toBe(0)
  })
  it('linear in between (3s -> ~50)', () => {
    const v = hookSignal(mockSignals({ sceneTimestamps: [3.0, 6] }))
    expect(v).toBeGreaterThan(45)
    expect(v).toBeLessThan(55)
  })
  it('0 when sceneCount=0 (D-25)', () => {
    expect(hookSignal(mockSignals({ sceneCount: 0, sceneTimestamps: [] }))).toBe(0)
  })
})

describe('pacingSignal (D-06)', () => {
  it('100 when 0.4 scenes/sec (10 cuts in 25s)', () => {
    expect(pacingSignal(mockSignals({ sceneCount: 10, durationSec: 25 }))).toBe(100)
  })
  it('0 when 0.1 scenes/sec (3 cuts in 30s)', () => {
    expect(pacingSignal(mockSignals({ sceneCount: 3, durationSec: 30 }))).toBe(0)
  })
  it('0 when sceneCount=0 (D-25)', () => {
    expect(pacingSignal(mockSignals({ sceneCount: 0, sceneTimestamps: [] }))).toBe(0)
  })
})

describe('faceSignal (D-07)', () => {
  it('confidence * 100 when faceCount>0', () => {
    expect(faceSignal(mockSignals({ faceCount: 1, faceConfidence: 0.85 }))).toBe(85)
  })
  it('0 when faceCount=0 (D-25)', () => {
    expect(faceSignal(mockSignals({ faceCount: 0, faceConfidence: undefined }))).toBe(0)
  })
  it('0 when confidence undefined even with faceCount=1', () => {
    expect(faceSignal(mockSignals({ faceCount: 1, faceConfidence: undefined }))).toBe(0)
  })
})

describe('audioSignal (D-08)', () => {
  it('energy*60 + beat*40', () => {
    // 0.7*60 + 40 = 82, no silence penalty
    expect(audioSignal(mockSignals({ audioEnergy: 0.7, beatPresent: true, silenceGapsSec: [0.5] }))).toBe(82)
  })
  it('0 when hasAudio=false (D-25)', () => {
    expect(audioSignal(mockSignals({ hasAudio: false }))).toBe(0)
  })
  it('subtracts 20 when longest gap > 1.5s', () => {
    // 0.5*60 + 0 - 20 = 10
    expect(audioSignal(mockSignals({
      audioEnergy: 0.5, beatPresent: false, silenceGapsSec: [2.0],
    }))).toBe(10)
  })
  it('floors at 0 after silence penalty', () => {
    expect(audioSignal(mockSignals({
      audioEnergy: 0, beatPresent: false, silenceGapsSec: [3.0],
    }))).toBe(0)
  })
})

describe('durationFitSignal (D-09)', () => {
  it('100 when within 5s of platform ideal (tiktok=21s, dur=24s)', () => {
    expect(durationFitSignal(mockSignals({ durationSec: 24 }), 'tiktok')).toBe(100)
  })
  it('0 when >=30s off ideal (x=45s, dur=10s)', () => {
    expect(durationFitSignal(mockSignals({ durationSec: 10 }), 'x')).toBe(0)
  })
  it('uses overall 31.2s when platform omitted', () => {
    // dur=31s, diff=0.2s -> 100
    expect(durationFitSignal(mockSignals({ durationSec: 31 }))).toBe(100)
  })
  it('0 when durationSec=0 (D-25)', () => {
    expect(durationFitSignal(mockSignals({ durationSec: 0 }))).toBe(0)
  })
})

describe('aspectRatioSignal (D-10)', () => {
  it('100 when within 0.05 of ideal (vertical 9:16=0.5625)', () => {
    expect(aspectRatioSignal(mockSignals({ aspectRatio: 0.5625 }), 'tiktok')).toBe(100)
  })
  it('0 when 0.4+ off ideal (vertical=0.5625, given 1.0)', () => {
    expect(aspectRatioSignal(mockSignals({ aspectRatio: 1.0 }), 'tiktok')).toBe(0)
  })
  it('0 when aspectRatio=NaN (D-25)', () => {
    expect(aspectRatioSignal(mockSignals({ aspectRatio: NaN }), 'tiktok')).toBe(0)
  })
  it('x platform ideal=1.0 (square)', () => {
    expect(aspectRatioSignal(mockSignals({ aspectRatio: 1.0 }), 'x')).toBe(100)
  })
})

describe('brightnessSignal (D-11)', () => {
  it('100 in healthy 0.3-0.7 range', () => {
    expect(brightnessSignal(mockSignals({ brightnessScore: 0.5 }))).toBe(100)
    expect(brightnessSignal(mockSignals({ brightnessScore: 0.3 }))).toBe(100)
    expect(brightnessSignal(mockSignals({ brightnessScore: 0.7 }))).toBe(100)
  })
  it('0 at extremes (<= 0.1 or >= 0.9)', () => {
    expect(brightnessSignal(mockSignals({ brightnessScore: 0.05 }))).toBe(0)
    expect(brightnessSignal(mockSignals({ brightnessScore: 0.95 }))).toBe(0)
  })
  it('linear in transition zones', () => {
    // 0.2 between 0.1 and 0.3 -> ~50
    const v = brightnessSignal(mockSignals({ brightnessScore: 0.2 }))
    expect(v).toBeGreaterThan(45)
    expect(v).toBeLessThan(55)
  })
})

// ============================================================================
// applyLearnedWeights (D-20)
// ============================================================================
describe('applyLearnedWeights', () => {
  it('returns baseline unchanged when dataPoints < 10', () => {
    const learned: LearnedWeights = { hook: 0.1, pacing: -0.05 }
    const out = applyLearnedWeights(BASELINE_WEIGHTS, learned, 5)
    expect(out).toBe(BASELINE_WEIGHTS) // reference equality — same object
  })
  it('returns baseline unchanged when learned is null', () => {
    expect(applyLearnedWeights(BASELINE_WEIGHTS, null, 50)).toBe(BASELINE_WEIGHTS)
  })
  it('applies deltas + re-normalises to sum 1.0 when dataPoints >= 10', () => {
    const learned: LearnedWeights = { hook: 0.1, pacing: -0.05, brightness: 0.05 }
    const out = applyLearnedWeights(BASELINE_WEIGHTS, learned, 12)
    const sum = out.hook + out.pacing + out.face + out.audio + out.duration_fit + out.aspect_ratio + out.brightness
    expect(sum).toBeCloseTo(1.0, 9)
    expect(out.hook).toBeGreaterThan(BASELINE_WEIGHTS.hook) // delta increased it (pre-normalise)
  })
  it('clamps deltas to +/- 0.15 cap', () => {
    const learned: LearnedWeights = { hook: 0.5 } // 0.5 -> capped to 0.15
    const out = applyLearnedWeights(BASELINE_WEIGHTS, learned, 20)
    // hook raw = baseline 0.25 + 0.15 = 0.40; total raw sum = 0.4 + 0.20 + 0.15 + 0.15 + 0.10 + 0.10 + 0.05 = 1.15
    // hook normalised = 0.40 / 1.15 ≈ 0.3478
    expect(out.hook).toBeCloseTo(0.40 / 1.15, 4)
  })
  it('output sums to exactly 1.0 within 1e-9 tolerance', () => {
    const learned: LearnedWeights = { hook: 0.05, face: -0.10, audio: 0.08 }
    const out = applyLearnedWeights(BASELINE_WEIGHTS, learned, 25)
    const sum = Object.values(out).reduce((a, b) => a + b, 0)
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9)
  })
})

// ============================================================================
// computeScore — integration of curves + weights
// ============================================================================
describe('computeScore', () => {
  it('returns ScoreResult with overall + 5 platforms', () => {
    const r = computeScore(mockSignals())
    expect(r.overall).toBeGreaterThanOrEqual(0)
    expect(r.overall).toBeLessThanOrEqual(100)
    for (const p of ['youtube','instagram','tiktok','facebook','x'] as const) {
      expect(r.perPlatform[p]).toBeGreaterThanOrEqual(0)
      expect(r.perPlatform[p]).toBeLessThanOrEqual(100)
      expect(Number.isInteger(r.perPlatform[p])).toBe(true)
    }
    expect(Number.isInteger(r.overall)).toBe(true)
  })

  it('D-25 durationSec=0 -> overall 0 + all platforms 0', () => {
    const r = computeScore(mockSignals({ durationSec: 0 }))
    expect(r.overall).toBe(0)
    expect(r.perPlatform.youtube).toBe(0)
    expect(r.perPlatform.instagram).toBe(0)
    expect(r.perPlatform.tiktok).toBe(0)
    expect(r.perPlatform.facebook).toBe(0)
    expect(r.perPlatform.x).toBe(0)
  })

  it('D-25 hasAudio=false zeroes the audio signal but does not crash', () => {
    const r = computeScore(mockSignals({ hasAudio: false, audioEnergy: 0, beatPresent: false }))
    expect(Number.isNaN(r.overall)).toBe(false)
    expect(r.overall).toBeGreaterThanOrEqual(0)
  })

  it('D-25 NaN aspectRatio zeroes that signal but does not crash', () => {
    const r = computeScore(mockSignals({ aspectRatio: NaN }))
    expect(Number.isNaN(r.overall)).toBe(false)
  })

  it('D-25 sceneCount=0 zeroes hook + pacing but does not crash', () => {
    const r = computeScore(mockSignals({ sceneCount: 0, sceneTimestamps: [] }))
    expect(Number.isNaN(r.overall)).toBe(false)
    expect(r.overall).toBeGreaterThanOrEqual(0)
  })

  it('D-25 faceCount=0 zeroes face signal but does not crash', () => {
    const r = computeScore(mockSignals({ faceCount: 0, faceConfidence: undefined }))
    expect(Number.isNaN(r.overall)).toBe(false)
  })

  it('high-quality signals produce score >= 70', () => {
    const r = computeScore(mockSignals({
      durationSec: 25,
      aspectRatio: 0.5625,
      hasAudio: true,
      audioEnergy: 0.9,
      beatPresent: true,
      silenceGapsSec: [0.2],
      sceneCount: 10,
      sceneTimestamps: [0.5, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5],
      faceCount: 1,
      faceConfidence: 0.95,
      brightnessScore: 0.5,
    }))
    expect(r.overall).toBeGreaterThanOrEqual(70)
  })

  it('platform variants differ for the same signals (TikTok hook-heavy, Facebook face-heavy)', () => {
    // Strong hook + pacing, no face -> TikTok > Facebook
    const r = computeScore(mockSignals({
      sceneTimestamps: [0.5, 2, 4, 6, 8, 10, 12, 14, 16, 18],
      sceneCount: 10,
      faceCount: 0,
      faceConfidence: undefined,
    }))
    expect(r.perPlatform.tiktok).toBeGreaterThan(r.perPlatform.facebook)
  })
})

// ============================================================================
// PLATFORM_WEIGHTS row sums (sanity)
// ============================================================================
describe('PLATFORM_WEIGHTS', () => {
  it.each(['youtube','instagram','tiktok','facebook','x'] as const)(
    '%s row sums to 1.0',
    (p) => {
      const w = PLATFORM_WEIGHTS[p]
      const sum = w.hook + w.pacing + w.face + w.audio + w.duration_fit + w.aspect_ratio + w.brightness
      expect(sum).toBeCloseTo(1.0, 9)
    },
  )
  it('BASELINE_WEIGHTS sums to 1.0', () => {
    const w = BASELINE_WEIGHTS
    const sum = w.hook + w.pacing + w.face + w.audio + w.duration_fit + w.aspect_ratio + w.brightness
    expect(sum).toBeCloseTo(1.0, 9)
  })
})
