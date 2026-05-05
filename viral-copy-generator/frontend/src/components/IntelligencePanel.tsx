import { useEffect, useState } from 'react'
import type { EngineSignals, Platform, IntelligenceVideoData, IntelligencePlatformResult } from '../lib/types'
import { triggerIntelligenceAnalysis, fetchIntelligenceVideo } from '../lib/api'

interface Props {
  postId: string
  niche: string
  engineSignals: EngineSignals
  enabledPlatforms: Platform[]
}

const FIELD_LABELS: Record<string, string> = {
  motion: 'Motion',
  faces: 'Face presence',
  audio_energy: 'Audio energy',
  duration: 'Duration',
  brightness: 'Brightness',
}

const PRIORITY_BADGE_CLASSES: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-red-500/20 text-red-400',
  medium: 'bg-amber-500/20 text-amber-400',
  low: 'bg-emerald-500/20 text-emerald-400',
}

const PRIORITY_EMOJI: Record<'high' | 'medium' | 'low', string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
}

export default function IntelligencePanel({
  postId,
  niche,
  engineSignals,
  enabledPlatforms,
}: Props) {
  const [data, setData] = useState<IntelligenceVideoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null)

  // Set initial platform
  useEffect(() => {
    if (enabledPlatforms.length > 0 && !selectedPlatform) {
      setSelectedPlatform(enabledPlatforms[0] as Platform)
    }
  }, [enabledPlatforms, selectedPlatform])

  // Trigger analysis and fetch results
  useEffect(() => {
    async function analyzeAndFetch() {
      try {
        setLoading(true)
        // Step 1: Trigger analysis
        await triggerIntelligenceAnalysis(postId, niche, engineSignals, enabledPlatforms)
        // Step 2: Fetch results (polling in case analysis is still running)
        let retries = 0
        let videoData: IntelligenceVideoData | null = null
        while (retries < 5) {
          try {
            videoData = await fetchIntelligenceVideo(postId)
            if (videoData && videoData.patterns && videoData.patterns.length > 0) {
              setData(videoData)
              break
            }
          } catch {
            retries++
            if (retries < 5) {
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }
        }
        if (!videoData) {
          console.warn('[IntelligencePanel] No analysis results after retries')
        }
      } catch (err) {
        console.warn('[IntelligencePanel] Analysis failed:', err)
      } finally {
        setLoading(false)
      }
    }

    analyzeAndFetch()
  }, [postId, niche, engineSignals, enabledPlatforms])

  if (loading) {
    return (
      <section className="mt-8 rounded-lg border border-zinc-700 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-r-zinc-300" />
          <p className="text-sm text-zinc-400">Analyzing your video against viral patterns...</p>
        </div>
      </section>
    )
  }

  if (!data || !data.patterns || data.patterns.length === 0) {
    return null
  }

  const platforms = data.patterns.filter(p => enabledPlatforms.includes(p.platform as Platform))
  if (platforms.length === 0 || !selectedPlatform) {
    return null
  }

  const current = platforms.find(p => p.platform === selectedPlatform)
  if (!current) {
    return null
  }

  const handleReanalyze = async () => {
    try {
      setLoading(true)
      await triggerIntelligenceAnalysis(postId, niche, engineSignals, enabledPlatforms)
      const newData = await fetchIntelligenceVideo(postId)
      setData(newData)
    } catch (err) {
      console.warn('[IntelligencePanel] Reanalysis failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-zinc-700 bg-zinc-900/50 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">How your video compares to viral content</h3>
        <button
          onClick={handleReanalyze}
          className="text-xs text-zinc-400 hover:text-zinc-300 transition"
        >
          Re-analyse
        </button>
      </div>

      {/* Platform tabs */}
      <div className="mb-6 flex gap-2 border-b border-zinc-700">
        {platforms.map(platform => (
          <button
            key={platform.platform}
            onClick={() => setSelectedPlatform(platform.platform as Platform)}
            className={`px-3 py-2 text-sm font-medium transition ${
              selectedPlatform === platform.platform
                ? 'border-b-2 border-blue-500 text-white'
                : 'border-b-2 border-transparent text-zinc-400 hover:text-zinc-300'
            }`}
          >
            {platform.platform.charAt(0).toUpperCase() + platform.platform.slice(1)}
          </button>
        ))}
      </div>

      {/* Current platform data */}
      <div className="space-y-6">
        {/* Similarity badge */}
        <div className="flex items-center gap-4 rounded-lg bg-zinc-800/50 p-4">
          <div className="flex-shrink-0">
            <div className="text-2xl font-bold text-blue-400">{current.similarity}%</div>
            <div className="text-xs text-zinc-400">match</div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-white">
              Compared to {current.viewTier} viral content
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              Your video is similar to videos getting {current.viewTier} views
            </div>
          </div>
        </div>

        {/* Signal gaps */}
        {current.gaps && current.gaps.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Signal gaps vs viral content:</h4>
            <ul className="space-y-2">
              {current.gaps.map((gap, idx) => (
                <li key={idx} className="text-sm text-zinc-300 flex items-start gap-2">
                  <span className="flex-shrink-0 mt-0.5">
                    {gap.difference < 0 ? '↑' : '↓'}
                  </span>
                  <span>
                    <strong>{FIELD_LABELS[gap.field] || gap.field}</strong> is{' '}
                    {gap.difference < 0 ? 'too low' : 'too high'} (you: {gap.current.toFixed(1)}, viral avg:{' '}
                    {gap.pattern_avg.toFixed(1)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI recommendations */}
        {current.aiInsights && current.aiInsights.recommendations && current.aiInsights.recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-zinc-300 mb-3">AI Recommendations:</h4>
            <div className="space-y-3">
              {current.aiInsights.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-3 ${PRIORITY_BADGE_CLASSES[rec.priority]}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 text-sm">{PRIORITY_EMOJI[rec.priority]}</span>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{rec.title}</div>
                      <div className="text-xs mt-1 opacity-90">{rec.description}</div>
                      {rec.estimated_impact && (
                        <div className="text-xs mt-2 opacity-75">{rec.estimated_impact}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {current.aiInsights.confidenceScore && (
              <div className="mt-3 text-xs text-zinc-400">
                Confidence: {current.aiInsights.confidenceScore}%
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
