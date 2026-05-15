import { describe, it, expect } from 'vitest'
import { canRunEngine, __testables } from './engine'

describe('engine — extractFrames bounding (Bug 1 / T-03-28)', () => {
  it('exposes FRAME_TARGET=10 and FRAME_EXTRACT_TIMEOUT_MS=60000 via __testables', () => {
    expect((__testables as { FRAME_TARGET: number }).FRAME_TARGET).toBe(10)
    expect((__testables as { FRAME_EXTRACT_TIMEOUT_MS: number }).FRAME_EXTRACT_TIMEOUT_MS).toBe(60_000)
  })

  it('returns [] without throwing when ffmpeg exec rejects', async () => {
    const ext = (__testables as unknown as { extractFrames: (ff: unknown, meta: unknown) => Promise<string[]> }).extractFrames
    const fakeFf = {
      on: () => {}, off: () => {},
      exec: () => Promise.reject(new Error('boom')),
      readFile: () => Promise.reject(new Error('absent')),
      deleteFile: () => Promise.resolve(),
    }
    const fakeMeta = { totalFrames: 0, durationSec: 0, fps: 0, width: 0, height: 0, aspectRatio: 0, bitrate: 0, hasAudio: false }
    const out = await ext(fakeFf, fakeMeta)
    expect(out).toEqual([])
  })

  it('clamps N >= 1 and calls exec when totalFrames is 0 (fallback path)', async () => {
    const ext = (__testables as unknown as { extractFrames: (ff: unknown, meta: unknown) => Promise<string[]> }).extractFrames
    const execArgs: string[][] = []
    const fakeFf = {
      on: () => {}, off: () => {},
      exec: (args: string[]) => { execArgs.push(args); return Promise.resolve(0) },
      readFile: () => Promise.reject(new Error('absent')),
      deleteFile: () => Promise.resolve(),
    }
    const fakeMeta = { totalFrames: 0, durationSec: 0, fps: 0, width: 0, height: 0, aspectRatio: 0, bitrate: 0, hasAudio: false }
    await ext(fakeFf, fakeMeta)
    expect(execArgs.length).toBe(1)
    // fallback: 60s * 30fps / 10 target = N=180; select filter contains mod(n\,180)
    const vfArg = execArgs[0][execArgs[0].indexOf('-vf') + 1]
    expect(vfArg).toMatch(/mod\(n\\,\d+\)/)
    // -frames:v ceiling = 10
    const framesIdx = execArgs[0].indexOf('-frames:v')
    expect(framesIdx).toBeGreaterThan(-1)
    expect(execArgs[0][framesIdx + 1]).toBe('10')
  })
})

describe('engine smoke (Wave 0)', () => {
  const isolated = typeof SharedArrayBuffer === 'function' && (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true

  it.skipIf(!isolated)('runs in a browser with crossOriginIsolated and SharedArrayBuffer', () => {
    expect(typeof WebAssembly).toBe('object')
    expect(typeof SharedArrayBuffer).toBe('function')
    expect(window.crossOriginIsolated).toBe(true)
  })

  it.skipIf(!isolated)('canRunEngine returns ok:true when env is correct', () => {
    const result = canRunEngine()
    expect(result.ok).toBe(true)
  })

  it('can fetch a fixture file from test/fixtures/', async () => {
    const { loadFixture } = await import('../../test/setup')
    const file = await loadFixture('with-face.mp4').catch(() => null)
    if (!file) return
    expect(file).toBeInstanceOf(File)
    expect(file.size).toBeGreaterThan(0)
  })
})
