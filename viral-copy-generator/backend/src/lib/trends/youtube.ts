// backend/src/lib/trends/youtube.ts
// RESEARCH-02: YouTube Data API v3 — mostPopular chart, regionCode=PK, per-niche category
// Auth: server-side API key only — no OAuth needed for public chart data (Pitfall 4)
import { google } from 'googleapis'
import type { TrendItem } from '../../db/schema.js'

const YOUTUBE_CATEGORY_MAP: Record<string, string> = {
  travel: '19',    // Travel & Events
  hotels: '19',    // Travel & Events
  cars: '2',       // Autos & Vehicles
  bikes: '2',      // Autos & Vehicles
  coding: '28',    // Science & Technology
  lifestyle: '22', // People & Blogs
}

export async function fetchYouTubeTrends(niche: string): Promise<TrendItem[]> {
  // Guard: skip if API key absent — other sources still work (RESEARCH.md Pitfall 4)
  if (!process.env.YOUTUBE_API_KEY) return []

  try {
    const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY })
    const categoryId = YOUTUBE_CATEGORY_MAP[niche] ?? '24' // Entertainment fallback

    const res = await youtube.videos.list({
      part: ['snippet', 'statistics'],
      chart: 'mostPopular',
      regionCode: 'PK',
      videoCategoryId: categoryId,
      maxResults: 10,
    })

    return (res.data.items ?? []).map((video) => ({
      title: video.snippet?.title ?? '',
      score: Math.min(100, Math.floor(Number(video.statistics?.viewCount ?? 0) / 10000)),
      source: 'youtube' as const,
      url: `https://youtube.com/watch?v=${video.id ?? ''}`,
    }))
  } catch {
    // Fail-open: YouTube API failure never blocks other sources
    return []
  }
}
