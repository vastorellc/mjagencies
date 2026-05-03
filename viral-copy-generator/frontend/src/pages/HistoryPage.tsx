import { useState, useEffect, useCallback } from 'react'
import type { Screen, PostWithPlatforms, PlatformPostRow, AccuracyLabel, PostFilters } from '../lib/types'
import { ALL_PLATFORMS, NICHES } from '../lib/types'
import { fetchPosts, deletePost, logActualViews } from '../lib/api'

interface Props {
  onNavigate: (s: Screen) => void
}

// Platform icon map — real abbreviated labels (CLAUDE.md rule 5: no placeholders)
const PLATFORM_ICONS: Record<string, string> = {
  youtube:   'YT',
  instagram: 'IG',
  tiktok:    'TK',
  facebook:  'FB',
  x:         'X',
}

// Accuracy badge colors
const ACCURACY_STYLES: Record<AccuracyLabel, string> = {
  overperformed:  'bg-green-900/50 text-green-300',
  matched:        'bg-zinc-700 text-zinc-300',
  underperformed: 'bg-red-900/50 text-red-300',
}

const ACCURACY_LABELS: Record<AccuracyLabel, string> = {
  overperformed:  'Overperformed',
  matched:        'Matched',
  underperformed: 'Underperformed',
}

// In-memory accuracy cache: platformPostId → AccuracyLabel
// Persists for the session; cleared on page reload (acceptable for v1)
type AccuracyMap = Record<string, AccuracyLabel>

export default function HistoryPage({ onNavigate }: Props) {
  const [posts, setPosts] = useState<PostWithPlatforms[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<PostFilters>({})
  const [accuracyMap, setAccuracyMap] = useState<AccuracyMap>({})
  // viewInputs: platformPostId → string (controlled input value)
  const [viewInputs, setViewInputs] = useState<Record<string, string>>({})
  const [loggingIds, setLoggingIds] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPosts(filters)
      setPosts(data)
    } catch {
      setError('Failed to load post history. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  // Pre-populate accuracyMap from existing actual_views in loaded posts
  useEffect(() => {
    const derived: AccuracyMap = {}
    for (const post of posts) {
      for (const pp of post.platforms) {
        if (pp.actual_views !== null && pp.actual_views !== undefined) {
          const predictedMid = ((pp.predicted_low ?? 0) + (pp.predicted_high ?? 0)) / 2
          const delta = pp.actual_views - predictedMid
          const threshold = 0.2 * Math.max(predictedMid, 1)
          const label: AccuracyLabel =
            delta > threshold ? 'overperformed' :
            delta < -threshold ? 'underperformed' :
            'matched'
          derived[pp.id] = label
        }
      }
    }
    setAccuracyMap(prev => ({ ...derived, ...prev }))  // keep server-confirmed labels
  }, [posts])

  async function handleLogViews(pp: PlatformPostRow) {
    const rawVal = viewInputs[pp.id] ?? ''
    const parsed = parseInt(rawVal, 10)
    if (isNaN(parsed) || parsed < 0) return

    setLoggingIds(prev => new Set(prev).add(pp.id))
    try {
      const { accuracy } = await logActualViews(pp.id, parsed)
      setAccuracyMap(prev => ({ ...prev, [pp.id]: accuracy }))
      // Optimistically update the displayed actual_views value in post list
      setPosts(prev => prev.map(post => ({
        ...post,
        platforms: post.platforms.map(p =>
          p.id === pp.id ? { ...p, actual_views: parsed } : p
        ),
      })))
    } catch {
      // Non-blocking — show no error; user can retry
    } finally {
      setLoggingIds(prev => { const s = new Set(prev); s.delete(pp.id); return s })
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm('Delete this post and all its learning data?')) return
    setDeletingId(postId)
    try {
      await deletePost(postId)
      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch {
      setError('Failed to delete post. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  // Format date as "3 May 2026" — real readable date, no placeholders
  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-PK', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  // Format predicted view range string — mirrors viewRange.ts format
  function viewRangeString(pp: PlatformPostRow): string {
    if (pp.predicted_low === null || pp.predicted_high === null) return '—'
    const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n)
    return `${fmt(pp.predicted_low)}–${fmt(pp.predicted_high)}`
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <span className="font-bold">Post History</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('generator')}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
          >
            Generator
          </button>
          <button
            type="button"
            onClick={() => onNavigate('learning')}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
          >
            Insights
          </button>
        </div>
      </header>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-zinc-800">
        {/* Platform filter */}
        <select
          value={filters.platform ?? ''}
          onChange={e => setFilters(f => ({ ...f, platform: e.target.value || undefined }))}
          className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-200 outline-none"
          aria-label="Filter by platform"
        >
          <option value="">All platforms</option>
          {ALL_PLATFORMS.map(p => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>

        {/* Niche filter */}
        <select
          value={filters.niche ?? ''}
          onChange={e => setFilters(f => ({ ...f, niche: e.target.value || undefined }))}
          className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-200 outline-none"
          aria-label="Filter by niche"
        >
          <option value="">All niches</option>
          {NICHES.map(n => (
            <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>
          ))}
        </select>

        {/* Date range */}
        <input
          type="date"
          value={filters.from ?? ''}
          onChange={e => setFilters(f => ({ ...f, from: e.target.value || undefined }))}
          className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-200 outline-none"
          aria-label="From date"
        />
        <input
          type="date"
          value={filters.to ?? ''}
          onChange={e => setFilters(f => ({ ...f, to: e.target.value || undefined }))}
          className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-200 outline-none"
          aria-label="To date"
        />

        {/* Clear filters */}
        {(filters.platform || filters.niche || filters.from || filters.to) && (
          <button
            type="button"
            onClick={() => setFilters({})}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
          >
            Clear filters
          </button>
        )}
      </div>

      <main className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
        {loading && (
          <p className="py-8 text-center text-sm text-zinc-500">Loading posts...</p>
        )}
        {error && (
          <p className="mt-4 rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>
        )}
        {!loading && !error && posts.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500">
            No posts yet. Generate your first copy to see it here.
          </p>
        )}

        <div className="flex flex-col gap-4 py-4">
          {posts.map(post => (
            <div key={post.id} className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
              {/* Post header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1 min-w-0">
                  <h2 className="text-sm font-bold truncate text-zinc-100">{post.title}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    {/* Platform icons — HISTORY-02 */}
                    <div className="flex gap-1">
                      {post.platforms.map(pp => (
                        <span
                          key={pp.id}
                          className="rounded bg-zinc-700 px-1.5 py-0.5 text-xs font-mono text-zinc-300"
                          title={pp.platform}
                        >
                          {PLATFORM_ICONS[pp.platform] ?? pp.platform.slice(0, 2).toUpperCase()}
                        </span>
                      ))}
                    </div>
                    {/* Niche tag — HISTORY-02 */}
                    <span className="rounded bg-purple-900/40 px-2 py-0.5 text-purple-300">
                      {post.niche}
                    </span>
                    {/* Virality score — HISTORY-02 */}
                    <span className="text-zinc-400">Score: <span className="text-white font-bold">{post.virality_score}</span></span>
                    {/* Date posted — HISTORY-02 */}
                    <span>{formatDate(post.created_at)}</span>
                  </div>
                </div>

                {/* Delete button — HISTORY-06 */}
                <button
                  type="button"
                  onClick={() => { void handleDelete(post.id) }}
                  disabled={deletingId === post.id}
                  className="shrink-0 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-red-900/40 hover:text-red-300 disabled:opacity-50"
                  aria-label={`Delete post ${post.title}`}
                >
                  {deletingId === post.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>

              {/* Platform rows — HISTORY-04, HISTORY-05 */}
              {post.platforms.length > 0 && (
                <div className="mt-3 flex flex-col gap-2 border-t border-zinc-800 pt-3">
                  {post.platforms.map(pp => {
                    const accuracy = accuracyMap[pp.id]
                    const isLogging = loggingIds.has(pp.id)

                    return (
                      <div key={pp.id} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="w-8 font-mono text-zinc-400">
                          {PLATFORM_ICONS[pp.platform] ?? pp.platform}
                        </span>
                        <span className="text-zinc-500">Predicted: {viewRangeString(pp)}</span>

                        {/* Accuracy badge — shown once actual_views is logged (HISTORY-05) */}
                        {accuracy && (
                          <span className={`rounded px-2 py-0.5 font-medium ${ACCURACY_STYLES[accuracy]}`}>
                            {ACCURACY_LABELS[accuracy]}
                          </span>
                        )}

                        {/* Inline view logging — HISTORY-04 */}
                        <div className="flex items-center gap-1 ml-auto">
                          <input
                            type="number"
                            min="0"
                            placeholder={pp.actual_views !== null ? String(pp.actual_views) : 'Actual views'}
                            value={viewInputs[pp.id] ?? ''}
                            onChange={e => setViewInputs(prev => ({ ...prev, [pp.id]: e.target.value }))}
                            className="w-28 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-purple-500 placeholder-zinc-600"
                            aria-label={`Actual views for ${pp.platform}`}
                          />
                          <button
                            type="button"
                            onClick={() => { void handleLogViews(pp) }}
                            disabled={isLogging || !viewInputs[pp.id]}
                            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600 disabled:opacity-50"
                          >
                            {isLogging ? '...' : 'Log'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
