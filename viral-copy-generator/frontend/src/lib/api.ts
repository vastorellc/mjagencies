import { supabase } from './supabase'
import type { AIProxyBody, SettingsResponse, CreatePostBody, PostSaveResponse, UploadFileResponse, ScheduleUploadBody, ScheduleUploadResponse } from './types'

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
