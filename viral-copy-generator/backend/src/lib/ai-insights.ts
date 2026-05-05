// Phase 11: Layer 2 - AI-Powered Comparative Analysis
// Use AI to generate actionable recommendations based on pattern analysis

import { Anthropic } from '@anthropic-ai/sdk'
import { db } from '../db/index.js'
import { video_ai_insights, type AIRecommendation, type PatternGapData } from '../db/schema.js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface AIInsightsInput {
  userId: string
  videoPatternAnalysisId: string
  platform: string
  niche: string
  similarityScore: number
  matchedViewTier: string
  gaps: PatternGapData[]
  aiProvider?: 'claude' | 'gemini' // For multi-provider support (future)
}

export interface GeneratedInsights {
  recommendations: AIRecommendation[]
  confidenceScore: number
  summary: string
}

/**
 * Layer 2: Generate AI-powered insights based on pattern analysis
 * Uses Claude to compare video against viral patterns and suggest improvements
 */
export async function generateAIInsights(
  input: AIInsightsInput,
): Promise<GeneratedInsights> {
  // Build prompt with pattern analysis data
  const gapsDescription =
    input.gaps.length > 0
      ? input.gaps
          .map(
            (g) =>
              `- ${g.field}: your video is ${g.difference > 0 ? 'higher' : 'lower'} by ${Math.abs(g.difference)} (you: ${g.current}, pattern avg: ${g.pattern_avg})`,
          )
          .join('\n')
      : 'Your video matches the pattern very well'

  const prompt = `You are a viral content expert analyzing a ${input.platform} video in the ${input.niche} niche.

Video Analysis:
- Matches ${input.matchedViewTier} view content with ${input.similarityScore}% similarity
- Platform: ${input.platform}
- Niche: ${input.niche}

Pattern Gaps (what's different from viral content):
${gapsDescription}

Based on this analysis, provide 3-5 specific, actionable recommendations to improve viral potential on ${input.platform}.

For each recommendation:
1. Be specific (mention exact values when possible)
2. Explain why it matters (e.g., "audiences on ${input.platform} respond to...")
3. Estimate impact (low/medium/high)

Format your response as JSON with this structure:
{
  "recommendations": [
    {
      "title": "Short title",
      "description": "Detailed explanation",
      "priority": "high|medium|low",
      "estimated_impact": "e.g., Could increase views by 20-30%"
    }
  ],
  "confidence": 85,
  "summary": "One sentence overview of the analysis"
}

Only respond with valid JSON.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-1',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const responseText =
      message.content[0]?.type === 'text' ? message.content[0].text : ''

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from AI')
    }

    const aiResponse = JSON.parse(jsonMatch[0]) as {
      recommendations: AIRecommendation[]
      confidence: number
      summary: string
    }

    // Store in DB
    await db.insert(video_ai_insights).values({
      user_id: input.userId,
      video_pattern_analysis_id: input.videoPatternAnalysisId,
      platform: input.platform,
      ai_recommendations: aiResponse.recommendations,
      confidence_score: aiResponse.confidence,
      analysis_summary: aiResponse.summary,
    })

    return {
      recommendations: aiResponse.recommendations,
      confidenceScore: aiResponse.confidence,
      summary: aiResponse.summary,
    }
  } catch (err: unknown) {
    console.error('[ai-insights] failed:', (err as Error).message)

    // Fail gracefully — return empty insights
    const fallbackInsights: GeneratedInsights = {
      recommendations: [],
      confidenceScore: 0,
      summary: 'AI analysis unavailable',
    }

    // Still store the record so we know it was attempted
    await db.insert(video_ai_insights).values({
      user_id: input.userId,
      video_pattern_analysis_id: input.videoPatternAnalysisId,
      platform: input.platform,
      ai_recommendations: [],
      confidence_score: 0,
      analysis_summary: 'Analysis failed',
    })

    return fallbackInsights
  }
}
