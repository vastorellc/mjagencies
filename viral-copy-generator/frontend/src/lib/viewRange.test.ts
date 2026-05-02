import { describe, it, expect } from 'vitest'
import { viewRangeFor, VIEW_RANGES } from './viewRange'
import type { Platform, ColorBand } from './types'

describe('viewRangeFor (D-13)', () => {
  // Boundary scores cover all 4 bands: red(0-39), amber(40-59), green(60-79), bright-green(80-100)
  it.each<[Platform, number, string]>([
    // YouTube — all four bands plus boundary edges
    ['youtube', 0, '< 1k'],
    ['youtube', 39, '< 1k'],
    ['youtube', 40, '1k-10k'],
    ['youtube', 59, '1k-10k'],
    ['youtube', 60, '10k-100k'],
    ['youtube', 79, '10k-100k'],
    ['youtube', 80, '100k-1M+'],
    ['youtube', 100, '100k-1M+'],
    // Instagram — sample one per band
    ['instagram', 30, '< 500'],
    ['instagram', 50, '500-5k'],
    ['instagram', 70, '5k-50k'],
    ['instagram', 90, '50k-500k+'],
    // TikTok — highest tier (FYP virality)
    ['tiktok', 30, '< 2k'],
    ['tiktok', 50, '2k-25k'],
    ['tiktok', 70, '25k-250k'],
    ['tiktok', 90, '250k-5M+'],
    // Facebook — same shape as Instagram (declining organic reach)
    ['facebook', 30, '< 500'],
    ['facebook', 50, '500-5k'],
    ['facebook', 70, '5k-50k'],
    ['facebook', 90, '50k-500k+'],
    // X — smallest tier (PK market)
    ['x', 30, '< 500'],
    ['x', 50, '500-5k'],
    ['x', 70, '5k-25k'],
    ['x', 90, '25k-250k+'],
  ])('viewRangeFor(%s, %i) === %s', (platform, score, expected) => {
    expect(viewRangeFor(platform, score)).toBe(expected)
  })
})

describe('VIEW_RANGES table shape', () => {
  const platforms: Platform[] = ['youtube', 'instagram', 'tiktok', 'facebook', 'x']
  const bands: ColorBand[] = ['red', 'amber', 'green', 'bright-green']

  it.each(platforms)('%s has all 4 bands populated with non-empty strings', (p) => {
    for (const b of bands) {
      expect(VIEW_RANGES[p][b]).toBeTruthy()
      expect(typeof VIEW_RANGES[p][b]).toBe('string')
    }
  })

  it('table has exactly 5 platforms', () => {
    expect(Object.keys(VIEW_RANGES).sort()).toEqual(
      ['facebook', 'instagram', 'tiktok', 'x', 'youtube'],
    )
  })

  it('TikTok bright-green is the highest range (D-13 rationale: FYP virality)', () => {
    // TikTok bright-green should mention 5M (highest tier in table)
    expect(VIEW_RANGES.tiktok['bright-green']).toContain('5M')
    expect(VIEW_RANGES.tiktok['bright-green']).toBe('250k-5M+')
  })

  it('X bright-green is the smallest among bright-greens (PK market)', () => {
    expect(VIEW_RANGES.x['bright-green']).toBe('25k-250k+')
  })

  it('Instagram and Facebook share the same view tiers (D-13)', () => {
    for (const b of bands) {
      expect(VIEW_RANGES.instagram[b]).toBe(VIEW_RANGES.facebook[b])
    }
  })
})
