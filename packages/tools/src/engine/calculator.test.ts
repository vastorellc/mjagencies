/**
 * packages/tools/src/engine/calculator.test.ts
 * Vitest unit tests for runCalculator determinism + validation.
 * REQ-122: same inputs → same outputs.
 */
import { describe, it, expect } from 'vitest'
import { runCalculator } from './calculator.js'
import type { ToolDefinition, BenchmarkDataset } from './types.js'

const mockTool: ToolDefinition = {
  slug: 'test-roi-calculator',
  name: 'Test ROI Calculator',
  agencySlug: 'ecommerce',
  fields: [
    { name: 'revenue', label: 'Monthly Revenue', type: 'number', required: true, min: 0, max: 10_000_000, step: 1 },
    { name: 'adSpend', label: 'Ad Spend', type: 'number', required: true, min: 0, max: 1_000_000, step: 1 },
  ],
  benchmarkKeys: ['ecommerce-roi'],
  calculate(inputs, _benchmarks) {
    const roi = ((Number(inputs['revenue']) - Number(inputs['adSpend'])) / Number(inputs['adSpend'])) * 100
    return {
      metrics: [{ name: 'roi', label: 'Return on Ad Spend', value: `${roi.toFixed(1)}%`, isPrimary: true }],
      disclaimer: 'Results are estimates based on the data you entered and industry averages. Actual outcomes vary.',
      benchmarkCitation: 'Industry benchmarks sourced from Test Source, 2024.',
      benchmarkExpired: false,
      benchmarkUpdatedLabel: 'January 2024',
    }
  },
}

const mockBenchmarks: Record<string, BenchmarkDataset> = {
  'ecommerce-roi': {
    key: 'ecommerce-roi',
    sourceName: 'Test Source',
    sourceYear: 2024,
    sourceUrl: 'https://example.com',
    updatedAt: new Date().toISOString(),
    data: { avgRoas: 4.2 },
  },
}

describe('runCalculator', () => {
  it('returns deterministic output for identical inputs', () => {
    const input = { tool: mockTool, inputs: { revenue: 50000, adSpend: 10000 }, benchmarks: mockBenchmarks }
    const r1 = runCalculator(input)
    const r2 = runCalculator(input)
    expect(r1).toEqual(r2)
  })

  it('returns ok: true with ToolResult on valid inputs', () => {
    const out = runCalculator({ tool: mockTool, inputs: { revenue: 50000, adSpend: 10000 }, benchmarks: mockBenchmarks })
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.result.metrics[0]?.value).toBe('400.0%')
    }
  })

  it('returns ok: false with fieldErrors on missing required field', () => {
    const out = runCalculator({ tool: mockTool, inputs: { revenue: 50000 }, benchmarks: mockBenchmarks })
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.fieldErrors['adSpend']).toContain('Please enter a valid number')
    }
  })

  it('returns ok: false when input exceeds max', () => {
    const out = runCalculator({ tool: mockTool, inputs: { revenue: 50000, adSpend: 2_000_000 }, benchmarks: mockBenchmarks })
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.fieldErrors['adSpend']).toContain('must be between')
    }
  })

  it('rejects NaN input', () => {
    const out = runCalculator({ tool: mockTool, inputs: { revenue: 'notanumber', adSpend: 1000 }, benchmarks: mockBenchmarks })
    expect(out.ok).toBe(false)
  })
})
