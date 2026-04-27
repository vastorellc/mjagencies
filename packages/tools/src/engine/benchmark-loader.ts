/**
 * packages/tools/src/engine/benchmark-loader.ts
 *
 * Loads benchmark datasets from packages/tools/src/data/*.json.
 * REQ-124: enforces 12-month expiry tracking.
 * REQ-406: tool stays live after expiry — only flags expired=true.
 *
 * Benchmark JSON files live at:
 *   packages/tools/src/data/{agencySlug}/{benchmarkKey}.json
 *
 * Each JSON file must conform to BenchmarkDataset interface.
 */
import type { BenchmarkDataset } from './types.js'

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000

/**
 * Returns true if the benchmark's updatedAt is older than 12 months.
 * REQ-124: expiry enforced. REQ-406: tool stays live — only warn.
 */
export function isBenchmarkExpired(benchmark: BenchmarkDataset): boolean {
  const updated = new Date(benchmark.updatedAt).getTime()
  return Date.now() - updated > TWELVE_MONTHS_MS
}

/**
 * Returns a formatted "Month Year" label for the benchmark expiry badge.
 * UI-SPEC copy: "Benchmark data last updated [month year]."
 */
export function formatBenchmarkUpdatedLabel(benchmark: BenchmarkDataset): string {
  const d = new Date(benchmark.updatedAt)
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

/**
 * Loads one or more benchmark datasets by key.
 * In production: reads from packages/tools/src/data/{agencySlug}/{key}.json
 * The datasets are statically imported at build time — no runtime DB queries.
 *
 * @param agencySlug — used to locate the data directory
 * @param keys — benchmark keys to load (matches BenchmarkDataset.key)
 * @returns Record keyed by benchmark key
 *
 * Implementation note: each tool's calculate() receives the full benchmarks record.
 * The loader is called once per page request (or at build time for static generation).
 * Benchmark JSON is registered in the tool definition — planners add JSON files in Plan 10-02.
 */
export async function loadBenchmarks(
  agencySlug: string,
  keys: string[],
): Promise<Record<string, BenchmarkDataset>> {
  const results: Record<string, BenchmarkDataset> = {}

  for (const key of keys) {
    // Dynamic import — tree-shaken at build time per tool page
    // Path: packages/tools/src/data/{agencySlug}/{key}.json
    try {
      const module = await import(`../data/${agencySlug}/${key}.json`, {
        with: { type: 'json' },
      })
      const dataset = module.default as BenchmarkDataset
      results[key] = dataset
    } catch {
      throw new Error(
        `Benchmark dataset not found: packages/tools/src/data/${agencySlug}/${key}.json. ` +
        `Create this file before running the tool. See REQ-124.`,
      )
    }
  }

  return results
}
