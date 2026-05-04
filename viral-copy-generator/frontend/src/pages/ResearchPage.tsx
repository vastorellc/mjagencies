import { useState, useEffect } from 'react'
import type {
  Screen, ResearchTab, ContentIdeaData, HashtagIntel,
  CalendarDay, SavedIdea, TrendItem
} from '../lib/types'
import {
  fetchResearchTrends, generateResearchIdeas,
  fetchSavedIdeas, saveIdea, refreshTrends, fetchResearchHashtags,
} from '../lib/api'

interface Props {
  onNavigate: (s: Screen) => void
}

const VALID_NICHES = ['travel', 'hotels', 'cars', 'bikes', 'coding', 'lifestyle'] as const
type ValidNiche = typeof VALID_NICHES[number]

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ResearchPage({ onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<ResearchTab>('ideas')
  const [niche, setNiche] = useState<ValidNiche>('travel')

  // Data state
  const [trends, setTrends] = useState<TrendItem[]>([])
  const [ideas, setIdeas] = useState<ContentIdeaData[]>([])
  const [hashtags, setHashtags] = useState<HashtagIntel[]>([])
  const [calendar, setCalendar] = useState<CalendarDay[]>([])
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)

  // Loading state
  const [loadingTrends, setLoadingTrends] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load trend data when niche changes (RESEARCH-06 cache-first)
  useEffect(() => {
    void (async () => {
      setLoadingTrends(true)
      setError(null)
      try {
        const data = await fetchResearchTrends(niche)
        setTrends(data.trends)
        setFetchedAt(data.fetchedAt)
      } catch {
        setError('Failed to load trend data. Try refreshing.')
      } finally {
        setLoadingTrends(false)
      }
    })()
  }, [niche])

  // Load saved ideas when Saved tab is activated
  useEffect(() => {
    if (activeTab !== 'saved') return
    void (async () => {
      const saved = await fetchSavedIdeas()
      setSavedIdeas(saved)
    })()
  }, [activeTab])

  async function handleGenerate(): Promise<void> {
    setGenerating(true)
    setError(null)
    try {
      const data = await generateResearchIdeas(niche)
      setIdeas(data.ideas)
      setCalendar(data.calendar)
      setHashtags(data.hashtags)
    } catch {
      setError('AI generation failed. Check your API key in Settings.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRefresh(): Promise<void> {
    setRefreshing(true)
    try {
      await refreshTrends()
      // Re-fetch after triggering refresh (may still return cached data until job runs)
      const data = await fetchResearchTrends(niche)
      setTrends(data.trends)
      setFetchedAt(data.fetchedAt)
    } catch {
      setError('Refresh failed. Try again.')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSaveToggle(ideaId: string): Promise<void> {
    try {
      await saveIdea(ideaId)
      // Refresh saved list if on saved tab
      if (activeTab === 'saved') {
        const saved = await fetchSavedIdeas()
        setSavedIdeas(saved)
      }
    } catch {
      // Non-blocking — save failure does not break the page
    }
  }

  // Format "Last updated: Xh ago" from ISO timestamp (RESEARCH-15)
  function freshnessLabel(isoStr: string): string {
    const ageMs = Date.now() - new Date(isoStr).getTime()
    const ageH = Math.round(ageMs / 3_600_000)
    if (ageH < 1) return 'Last updated: just now'
    return `Last updated: ${ageH}h ago`
  }

  // Normalize scores for bar chart
  function pctOf(value: number, max: number): number {
    if (max <= 0) return 0
    return Math.min(100, Math.round((value / max) * 100))
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <span className="font-bold">Research</span>
        <div className="flex items-center gap-2">
          {/* Niche selector */}
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value as ValidNiche)}
            className="rounded bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 border border-zinc-700 hover:bg-zinc-700"
          >
            {VALID_NICHES.map(n => (
              <option key={n} value={n} className="capitalize">{n}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
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

      {/* Freshness indicator (RESEARCH-15) */}
      {fetchedAt && (
        <div className="px-4 py-1 border-b border-zinc-900">
          <span className="text-xs text-zinc-500">{freshnessLabel(fetchedAt)}</span>
        </div>
      )}

      {/* 4-tab sub-nav */}
      <div className="flex border-b border-zinc-800">
        {(['ideas', 'hashtags', 'calendar', 'saved'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm capitalize ${
              activeTab === tab
                ? 'border-b-2 border-purple-500 text-purple-300'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 rounded bg-red-900/30 border border-red-800 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">

        {/* -- IDEAS TAB -------------------------------------------------------- */}
        {activeTab === 'ideas' && (
          <div className="py-4">
            {/* Generate button */}
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating || loadingTrends}
              className="mb-4 w-full rounded-lg bg-purple-600 px-4 py-3 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50"
            >
              {generating ? 'Generating ideas...' : loadingTrends ? 'Loading trends...' : 'Generate Content Ideas'}
            </button>

            {/* Trend source summary (RESEARCH-02..05) */}
            {trends.length > 0 && !generating && (
              <div className="mb-4 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2">
                <p className="text-xs text-zinc-500">
                  {trends.length} trending signals loaded from {
                    [...new Set(trends.map(t => t.source))].join(', ')
                  }
                </p>
              </div>
            )}

            {/* Idea cards */}
            {ideas.length === 0 && !generating && (
              <p className="py-6 text-center text-sm text-zinc-500">
                Press "Generate Content Ideas" to get AI-powered suggestions based on current trends and your learning history.
              </p>
            )}

            <div className="flex flex-col gap-4">
              {ideas.map((idea, i) => (
                <IdeaCard
                  key={i}
                  idea={idea}
                  onSave={() => void handleSaveToggle(idea.id ?? String(i))}
                />
              ))}
            </div>
          </div>
        )}

        {/* -- HASHTAGS TAB ----------------------------------------------------- */}
        {activeTab === 'hashtags' && (
          <HashtagsTab
            hashtags={hashtags}
            niche={niche}
            pctOf={pctOf}
          />
        )}

        {/* -- CALENDAR TAB — implemented in Plan 09-07 ------------------------ */}
        {activeTab === 'calendar' && (
          <div className="py-8 text-center">
            <p className="text-sm text-zinc-400">Generate ideas first to populate the calendar.</p>
          </div>
        )}

        {/* -- SAVED TAB — implemented in Plan 09-07 --------------------------- */}
        {activeTab === 'saved' && (
          <div className="py-8 text-center">
            <p className="text-sm text-zinc-400">Loading saved ideas...</p>
          </div>
        )}

      </main>
    </div>
  )
}

// -- IdeaCard — RESEARCH-09 full idea schema + RESEARCH-10 gap warnings -------
interface IdeaCardProps {
  idea: ContentIdeaData
  onSave: () => void
}

function IdeaCard({ idea, onSave }: IdeaCardProps) {
  const [expanded, setExpanded] = useState(false)

  // Strength bar color
  const strengthColor =
    idea.estimatedStrength >= 70 ? 'bg-green-500' :
    idea.estimatedStrength >= 50 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
      {/* Title + strength */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold text-zinc-100 flex-1">{idea.title}</h3>
        <span className="shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          {idea.estimatedStrength}/100
        </span>
      </div>

      {/* Strength bar — inline style, never dynamic Tailwind class */}
      <div className="mb-2 h-1 rounded-full bg-zinc-800">
        <div
          className={`h-1 rounded-full ${strengthColor}`}
          style={{ width: `${idea.estimatedStrength}%` }}
        />
      </div>

      {/* Angle */}
      <p className="mb-2 text-xs text-zinc-400">{idea.angle}</p>

      {/* Gap warnings (RESEARCH-10: rule-based pre-analysis) */}
      {idea.gapWarnings.length > 0 && (
        <div className="mb-2 rounded bg-amber-900/20 border border-amber-800/30 px-2 py-1.5">
          {idea.gapWarnings.map((w, wi) => (
            <p key={wi} className="text-xs text-amber-300">! {w}</p>
          ))}
        </div>
      )}

      {/* Hook variants — always show 3 */}
      <div className="mb-2 flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Hook Variants</p>
        {idea.hookVariants.map((hook, hi) => (
          <p key={hi} className="text-xs text-zinc-300 rounded bg-zinc-800 px-2 py-1">
            "{hook}"
          </p>
        ))}
      </div>

      {/* Platform tags */}
      <div className="mb-2 flex flex-wrap gap-1">
        {idea.platforms.map(p => (
          <span key={p} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 capitalize">{p}</span>
        ))}
      </div>

      {/* Expand/collapse for script outline */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="text-xs text-purple-400 hover:text-purple-300 mb-2"
      >
        {expanded ? 'Show less' : 'Show script outline'}
      </button>

      {expanded && (
        <div className="mb-2">
          <p className="text-xs text-zinc-300 whitespace-pre-wrap">{idea.scriptOutline}</p>
          {idea.keyMoments.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Key Moments</p>
              {idea.keyMoments.map((km, kmi) => (
                <p key={kmi} className="text-xs text-zinc-400">{km.timestamp} -- {km.description}</p>
              ))}
            </div>
          )}
          {idea.brollSuggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">B-roll</p>
              {idea.brollSuggestions.map((b, bi) => (
                <p key={bi} className="text-xs text-zinc-400">- {b}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hashtags + save action */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex flex-wrap gap-1">
          {idea.hashtagSuggestions.slice(0, 5).map((h, hi) => (
            <span key={hi} className="text-xs text-purple-400">#{h}</span>
          ))}
        </div>
        <button
          type="button"
          onClick={onSave}
          className="text-xs text-zinc-500 hover:text-zinc-300"
          aria-label="Save idea"
        >
          Save
        </button>
      </div>
    </div>
  )
}

// -- HashtagsTab — RESEARCH-11 with inline-style score bars -------------------
interface HashtagsTabProps {
  hashtags: HashtagIntel[]
  niche: string
  pctOf: (value: number, max: number) => number
}

function HashtagsTab({ hashtags, niche, pctOf }: HashtagsTabProps) {
  const [localHashtags, setLocalHashtags] = useState<HashtagIntel[]>(hashtags)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // If hashtags were already loaded via /generate, use them
    if (hashtags.length > 0) {
      setLocalHashtags(hashtags)
      return
    }
    // Otherwise fetch standalone
    setLoading(true)
    void fetchResearchHashtags(niche).then(h => {
      setLocalHashtags(h)
      setLoading(false)
    })
  }, [hashtags, niche])

  const maxScore = Math.max(...localHashtags.map(h => h.combinedScore), 1)

  return (
    <div className="py-4">
      {loading && (
        <p className="py-6 text-center text-sm text-zinc-500">Loading hashtag intelligence...</p>
      )}

      {!loading && localHashtags.length === 0 && (
        <div className="py-6 text-center">
          <p className="text-sm text-zinc-400">No hashtag data yet.</p>
          <p className="mt-1 text-xs text-zinc-600">Generate content ideas or log actual views to activate hashtag intelligence.</p>
        </div>
      )}

      {!loading && localHashtags.length > 0 && (
        <>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Hashtag Intelligence -- {niche}
          </h2>
          <div className="flex flex-col gap-2">
            {localHashtags.slice(0, 20).map((h, i) => {
              const pct = pctOf(h.combinedScore, maxScore)
              const sourceColor =
                h.source === 'both' ? 'text-green-400' :
                h.source === 'user' ? 'text-blue-400' : 'text-zinc-400'
              return (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-200">#{h.hashtag}</span>
                    <span className={`shrink-0 ${sourceColor} text-xs`}>{h.source}</span>
                  </div>
                  {/* RESEARCH-11: inline style width — NEVER dynamic Tailwind class */}
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
          <p className="mt-4 text-xs text-zinc-600">
            Combined score = trend velocity x (1 + your avg views / 1000).
            Green = trending + proven by your posts. Blue = from your history. Gray = trending externally.
          </p>
        </>
      )}
    </div>
  )
}

