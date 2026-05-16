import { supabase } from './supabase'
import { parseAPIError } from './errors'
import type {
  AIProxyBody, SettingsResponse, CreatePostBody, PostSaveResponse,
  UploadFileResponse, ScheduleUploadBody, ScheduleUploadResponse,
  PostWithPlatforms, LogViewsResponse, TopHook, TopHashtag,
  PostingTimeSlot, NichePerformance, LearningWeightsResponse, PostFilters,
  AdminJob, AdminUser, AdminHealthResponse, AdminLogsResponse, AdminPlatformStatsResponse,
  ResearchTrendsResponse, ResearchGenerateResponse, SavedIdea, HashtagIntel,
  EngineSignals, Platform,
  IntelligenceVideoData, IntelligencePlatformResult,
  AdminProviderHealth,
} from './types'

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

/**
 * Throw a structured error that can be parsed by getErrorPayload().
 * Wraps the APIErrorPayload in JSON so it survives the Error message channel.
 */
function throwStructuredError(payload: any): never {
  throw new Error(JSON.stringify(payload))
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(`/api${path}`, { ...init, headers })
}

export async function proxyAIGenerate(body: AIProxyBody): Promise<{ text: string }> {
  const res = await apiFetch('/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errPayload = await parseAPIError(res)
    throwStructuredError(errPayload)
  }
  return res.json() as Promise<{ text: string }>
}

export async function fetchSettings(): Promise<SettingsResponse> {
  const res = await apiFetch('/settings')
  if (!res.ok) throw new Error('settings_fetch_failed')
  return res.json() as Promise<SettingsResponse>
}

export async function createPost(body: CreatePostBody): Promise<PostSaveResponse> {
  const res = await apiFetch('/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('post_save_failed')
  return res.json() as Promise<PostSaveResponse>
}

export async function fetchApiKey(): Promise<{ api_key: string | null }> {
  // CLAUDE.md compliance: key fetched only immediately before callAI() — never stored in React state
  const res = await apiFetch('/settings/key')
  if (!res.ok) throw new Error('key_fetch_failed')
  return res.json() as Promise<{ api_key: string | null }>
}

// ============================================================================
// Phase 6: Auto-Upload + Scheduling
// ============================================================================

/**
 * POST /api/upload/file — upload video file to VPS storage.
 * Returns fileId and publicUrl for the stored file.
 * Do NOT set Content-Type manually — browser must set it with boundary for multipart.
 */
export async function uploadFile(file: File): Promise<UploadFileResponse> {
  const form = new FormData()
  form.append('video', file)
  const res = await apiFetch('/upload/file', {
    method: 'POST',
    body: form,
    // Content-Type intentionally omitted — browser sets multipart boundary automatically
  })
  if (!res.ok) {
    const errPayload = await parseAPIError(res)
    throwStructuredError(errPayload)
  }
  return res.json() as Promise<UploadFileResponse>
}

/**
 * POST /api/upload/schedule — enqueue a pg-boss upload job.
 * scheduledAt is ISO-8601 UTC; omit for immediate dispatch.
 * filePath and publicUrl are NOT sent — derived server-side from userId + fileId.
 */
export async function scheduleUpload(body: ScheduleUploadBody): Promise<ScheduleUploadResponse> {
  const res = await apiFetch('/upload/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errPayload = await parseAPIError(res)
    throwStructuredError(errPayload)
  }
  return res.json() as Promise<ScheduleUploadResponse>
}

/**
 * GET /api/upload/peak-times?platform={platform}
 * Returns up to 2 upcoming PKT peak-time slots as ISO-8601 UTC strings.
 */
export async function fetchPeakTimes(platform: string): Promise<string[]> {
  const res = await apiFetch(`/upload/peak-times?platform=${encodeURIComponent(platform)}`)
  if (!res.ok) return []
  const json = await res.json() as { slots: string[] }
  return json.slots ?? []
}

// ============================================================================
// Phase 7: History + Learning Loops
// ============================================================================

/**
 * GET /api/posts — returns authenticated user's posts, newest-first.
 * Filters are optional; platform filter uses EXISTS subquery server-side.
 */
export async function fetchPosts(filters: PostFilters = {}): Promise<PostWithPlatforms[]> {
  const params = new URLSearchParams()
  if (filters.platform) params.set('platform', filters.platform)
  if (filters.niche)    params.set('niche', filters.niche)
  if (filters.from)     params.set('from', filters.from)
  if (filters.to)       params.set('to', filters.to)

  const qs = params.size > 0 ? `?${params.toString()}` : ''
  const res = await apiFetch(`/posts${qs}`)
  if (!res.ok) throw new Error('posts_fetch_failed')
  const json = await res.json() as { posts: PostWithPlatforms[] }
  return json.posts
}

/**
 * DELETE /api/posts/:id — deletes post, cascades to platform_posts and learning_signals.
 */
export async function deletePost(postId: string): Promise<void> {
  const res = await apiFetch(`/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('post_delete_failed')
}

/**
 * POST /api/platform-posts/:platformPostId/views — logs actual views.
 * Returns accuracy label for inline display.
 * HISTORY-04, HISTORY-05, LEARNING-08: all 4 DB writes execute atomically server-side.
 */
export async function logActualViews(
  platformPostId: string,
  actualViews: number,
): Promise<LogViewsResponse> {
  const res = await apiFetch(`/platform-posts/${encodeURIComponent(platformPostId)}/views`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actualViews }),
  })
  if (!res.ok) throw new Error('log_views_failed')
  return res.json() as Promise<LogViewsResponse>
}

/**
 * GET /api/learning/hooks?niche=...
 * Returns top 5 hooks by MAX(actual_views) — LEARNING-01.
 * Called fresh before every AI generation — no caching (LEARNING-06).
 * Fail-open: returns [] on any error so AI generation is never blocked.
 */
export async function fetchTopHooks(niche?: string): Promise<TopHook[]> {
  try {
    const qs = niche ? `?niche=${encodeURIComponent(niche)}` : ''
    const res = await apiFetch(`/learning/hooks${qs}`)
    if (!res.ok) return []
    const json = await res.json() as { hooks: TopHook[] }
    return json.hooks ?? []
  } catch {
    return []
  }
}

/**
 * GET /api/learning/hashtags?niche=...&platform=...
 * Returns top 10 hashtags by avg_views using unnest() aggregation — LEARNING-02.
 * Called fresh before every AI generation — no caching (LEARNING-06).
 * Fail-open: returns [] on any error so AI generation is never blocked.
 */
export async function fetchTopHashtags(niche?: string, platform?: string): Promise<TopHashtag[]> {
  try {
    const params = new URLSearchParams()
    if (niche)    params.set('niche', niche)
    if (platform) params.set('platform', platform)
    const qs = params.size > 0 ? `?${params.toString()}` : ''
    const res = await apiFetch(`/learning/hashtags${qs}`)
    if (!res.ok) return []
    const json = await res.json() as { hashtags: TopHashtag[] }
    return json.hashtags ?? []
  } catch {
    return []
  }
}

/**
 * GET /api/learning/posting-times?platform=...
 * Returns best PKT posting times — LEARNING-04.
 */
export async function fetchPostingTimes(platform?: string): Promise<PostingTimeSlot[]> {
  const qs = platform ? `?platform=${encodeURIComponent(platform)}` : ''
  const res = await apiFetch(`/learning/posting-times${qs}`)
  if (!res.ok) return []
  const json = await res.json() as { times: PostingTimeSlot[] }
  return json.times ?? []
}

/**
 * GET /api/learning/niche-performance
 * Returns niche breakdown — LEARNING-05.
 */
export async function fetchNichePerformance(): Promise<NichePerformance[]> {
  const res = await apiFetch('/learning/niche-performance')
  if (!res.ok) return []
  const json = await res.json() as { niches: NichePerformance[] }
  return json.niches ?? []
}

/**
 * GET /api/learning/weights
 * Returns learned_weights, data_points, is_calibrated — LEARNING-09.
 * Returns safe defaults on error so callers never need to null-check.
 */
export async function fetchLearningWeights(): Promise<LearningWeightsResponse> {
  const res = await apiFetch('/learning/weights')
  if (!res.ok) return { learned_weights: null, data_points: 0, is_calibrated: false }
  return res.json() as Promise<LearningWeightsResponse>
}

// ============================================================================
// Phase 8: Admin Panel
// ============================================================================

/**
 * GET /api/admin/jobs?state=all
 * Returns all pg-boss jobs across all users — ADMIN-02.
 * state=all includes cancelled jobs; default omits cancelled.
 */
export async function fetchAdminJobs(includeAll = false): Promise<AdminJob[]> {
  const qs = includeAll ? '?state=all' : ''
  const res = await apiFetch(`/admin/jobs${qs}`)
  if (!res.ok) throw new Error('admin_jobs_fetch_failed')
  const json = await res.json() as { jobs: AdminJob[] }
  return json.jobs
}

/**
 * POST /api/admin/jobs/:id/retry
 * Retries a failed pg-boss job — ADMIN-03.
 */
export async function retryAdminJob(jobId: string): Promise<void> {
  const res = await apiFetch(`/admin/jobs/${encodeURIComponent(jobId)}/retry`, { method: 'POST' })
  if (!res.ok) throw new Error('admin_job_retry_failed')
}

/**
 * DELETE /api/admin/jobs/:id
 * Cancels a pending pg-boss job — ADMIN-03.
 */
export async function cancelAdminJob(jobId: string): Promise<void> {
  const res = await apiFetch(`/admin/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('admin_job_cancel_failed')
}

/**
 * GET /api/admin/users
 * Returns all users with safe metadata only — ADMIN-04. ADMIN-10: no tokens.
 */
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const res = await apiFetch('/admin/users')
  if (!res.ok) throw new Error('admin_users_fetch_failed')
  const json = await res.json() as { users: AdminUser[] }
  return json.users
}

/**
 * PATCH /api/admin/users/:userId/disable
 * Bans a user account — ADMIN-05.
 */
export async function disableAdminUser(userId: string): Promise<void> {
  const res = await apiFetch(`/admin/users/${encodeURIComponent(userId)}/disable`, { method: 'PATCH' })
  if (!res.ok) {
    const errPayload = await parseAPIError(res)
    throwStructuredError(errPayload)
  }
}

/**
 * PATCH /api/admin/users/:userId/enable
 * Restores a banned user account — ADMIN-05.
 */
export async function enableAdminUser(userId: string): Promise<void> {
  const res = await apiFetch(`/admin/users/${encodeURIComponent(userId)}/enable`, { method: 'PATCH' })
  if (!res.ok) throw new Error('admin_enable_user_failed')
}

/**
 * DELETE /api/admin/users/:userId/learning
 * Resets learning_signals + learned_weights for a user — ADMIN-06.
 * Returns deleted count for confirmation display.
 */
export async function resetAdminLearning(userId: string): Promise<{ deleted: number }> {
  const res = await apiFetch(`/admin/users/${encodeURIComponent(userId)}/learning`, { method: 'DELETE' })
  if (!res.ok) throw new Error('admin_reset_learning_failed')
  return res.json() as Promise<{ deleted: number }>
}

/**
 * GET /api/admin/health
 * Returns VPS CPU/memory/disk + Supabase DB size + queue depth — ADMIN-07.
 */
export async function fetchAdminHealth(): Promise<AdminHealthResponse> {
  const res = await apiFetch('/admin/health')
  if (!res.ok) throw new Error('admin_health_fetch_failed')
  return res.json() as Promise<AdminHealthResponse>
}

/**
 * GET /api/admin/logs?lines=N&userId=...&from=ISO
 * Returns last N log lines from the pino log file — ADMIN-08.
 */
export async function fetchAdminLogs(
  options: { lines?: number; userId?: string; from?: string } = {},
): Promise<AdminLogsResponse> {
  const params = new URLSearchParams()
  if (options.lines)  params.set('lines', String(options.lines))
  if (options.userId) params.set('userId', options.userId)
  if (options.from)   params.set('from', options.from)
  const qs = params.size > 0 ? `?${params.toString()}` : ''
  const res = await apiFetch(`/admin/logs${qs}`)
  if (!res.ok) throw new Error('admin_logs_fetch_failed')
  return res.json() as Promise<AdminLogsResponse>
}

/**
 * GET /api/admin/stats/platforms
 * Returns aggregate platform stats across all users — ADMIN-09.
 */
export async function fetchAdminPlatformStats(): Promise<AdminPlatformStatsResponse> {
  const res = await apiFetch('/admin/stats/platforms')
  if (!res.ok) throw new Error('admin_platform_stats_fetch_failed')
  return res.json() as Promise<AdminPlatformStatsResponse>
}

// ============================================================================
// Phase 9: Content Research Engine
// ============================================================================

// RESEARCH-06 + RESEARCH-15: Fetch trend data for a niche (cache-first, returns fetchedAt)
export async function fetchResearchTrends(niche: string): Promise<ResearchTrendsResponse> {
  try {
    const res = await apiFetch(`/research/trends?niche=${encodeURIComponent(niche)}`)
    if (!res.ok) throw new Error(`trends_${res.status}`)
    return res.json() as Promise<ResearchTrendsResponse>
  } catch (err) {
    // Re-throw so callers can set trendsOffline state — but log for diagnostics
    console.warn('[api] fetchResearchTrends failed:', (err as Error).message)
    throw err
  }
}

// RESEARCH-08: Generate ideas using combined trend + learning context
// POST /api/research/generate
export async function generateResearchIdeas(
  niche: string,
  topic?: string,
  instructions?: string,
): Promise<ResearchGenerateResponse> {
  const res = await apiFetch('/research/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ niche, topic: topic || undefined, instructions: instructions || undefined }),
  })
  if (!res.ok) throw new Error('research_generate_failed')
  return res.json() as Promise<ResearchGenerateResponse>
}

// RESEARCH-13: Get authenticated user's saved ideas (fail-open — returns [] on error)
export async function fetchSavedIdeas(): Promise<SavedIdea[]> {
  try {
    const res = await apiFetch('/research/saved')
    if (!res.ok) return []
    const json = await res.json() as { ideas: SavedIdea[] }
    return json.ideas ?? []
  } catch {
    return []
  }
}

// RESEARCH-13: Toggle save state for a content idea
export async function saveIdea(ideaId: string): Promise<{ saved: boolean }> {
  const res = await apiFetch(`/research/ideas/${encodeURIComponent(ideaId)}/save`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('save_idea_failed')
  return res.json() as Promise<{ saved: boolean }>
}

// RESEARCH-14: Trigger on-demand cache refresh (bypasses 24h TTL)
export async function refreshTrends(): Promise<void> {
  const res = await apiFetch('/research/refresh', { method: 'POST' })
  if (!res.ok) throw new Error('refresh_trends_failed')
}

// RESEARCH-11: Fetch standalone hashtag intelligence for a niche
export async function fetchResearchHashtags(niche: string): Promise<HashtagIntel[]> {
  try {
    const res = await apiFetch(`/research/hashtags?niche=${encodeURIComponent(niche)}`)
    if (!res.ok) return []
    const json = await res.json() as { hashtags: HashtagIntel[] }
    return json.hashtags ?? []
  } catch {
    return []
  }
}

// ============================================================================
// Phase 11: Content Intelligence Layer API
// ============================================================================

// Trigger multi-layer pattern analysis and AI insights generation
// Fail-silent on error — don't block main generator flow
export async function triggerIntelligenceAnalysis(
  postId: string,
  niche: string,
  engineSignals: EngineSignals,
  enabledPlatforms: Platform[],
): Promise<{ videoAnalysisId: string }> {
  try {
    const res = await apiFetch('/intelligence/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId,
        niche,
        engineSignals,
        enabledPlatforms,
      }),
    })
    if (!res.ok) {
      console.warn('[intelligence/analyze] failed:', res.status)
      throw new Error('Analysis trigger failed')
    }
    return res.json() as Promise<{ videoAnalysisId: string }>
  } catch (err) {
    console.warn('[triggerIntelligenceAnalysis]', err)
    throw err
  }
}

// Fetch full analysis results for a post (Layer 1 + Layer 2)
export async function fetchIntelligenceVideo(postId: string): Promise<IntelligenceVideoData> {
  const res = await apiFetch(`/intelligence/video/${encodeURIComponent(postId)}`)
  if (!res.ok) throw new Error('Intelligence fetch failed')
  return res.json() as Promise<IntelligenceVideoData>
}

// Fetch lightweight platform summary (pattern analysis only)
export async function fetchIntelligencePlatforms(postId: string): Promise<{ platforms: IntelligencePlatformResult[] }> {
  const res = await apiFetch(`/intelligence/platforms/${encodeURIComponent(postId)}`)
  if (!res.ok) throw new Error('Platforms fetch failed')
  return res.json() as Promise<{ platforms: IntelligencePlatformResult[] }>
}

// ============================================================================
// Phase 11: AI Provider + Model Verification (VERIFY-06)
// ============================================================================

/**
 * GET /api/admin/provider-health
 * Returns weekly health check results per (provider, model) — VERIFY-06.
 * Admin-only route gated by adminMiddleware server-side.
 */
export async function fetchAdminProviderHealth(): Promise<AdminProviderHealth[]> {
  const res = await apiFetch('/admin/provider-health', { method: 'GET' })
  if (!res.ok) {
    throw new Error(`Failed to fetch provider health (${res.status})`)
  }
  const json = await res.json() as { models: AdminProviderHealth[] }
  return json.models
}
