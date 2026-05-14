// engine.calibration.test.ts — A2/A3 threshold empirical calibration
// Run with: npm run test:browser -- src/lib/engine.calibration.test.ts
// The [CALIB] console lines give you the measured values for 03-CALIBRATION.md

import { describe, it, expect } from 'vitest'
import { __testables } from './engine'
import { loadFixture } from '../../test/setup'

const { analyseAudioRaw, AUDIO_THRESHOLDS } = __testables
const FIXTURES = ['with-face.mp4', 'no-face.mp4', 'no-audio.mp4', 'sample.mov', 'corrupt.mp4'] as const

describe('engine — A2/A3 calibration evidence', () => {
  it.each(FIXTURES)('measures meanFlux + meanRms for %s', async (name) => {
    const file = await loadFixture(name).catch(() => null)
    if (!file) return
    const r = await analyseAudioRaw(file)
    // Print measurement so the developer can transcribe into 03-CALIBRATION.md
    // eslint-disable-next-line no-console
    console.info(`[CALIB] ${name} hasAudio=${r.signals.hasAudio} meanFlux=${r.meanFlux.toFixed(4)} meanRms=${r.meanRms.toFixed(4)} windows=${r.windowCount}`)
    // Sanity-only assertion — catches NaN / undefined regressions
    expect(Number.isFinite(r.meanFlux)).toBe(true)
    expect(Number.isFinite(r.meanRms)).toBe(true)
  }, 90_000)

  it('with-face.mp4 mean spectralFlux exceeds BEAT_FLUX_THRESHOLD (else update constant + this test)', async () => {
    const file = await loadFixture('with-face.mp4').catch(() => null)
    if (!file) return
    const r = await analyseAudioRaw(file)
    if (!r.signals.hasAudio) return  // fixture without audio — N/A
    expect(r.meanFlux).toBeGreaterThan(AUDIO_THRESHOLDS.BEAT_FLUX_THRESHOLD)
  }, 90_000)

  it('with-face.mp4 mean rms exceeds SILENCE_RMS_THRESHOLD (else talking-head clip would be classified as silence)', async () => {
    const file = await loadFixture('with-face.mp4').catch(() => null)
    if (!file) return
    const r = await analyseAudioRaw(file)
    if (!r.signals.hasAudio) return
    expect(r.meanRms).toBeGreaterThan(AUDIO_THRESHOLDS.SILENCE_RMS_THRESHOLD)
  }, 90_000)
})
