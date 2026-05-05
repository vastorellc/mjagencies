// backend/src/lib/trends/reddit.ts
// RESEARCH-04: Reddit public JSON API, niche-mapped subreddits, no OAuth needed
// PITFALL 3: Custom User-Agent mandatory — default Node.js UA is blocklisted by Reddit
import type { TrendItem } from '../../db/schema.js'

const REDDIT_USER_AGENT = 'viral-copy-generator/1.0 (by /u/viral_copy_bot)'

const SUBREDDIT_MAP: Record<string, string[]> = {
  travel: ['pakistan', 'travel', 'CasualPakistan'],
  hotels: ['pakistan', 'travel'],
  cars: ['motorcycles', 'pakistan'],
  bikes: ['motorcycles', 'pakistan'],
  coding: ['programming', 'learnprogramming'],
  lifestyle: ['CasualPakistan', 'pakistan'],
}

interface RedditPost {
  data: {
    title: string
    score: number
    permalink: string
  }
}

interface RedditResponse {
  data?: {
    children?: RedditPost[]
  }
}

export async function fetchRedditTrends(niche: string): Promise<TrendItem[]> {
  try {
    const subs = SUBREDDIT_MAP[niche] ?? ['pakistan', 'AskPakistan']
    const results: TrendItem[] = []

    for (const sub of subs) {
      try {
        const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, {
          headers: {
            // REQUIRED: Reddit 429s any request without a valid User-Agent (Pitfall 3)
            'User-Agent': REDDIT_USER_AGENT,
          },
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) continue
        const data = (await res.json()) as RedditResponse
        const posts = data?.data?.children ?? []
        for (const post of posts) {
          results.push({
            title: post.data.title,
            score: Math.min(100, Math.floor(post.data.score / 100)),
            source: 'reddit' as const,
            url: `https://reddit.com${post.data.permalink}`,
          })
        }
      } catch {
        // Per-subreddit fail-open — one timeout does not abort the whole niche
        continue
      }
    }

    return results
  } catch {
    // Outer fail-open — unexpected error never blocks other sources
    return []
  }
}
