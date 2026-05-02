import { Router, type Request, type Response } from 'express'
import { db } from '../db/index.js'
import { posts, platform_posts } from '../db/schema.js'

export const postsRouter = Router()

const VALID_PLATFORMS = ['youtube', 'instagram', 'tiktok', 'facebook', 'x'] as const
const VALID_NICHES = ['travel', 'hotels', 'cars', 'bikes', 'coding', 'lifestyle', 'food', 'other'] as const

// GET /api/posts — returns user's posts (stub; full impl in Phase 7)
postsRouter.get('/', (_req, res) => {
  res.json({ posts: [] })
})

// POST /api/posts — creates post + platform_posts rows (D-14)
postsRouter.post('/', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const body = req.body as {
    title?: string
    niche?: string
    virality_score?: number
    engine_signals?: Record<string, unknown>
    ai_output?: Record<string, unknown>
    enabled_platforms?: string[]
  }

  if (
    body.enabled_platforms !== undefined && (
      !Array.isArray(body.enabled_platforms) ||
      body.enabled_platforms.some(
        (p) => !VALID_PLATFORMS.includes(p as (typeof VALID_PLATFORMS)[number]),
      )
    )
  ) {
    res.status(400).json({ error: 'invalid_enabled_platforms' })
    return
  }

  if (
    body.niche !== undefined &&
    !VALID_NICHES.includes(body.niche as (typeof VALID_NICHES)[number])
  ) {
    res.status(400).json({ error: 'invalid_niche' })
    return
  }

  // T-5-03: user_id always from res.locals, never from req.body
  const [post] = await db.insert(posts).values({
    user_id: userId,
    title: body.title ?? 'Untitled',
    niche: body.niche ?? 'travel',
    virality_score: body.virality_score ?? 0,
    engine_signals: body.engine_signals ?? {},
    ai_output: body.ai_output ?? {},
  }).returning()

  const enabledPlatforms = body.enabled_platforms ?? []
  if (enabledPlatforms.length > 0) {
    await db.insert(platform_posts).values(
      enabledPlatforms.map((platform) => ({
        user_id: userId,
        post_id: post.id,
        platform,
        upload_status: 'idle' as const,
      }))
    )
  }

  res.status(201).json({ postId: post.id })
})
