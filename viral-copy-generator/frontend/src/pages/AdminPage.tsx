import { useState, useEffect, useCallback } from 'react'
import type {
  Screen, AdminJob, AdminUser,
  AdminHealthResponse, AdminLogsResponse, AdminPlatformStat
} from '../lib/types'
import {
  fetchAdminJobs, retryAdminJob, cancelAdminJob,
  fetchAdminUsers, disableAdminUser, enableAdminUser, resetAdminLearning,
  fetchAdminHealth,
  fetchAdminLogs,
  fetchAdminPlatformStats,
} from '../lib/api'

interface Props {
  onNavigate: (s: Screen) => void
}

type AdminTab = 'queue' | 'users' | 'health' | 'logs' | 'stats'

// Job state badge styles
const JOB_STATE_STYLES: Record<string, string> = {
  created:   'bg-amber-900/50 text-amber-300',
  retry:     'bg-amber-900/50 text-amber-300',
  active:    'bg-blue-900/50 text-blue-300',
  completed: 'bg-green-900/50 text-green-300',
  failed:    'bg-red-900/50 text-red-300',
  cancelled: 'bg-zinc-700 text-zinc-400',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminPage({ onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('queue')

  // ── Queue state ──────────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [jobActionError, setJobActionError] = useState<string | null>(null)
  const [showAllJobs, setShowAllJobs] = useState(false)

  const loadJobs = useCallback(async () => {
    setJobsLoading(true)
    setJobsError(null)
    try {
      setJobs(await fetchAdminJobs(showAllJobs))
    } catch {
      setJobsError('Failed to load jobs.')
    } finally {
      setJobsLoading(false)
    }
  }, [showAllJobs])

  useEffect(() => {
    if (activeTab === 'queue') void loadJobs()
  }, [activeTab, loadJobs])

  async function handleRetry(jobId: string) {
    setRetryingId(jobId)
    setJobActionError(null)
    try {
      await retryAdminJob(jobId)
      await loadJobs()
    } catch {
      setJobActionError('Failed to retry job. It may have already transitioned state.')
    } finally {
      setRetryingId(null)
    }
  }

  async function handleCancel(jobId: string) {
    if (!confirm('Cancel this job?')) return
    setCancellingId(jobId)
    setJobActionError(null)
    try {
      await cancelAdminJob(jobId)
      await loadJobs()
    } catch {
      setJobActionError('Failed to cancel job. It may have already transitioned state.')
    } finally {
      setCancellingId(null)
    }
  }

  // ── Users state ──────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [resetResults, setResetResults] = useState<Record<string, number>>({})

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    setUsersError(null)
    try {
      setUsers(await fetchAdminUsers())
    } catch {
      setUsersError('Failed to load users.')
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'users') void loadUsers()
  }, [activeTab, loadUsers])

  async function handleToggleBan(user: AdminUser) {
    if (user.banned) {
      if (!confirm(`Re-enable ${user.email ?? user.id}?`)) return
    } else {
      if (!confirm(`Disable ${user.email ?? user.id}? They cannot log in while disabled.`)) return
    }
    setTogglingId(user.id)
    try {
      if (user.banned) {
        await enableAdminUser(user.id)
      } else {
        await disableAdminUser(user.id)
      }
      await loadUsers()
    } catch {
      setUsersError('Failed to update user status.')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleResetLearning(userId: string, email: string | null) {
    if (!confirm(`Reset all learning data for ${email ?? userId}? This cannot be undone.`)) return
    setResettingId(userId)
    try {
      const result = await resetAdminLearning(userId)
      setResetResults(prev => ({ ...prev, [userId]: result.deleted }))
    } catch {
      setUsersError('Failed to reset learning data.')
    } finally {
      setResettingId(null)
    }
  }

  // ── Health / Logs / Stats state (loaded on tab switch) ───────────────────────
  const [health, setHealth] = useState<AdminHealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState<string | null>(null)

  const [logs, setLogs] = useState<AdminLogsResponse | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [logLines, setLogLines] = useState(100)

  const [platformStats, setPlatformStats] = useState<AdminPlatformStat[]>([])
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab === 'health') {
      setHealthLoading(true)
      setHealthError(null)
      void fetchAdminHealth().then(h => setHealth(h)).catch(() => setHealthError('Failed to load health.')).finally(() => setHealthLoading(false))
    }
    if (activeTab === 'logs') {
      setLogsLoading(true)
      setLogsError(null)
      void fetchAdminLogs({ lines: logLines }).then(l => setLogs(l)).catch(() => setLogsError('Failed to load logs.')).finally(() => setLogsLoading(false))
    }
    if (activeTab === 'stats') {
      setStatsLoading(true)
      setStatsError(null)
      void fetchAdminPlatformStats().then(r => setPlatformStats(r.platform_stats)).catch(() => setStatsError('Failed to load stats.')).finally(() => setStatsLoading(false))
    }
  }, [activeTab, logLines])

  // Tab nav labels
  const TABS: { id: AdminTab; label: string }[] = [
    { id: 'queue',  label: 'Queue' },
    { id: 'users',  label: 'Users' },
    { id: 'health', label: 'Health' },
    { id: 'logs',   label: 'Logs' },
    { id: 'stats',  label: 'Stats' },
  ]

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <span className="font-bold">Admin Panel</span>
        <button
          type="button"
          onClick={() => onNavigate('generator')}
          className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
        >
          Generator
        </button>
      </header>

      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-zinc-800 px-4 gap-1 pt-2 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-t px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">

        {/* ── Queue tab ── */}
        {activeTab === 'queue' && (
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Upload Jobs</h2>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={showAllJobs}
                    onChange={e => setShowAllJobs(e.target.checked)}
                    className="rounded"
                  />
                  Show cancelled
                </label>
                <button
                  type="button"
                  onClick={() => { void loadJobs() }}
                  className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                >
                  Refresh
                </button>
              </div>
            </div>

            {jobsLoading && <p className="text-center text-sm text-zinc-500 py-6">Loading jobs...</p>}
            {jobsError && <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300 mb-3">{jobsError}</p>}
            {jobActionError && <p className="rounded bg-amber-900/40 px-3 py-2 text-sm text-amber-300 mb-3">{jobActionError}</p>}

            {!jobsLoading && jobs.length === 0 && (
              <p className="text-center text-sm text-zinc-500 py-6">No active or failed jobs.</p>
            )}

            <div className="flex flex-col gap-2">
              {jobs.map(job => (
                <div key={job.id} className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono text-zinc-200 truncate">{job.name}</span>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${JOB_STATE_STYLES[job.state] ?? 'bg-zinc-700 text-zinc-300'}`}>
                          {job.state}
                        </span>
                        {job.data.platform && (
                          <span className="text-xs text-zinc-400">{job.data.platform}</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-600 font-mono truncate">
                        user: {job.data.userId?.slice(0, 8) ?? '—'}...
                        {' '} created: {formatDate(job.createdon)}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {job.state === 'failed' && (
                        <button
                          type="button"
                          onClick={() => { void handleRetry(job.id) }}
                          disabled={retryingId === job.id}
                          className="rounded bg-amber-900/40 px-2 py-1 text-xs text-amber-300 hover:bg-amber-900/60 disabled:opacity-50"
                        >
                          {retryingId === job.id ? '...' : 'Retry'}
                        </button>
                      )}
                      {(job.state === 'created' || job.state === 'retry' || job.state === 'active') && (
                        <button
                          type="button"
                          onClick={() => { void handleCancel(job.id) }}
                          disabled={cancellingId === job.id}
                          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-red-900/40 hover:text-red-300 disabled:opacity-50"
                        >
                          {cancellingId === job.id ? '...' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Users tab ── */}
        {activeTab === 'users' && (
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Registered Users ({users.length})
              </h2>
              <button
                type="button"
                onClick={() => { void loadUsers() }}
                className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
              >
                Refresh
              </button>
            </div>

            {usersLoading && <p className="text-center text-sm text-zinc-500 py-6">Loading users...</p>}
            {usersError && <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300 mb-3">{usersError}</p>}

            <div className="flex flex-col gap-3">
              {users.map(user => {
                const resetCount = resetResults[user.id]
                return (
                  <div key={user.id} className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-zinc-200 truncate">{user.email ?? user.id}</span>
                          {user.banned && (
                            <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-xs text-red-300 font-medium">Disabled</span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Joined {formatDate(user.created_at)}
                          {' · '}{user.upload_count} uploads
                          {user.connected_platforms.length > 0 && (
                            <> · {user.connected_platforms.join(', ')}</>
                          )}
                        </div>
                        {resetCount !== undefined && (
                          <p className="text-xs text-green-400">
                            Learning reset — {resetCount} signals deleted.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => { void handleToggleBan(user) }}
                          disabled={togglingId === user.id}
                          className={`rounded px-2 py-1 text-xs disabled:opacity-50 ${
                            user.banned
                              ? 'bg-green-900/40 text-green-300 hover:bg-green-900/60'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-red-900/40 hover:text-red-300'
                          }`}
                        >
                          {togglingId === user.id ? '...' : user.banned ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { void handleResetLearning(user.id, user.email) }}
                          disabled={resettingId === user.id}
                          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-amber-900/40 hover:text-amber-300 disabled:opacity-50"
                        >
                          {resettingId === user.id ? '...' : 'Reset Learning'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Health tab ── */}
        {activeTab === 'health' && (
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">System Health</h2>
              <button
                type="button"
                onClick={() => { setHealth(null); setHealthLoading(true); void fetchAdminHealth().then(h => setHealth(h)).catch(() => setHealthError('Failed.')).finally(() => setHealthLoading(false)) }}
                className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
              >
                Refresh
              </button>
            </div>

            {healthLoading && <p className="text-center text-sm text-zinc-500 py-6">Loading health data...</p>}
            {healthError && <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300 mb-3">{healthError}</p>}

            {health && (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">CPU &amp; Memory</h3>
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">CPU Cores</span>
                      <span className="text-zinc-200">{health.cpu.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Memory Usage</span>
                      <span className="text-zinc-200">{health.memory.use_pct}% ({health.memory.used_mb} MB / {health.memory.total_mb} MB)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800">
                      <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${health.memory.use_pct}%` }} />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Disk (/var)</h3>
                  {'error' in health.disk
                    ? <p className="text-xs text-red-400">{health.disk.error}</p>
                    : (
                      <div className="flex flex-col gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Used / Total</span>
                          <span className="text-zinc-200">{health.disk.used} / {health.disk.size} ({health.disk.usePct})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Available</span>
                          <span className="text-zinc-200">{health.disk.avail}</span>
                        </div>
                      </div>
                    )
                  }
                </div>

                <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Database &amp; Queue</h3>
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Supabase DB Size</span>
                      <span className="text-zinc-200">{'error' in health.database ? health.database.error : health.database.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Pending Jobs</span>
                      <span className="text-zinc-200">{health.queue.pending_jobs}</span>
                    </div>
                  </div>
                </div>

                {/* API Status */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 mb-4">
                  <h3 className="text-sm font-semibold text-zinc-200 mb-3">API Connectivity</h3>
                  <div className="space-y-2 text-sm">
                    {Object.entries(health.apis).map(([apiName, status]) => (
                      <div key={apiName} className="flex items-center justify-between">
                        <span className="text-zinc-400 capitalize">{apiName}</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${status.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className={status.connected ? 'text-green-400' : 'text-red-400'}>
                            {status.connected ? 'Connected' : status.error ? 'Disconnected' : 'Offline'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-zinc-600">Last refreshed: {formatDate(health.timestamp)}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Logs tab ── */}
        {activeTab === 'logs' && (
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Application Logs</h2>
              <div className="flex items-center gap-2">
                <select
                  value={logLines}
                  onChange={e => setLogLines(parseInt(e.target.value, 10))}
                  className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 outline-none"
                  aria-label="Log lines count"
                >
                  <option value={50}>Last 50</option>
                  <option value={100}>Last 100</option>
                  <option value={200}>Last 200</option>
                  <option value={500}>Last 500</option>
                </select>
                <button
                  type="button"
                  onClick={() => { setLogs(null); setLogsLoading(true); void fetchAdminLogs({ lines: logLines }).then(l => setLogs(l)).catch(() => setLogsError('Failed.')).finally(() => setLogsLoading(false)) }}
                  className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                >
                  Refresh
                </button>
              </div>
            </div>

            {logsLoading && <p className="text-center text-sm text-zinc-500 py-6">Loading logs...</p>}
            {logsError && <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300 mb-3">{logsError}</p>}

            {logs && (
              <>
                <p className="text-xs text-zinc-600 mb-2">
                  Showing {logs.meta.returned} of {logs.meta.total_lines} lines
                  {logs.meta.error && <span className="text-amber-400 ml-2">{logs.meta.error}</span>}
                </p>
                <div className="rounded-lg bg-black border border-zinc-800 p-3 overflow-x-auto">
                  <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all">
                    {logs.lines.length === 0
                      ? 'No log entries found.'
                      : logs.lines.join('\n')
                    }
                  </pre>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Platform Stats tab ── */}
        {activeTab === 'stats' && (
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Platform Stats (All Users)</h2>
              <button
                type="button"
                onClick={() => { setStatsLoading(true); void fetchAdminPlatformStats().then(r => setPlatformStats(r.platform_stats)).catch(() => setStatsError('Failed.')).finally(() => setStatsLoading(false)) }}
                className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
              >
                Refresh
              </button>
            </div>

            {statsLoading && <p className="text-center text-sm text-zinc-500 py-6">Loading stats...</p>}
            {statsError && <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300 mb-3">{statsError}</p>}

            {!statsLoading && platformStats.length === 0 && (
              <p className="text-center text-sm text-zinc-500 py-6">No upload data yet.</p>
            )}

            {platformStats.length > 0 && (() => {
              const maxUploads = Math.max(...platformStats.map(s => s.total_uploads), 1)
              return (
                <div className="flex flex-col gap-4">
                  {platformStats.map(stat => {
                    const uploadPct = Math.round((stat.total_uploads / maxUploads) * 100)
                    return (
                      <div key={stat.platform} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-200 capitalize">{stat.platform}</span>
                          <span className="text-zinc-400">
                            {stat.total_uploads} uploads · {stat.success_rate}% success
                            {stat.avg_virality_score != null && <> · avg score {stat.avg_virality_score}</>}
                          </span>
                        </div>
                        {/* ADMIN-09: bar chart — inline style (never dynamic Tailwind class) */}
                        <div className="h-1.5 rounded-full bg-zinc-800">
                          <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${uploadPct}%` }} />
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="text-green-400">{stat.succeeded} succeeded</span>
                          <span className="text-red-400">{stat.failed} failed</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}

      </main>
    </div>
  )
}
