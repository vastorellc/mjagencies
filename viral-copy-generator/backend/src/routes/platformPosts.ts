// backend/src/routes/platformPosts.ts
// HISTORY-04, HISTORY-05, LEARNING-07, LEARNING-08
import { Router, type Request, type Response } from 'express'
import { eq, and, count as drizzleCount } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { platform_posts, posts, learning_signals, settings } from '../db/schema.js'

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
    res.status(400).json({ error: 'invalid_actual_views' })
    return
  }

  // Fetch platform_post — confirms ownership (T-07-04)
  const [pp] = await db
    .select()
    .from(platform_posts)
    .where(and(eq(platform_posts.id, platformPostId), eq(platform_posts.user_id, userId)))

  if (!pp) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  // Fetch parent post for niche + ai_output (hook_text, hashtags)
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, pp.post_id), eq(posts.user_id, userId)))

  if (!post) {
    res.status(404).json({ error: 'post_not_found' })
    return
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

  // Fetch current learned_weights for signal_weights snapshot
  const [settingsRow] = await db
    .select({ learned_weights: settings.learned_weights })
    .from(settings)
    .where(eq(settings.user_id, userId))

  const currentWeights = settingsRow?.learned_weights ?? null

  // Count existing learning_signals for this user — determines EMA activation gate
  const [{ value: dataPoints }] = await db
    .select({ value: drizzleCount() })
    .from(learning_signals)
    .where(eq(learning_signals.user_id, userId))

  // LEARNING-08: ALL 4 writes in a single transaction — if any throws, all roll back
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
      post_id: pp.post_id,
      platform: pp.platform,
      niche: post.niche,
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

  res.json({ ok: true, accuracy })
})
