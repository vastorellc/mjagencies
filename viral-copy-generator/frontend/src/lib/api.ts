import { supabase } from './supabase'
import type { AIProxyBody, SettingsResponse, CreatePostBody, PostSaveResponse } from './types'

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
