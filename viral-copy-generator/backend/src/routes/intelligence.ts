// Phase 11: Content Intelligence Layer API
// Endpoints for video analysis, pattern comparison, and AI insights

import { Router } from 'express'
import { db } from '../db/index.js'
import {
  video_analysis,
  video_pattern_analysis,
  video_ai_insights,
} from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { analyzeVideoPatterns, type EngineSignalsData } from '../lib/pattern-analysis.js'
import { generateAIInsights } from '../lib/ai-insights.js'
import type { Request, Response } from 'express'

export const intelligenceRouter = Router()

// POST /api/intelligence/analyze
// Trigger full multi-layer analysis for a video
intelligenceRouter.post('/analyze', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string
  const {
    postId,
    niche,
    engineSignals,
    enabledPlatforms,
  } = req.body as {
    postId: string
    niche: string
    engineSignals: EngineSignalsData
    enabledPlatforms: string[]
  }

  if (!postId || !niche || !engineSignals || !enabledPlatforms) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  try {
    // Normalize field names: frontend camelCase → backend snake_case
    const normalizedSignals: EngineSignalsData = {
      ...engineSignals,
      audio_energy: (engineSignals as Record<string, unknown>).audioEnergy ??
                    (engineSignals as Record<string, unknown>).audio_energy,
      duration: (engineSignals as Record<string, unknown>).durationSeconds ??
                (engineSignals as Record<string, unknown>).durationSec ??
                (engineSignals as Record<string, unknown>).duration,
    }

    // Step 1: Store video analysis
    const [analysis] = await db
      .insert(video_analysis)
      .values({
        user_id: userId,
        post_id: postId,
        niche,
        engine_signals: normalizedSignals,
      })
      .returning()

    if (!analysis) {
      res.status(500).json({ error: 'Failed to store video analysis' })
      return
    }

    // Step 2: Layer 1 — Pattern analysis
    const patternResults = await analyzeVideoPatterns({
      videoAnalysisId: analysis.id,
      userId,
      niche,
      engineSignals: normalizedSignals,
      enabledPlatforms,
    })

    // Step 3: Layer 2 — AI insights (parallel for each platform)
    const aiInsightsPromises = patternResults.map(async (result) => {
      const rows = await db
        .select()
        .from(video_pattern_analysis)
        .where(
          and(
            eq(video_pattern_analysis.user_id, userId),
            eq(video_pattern_analysis.video_analysis_id, analysis.id),
            eq(video_pattern_analysis.platform, result.platform),
          ),
        )

      const pa = rows[0]
      if (!pa) return null

      return generateAIInsights({
        userId,
        videoPatternAnalysisId: pa.id,
        platform: result.platform,
        niche,
        similarityScore: result.similarityScore,
        matchedViewTier: result.viewTier,
        gaps: result.gaps,
      })
    })

    await Promise.all(aiInsightsPromises)

    res.json({
      videoAnalysisId: analysis.id,
      patterns: patternResults,
      message: 'Analysis complete',
    })
  } catch (err: unknown) {
    console.error('[intelligence/analyze] failed:', (err as Error).message)
    res.status(500).json({ error: 'Analysis failed' })
  }
})

// GET /api/intelligence/video/:postId
// Get all analysis data for a video
intelligenceRouter.get('/video/:postId', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string
  const postId = req.params.postId as string

  try {
    // Get video analysis
    const va = await db
      .select()
      .from(video_analysis)
      .where(
        and(
          eq(video_analysis.user_id, userId),
          eq(video_analysis.post_id, postId),
        ),
      )
      .then((rows) => rows[0])

    if (!va) {
      res.status(404).json({ error: 'Video analysis not found' })
      return
    }

    // Get pattern analyses
    const patterns = await db
      .select()
      .from(video_pattern_analysis)
      .where(eq(video_pattern_analysis.video_analysis_id, va.id))

    // Get AI insights for each pattern
    const insights = await Promise.all(
      patterns.map((p) =>
        db
          .select()
          .from(video_ai_insights)
          .where(eq(video_ai_insights.video_pattern_analysis_id, p.id))
          .then((rows) => rows[0] ?? null),
      ),
    )

    res.json({
      videoAnalysis: va,
      patterns: patterns.map((p, i) => ({
        ...p,
        aiInsights: insights[i],
      })),
    })
  } catch (err: unknown) {
    console.error('[intelligence/video] failed:', (err as Error).message)
    res.status(500).json({ error: 'Fetch failed' })
  }
})

// GET /api/intelligence/platforms/:postId
// Get platform-specific analysis summary
intelligenceRouter.get(
  '/platforms/:postId',
  async (req: Request, res: Response) => {
    const userId = (req as any).userId as string
    const postId = req.params.postId as string

    try {
      const va = await db
        .select()
        .from(video_analysis)
        .where(
          and(
            eq(video_analysis.user_id, userId),
            eq(video_analysis.post_id, postId),
          ),
        )
        .then((rows) => rows[0])

      if (!va) {
        res.status(404).json({ error: 'Video analysis not found' })
        return
      }

      const patterns = await db
        .select()
        .from(video_pattern_analysis)
        .where(eq(video_pattern_analysis.video_analysis_id, va.id))

      const summary = patterns.map((p) => ({
        platform: p.platform,
        viewTier: p.matched_view_tier,
        similarity: p.similarity_score,
        gaps: p.gaps_detected,
      }))

      res.json({ platforms: summary })
    } catch (err: unknown) {
      console.error('[intelligence/platforms] failed:', (err as Error).message)
      res.status(500).json({ error: 'Fetch failed' })
    }
  },
)
