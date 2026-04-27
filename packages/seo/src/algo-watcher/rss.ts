/**
 * packages/seo/src/algo-watcher/rss.ts
 * RSS feed parser + keyword matcher + Redis GUID deduplication.
 * REQ-074: RSS monitoring for algorithm watcher.
 *
 * Pitfall 4 fix: dedup key = item.guid ?? item.link ?? `${item.isoDate}:${item.title}`
 * (URL-as-GUID is common in Google Search Central feed)
 */
import Parser from 'rss-parser'
import { Redis } from 'ioredis'

const SEEN_KEY = 'seo:algo-watcher:seen-guids'
const SEEN_TTL_SECONDS = 90 * 24 * 60 * 60  // 90 days (D-13)

export interface AlgoAlert {
  guid: string
  title: string
  link: string
  snippet: string
  pubDate: string
  matchedKeywords: string[]
  source: 'google_search_central' | 'configurable_feed'
}

export async function processRssFeed(
  feedUrl: string,
  source: 'google_search_central' | 'configurable_feed',
  keywords: string[],
  redis: Redis,
): Promise<AlgoAlert[]> {
  const parser = new Parser()
  let feed: Awaited<ReturnType<Parser['parseURL']>>
  try {
    feed = await parser.parseURL(feedUrl)
  } catch (err) {
    // Graceful degradation per RESEARCH.md (algorithm watcher must not crash the worker)
    console.error(`[algo-watcher] RSS fetch failed for ${feedUrl}:`, (err as Error).message)
    return []
  }

  const newAlerts: AlgoAlert[] = []

  for (const item of feed.items) {
    // Pitfall 4: stable dedup key using multiple fallbacks
    const guid = item.guid ?? item.link ?? `${item.isoDate ?? ''}:${item.title ?? ''}`
    if (!guid) continue

    const isSeen = await redis.sismember(SEEN_KEY, guid)
    if (isSeen) continue

    const text = `${item.title ?? ''} ${item.contentSnippet ?? ''}`.toLowerCase()
    const matched = keywords.filter(kw => text.includes(kw.toLowerCase()))
    if (matched.length === 0) {
      // Mark as seen even if no keyword match — avoids reprocessing on every run
      const pipeline = redis.pipeline()
      pipeline.sadd(SEEN_KEY, guid)
      pipeline.expire(SEEN_KEY, SEEN_TTL_SECONDS)
      await pipeline.exec()
      continue
    }

    newAlerts.push({
      guid,
      title: item.title ?? 'Untitled',
      link: item.link ?? '',
      snippet: item.contentSnippet ?? '',
      pubDate: item.isoDate ?? new Date().toISOString(),
      matchedKeywords: matched,
      source,
    })

    // Mark GUID as seen — pipeline SADD + EXPIRE (D-13)
    const pipeline = redis.pipeline()
    pipeline.sadd(SEEN_KEY, guid)
    pipeline.expire(SEEN_KEY, SEEN_TTL_SECONDS)
    await pipeline.exec()
  }

  return newAlerts
}
