// backend/src/lib/trends/exploding.ts
// RESEARCH-05: ExplodingTopics page scrape — LOW confidence, pure best-effort
// PITFALL 5: ExplodingTopics is a JS-rendered SPA; raw HTML fetch may not contain data
// This fetcher MUST return [] on ANY failure — never throw, never block other sources.
import type { TrendItem } from '../../db/schema.js'

interface ExplodingTopic {
  topic?: string
  name?: string
  growth?: number
}

export async function fetchExplodingTopics(_niche: string): Promise<TrendItem[]> {
  try {
    const res = await fetch('https://explodingtopics.com/blog/trending-topics', {
      headers: { 'User-Agent': 'viral-copy-generator/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []

    const html = await res.text()

    // Try to find JSON embedded in a <script> tag
    // ExplodingTopics may embed topic data as a JS variable or JSON blob
    const match = /<script[^>]*>\s*.*?(\[{.*?}\])/s.exec(html)
    if (!match?.[1]) return []

    const items = JSON.parse(match[1]) as ExplodingTopic[]
    return items.slice(0, 10).map((item) => ({
      title: item.topic ?? item.name ?? 'Unknown Topic',
      score: Math.min(100, item.growth ?? 50),
      source: 'exploding-topics' as const,
    }))
  } catch {
    // Silently degrade — ExplodingTopics scraping is low-confidence (Pitfall 5)
    return []
  }
}
