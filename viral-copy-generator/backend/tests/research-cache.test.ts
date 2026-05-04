// Research cache + trend fetcher shape tests — Wave 0 stubs (RED state)
// These become GREEN in Plans 09-02 and 09-03.
import { describe, it, expect } from 'vitest'

describe('getTrendCache', () => {
  it('returns null when no cached row exists for (source, niche)', async () => {
    // Covered by Plan 09-03 (research-cache.ts implementation)
    const { getTrendCache } = await import('../src/lib/research-cache.js')
    const result = await getTrendCache('all', 'travel')
    expect(result).toBeNull()
  })

  it('returns cached TrendItem[] when fresh row exists for (source, niche)', async () => {
    const { getTrendCache, setTrendCache } = await import('../src/lib/research-cache.js')
    const items = [{ title: 'test', score: 50, source: 'reddit' as const }]
    await setTrendCache('all', 'travel', items)
    const result = await getTrendCache('all', 'travel')
    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
  })
})

describe('fetchYouTubeTrends', () => {
  it('returns TrendItem[] (may be empty if YOUTUBE_API_KEY absent)', async () => {
    const { fetchYouTubeTrends } = await import('../src/lib/trends/youtube.js')
    const result = await fetchYouTubeTrends('travel')
    expect(Array.isArray(result)).toBe(true)
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('title')
      expect(result[0]).toHaveProperty('score')
      expect(result[0]).toHaveProperty('source')
    }
  })
})

describe('fetchGoogleTrends', () => {
  it('returns TrendItem[] without throwing (fail-open)', async () => {
    const { fetchGoogleTrends } = await import('../src/lib/trends/google-trends.js')
    const result = await fetchGoogleTrends('travel')
    expect(Array.isArray(result)).toBe(true)
  })
})

describe('fetchRedditTrends', () => {
  it('returns TrendItem[] with correct shape', async () => {
    const { fetchRedditTrends } = await import('../src/lib/trends/reddit.js')
    const result = await fetchRedditTrends('travel')
    expect(Array.isArray(result)).toBe(true)
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('title')
      expect(result[0].source).toBe('reddit')
    }
  })
})

describe('fetchExplodingTopics', () => {
  it('returns TrendItem[] without throwing even on fetch failure', async () => {
    const { fetchExplodingTopics } = await import('../src/lib/trends/exploding.js')
    const result = await fetchExplodingTopics('travel')
    expect(Array.isArray(result)).toBe(true)
  })
})
