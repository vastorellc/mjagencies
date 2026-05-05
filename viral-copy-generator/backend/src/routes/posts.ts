import { Router, type Request, type Response } from 'express'
import { eq, desc, and, gte, lte, inArray, sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { posts, platform_posts } from '../db/schema.js'
import { ValidationError, DatabaseError, NotFoundError } from '../lib/errors.js'

export const postsRouter = Router()

const VALID_PLATFORMS = ['youtube', 'instagram', 'tiktok', 'facebook', 'x'] as const

// GET /api/posts — returns user's posts newest-first with optional filters
// HISTORY-01, HISTORY-03
postsRouter.get('/', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const { platform, niche, from, to } = req.query as Record<string, string | undefined>

  // Base condition: user ownership (RLS also enforces at DB level)
  const conditions: SQL[] = [eq(posts.user_id, userId)]

  // HISTORY-03: platform filter — EXISTS subquery (NOT a JOIN — avoids duplicate rows
  // when a post has multiple platform_posts entries for the same platform)
  if (platform && VALID_PLATFORMS.includes(platform as (typeof VALID_PLATFORMS)[number])) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM platform_posts pp WHERE pp.post_id = ${posts.id} AND pp.platform = ${platform})`
    )
  }

  // HISTORY-03: niche filter — accept any niche value
  if (niche) {
    conditions.push(eq(posts.niche, niche))
  }

  // HISTORY-03: date range filter (inclusive)
  if (from) conditions.push(gte(posts.created_at, new Date(from)))
  if (to) conditions.push(lte(posts.created_at, new Date(to)))

  let rows: Array<typeof posts.$inferSelect>
  let platformRows: Array<typeof platform_posts.$inferSelect>
  try {
    rows = await db
      .select()
      .from(posts)
      .where(and(...conditions))
      .orderBy(desc(posts.created_at))

    // Fetch platform_posts for all returned posts in a single batch query
    const postIds = rows.map((p) => p.id)
    platformRows =
      postIds.length > 0
        ? await db
            .select()
            .from(platform_posts)
            .where(inArray(platform_posts.post_id, postIds))
        : []
  } catch (err) {
    throw new DatabaseError(
      'Failed to load posts',
      `Could not fetch posts: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }

  // Group platform_posts by post_id
  const platformByPost = platformRows.reduce<Record<string, typeof platformRows>>(
    (acc, pp) => {
      ;(acc[pp.post_id] ??= []).push(pp)
      return acc
    },
    {},
  )

  const result = rows.map((post) => ({
    ...post,
    platforms: platformByPost[post.id] ?? [],
  }))

  res.json({ posts: result })
})

// DELETE /api/posts/:id — validates ownership, cascades to platform_posts + learning_signals
// HISTORY-06
postsRouter.delete('/:id', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const postId = req.params.id as string

  // Ownership check — return 404 (not 403) to avoid UUID enumeration (T-07-02)
  let existing: Array<{ id: string }>
  try {
    existing = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, postId), eq(posts.user_id, userId)))
  } catch (err) {
    throw new DatabaseError(
      'Failed to check post',
      `Could not fetch post: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }

  if (!existing[0]) {
    throw new NotFoundError('Post not found', `Post ${postId} does not exist or does not belong to user`)
  }

  // FK ON DELETE CASCADE handles platform_posts + learning_signals
  try {
    await db
      .delete(posts)
      .where(and(eq(posts.id, postId), eq(posts.user_id, userId)))
  } catch (err) {
    throw new DatabaseError(
      'Failed to delete post',
      `Could not delete post: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }

  res.json({ ok: true })
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
    throw new ValidationError(
      'Invalid platform selection',
      `enabled_platforms contains invalid values. Valid: [${VALID_PLATFORMS.join(', ')}]`,
      { field: 'enabled_platforms' }
    )
  }

  if (body.niche !== undefined && (typeof body.niche !== 'string' || body.niche.trim().length === 0)) {
    throw new ValidationError(
      'niche must be a non-empty string',
      `niche is "${body.niche}"`,
      { field: 'niche' }
    )
  }

  // T-5-03: user_id always from res.locals, never from req.body
  let post: typeof posts.$inferSelect
  try {
    const result = await db.insert(posts).values({
      user_id: userId,
      title: body.title ?? 'Untitled',
      niche: body.niche ?? 'travel',
      virality_score: body.virality_score ?? 0,
      engine_signals: body.engine_signals ?? {},
      ai_output: body.ai_output ?? {},
    }).returning()
    post = result[0]
  } catch (err) {
    throw new DatabaseError(
      'Failed to create post',
      `Could not insert post: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }

  const enabledPlatforms = body.enabled_platforms ?? []
  if (enabledPlatforms.length > 0) {
    try {
      await db.insert(platform_posts).values(
        enabledPlatforms.map((platform) => ({
          user_id: userId,
          post_id: post.id,
          platform,
          upload_status: 'idle' as const,
        }))
      )
    } catch (err) {
      throw new DatabaseError(
        'Failed to link platforms',
        `Could not insert platform_posts: ${err instanceof Error ? err.message : String(err)}`,
        { original: err }
      )
    }
  }

  res.status(201).json({ postId: post.id })
})
