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
import { eq, and } from 'drizzle-orm'

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
  // This would be called by a scheduled job to:
  // 1. Query learning_signals grouped by (platform, niche, view_tier)
  // 2. Calculate averages for each group
  // 3. Upsert into platform_viral_patterns
  // Implementation: See scheduled job in boss.ts
}
