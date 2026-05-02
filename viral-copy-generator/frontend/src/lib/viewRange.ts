import type { Platform, ColorBand } from './types'
import { bandForScore } from './score'

/**
 * D-13: Per-platform expected view-range table.
 *
 * Strings copied verbatim from CONTEXT.md. Rationale baked in:
 * - TikTok highest tier (FYP virality drives massive view counts)
 * - YouTube second (long-form discovery)
 * - Instagram and Facebook share the same tier (Meta algorithmic, declining organic reach)
 * - X smallest (smaller PK user base)
 *
 * Lookup is by ColorBand derived from a per-platform score (SCORE-04).
 */
export const VIEW_RANGES: Record<Platform, Record<ColorBand, string>> = {
  youtube: {
    'red': '< 1k',
    'amber': '1k-10k',
    'green': '10k-100k',
    'bright-green': '100k-1M+',
  },
  instagram: {
    'red': '< 500',
    'amber': '500-5k',
    'green': '5k-50k',
    'bright-green': '50k-500k+',
  },
  tiktok: {
    'red': '< 2k',
    'amber': '2k-25k',
    'green': '25k-250k',
    'bright-green': '250k-5M+',
  },
  facebook: {
    'red': '< 500',
    'amber': '500-5k',
    'green': '5k-50k',
    'bright-green': '50k-500k+',
  },
  x: {
    'red': '< 500',
    'amber': '500-5k',
    'green': '5k-25k',
    'bright-green': '25k-250k+',
  },
}

/**
 * viewRangeFor (SCORE-04, D-13)
 *
 * Looks up the expected view range for a platform given that platform's own
 * score. Callers MUST pass `perPlatform[platform]` from `ScoreResult`, NOT
 * the overall score — D-13 ranges are calibrated to platform-specific scores.
 */
export function viewRangeFor(platform: Platform, score: number): string {
  const band = bandForScore(score)
  return VIEW_RANGES[platform][band]
}
