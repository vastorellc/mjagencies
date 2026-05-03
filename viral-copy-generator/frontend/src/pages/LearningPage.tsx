import { useState, useEffect } from 'react'
import type { Screen, TopHook, TopHashtag, PostingTimeSlot, NichePerformance } from '../lib/types'
import {
  fetchTopHooks, fetchTopHashtags, fetchPostingTimes,
  fetchNichePerformance, fetchLearningWeights,
} from '../lib/api'

interface Props {
  onNavigate: (s: Screen) => void
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function LearningPage({ onNavigate }: Props) {
  const [hooks, setHooks] = useState<TopHook[]>([])
  const [hashtags, setHashtags] = useState<TopHashtag[]>([])
  const [postingTimes, setPostingTimes] = useState<PostingTimeSlot[]>([])
  const [niches, setNiches] = useState<NichePerformance[]>([])
  const [dataPoints, setDataPoints] = useState(0)
  const [isCalibrated, setIsCalibrated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const [hooksData, hashtagsData, timesData, nichesData, weightsData] = await Promise.all([
        fetchTopHooks(),
        fetchTopHashtags(),
        fetchPostingTimes(),
        fetchNichePerformance(),
        fetchLearningWeights(),
      ])
      setHooks(hooksData)
      setHashtags(hashtagsData)
      setPostingTimes(timesData)
      setNiches(nichesData)
      setDataPoints(weightsData.data_points)
      setIsCalibrated(weightsData.is_calibrated)
      setLoading(false)
    })()
  }, [])

  // Normalize values to 0-100 percentage of max for bar chart widths
  function pctOf(value: number, max: number): number {
    if (max <= 0) return 0
    return Math.round((value / max) * 100)
  }

  const maxHookViews = Math.max(...hooks.map(h => h.max_views), 1)
  const maxHashtagViews = Math.max(...hashtags.map(h => h.avg_views), 1)
  const maxNicheAvg = Math.max(...niches.map(n => n.avg_views), 1)

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="font-bold">Learning Insights</span>
          {/* LEARNING-09: Calibrated badge when dataPoints >= 10 */}
          {isCalibrated && (
            <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-xs text-green-300 font-medium">
              Calibrated ({dataPoints} posts)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
          >
            History
          </button>
          <button
            type="button"
            onClick={() => onNavigate('generator')}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
          >
            Generator
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
        {loading && (
          <p className="py-8 text-center text-sm text-zinc-500">Loading insights...</p>
        )}

        {!loading && hooks.length === 0 && hashtags.length === 0 && niches.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-zinc-400">No learning data yet.</p>
            <p className="mt-1 text-xs text-zinc-600">Generate posts and log actual views to activate insights.</p>
          </div>
        )}

        {!loading && (
          <div className="flex flex-col gap-6 py-4">

            {/* LEARNING-01: Top Hooks by MAX(actual_views) */}
            {hooks.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Top Hooks -- Viral Ceiling
                </h2>
                <div className="flex flex-col gap-2">
                  {hooks.map((hook, i) => {
                    const pct = pctOf(hook.max_views, maxHookViews)
                    const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n)
                    return (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-200 truncate pr-2" style={{ maxWidth: '75%' }}>{hook.hook_text}</span>
                          <span className="text-zinc-400 shrink-0">{fmt(hook.max_views)} views</span>
                        </div>
                        {/* LEARNING-03: inline style width -- NEVER dynamic Tailwind class */}
                        <div className="h-1.5 rounded-full bg-zinc-800">
                          <div
                            className="h-1.5 rounded-full bg-purple-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* LEARNING-02: Top Hashtags via unnest() aggregation */}
            {hashtags.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Top Hashtags -- Avg Views
                </h2>
                <div className="flex flex-col gap-2">
                  {hashtags.map((h, i) => {
                    const pct = pctOf(h.avg_views, maxHashtagViews)
                    const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n)
                    return (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-200">{h.hashtag}</span>
                          <span className="text-zinc-400">{fmt(h.avg_views)} avg</span>
                        </div>
                        {/* LEARNING-03: inline style width */}
                        <div className="h-1.5 rounded-full bg-zinc-800">
                          <div
                            className="h-1.5 rounded-full bg-blue-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* LEARNING-04: Best posting times per platform (PKT) */}
            {postingTimes.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Best Posting Times (PKT)
                </h2>
                <div className="flex flex-col gap-2">
                  {postingTimes.slice(0, 8).map((slot, i) => {
                    const hour12 = slot.hour % 12 === 0 ? 12 : slot.hour % 12
                    const amPm = slot.hour < 12 ? 'AM' : 'PM'
                    const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n)
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 w-16 shrink-0 font-mono">
                          {slot.platform.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-zinc-200">
                          {DOW_LABELS[slot.dow]} {hour12}{amPm}
                        </span>
                        <span className="text-zinc-400">{fmt(slot.avg_views)} avg {slot.post_count} posts</span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* LEARNING-05: Niche performance breakdown */}
            {niches.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Niche Performance
                </h2>
                <div className="flex flex-col gap-2">
                  {niches.map((n, i) => {
                    const pct = pctOf(n.avg_views, maxNicheAvg)
                    const fmt = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(Math.round(v))
                    return (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-200 capitalize">{n.niche}</span>
                          <span className="text-zinc-400">{fmt(n.avg_views)} avg {n.total_posts} posts</span>
                        </div>
                        {/* LEARNING-03: inline style width */}
                        <div className="h-1.5 rounded-full bg-zinc-800">
                          <div
                            className="h-1.5 rounded-full bg-amber-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* EMA calibration status */}
            <section className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
              <p className="text-xs text-zinc-500">
                {isCalibrated
                  ? `Score calibration active -- EMA trained on ${dataPoints} posts. Your scores now reflect your niche's real performance patterns.`
                  : `Score calibration inactive -- log actual views for ${Math.max(0, 10 - dataPoints)} more posts to activate EMA calibration.`
                }
              </p>
            </section>

          </div>
        )}
      </main>
    </div>
  )
}
