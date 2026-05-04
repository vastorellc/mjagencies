// backend/src/routes/research.ts
// Phase 9: Content Research Engine routes
// Auth: inherited from app.use('/api', authMiddleware) — no per-route decoration needed
import { Router, type Request, type Response } from 'express'
import { eq, and, desc } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { content_ideas } from '../db/schema.js'
import { getTrendCache, setTrendCache } from '../lib/research-cache.js'
import { fetchYouTubeTrends } from '../lib/trends/youtube.js'
import { fetchGoogleTrends } from '../lib/trends/google-trends.js'
import { fetchRedditTrends } from '../lib/trends/reddit.js'
import { fetchExplodingTopics } from '../lib/trends/exploding.js'
import { callResearchAI } from '../lib/research-ai.js'
import { buildCalendar } from '../lib/calendar.js'
import { getBoss } from '../lib/boss.js'
import type { TrendItem, ContentIdeaData } from '../db/schema.js'

export const researchRouter = Router()

const VALID_NICHES = ['travel', 'hotels', 'cars', 'bikes', 'coding', 'lifestyle'] as const
type ValidNiche = typeof VALID_NICHES[number]

export function isValidNiche(n: string): n is ValidNiche {
  return (VALID_NICHES as readonly string[]).includes(n)
}

// ── RESEARCH-11: Hashtag intelligence ranking ──────────────────────────────
// trendVelocity * (1 + userAvgViews / 1000)
interface HashtagIntelItem {
  hashtag: string
  trendScore: number
  userAvgViews: number
  combinedScore: number
  source: 'external' | 'user' | 'both'
}

function buildHashtagIntel(
  trends: TrendItem[],
  userHashtags: Array<{ hashtag: string; avg_views: number }>,
): HashtagIntelItem[] {
  // Extract hashtag-like words from trend titles (words starting with # or short keywords)
  const externalMap = new Map<string, number>()
  for (const t of trends) {
    const words = t.title.toLowerCase().split(/\s+/)
    for (const w of words) {
      const tag = w.replace(/^#/, '').replace(/[^a-z0-9_]/g, '')
      if (tag.length >= 3) {
        externalMap.set(tag, Math.max(externalMap.get(tag) ?? 0, t.score))
      }
    }
  }

  const userMap = new Map<string, number>()
  for (const h of userHashtags) {
    userMap.set(h.hashtag.toLowerCase().replace(/^#/, ''), h.avg_views)
  }

  // Merge: hashtags that appear in both get 'both' source
  const allTags = new Set([...externalMap.keys(), ...userMap.keys()])
  const items: HashtagIntelItem[] = []

  for (const tag of allTags) {
    const trendScore = externalMap.get(tag) ?? 0
    const userAvgViews = userMap.get(tag) ?? 0
    const combinedScore = trendScore * (1 + userAvgViews / 1000)
    const source: HashtagIntelItem['source'] =
      externalMap.has(tag) && userMap.has(tag) ? 'both' :
      userMap.has(tag) ? 'user' : 'external'

    items.push({ hashtag: tag, trendScore, userAvgViews, combinedScore, source })
  }

  return items.sort((a, b) => b.combinedScore - a.combinedScore).slice(0, 30)
}

// ── GET /api/research/trends ────────────────────────────────────────────────
// RESEARCH-06: Cache-first; fetch live on miss; store result
// RESEARCH-15: Returns fetchedAt for freshness indicator
researchRouter.get('/trends', async (req: Request, res: Response) => {
  const niche = (req.query['niche'] as string | undefined) ?? 'travel'

  if (!isValidNiche(niche)) {
    res.status(400).json({ error: 'invalid_niche' })
    return
  }

  try {
    const cached = await getTrendCache('all', niche)
    if (cached) {
      res.json({ trends: cached.data, fromCache: true, fetchedAt: cached.fetchedAt })
      return
    }
  } catch (err) {
    console.error('[research/trends] cache read error:', (err as Error).message)
    // Fall through to live fetch — do not fail on cache miss error
  }

  // Cache miss (or cache error) — fetch from all sources in parallel (fail-open via Promise.allSettled)
  const [yt, gt, rd, et] = await Promise.allSettled([
    fetchYouTubeTrends(niche),
    fetchGoogleTrends(niche),
    fetchRedditTrends(niche),
    fetchExplodingTopics(niche),
  ])

  const trends: TrendItem[] = [
    ...(yt.status === 'fulfilled' ? yt.value : []),
    ...(gt.status === 'fulfilled' ? gt.value : []),
    ...(rd.status === 'fulfilled' ? rd.value : []),
    ...(et.status === 'fulfilled' ? et.value : []),
  ]

  try {
    await setTrendCache('all', niche, trends)
  } catch (err) {
    console.error('[research/trends] cache write error:', (err as Error).message)
    // Non-fatal — still return the live data to the client
  }

  const fetchedAt = new Date().toISOString()
  res.json({ trends, fromCache: false, fetchedAt })
})

// ── POST /api/research/generate ────────────────────────────────────────────
// RESEARCH-07 + RESEARCH-08: Combine trend + learning data, call AI, return ideas + calendar + hashtags
researchRouter.post('/generate', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const niche = (req.body?.niche as string | undefined) ?? 'travel'

  if (!isValidNiche(niche)) {
    res.status(400).json({ error: 'invalid_niche' })
    return
  }

  // Fetch trend cache + user learning data in parallel
  const [trendResult, hooksResult, hashtagsResult, nicheResult, timesResult] =
    await Promise.allSettled([
      getTrendCache('all', niche),
      db.execute<{ hook_text: string; max_views: number }>(
        sql`SELECT hook_text, MAX(actual_views) AS max_views
            FROM learning_signals
            WHERE user_id = ${userId} AND niche = ${niche} AND actual_views IS NOT NULL
            GROUP BY hook_text ORDER BY max_views DESC NULLS LAST LIMIT 5`
      ),
      db.execute<{ hashtag: string; avg_views: number }>(
        sql`SELECT unnest(hashtags) AS hashtag, AVG(actual_views) AS avg_views
            FROM learning_signals
            WHERE user_id = ${userId} AND niche = ${niche} AND actual_views IS NOT NULL
            GROUP BY hashtag ORDER BY avg_views DESC NULLS LAST LIMIT 20`
      ),
      db.execute<{ niche: string; avg_views: number }>(
        sql`SELECT COALESCE(niche, 'Other') AS niche, AVG(actual_views) AS avg_views
            FROM learning_signals
            WHERE user_id = ${userId} AND actual_views IS NOT NULL
            GROUP BY COALESCE(niche, 'Other') ORDER BY avg_views DESC NULLS LAST LIMIT 1`
      ),
      db.execute<{ dow: number; hour: number; platform: string; avg_views: number; post_count: number }>(
        sql`SELECT EXTRACT(DOW FROM pp.posted_at AT TIME ZONE 'Asia/Karachi')::int AS dow,
                   EXTRACT(HOUR FROM pp.posted_at AT TIME ZONE 'Asia/Karachi')::int AS hour,
                   pp.platform, AVG(pp.actual_views) AS avg_views, COUNT(*)::int AS post_count
            FROM platform_posts pp
            WHERE pp.user_id = ${userId} AND pp.actual_views IS NOT NULL
              AND pp.upload_status = 'posted' AND pp.posted_at IS NOT NULL
            GROUP BY dow, hour, pp.platform HAVING COUNT(*) >= 2
            ORDER BY avg_views DESC NULLS LAST`
      ),
    ])

  const trends = trendResult.status === 'fulfilled' && trendResult.value
    ? trendResult.value.data : []
  const topHooks = hooksResult.status === 'fulfilled' ? hooksResult.value.rows : []
  const topHashtags = hashtagsResult.status === 'fulfilled' ? hashtagsResult.value.rows : []
  const bestNiche = nicheResult.status === 'fulfilled'
    ? (nicheResult.value.rows[0]?.niche ?? niche) : niche
  const postingTimes = timesResult.status === 'fulfilled' ? timesResult.value.rows : []

  // Call AI with combined context
  const ideas: ContentIdeaData[] = await callResearchAI({
    userId, trends, topHooks, topHashtags, bestNiche, postingTimes,
    userNiches: [niche],
  }).catch(() => [])  // callResearchAI error → empty ideas (no_api_key_configured etc.)

  // Persist ideas to content_ideas table (unsaved by default)
  // .returning() so the frontend receives real UUIDs for save/unsave
  let ideasWithIds: Array<ContentIdeaData & { id: string }> = ideas.map(idea => ({ ...idea, id: '' }))
  if (ideas.length > 0) {
    const inserted = await db.insert(content_ideas).values(
      ideas.map(idea => ({
        user_id: userId,
        idea,
        niches: [niche],
        platforms: idea.platforms,
        saved: false,
      }))
    ).returning({ id: content_ideas.id })
    // Zip inserted UUIDs back onto idea objects
    ideasWithIds = ideas.map((idea, i) => ({ ...idea, id: inserted[i]?.id ?? '' }))
  }

  const calendar = buildCalendar(ideas, postingTimes)
  const hashtags = buildHashtagIntel(trends, topHashtags)
  const fetchedAt = new Date().toISOString()

  res.json({ ideas: ideasWithIds, calendar, hashtags, fetchedAt })
})

// ── GET /api/research/saved ────────────────────────────────────────────────
// RESEARCH-13: Returns only the authenticated user's saved ideas (RLS on content_ideas)
researchRouter.get('/saved', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string

  const rows = await db
    .select()
    .from(content_ideas)
    .where(and(eq(content_ideas.user_id, userId), eq(content_ideas.saved, true)))
    .orderBy(desc(content_ideas.generated_at))
    .limit(50)

  res.json({ ideas: rows })
})

// ── POST /api/research/ideas/:id/save ──────────────────────────────────────
// RESEARCH-13: Save or unsave an idea (toggle)
// T-09-11: user_id check ensures user can only save their own ideas
researchRouter.post('/ideas/:id/save', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const { id } = req.params as { id: string }

  const existing = await db
    .select({ id: content_ideas.id, saved: content_ideas.saved })
    .from(content_ideas)
    .where(and(eq(content_ideas.id, id), eq(content_ideas.user_id, userId)))
    .limit(1)

  if (!existing[0]) {
    res.status(404).json({ error: 'idea_not_found' })
    return
  }

  const newSaved = !existing[0].saved
  await db
    .update(content_ideas)
    .set({ saved: newSaved })
    .where(and(eq(content_ideas.id, id), eq(content_ideas.user_id, userId)))

  res.json({ ok: true, saved: newSaved })
})

// ── POST /api/research/refresh ─────────────────────────────────────────────
// RESEARCH-14: On-demand refresh — bypasses 24h cache by firing pg-boss job immediately
researchRouter.post('/refresh', async (_req: Request, res: Response) => {
  const boss = await getBoss()
  await boss.send('refresh-trends', {})
  res.json({ ok: true })
})

// ── GET /api/research/hashtags ─────────────────────────────────────────────
// RESEARCH-11: Standalone hashtag intelligence (no AI generation)
researchRouter.get('/hashtags', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const niche = (req.query['niche'] as string | undefined) ?? 'travel'

  if (!isValidNiche(niche)) {
    res.status(400).json({ error: 'invalid_niche' })
    return
  }

  const [trendResult, hashtagsResult] = await Promise.allSettled([
    getTrendCache('all', niche),
    db.execute<{ hashtag: string; avg_views: number }>(
      sql`SELECT unnest(hashtags) AS hashtag, AVG(actual_views) AS avg_views
          FROM learning_signals
          WHERE user_id = ${userId} AND niche = ${niche} AND actual_views IS NOT NULL
          GROUP BY hashtag ORDER BY avg_views DESC NULLS LAST LIMIT 20`
    ),
  ])

  const trends = trendResult.status === 'fulfilled' && trendResult.value
    ? trendResult.value.data : []
  const userHashtags = hashtagsResult.status === 'fulfilled'
    ? hashtagsResult.value.rows : []

  const hashtags = buildHashtagIntel(trends, userHashtags)
  res.json({ hashtags })
})
