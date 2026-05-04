// backend/src/lib/trends/google-trends.ts
// RESEARCH-03: Google Trends relatedQueries, geo=PK, last 7 days
// PITFALL 7: google-trends-api returns a JSON STRING not a parsed object — always JSON.parse()
// CJS/ESM interop confirmed (Plan 09-01 spike): default import returns 'object' — no createRequire needed
import googleTrends from 'google-trends-api'
import type { TrendItem } from '../../db/schema.js'

interface GoogleTrendsRankedKeyword {
  query: string
  value: number
}

interface GoogleTrendsResponse {
  default?: {
    rankedList?: Array<{
      rankedKeyword?: GoogleTrendsRankedKeyword[]
    }>
  }
}

export async function fetchGoogleTrends(niche: string): Promise<TrendItem[]> {
  try {
    // relatedQueries returns a JSON string (PITFALL 7 — must JSON.parse)
    const raw = await googleTrends.relatedQueries({
      keyword: niche,
      geo: 'PK',
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    })
    const parsed = JSON.parse(raw as string) as GoogleTrendsResponse
    // Index 1 = rising queries (index 0 = top/established queries)
    const rising = parsed?.default?.rankedList?.[1]?.rankedKeyword ?? []
    return rising.slice(0, 10).map((item) => ({
      title: item.query,
      score: Math.min(100, item.value),
      source: 'google-trends' as const,
    }))
  } catch {
    // Google may return CAPTCHA on burst requests — fail-open (Pitfall 2)
    return []
  }
}
