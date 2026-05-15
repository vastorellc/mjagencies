import { describe, it, expect, afterEach } from 'vitest'
import { canRunEngine, getFFmpeg, __resetEngineForTests } from './engine'
import { removeWebAssembly } from '../../test/setup'

describe('engine.canRunEngine — negative branches', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => { while (cleanups.length) cleanups.pop()!(); __resetEngineForTests() })

  it('reports WebAssembly missing', () => {
    cleanups.push(removeWebAssembly())
    const r = canRunEngine()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/WebAssembly/i)
  })

  it('reports cross-origin isolation missing when crossOriginIsolated is false', () => {
    const original = window.crossOriginIsolated
    Object.defineProperty(window, 'crossOriginIsolated', { value: false, configurable: true })
    cleanups.push(() => { Object.defineProperty(window, 'crossOriginIsolated', { value: original, configurable: true }) })
    const r = canRunEngine()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/Cross-origin isolation/i)
  })

  it('getFFmpeg rejects when preflight fails', async () => {
    cleanups.push(removeWebAssembly())
    await expect(getFFmpeg()).rejects.toThrow(/ffmpeg unavailable/)
  })
})

describe('engine.getFFmpeg — singleton', () => {
  const isolated = typeof SharedArrayBuffer === 'function' && (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true

  it.skipIf(!isolated)('returns the same FFmpeg instance on repeat calls', async () => {
    const a = await getFFmpeg()
    const b = await getFFmpeg()
    expect(a).toBe(b)
  })
})
