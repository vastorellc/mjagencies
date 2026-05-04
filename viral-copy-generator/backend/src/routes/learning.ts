// backend/src/routes/learning.ts
import { Router, type Request, type Response } from 'express'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { settings } from '../db/schema.js'
import { DatabaseError } from '../lib/errors.js'

export const learningRouter = Router()

// ─── LEARNING-01: Top 5 hooks by MAX(actual_views) per niche ─────────────────
// MAX not AVG — surfaces viral ceiling, not average performer
// LEARNING-06: This endpoint is called fresh before every AI generation
// Fail-open: returns [] on error so AI generation is never blocked
learningRouter.get('/hooks', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const { niche } = req.query as { niche?: string }

  try {
    const rows = await db.execute<{ hook_text: string; max_views: number }>(
      niche
        ? sql`
            SELECT hook_text, MAX(actual_views) AS max_views
            FROM learning_signals
            WHERE user_id = ${userId}
              AND niche = ${niche}
              AND actual_views IS NOT NULL
            GROUP BY hook_text
            ORDER BY max_views DESC NULLS LAST
            LIMIT 5
          `
        : sql`
            SELECT hook_text, MAX(actual_views) AS max_views
            FROM learning_signals
            WHERE user_id = ${userId}
              AND actual_views IS NOT NULL
            GROUP BY hook_text
            ORDER BY max_views DESC NULLS LAST
            LIMIT 5
          `
    )

    res.json({ hooks: rows.rows })
  } catch (err) {
    // Fail-open: return empty list on error so AI generation never blocks
    res.json({ hooks: [] })
  }
})

// ─── LEARNING-02: Top 10 hashtags by AVG(actual_views) using unnest() ────────
// unnest(hashtags) — required because hashtags is TEXT[] not a scalar column
// LEARNING-06: This endpoint is called fresh before every AI generation
// Fail-open: returns [] on error so AI generation is never blocked
learningRouter.get('/hashtags', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const { niche, platform } = req.query as { niche?: string; platform?: string }

  try {
    let rows
    if (niche && platform) {
      rows = await db.execute<{ hashtag: string; avg_views: number }>(
        sql`
          SELECT unnest(hashtags) AS hashtag, AVG(actual_views) AS avg_views
          FROM learning_signals
          WHERE user_id = ${userId}
            AND niche = ${niche}
            AND platform = ${platform}
            AND actual_views IS NOT NULL
          GROUP BY hashtag
          ORDER BY avg_views DESC NULLS LAST
          LIMIT 10
        `
      )
    } else if (niche) {
      rows = await db.execute<{ hashtag: string; avg_views: number }>(
        sql`
          SELECT unnest(hashtags) AS hashtag, AVG(actual_views) AS avg_views
          FROM learning_signals
          WHERE user_id = ${userId}
            AND niche = ${niche}
            AND actual_views IS NOT NULL
          GROUP BY hashtag
          ORDER BY avg_views DESC NULLS LAST
          LIMIT 10
        `
      )
    } else if (platform) {
      rows = await db.execute<{ hashtag: string; avg_views: number }>(
        sql`
          SELECT unnest(hashtags) AS hashtag, AVG(actual_views) AS avg_views
          FROM learning_signals
          WHERE user_id = ${userId}
            AND platform = ${platform}
            AND actual_views IS NOT NULL
          GROUP BY hashtag
          ORDER BY avg_views DESC NULLS LAST
          LIMIT 10
        `
      )
    } else {
      rows = await db.execute<{ hashtag: string; avg_views: number }>(
        sql`
          SELECT unnest(hashtags) AS hashtag, AVG(actual_views) AS avg_views
          FROM learning_signals
          WHERE user_id = ${userId}
            AND actual_views IS NOT NULL
          GROUP BY hashtag
          ORDER BY avg_views DESC NULLS LAST
          LIMIT 10
        `
      )
    }

    res.json({ hashtags: rows.rows })
  } catch (err) {
    // Fail-open: return empty list on error so AI generation never blocks
    res.json({ hashtags: [] })
  }
})

// ─── LEARNING-04: Best posting times per platform ─────────────────────────────
// EXTRACT DOW/HOUR from posted_at AT TIME ZONE 'Asia/Karachi'
// Pakistan is UTC+5, no DST — same timezone offset year-round
// HAVING COUNT >= 2 prevents noise from single-post samples
// Fail-open: returns [] on error
learningRouter.get('/posting-times', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string
  const { platform } = req.query as { platform?: string }

  try {
    let rows
    if (platform) {
      rows = await db.execute<{ dow: number; hour: number; platform: string; avg_views: number; post_count: number }>(
        sql`
          SELECT
            EXTRACT(DOW FROM pp.posted_at AT TIME ZONE 'Asia/Karachi')::int AS dow,
            EXTRACT(HOUR FROM pp.posted_at AT TIME ZONE 'Asia/Karachi')::int AS hour,
            pp.platform,
            AVG(pp.actual_views) AS avg_views,
            COUNT(*)::int AS post_count
          FROM platform_posts pp
          WHERE pp.user_id = ${userId}
            AND pp.actual_views IS NOT NULL
            AND pp.upload_status = 'posted'
            AND pp.posted_at IS NOT NULL
            AND pp.platform = ${platform}
          GROUP BY dow, hour, pp.platform
          HAVING COUNT(*) >= 2
          ORDER BY avg_views DESC NULLS LAST
        `
      )
    } else {
      rows = await db.execute<{ dow: number; hour: number; platform: string; avg_views: number; post_count: number }>(
        sql`
          SELECT
            EXTRACT(DOW FROM pp.posted_at AT TIME ZONE 'Asia/Karachi')::int AS dow,
            EXTRACT(HOUR FROM pp.posted_at AT TIME ZONE 'Asia/Karachi')::int AS hour,
            pp.platform,
            AVG(pp.actual_views) AS avg_views,
            COUNT(*)::int AS post_count
          FROM platform_posts pp
          WHERE pp.user_id = ${userId}
            AND pp.actual_views IS NOT NULL
            AND pp.upload_status = 'posted'
            AND pp.posted_at IS NOT NULL
          GROUP BY dow, hour, pp.platform
          HAVING COUNT(*) >= 2
          ORDER BY avg_views DESC NULLS LAST
        `
      )
    }

    res.json({ times: rows.rows })
  } catch (err) {
    // Fail-open: return empty list on error
    res.json({ times: [] })
  }
})

// ─── LEARNING-05: Niche performance breakdown ─────────────────────────────────
// COALESCE(niche, 'Other') — NULL niches fall back to 'Other'
// NULL niche is also written as default_niche at insert time (Plan 01 enforces this)
// Fail-open: returns [] on error
learningRouter.get('/niche-performance', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string

  try {
    const rows = await db.execute<{ niche: string; avg_views: number; max_views: number; total_posts: number }>(
      sql`
        SELECT
          COALESCE(niche, 'Other') AS niche,
          AVG(actual_views) AS avg_views,
          MAX(actual_views) AS max_views,
          COUNT(*)::int AS total_posts
        FROM learning_signals
        WHERE user_id = ${userId}
          AND actual_views IS NOT NULL
        GROUP BY COALESCE(niche, 'Other')
        ORDER BY avg_views DESC NULLS LAST
      `
    )

    res.json({ niches: rows.rows })
  } catch (err) {
    // Fail-open: return empty list on error
    res.json({ niches: [] })
  }
})

// ─── LEARNING-07 + LEARNING-09: Current learned weights + data_points ────────
// Used by frontend to show "Calibrated (N posts)" badge and inject weights into score
learningRouter.get('/weights', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string

  try {
    const rows = await db
      .select({ learned_weights: settings.learned_weights })
      .from(settings)
      .where(eq(settings.user_id, userId))

    const row = rows[0]
    const weights = row?.learned_weights as Record<string, number> | null | undefined
    const dataPoints = (weights as Record<string, number> | null)?.data_points ?? 0
    const isCalibrated = dataPoints >= 10

    res.json({
      learned_weights: weights ?? null,
      data_points: dataPoints,
      is_calibrated: isCalibrated,
    })
  } catch (err) {
    throw new DatabaseError(
      'Failed to load learning weights',
      `Could not fetch settings: ${err instanceof Error ? err.message : String(err)}`,
      { original: err }
    )
  }
})
