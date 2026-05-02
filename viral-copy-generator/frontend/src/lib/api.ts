import { supabase } from './supabase'
import type { AIProxyBody } from './types'

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
