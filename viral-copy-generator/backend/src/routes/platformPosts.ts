// backend/src/routes/platformPosts.ts
// HISTORY-04, HISTORY-05, LEARNING-07, LEARNING-08
import { Router, type Request, type Response } from 'express'
import { eq, and, count as drizzleCount } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { platform_posts, posts, learning_signals, settings } from '../db/schema.js'
import { ValidationError, DatabaseError, NotFoundError } from '../lib/errors.js'

export const platformPostsRouter = Router()

// POST /api/platform-posts/:platformPostId/views
// Atomically logs actual views, inserts learning signal, and conditionally updates EMA.
// All 4 writes execute in a single db.transaction() — partial commits corrupt learning loops.
platformPostsRouter.post('/:platformPostId/views', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const platformPostId = req.params.platformPostId as string
  const body = req.body as { actualViews?: unknown }

  // HISTORY-04: validate actualViews is a non-negative integer
  const actualViews = Number(body.actualViews)
  if (!Number.isInteger(actualViews) || actualViews < 0) {
    throw new ValidationError(
      'Invalid view count. Must be a non-negative integer.',
      `actualViews=${body.actualViews} is not a valid integer`,
      { field: 'actualViews' }
    )
  }

  // Fetch platform_post — confirms ownership (T-07-04)
  let pp: typeof platform_posts.$inferSelect | undefined
  let post: typeof posts.$inferSelect | undefined
  try {
    const ppRows = await db
      .select()
      .from(platform_posts)
      .where(and(eq(platform_posts.id, platformPostId), eq(platform_posts.user_id, userId)))
    pp = ppRows[0]

    if (!pp) {
      throw new NotFoundError('Platform post not found', `Platform post ${platformPostId} does not exist or does not belong to user`)
    }

    // Fetch parent post for niche + ai_output (hook_text, hashtags)
    const postRows = await db
      .select()
      .from(posts)
      .where(and(eq(posts.id, pp.post_id), eq(posts.user_id, userId)))

    post = postRows[0]
    if (!post) {
      throw new NotFoundError('Post not found', `Post ${pp.post_id} does not exist or does not belong to user`)
    }
  } catch (err) {
    if (err instanceof NotFoundError) throw err
    throw new DatabaseError(
      'Failed to load post data',
      `Could not fetch post or platform_post: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }

  // HISTORY-05: accuracy label — ±20% of predictedMid
  const predictedMid = ((pp.predicted_low ?? 0) + (pp.predicted_high ?? 0)) / 2
  const delta = actualViews - predictedMid
  const threshold = 0.2 * Math.max(predictedMid, 1)
  const accuracy: 'overperformed' | 'matched' | 'underperformed' =
    delta > threshold
      ? 'overperformed'
      : delta < -threshold
        ? 'underperformed'
        : 'matched'

  // Extract hook_text and hashtags from ai_output (best-effort)
  const aiOut = post.ai_output as Record<string, unknown>
  const hookText =
    typeof (aiOut.youtube as Record<string, unknown> | undefined)?.hook === 'string'
      ? ((aiOut.youtube as Record<string, unknown>).hook as string)
      : ''
  const hashtags = Array.isArray(
    (aiOut.instagram as Record<string, unknown> | undefined)?.hashtags,
  )
    ? ((aiOut.instagram as Record<string, unknown>).hashtags as string[])
    : []

  // Fetch current learned_weights for signal_weights snapshot and learning_signals count
  let settingsRow: { learned_weights: Record<string, number> | null } | undefined
  let dataPoints = 0
  try {
    const settingsRows = await db
      .select({ learned_weights: settings.learned_weights })
      .from(settings)
      .where(eq(settings.user_id, userId))
    settingsRow = settingsRows[0]

    // Count existing learning_signals for this user — determines EMA activation gate
    const countResult = await db
      .select({ value: drizzleCount() })
      .from(learning_signals)
      .where(eq(learning_signals.user_id, userId))
    dataPoints = countResult[0]?.value ?? 0
  } catch (err) {
    throw new DatabaseError(
      'Failed to load learning data',
      `Could not fetch settings or learning_signals: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }

  const currentWeights = settingsRow?.learned_weights ?? null

  // LEARNING-08: ALL 4 writes in a single transaction — if any throws, all roll back
  try {
    await db.transaction(async (tx) => {
      // Write 1: update platform_posts.actual_views
      await tx
        .update(platform_posts)
        .set({ actual_views: actualViews })
        .where(and(eq(platform_posts.id, platformPostId), eq(platform_posts.user_id, userId)))

      // Write 2 + 3: insert learning_signal with accuracy embedded via overperformed boolean
      // user_id hardcoded from res.locals.userId — never from request body (T-07-06)
      await tx.insert(learning_signals).values({
        user_id: userId,
        post_id: pp!.post_id,
        platform: pp!.platform,
        niche: post!.niche,
        hook_text: hookText,
        hashtags,
        actual_views: actualViews,
        overperformed: accuracy === 'overperformed',
        signal_weights: currentWeights as Record<string, number> | undefined,
      })

      // Write 4 (conditional): EMA calibration — only when >= 10 data points (LEARNING-07)
      // dataPoints is the count BEFORE this insert. Gate at >=10 means we have >=10 prior
      // signals; after insert we'll have >=11. Spec: "activates at 10+ data points".
      if (dataPoints >= 10) {
        const prevEMA = (currentWeights as Record<string, number> | null)?.ema_delta ?? 0
        const rawDelta = (actualViews - predictedMid) / Math.max(predictedMid, 1)
        // EMA formula: delta capped ±15%, then 0.3 × delta + 0.7 × prevEMA
        const clampedDelta = Math.max(-0.15, Math.min(0.15, rawDelta))
        const newEMA = 0.3 * clampedDelta + 0.7 * prevEMA
        const newDataPoints = dataPoints + 1

        // JSONB partial update — || merge operator, NEVER replace whole column (CLAUDE.md pitfall)
        await tx
          .update(settings)
          .set({
            learned_weights: sql`${settings.learned_weights} || ${JSON.stringify({ ema_delta: newEMA, data_points: newDataPoints })}::jsonb`,
            updated_at: new Date(),
          })
          .where(eq(settings.user_id, userId))
      }
    })
  } catch (err) {
    throw new DatabaseError(
      'Failed to log views',
      `Transaction failed: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }

  res.json({ ok: true, accuracy })
})
