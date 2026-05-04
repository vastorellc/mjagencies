import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import {
  AI_PROVIDERS, ALL_PLATFORMS, NICHES,
  type Screen, type SettingsResponse, type AIProvider, type Platform,
} from '../lib/types'

interface Props {
  onNavigate: (s: Screen) => void
  oauthBanner:
    | { kind: 'connected'; platform: 'youtube' | 'instagram' | 'facebook'; warning?: string }
    | { kind: 'error'; reason: string }
    | null
  clearBanner: () => void
}

const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  x: 'X / Twitter',
}

export default function SettingsPage({ onNavigate, oauthBanner, clearBanner }: Props) {
  const [data, setData] = useState<SettingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keyDraft, setKeyDraft] = useState('')

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/settings')
      if (!res.ok) throw new Error(`GET /settings ${res.status}`)
      setData(await res.json() as SettingsResponse)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refetch() }, [refetch])

  async function patch(body: Record<string, unknown>): Promise<void> {
    setSaving(true)
    try {
      const res = await apiFetch('/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }))
        throw new Error((j as { error?: string }).error ?? `PATCH /settings ${res.status}`)
      }
      await refetch()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function connectPlatform(provider: 'youtube' | 'instagram' | 'facebook'): void {
    // COOP-safe redirect via JSON contract:
    // The backend's /api/auth/{provider}/connect returns 200 JSON { auth_url } (NOT 302).
    // We CANNOT use 302 + Location-read for an authenticated XHR — CORS hides the
    // Location header on cross-origin opaqueredirect responses (`response.headers.get('location')`
    // returns null in real browsers). Reading JSON and calling window.location.assign(auth_url)
    // is the only contract that works without a popup (popups are killed by COOP same-origin).
    initiateConnect(provider).catch((e) => setError((e as Error).message))
  }

  async function initiateConnect(provider: 'youtube' | 'instagram' | 'facebook'): Promise<void> {
    const path = provider === 'youtube' ? '/auth/google/connect' : `/auth/${provider}/connect`
    const res = await apiFetch(path)
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(j.error ?? `Could not start OAuth (${res.status})`)
    }
    const json = await res.json() as { auth_url?: string }
    if (!json.auth_url || typeof json.auth_url !== 'string') {
      throw new Error('Could not start OAuth — invalid response')
    }
    window.location.assign(json.auth_url)
  }

  async function disconnect(provider: 'youtube' | 'instagram' | 'facebook'): Promise<void> {
    setSaving(true)
    try {
      const res = await apiFetch(`/settings/connections/${provider}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`disconnect failed ${res.status}`)
      await refetch()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function togglePlatform(p: Platform): void {
    if (!data) return
    const enabled = data.enabled_platforms.includes(p)
      ? data.enabled_platforms.filter((x) => x !== p)
      : [...data.enabled_platforms, p]
    void patch({ enabled_platforms: enabled })
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="font-bold">Settings</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('generator')}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
          >
            Generator
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
        {oauthBanner && (
          <div className={`mb-4 rounded p-3 text-sm ${
            oauthBanner.kind === 'connected'
              ? oauthBanner.warning ? 'bg-yellow-900/40 text-yellow-200' : 'bg-emerald-900/40 text-emerald-200'
              : 'bg-red-900/40 text-red-200'
          }`}>
            {oauthBanner.kind === 'connected'
              ? oauthBanner.warning === 'no_facebook_page'
                ? 'Facebook connected, but no Page found. Create a Facebook Page to enable Reels uploads.'
                : `${PLATFORM_LABELS[oauthBanner.platform]} connected.`
              : oauthBanner.reason === 'instagram_personal_account'
              ? 'Personal Instagram accounts cannot publish. Switch to Business or Creator and retry.'
              : `Connection failed (${oauthBanner.reason}). Please try again.`}
            <button onClick={clearBanner} className="ml-3 underline">dismiss</button>
          </div>
        )}

        {error && <div className="mb-4 rounded bg-red-900/40 p-3 text-sm text-red-200">{error}</div>}

        {loading || !data ? (
          <div className="py-8 text-center text-zinc-400">Loading…</div>
        ) : (
          <div className="space-y-6 py-4">
            {/* AI Provider + API key (SETTINGS-01) */}
            <section>
              <h2 className="mb-2 font-bold">AI Provider</h2>
              <select
                value={data.ai_provider}
                onChange={(e) => void patch({ ai_provider: e.target.value as AIProvider })}
                disabled={saving}
                className="mb-2 rounded bg-zinc-800 px-3 py-2 text-sm"
              >
                {AI_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="text-sm text-zinc-400">
                Current key: {data.api_key_masked ?? <em>not set</em>}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (keyDraft.length > 0) {
                    void patch({ api_key: keyDraft })
                    setKeyDraft('')
                  }
                }}
                className="mt-2 flex gap-2"
              >
                <input
                  type="password"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  placeholder="Paste new API key"
                  className="flex-1 rounded bg-zinc-800 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={saving || keyDraft.length === 0}
                  className="rounded bg-emerald-700 px-3 py-2 text-sm font-bold hover:bg-emerald-600 disabled:opacity-40"
                >
                  Save
                </button>
              </form>
            </section>

            {/* Default niche (SETTINGS-02) */}
            <section>
              <h2 className="mb-2 font-bold">Default Niche</h2>
              <select
                value={data.default_niche}
                onChange={(e) => void patch({ default_niche: e.target.value })}
                disabled={saving}
                className="rounded bg-zinc-800 px-3 py-2 text-sm"
              >
                {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </section>

            {/* Platform toggles (SETTINGS-03) */}
            <section>
              <h2 className="mb-2 font-bold">Enabled Platforms</h2>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PLATFORMS.map((p) => (
                  <label key={p} className="flex items-center gap-2 rounded bg-zinc-900 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={data.enabled_platforms.includes(p)}
                      onChange={() => togglePlatform(p)}
                      disabled={saving}
                    />
                    {PLATFORM_LABELS[p]}
                  </label>
                ))}
              </div>
            </section>

            {/* OAuth connections (SETTINGS-04, 05, 06, 09) */}
            <section>
              <h2 className="mb-2 font-bold">Connections</h2>
              <div className="space-y-2">
                {(['youtube', 'instagram', 'facebook'] as const).map((p) => (
                  <div key={p} className="flex items-center justify-between rounded bg-zinc-900 px-3 py-2">
                    <span className="text-sm">
                      {PLATFORM_LABELS[p]}{' '}
                      {data.connected[p] && <span className="text-emerald-400">Connected</span>}
                    </span>
                    {data.connected[p] ? (
                      <button
                        onClick={() => void disconnect(p)}
                        disabled={saving}
                        className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => connectPlatform(p)}
                        disabled={saving}
                        className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-bold hover:bg-emerald-600"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                ))}
                {/* TikTok greyed out — SETTINGS-08 */}
                <div className="flex items-center justify-between rounded bg-zinc-900/50 px-3 py-2 opacity-60">
                  <span className="text-sm">TikTok</span>
                  <span className="text-xs text-zinc-500">Pending API approval</span>
                </div>
                {/* X — copy only, no upload — surfaced for clarity in v1 */}
                <div className="flex items-center justify-between rounded bg-zinc-900/50 px-3 py-2 opacity-60">
                  <span className="text-sm">X / Twitter</span>
                  <span className="text-xs text-zinc-500">Manual copy only</span>
                </div>
              </div>
            </section>

            {/* Timezone (SETTINGS-10) */}
            <section>
              <h2 className="mb-2 font-bold">Timezone</h2>
              <div className="text-sm text-zinc-400">Asia/Karachi (Pakistan Standard Time, fixed)</div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
