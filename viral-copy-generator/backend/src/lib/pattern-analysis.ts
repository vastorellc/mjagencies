// Phase 11: Layer 1 - Platform-Specific Viral Pattern Analysis
// Compare video EngineSignals against platform-wide patterns for same/related niches

import { db } from '../db/index.js'
import {
  video_analysis,
  platform_viral_patterns,
  video_pattern_analysis,
  type EngineSignalsData,
  type PatternGapData,
} from '../db/schema.js'
import { eq, and, sql } from 'drizzle-orm'

export type { EngineSignalsData }

export interface VideoAnalysisInput {
  videoAnalysisId: string
  userId: string
  niche: string
  engineSignals: EngineSignalsData
  enabledPlatforms: string[]
}

export interface PatternAnalysisResult {
  platform: string
  matchedPatternId: string
  viewTier: string
  similarityScore: number // 0-100
  gaps: PatternGapData[]
}

/**
 * Calculate similarity score between video signals and pattern average
 * Returns 0-100 score based on how close the video matches the pattern
 */
function calculateSimilarityScore(
  signals: EngineSignalsData,
  patternData: Record<string, unknown>,
): number {
  const fields = ['motion', 'faces', 'audio_energy', 'duration', 'brightness']
  const weights: Record<string, number> = {
    motion: 0.25,
    faces: 0.20,
    audio_energy: 0.20,
    duration: 0.20,
    brightness: 0.15,
  }

  let totalScore = 0
  let totalWeight = 0

  for (const field of fields) {
    const signalValue = signals[field] as number | undefined
    const patternValue = (patternData[`avg_${field}`] as number | undefined) ?? 0

    if (signalValue === undefined || signalValue === null) continue

    // Normalize difference to 0-100 scale (100 = perfect match, 0 = opposite)
    const maxDiff = field === 'duration' ? 300 : 100
    const diff = Math.abs(signalValue - patternValue)
    const normalizedDiff = Math.min(diff / maxDiff, 1)
    const fieldScore = (1 - normalizedDiff) * 100

    totalScore += fieldScore * (weights[field] ?? 0.1)
    totalWeight += weights[field] ?? 0.1
  }

  return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 50
}

/**
 * Identify gaps between video signals and pattern averages
 */
function identifyGaps(
  signals: EngineSignalsData,
  patternData: Record<string, unknown>,
): PatternGapData[] {
  const gaps: PatternGapData[] = []
  const fields = ['motion', 'faces', 'audio_energy', 'duration', 'brightness']

  for (const field of fields) {
    const signalValue = (signals[field] as number) ?? 0
    const patternValue = (patternData[`avg_${field}`] as number) ?? 0

    if (signalValue === undefined || signalValue === null) continue

    const difference = signalValue - patternValue
    if (Math.abs(difference) > 10) {
      // Only report significant gaps
      gaps.push({
        field,
        current: Math.round(signalValue * 10) / 10,
        pattern_avg: Math.round(patternValue * 10) / 10,
        difference: Math.round(difference * 10) / 10,
      })
    }
  }

  return gaps
}

/**
 * Layer 1: Analyze video against platform-specific viral patterns
 * Finds matching patterns and stores comparison results
 */
export async function analyzeVideoPatterns(
  input: VideoAnalysisInput,
): Promise<PatternAnalysisResult[]> {
  const results: PatternAnalysisResult[] = []

  // Get or create related_niches array (for now, use same niche)
  const searchNiches = [input.niche]

  for (const platform of input.enabledPlatforms) {
    // Find patterns for this platform in this niche (all view tiers)
    const patterns = await db
      .select()
      .from(platform_viral_patterns)
      .where(
        and(
          eq(platform_viral_patterns.platform, platform),
          eq(platform_viral_patterns.niche, input.niche),
        ),
      )

    if (patterns.length === 0) continue

    // Find best matching pattern (highest similarity)
    let bestMatch = patterns[0]
    let bestScore = calculateSimilarityScore(
      input.engineSignals,
      bestMatch.pattern_data,
    )

    for (const pattern of patterns.slice(1)) {
      const score = calculateSimilarityScore(input.engineSignals, pattern.pattern_data)
      if (score > bestScore) {
        bestScore = score
        bestMatch = pattern
      }
    }

    // Calculate gaps
    const gaps = identifyGaps(input.engineSignals, bestMatch.pattern_data)

    // Store result in DB
    await db.insert(video_pattern_analysis).values({
      user_id: input.userId,
      video_analysis_id: input.videoAnalysisId,
      platform,
      matched_pattern_id: bestMatch.id,
      similarity_score: bestScore,
      matched_view_tier: bestMatch.view_tier,
      gaps_detected: gaps,
    })

    results.push({
      platform,
      matchedPatternId: bestMatch.id,
      viewTier: bestMatch.view_tier,
      similarityScore: bestScore,
      gaps,
    })
  }

  return results
}

/**
 * Aggregate learning signals into platform viral patterns
 * Run this periodically to update pattern data from user performance
 */
export async function updatePlatformPatterns(): Promise<void> {
  try {
    // Query learning signals grouped by platform, niche, and view tier (based on actual_views)
    // Join with posts to get engine_signals data
    const rawResults = await db.execute(sql`
      SELECT
        ls.platform,
        ls.niche,
        CASE
          WHEN COALESCE(ls.actual_views, 0) < 1000 THEN '100-1k'
          WHEN COALESCE(ls.actual_views, 0) < 10000 THEN '1k-10k'
          WHEN COALESCE(ls.actual_views, 0) < 100000 THEN '10k-100k'
          ELSE '100k+'
        END AS view_tier,
        COUNT(*) AS sample_count,
        ROUND(AVG(CAST(p.engine_signals->>'motion' AS FLOAT)))::INT AS avg_motion,
        ROUND(AVG(CAST(p.engine_signals->>'faces' AS FLOAT)))::INT AS avg_faces,
        ROUND(AVG(CAST(p.engine_signals->>'audioEnergy' AS FLOAT)))::INT AS avg_audio_energy,
        ROUND(AVG(CAST(p.engine_signals->>'durationSeconds' AS FLOAT)))::INT AS avg_duration,
        ROUND(AVG(CAST(p.engine_signals->>'brightness' AS FLOAT)))::INT AS avg_brightness,
        ROUND(AVG(EXTRACT(HOUR FROM ls.created_at AT TIME ZONE 'Asia/Karachi')))::INT AS optimal_posting_hour_pkt,
        ROUND(AVG(ARRAY_LENGTH(ls.hashtags, 1)))::INT AS avg_hashtag_count
      FROM learning_signals ls
      JOIN posts p ON p.id = ls.post_id
      WHERE ls.actual_views IS NOT NULL
      GROUP BY ls.platform, ls.niche, view_tier
      HAVING COUNT(*) >= 5
      ORDER BY ls.platform, ls.niche, view_tier
    `)

    // Drizzle's execute() returns either an array (postgres.js) or { rows } (node-postgres)
    const data: Record<string, unknown>[] = Array.isArray(rawResults)
      ? rawResults
      : (rawResults as { rows: Record<string, unknown>[] }).rows

    // Upsert into platform_viral_patterns
    for (const row of data) {
      const typedRow = row as Record<string, unknown>
      await db
        .insert(platform_viral_patterns)
        .values({
          platform: typedRow.platform as string,
          niche: typedRow.niche as string,
          view_tier: typedRow.view_tier as string,
          pattern_data: {
            avg_motion: (typedRow.avg_motion as number) ?? 0,
            avg_faces: (typedRow.avg_faces as number) ?? 0,
            avg_audio_energy: (typedRow.avg_audio_energy as number) ?? 0,
            avg_duration: (typedRow.avg_duration as number) ?? 0,
            avg_brightness: (typedRow.avg_brightness as number) ?? 0,
            optimal_posting_hour_pkt: (typedRow.optimal_posting_hour_pkt as number) ?? 0,
            avg_hashtag_count: (typedRow.avg_hashtag_count as number) ?? 0,
            sample_count: (typedRow.sample_count as number) ?? 0,
            characteristics: [],
          },
        })
        .onConflictDoUpdate({
          target: [platform_viral_patterns.platform, platform_viral_patterns.niche, platform_viral_patterns.view_tier],
          set: {
            pattern_data: sql`excluded.pattern_data`,
            last_updated: sql`now()`,
          },
        })
    }

    console.log(`[updatePlatformPatterns] Updated ${data.length} pattern rows`)
  } catch (err: unknown) {
    console.error('[updatePlatformPatterns] failed:', (err as Error).message)
    throw err
  }
}
