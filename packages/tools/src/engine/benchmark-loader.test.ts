/**
 * packages/tools/src/engine/benchmark-loader.test.ts
 */
import { describe, it, expect } from 'vitest'
import { isBenchmarkExpired, formatBenchmarkUpdatedLabel } from './benchmark-loader.js'
import type { BenchmarkDataset } from './types.js'

function makeBenchmark(updatedAt: string): BenchmarkDataset {
  return {
    key: 'test',
    sourceName: 'Test Source',
    sourceYear: 2024,
    sourceUrl: 'https://example.com',
    updatedAt,
    data: {},
  }
}

describe('isBenchmarkExpired', () => {
  it('returns false for benchmark updated today', () => {
    const b = makeBenchmark(new Date().toISOString())
    expect(isBenchmarkExpired(b)).toBe(false)
  })

  it('returns true for benchmark updated 13 months ago', () => {
    const d = new Date()
    d.setMonth(d.getMonth() - 13)
    const b = makeBenchmark(d.toISOString())
    expect(isBenchmarkExpired(b)).toBe(true)
  })

  it('returns false for benchmark updated 11 months ago', () => {
    const d = new Date()
    d.setMonth(d.getMonth() - 11)
    const b = makeBenchmark(d.toISOString())
    expect(isBenchmarkExpired(b)).toBe(false)
  })
})

describe('formatBenchmarkUpdatedLabel', () => {
  it('returns month and year string', () => {
    const b = makeBenchmark('2024-01-15T00:00:00Z')
    const label = formatBenchmarkUpdatedLabel(b)
    expect(label).toContain('2024')
  })
})
