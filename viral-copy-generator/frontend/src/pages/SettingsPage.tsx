import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import {
  AI_PROVIDERS, ALL_PLATFORMS,
  type Screen, type SettingsResponse, type AIProvider, type Platform,
  type ValidateKeyResponse,
} from '../lib/types'
import { MODELS_BY_PROVIDER, defaultModelFor } from '../lib/models'

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
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidateKeyResponse | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [newNiche, setNewNiche] = useState('')
  const [nicheError, setNicheError] = useState<string | null>(null)

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

  // Reset selectedModelId whenever the provider changes (or on initial data load)
  useEffect(() => {
    if (data) {
      setSelectedModelId(defaultModelFor(data.ai_provider))
    }
  }, [data?.ai_provider]) // eslint-disable-line react-hooks/exhaustive-deps

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

  async function validateApiKey(): Promise<void> {
    if (!keyDraft.trim()) {
      setError('Please enter an API key to test')
      return
    }
    if (!data) return

    setValidating(true)
    setValidationResult(null)
    try {
      const res = await apiFetch('/settings/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: data.ai_provider,
          api_key: keyDraft.trim(),
          model_id: selectedModelId || defaultModelFor(data.ai_provider),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }))
        throw new Error((j as { error?: string }).error ?? `Validation failed (${res.status})`)
      }
      const result = await res.json() as ValidateKeyResponse
      setValidationResult(result)
      if (result.valid) {
        setError(null)
      }
    } catch (e) {
      setError((e as Error).message)
      setValidationResult({
        valid: false,
        key_valid: false,
        model_valid: false,
        error_kind: null,
        error: (e as Error).message,
        model_id: selectedModelId || '',
      })
    } finally {
      setValidating(false)
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

  function addNiche(): void {
    if (!data) return
    const trimmed = newNiche.trim().toLowerCase()
    setNicheError(null)

    if (!trimmed) {
      setNicheError('Niche cannot be empty')
      return
    }
    if (trimmed.length > 50) {
      setNicheError('Niche must be 50 characters or less')
      return
    }
    if (data.available_niches.map(n => n.toLowerCase()).includes(trimmed)) {
      setNicheError('Niche already exists')
      return
    }

    const updated = [...data.available_niches, trimmed]
    void patch({ available_niches: updated })
    setNewNiche('')
  }

  function deleteNiche(niche: string): void {
    if (!data) return
    if (niche === data.default_niche) {
      setNicheError('Cannot delete the current default niche')
      return
    }
    const updated = data.available_niches.filter(n => n !== niche)
    void patch({ available_niches: updated })
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
                onChange={(e) => {
                  const newProvider = e.target.value as AIProvider
                  setSelectedModelId(defaultModelFor(newProvider))
                  void patch({ ai_provider: newProvider })
                }}
                disabled={saving}
                className="mb-2 rounded bg-zinc-800 px-3 py-2 text-sm"
              >
                {AI_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>

              <label className="block mt-3">
                <span className="text-sm text-zinc-400">AI Model</span>
                <select
                  className="mt-1 w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100"
                  value={selectedModelId || defaultModelFor(data.ai_provider)}
                  onChange={(e) => {
                    setSelectedModelId(e.target.value)
                    setValidationResult(null)
                  }}
                  disabled={saving}
                >
                  {(MODELS_BY_PROVIDER[data.ai_provider] ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} ({m.tier})
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-2 text-sm text-zinc-400">
                Current key: {data.api_key_masked ?? <em>not set</em>}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (keyDraft.length > 0) {
                    void patch({ api_key: keyDraft })
                    setKeyDraft('')
                    setValidationResult(null)
                  }
                }}
                className="mt-2 flex gap-2"
              >
                <input
                  type="password"
                  value={keyDraft}
                  onChange={(e) => {
                    setKeyDraft(e.target.value)
                    setValidationResult(null)
                  }}
                  placeholder="Paste new API key"
                  className="flex-1 rounded bg-zinc-800 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => { void validateApiKey() }}
                  disabled={validating || keyDraft.length === 0}
                  className="rounded bg-blue-700 px-3 py-2 text-sm font-bold hover:bg-blue-600 disabled:opacity-40 transition"
                >
                  {validating ? '⏳ Testing...' : '🔍 Test'}
                </button>
                <button
                  type="submit"
                  disabled={saving || keyDraft.length === 0}
                  className="rounded bg-emerald-700 px-3 py-2 text-sm font-bold hover:bg-emerald-600 disabled:opacity-40 transition"
                >
                  Save
                </button>
              </form>

              {/* Validation result display — discriminated by error_kind; plain text only (T-11-20 XSS mitigation) */}
              {validationResult && !validationResult.valid && validationResult.error_kind === 'model_not_found' && (
                <div className="mt-3 rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">
                  Selected model unavailable. Pick a different model below.
                </div>
              )}

              {validationResult && !validationResult.valid && validationResult.error_kind === 'invalid_key' && (
                <div className="mt-3 rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">
                  API key rejected. Re-check the key.
                </div>
              )}

              {validationResult && !validationResult.valid && validationResult.error_kind !== 'model_not_found' && validationResult.error_kind !== 'invalid_key' && (
                <div className="mt-3 rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">
                  {validationResult.error_kind
                    ? `Validation failed: ${validationResult.error_message ?? validationResult.error ?? 'Unknown error'}`
                    : (validationResult.error ?? 'Key validation failed.')}
                </div>
              )}

              {validationResult && validationResult.valid && (
                <div className="mt-3 rounded bg-emerald-900/40 px-3 py-2 text-sm text-emerald-200">
                  <div className="mb-1 font-bold">Key + model verified. Click Save to use it.</div>
                  {validationResult.capabilities && (
                    <div className="flex gap-1 flex-wrap mt-1">
                      {validationResult.capabilities.text && (
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">Text</span>
                      )}
                      {validationResult.capabilities.vision && (
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">Vision</span>
                      )}
                      {validationResult.capabilities.audio && (
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">Audio</span>
                      )}
                      {validationResult.capabilities.video && (
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">Video</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Niche Management (SETTINGS-02) */}
            <section>
              <h2 className="mb-3 font-bold">Your Niches</h2>

              {/* Default niche dropdown */}
              <div className="mb-4">
                <label className="text-sm text-zinc-400 block mb-1">Default Niche</label>
                <select
                  value={data.default_niche}
                  onChange={(e) => void patch({ default_niche: e.target.value })}
                  disabled={saving}
                  className="w-full rounded bg-zinc-800 px-3 py-2 text-sm"
                >
                  {data.available_niches.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              {/* List of niches */}
              <div className="mb-4">
                <label className="text-sm text-zinc-400 block mb-2">Available Niches</label>
                <div className="flex flex-wrap gap-2">
                  {data.available_niches.map((niche) => (
                    <div
                      key={niche}
                      className="flex items-center gap-2 rounded bg-zinc-900 px-3 py-1.5 text-sm"
                    >
                      <span>{niche}</span>
                      <button
                        onClick={() => deleteNiche(niche)}
                        disabled={saving || niche === data.default_niche}
                        title={niche === data.default_niche ? 'Cannot delete default niche' : 'Delete niche'}
                        className="text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add new niche */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNiche}
                  onChange={(e) => {
                    setNewNiche(e.target.value)
                    setNicheError(null)
                  }}
                  placeholder="Add new niche (e.g., real estate, fitness)"
                  className="flex-1 rounded bg-zinc-800 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => addNiche()}
                  disabled={saving || newNiche.trim().length === 0}
                  className="rounded bg-blue-700 px-3 py-2 text-sm font-bold hover:bg-blue-600 disabled:opacity-40 transition"
                >
                  + Add
                </button>
              </div>

              {nicheError && (
                <div className="mt-2 rounded bg-red-900/40 p-2 text-sm text-red-200">
                  {nicheError}
                </div>
              )}
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
