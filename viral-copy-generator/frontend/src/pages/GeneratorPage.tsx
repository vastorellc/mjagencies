import { useMemo, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Screen,
  EngineSignals,
  LearnedWeights,
  Niche,
  Platform,
  AIOutput,
  UploadStatus,
  SettingsResponse,
} from '../lib/types'
import {
  computeScore,
  applyLearnedWeights,
  BASELINE_WEIGHTS,
} from '../lib/score'
import { buildChecklist } from '../lib/checklist'
import { buildGapAnalysis } from '../lib/gaps'
import { buildPrompt } from '../lib/prompt'
import { callAI } from '../lib/ai'
import { fetchSettings, createPost, fetchApiKey } from '../lib/api'
import ScorePanel from '../components/ScorePanel'
import PlatformCardGrid from '../components/PlatformCardGrid'
import ChecklistAccordion from '../components/ChecklistAccordion'
import GapAnalysisPanel from '../components/GapAnalysisPanel'
import PlatformCopyCard from '../components/PlatformCopyCard'

interface Props {
  onNavigate: (s: Screen) => void
  __testSignals?: EngineSignals
}

const DEFAULT_NICHE: Niche = 'travel'
const DEFAULT_ENABLED: Platform[] = ['youtube', 'instagram', 'tiktok', 'facebook', 'x']
const PLATFORM_ORDER: Platform[] = ['youtube', 'instagram', 'tiktok', 'facebook', 'x']

const ERROR_MESSAGES: Record<string, string> = {
  no_api_key:       'No API key saved. Go to Settings to add your key.',
  invalid_key:      'API key rejected. Check your key in Settings.',
  rate_limited:     'Rate limit reached. Wait a moment, then try again.',
  quota_exhausted:  'Quota exhausted for today. Try again tomorrow or switch provider.',
  network_error:    'Network error. Check your connection and try again.',
  unparseable:      'Copy generation failed. Try again — the AI returned an unexpected response.',
  post_save_failed: 'Copy generated but save failed. Your copy is still usable above.',
}

const RETRYABLE_ERRORS = new Set(['rate_limited', 'network_error'])

export default function GeneratorPage({ onNavigate, __testSignals }: Props) {
  // Phase 3/4 state
  const [signals, _setSignals] = useState<EngineSignals | null>(__testSignals ?? null)
  const [learnedWeights] = useState<LearnedWeights | null>(null)
  const [dataPoints] = useState<number>(0)

  // Phase 5 state
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [description, setDescription] = useState<string>('')
  const [aiOutput, setAiOutput] = useState<AIOutput | null>(null)
  const [settingsData, setSettingsData] = useState<SettingsResponse | null>(null)
  const [aiLoading, setAiLoading] = useState<boolean>(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiErrorKey, setAiErrorKey] = useState<string | null>(null)
  const [postId, setPostId] = useState<string | null>(null)
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, string>>({})
  const isFirstGenerationRef = useRef<boolean>(true)

  // D-13: Fetch settings on mount; populate userId from auth session
  useEffect(() => {
    fetchSettings()
      .then(data => setSettingsData(data))
      .catch(() => { /* fall back to defaults — non-blocking per D-13 */ })

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => { subscription.unsubscribe() }
  }, [])

  // D-15: Realtime subscription on platform_posts — guard: only when postId AND userId are non-null
  // Cleanup returned synchronously so React calls it on unmount/dep change (Pitfall 6).
  useEffect(() => {
    if (!postId || !userId) return

    const channel = supabase
      .channel('platform-posts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'platform_posts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { platform: string; upload_status: string }
          setUploadStatuses(prev => ({ ...prev, [row.platform]: row.upload_status }))
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [postId, userId])

  // Derived settings values with fallbacks
  const niche = (settingsData?.default_niche as Niche | undefined) ?? DEFAULT_NICHE
  const enabledPlatforms = (settingsData?.enabled_platforms as Platform[] | undefined) ?? DEFAULT_ENABLED
  const aiProvider = settingsData?.ai_provider ?? 'gemini'

  // D-24: useMemo chain — extended for Phase 5 (AI-10: pass aiOutput to buildChecklist)
  const scoreResult = useMemo(() => {
    if (!signals) return null
    const effectiveWeights = applyLearnedWeights(BASELINE_WEIGHTS, learnedWeights, dataPoints)
    return computeScore(signals, effectiveWeights)
  }, [signals, learnedWeights, dataPoints])

  const checklistItems = useMemo(() => {
    if (!signals) return null
    return buildChecklist(
      signals,
      { niche, enabledPlatforms },
      aiOutput ?? undefined,
    )
  }, [signals, aiOutput, niche, enabledPlatforms])

  const gapMessages = useMemo(() => {
    if (!checklistItems) return null
    return buildGapAnalysis(checklistItems)
  }, [checklistItems])

  // Generate Copy / Get Better Version handler
  async function handleGenerate(opts: { isSecondPass?: boolean } = {}) {
    if (aiLoading) return

    setAiLoading(true)
    setAiError(null)
    setAiErrorKey(null)

    try {
      // CLAUDE.md compliance: fetchApiKey() calls GET /api/settings/key — key stays in
      // function scope only; never stored in React state, never in localStorage.
      const { api_key: apiKey } = await fetchApiKey()

      if (!apiKey) {
        setAiError(ERROR_MESSAGES.no_api_key)
        setAiErrorKey('no_api_key')
        setAiLoading(false)
        return
      }

      const scriptOutline = opts.isSecondPass ? (aiOutput?.script_outline ?? undefined) : undefined
      const prompt = buildPrompt(signals, description, niche, {
        enabledPlatforms,
        scriptOutline,
      })

      const result = await callAI({
        provider: aiProvider,
        apiKey,
        prompt,
        selectedFile: selectedFile ?? undefined,
        frames: opts.isSecondPass ? undefined : (signals?.framesBase64 ?? undefined),
      })
      // apiKey goes out of scope here — never stored in state

      setAiOutput(result)

      // D-14: Save post on FIRST generation only — not on regenerate or Get Better Version
      if (isFirstGenerationRef.current) {
        isFirstGenerationRef.current = false
        try {
          const saved = await createPost({
            title: result.youtube.title || 'Untitled',
            niche,
            virality_score: scoreResult?.overall ?? 0,
            engine_signals: signals ? (signals as unknown as Record<string, unknown>) : {},
            ai_output: result as unknown as Record<string, unknown>,
            enabled_platforms: enabledPlatforms,
          })
          setPostId(saved.postId)
        } catch {
          setAiError(ERROR_MESSAGES.post_save_failed)
          setAiErrorKey('post_save_failed')
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown_error'
      let errorKey = 'unparseable'
      if (msg.includes('invalid_api_key') || msg.includes('401') || msg.includes('invalid key')) {
        errorKey = 'invalid_key'
      } else if (msg.includes('rate_limit') || msg.includes('429') || msg.includes('rate limit')) {
        errorKey = 'rate_limited'
      } else if (msg.includes('quota') || msg.includes('402')) {
        errorKey = 'quota_exhausted'
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('ENOTFOUND')) {
        errorKey = 'network_error'
      }
      setAiError(ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unparseable)
      setAiErrorKey(errorKey)
    } finally {
      setAiLoading(false)
    }
  }

  const canGenerate = (selectedFile !== null || description.trim().length > 0) && !aiLoading

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="font-bold">Viral Copy Generator</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => { void supabase.auth.signOut() }}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
        <div className="flex flex-col gap-4 py-4">

          {/* D-08: Minimal file picker + description textarea */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer rounded-lg bg-zinc-800 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-700">
                {selectedFile
                  ? selectedFile.name.length > 30
                    ? `${selectedFile.name.slice(0, 27)}...`
                    : selectedFile.name
                  : 'Pick a video to analyse — or skip and use description below'}
                <input
                  type="file"
                  accept="video/*"
                  className="sr-only"
                  onChange={e => {
                    const file = e.target.files?.[0] ?? null
                    setSelectedFile(file)
                    if (file) {
                      setPostId(null)
                      setUploadStatuses({})
                      isFirstGenerationRef.current = true
                      setAiOutput(null)
                    }
                  }}
                />
              </label>
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <textarea
                rows={2}
                maxLength={280}
                placeholder="Optional: brief description — helps AI when video is ambiguous"
                aria-label="Optional description to help AI generate better copy"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
              <span className="text-right text-xs text-zinc-500">{description.length}/280</span>
            </div>
          </div>

          {/* Generate Copy button */}
          <button
            type="button"
            disabled={!canGenerate}
            onClick={() => { void handleGenerate() }}
            className={
              !canGenerate
                ? 'w-full rounded-lg bg-purple-600 py-3 font-bold text-white opacity-50 cursor-not-allowed'
                : aiLoading
                  ? 'w-full rounded-lg bg-purple-600 py-3 font-bold text-white opacity-75 cursor-not-allowed flex items-center justify-center gap-2'
                  : 'w-full rounded-lg bg-purple-600 py-3 font-bold text-white transition hover:bg-purple-500'
            }
          >
            {aiLoading && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {aiLoading ? 'Generating copy…' : aiOutput ? 'Regenerate' : 'Generate Copy'}
          </button>

          {/* Error display */}
          {aiError && (
            <div>
              <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{aiError}</p>
              {aiErrorKey && RETRYABLE_ERRORS.has(aiErrorKey) && (
                <button
                  type="button"
                  onClick={() => { void handleGenerate() }}
                  className="mt-1 rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          {/* D-02: Five platform copy cards */}
          {aiOutput && (
            <div className="flex flex-col gap-4">
              {PLATFORM_ORDER.map(platform => (
                <PlatformCopyCard
                  key={platform}
                  platform={platform}
                  aiOutput={aiOutput}
                  uploadStatus={(uploadStatuses[platform] as UploadStatus | undefined) ?? 'idle'}
                  onUpload={() => {
                    // Phase 6 wires this to the upload route
                  }}
                />
              ))}
            </div>
          )}

          {/* Get Better Version — only visible after first generation */}
          {aiOutput && (
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => { void handleGenerate({ isSecondPass: true }) }}
              className={
                aiLoading
                  ? 'w-full rounded-lg border border-zinc-600 bg-zinc-800 py-3 text-sm text-zinc-400 cursor-not-allowed flex items-center justify-center gap-2'
                  : 'w-full rounded-lg border border-zinc-600 bg-zinc-800 py-3 text-sm text-zinc-200 transition hover:bg-zinc-700'
              }
            >
              {aiLoading && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {aiLoading ? 'Improving copy…' : 'Get Better Version'}
            </button>
          )}

          {/* Phase 4 score panels — visible when signals available */}
          {signals && scoreResult && checklistItems && gapMessages && (
            <div data-testid="score-results" className="flex flex-col gap-4 mt-6">
              <ScorePanel score={scoreResult.overall} dataPoints={dataPoints} />
              <PlatformCardGrid perPlatform={scoreResult.perPlatform} />
              <ChecklistAccordion items={checklistItems} />
              <GapAnalysisPanel gaps={gapMessages} />
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
