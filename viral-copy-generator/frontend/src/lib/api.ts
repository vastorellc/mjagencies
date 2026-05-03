import { supabase } from './supabase'
import type {
  AIProxyBody, SettingsResponse, CreatePostBody, PostSaveResponse,
  UploadFileResponse, ScheduleUploadBody, ScheduleUploadResponse,
  PostWithPlatforms, LogViewsResponse, TopHook, TopHashtag,
  PostingTimeSlot, NichePerformance, LearningWeightsResponse, PostFilters,
} from './types'

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
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
  if (!res.ok) throw new Error('ai_proxy_failed')
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
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'upload_file_failed')
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
    const json = await res.json().catch(() => ({})) as { error?: string; message?: string }
    throw new Error(json.message ?? json.error ?? 'schedule_upload_failed')
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
