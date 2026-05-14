import { useMemo, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Screen,
  EngineSignals,
  ProgressStep,
  LearnedWeights,
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
import { callAI, parseProviderError } from '../lib/ai'
import type { AIErrorKind } from '../lib/ai'
import {
  fetchSettings,
  createPost,
  fetchApiKey,
  uploadFile,
  scheduleUpload,
  fetchTopHooks,
  fetchTopHashtags,
  fetchLearningWeights,
} from '../lib/api'
import type { LearningData } from '../lib/types'
import { ADVISORY_BYTES, isTouchDevice, isNarrowViewport } from '../lib/upload'
import { canRunEngine, warmup, analyse } from '../lib/engine'
import UploadDropzone from '../components/UploadDropzone'
import VideoPreview from '../components/VideoPreview'
import AnalysisProgress from '../components/AnalysisProgress'
import AnalysisError from '../components/AnalysisError'
import WasmFallbackBanner from '../components/WasmFallbackBanner'
import MobileAdvisoryBanner from '../components/MobileAdvisoryBanner'
import ScheduleModal from '../components/ScheduleModal'
import ScorePanel from '../components/ScorePanel'
import PlatformCardGrid from '../components/PlatformCardGrid'
import ChecklistAccordion from '../components/ChecklistAccordion'
import GapAnalysisPanel from '../components/GapAnalysisPanel'
import PlatformCopyCard from '../components/PlatformCopyCard'
import IntelligencePanel from '../components/IntelligencePanel'
import ProgressSidebar, { type AnalysisStep } from '../components/ProgressSidebar'

// ============================================================================
// Phase 3 state machine types
// ============================================================================

type Status =
  | { kind: 'idle' }
  | { kind: 'picked'; file: File }
  | { kind: 'analysing'; file: File; step: ProgressStep | null; preparing: boolean }
  | { kind: 'done'; file: File; signals: EngineSignals }
  | { kind: 'error'; file: File; cause: string; detail?: string }
  | { kind: 'wasm_blocked'; reason: string }

function deriveCause(err: unknown): { cause: string; detail: string } {
  const detail = err instanceof Error ? err.message : String(err)
  if (/OOM|out of memory|RangeError/i.test(detail)) {
    return { cause: "Couldn't analyse — your browser ran out of memory on this video.", detail }
  }
  if (/SharedArrayBuffer|crossOriginIsolated/i.test(detail)) {
    return { cause: "Couldn't analyse — browser cross-origin isolation is missing. Try refreshing.", detail }
  }
  if (/codec|decode|demuxer|invalid data/i.test(detail)) {
    return { cause: "Couldn't decode video — codec may not be supported.", detail }
  }
  return { cause: 'Something went wrong while analysing this video.', detail }
}

function toSidebarStep(s: Status): AnalysisStep {
  if (s.kind === 'idle' || s.kind === 'picked' || s.kind === 'wasm_blocked') return 'idle'
  if (s.kind === 'error') return 'error'
  if (s.kind === 'done') return 'complete'
  // analysing
  if (!s.step) return 'loading'
  const map: Record<ProgressStep, AnalysisStep> = {
    metadata: 'loading',
    frames: 'extracting-frames',
    scenes: 'detecting-scenes',
    faces: 'detecting-faces',
    objects: 'analyzing-audio',
    audio: 'analyzing-audio',
    brightness: 'computing-scores',
    done: 'complete',
  }
  return map[s.step]
}

// ============================================================================
// Constants (Phase 5)
// ============================================================================

interface Props {
  onNavigate: (s: Screen) => void
}

const DEFAULT_NICHE = 'travel'
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

const RETRYABLE_ERRORS = new Set<AIErrorKind>(['rate_limited', 'model_busy', 'network_error'])

// ============================================================================
// Component
// ============================================================================

export default function GeneratorPage({ onNavigate }: Props) {
  // ── Phase 3: upload + analysis state machine ──
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [description, setDescription] = useState('')
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [showAdvisory, setShowAdvisory] = useState(false)
  const [touchOrNarrow, setTouchOrNarrow] = useState(false)
  const generationRef = useRef(0)

  // ── Phase 4 / 5 state ──
  const [learnedWeights, setLearnedWeights] = useState<LearnedWeights | null>(null)
  const [dataPoints, setDataPoints] = useState<number>(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [aiOutput, setAiOutput] = useState<AIOutput | null>(null)
  const [settingsData, setSettingsData] = useState<SettingsResponse | null>(null)
  const [aiLoading, setAiLoading] = useState<boolean>(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiErrorKey, setAiErrorKey] = useState<AIErrorKind | null>(null)
  const [postId, setPostId] = useState<string | null>(null)
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, string>>({})
  const isFirstGenerationRef = useRef<boolean>(true)

  // ── Phase 6: upload modal ──
  const [scheduleModal, setScheduleModal] = useState<{ platform: Platform } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // ── Phase 11: content intelligence ──
  const [intelligenceTriggered, setIntelligenceTriggered] = useState<boolean>(false)

  // ── Derived from status ──
  const selectedFile: File | null = 'file' in status ? status.file : null
  const signals: EngineSignals | null = status.kind === 'done' ? status.signals : null

  // ── ANALYSIS-09 / D-11 preflight on mount ──
  useEffect(() => {
    const pre = canRunEngine()
    if (!pre.ok) setStatus({ kind: 'wasm_blocked', reason: pre.reason })
  }, [])

  // ── D-12 mobile + narrow detection ──
  useEffect(() => {
    const update = (): void => setTouchOrNarrow(isTouchDevice() || isNarrowViewport())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // ── D-07 background pre-warm when file is picked ──
  useEffect(() => {
    if (status.kind === 'picked') {
      warmup().catch(() => { /* surfaced via analyse() if warmup actually fails */ })
    }
  }, [status.kind])

  // ── Phase 5: settings + auth + learning weights ──
  useEffect(() => {
    fetchSettings()
      .then(data => setSettingsData(data))
      .catch(() => { /* non-blocking */ })

    fetchLearningWeights()
      .then(data => {
        setDataPoints(data.data_points)
        setLearnedWeights(data.learned_weights as LearnedWeights | null)
      })
      .catch(() => { /* non-blocking */ })

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => { subscription.unsubscribe() }
  }, [])

  // ── D-15: Realtime subscription on platform_posts ──
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
          const row = payload.new as { platform: string; upload_status: string; error_message?: string }
          setUploadStatuses(prev => ({ ...prev, [row.platform]: row.upload_status }))
          if (row.upload_status === 'failed' && row.error_message?.startsWith('oauth_expired:')) {
            const platform = row.error_message.split(':')[1] ?? 'platform'
            const displayName = platform.charAt(0).toUpperCase() + platform.slice(1)
            setUploadError(`${displayName} connection expired. Reconnect it in Settings.`)
          }
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [postId, userId])

  // ── Phase 3: state machine handlers ──

  function onFile(file: File): void {
    generationRef.current += 1
    setDescription('')
    setErrorBanner(null)
    setShowAdvisory(file.size >= ADVISORY_BYTES)
    setStatus({ kind: 'picked', file })
    setAiOutput(null)
    setPostId(null)
    setUploadStatuses({})
    isFirstGenerationRef.current = true
  }

  function onUploadError(message: string): void {
    setErrorBanner(message)
  }

  async function startAnalyse(): Promise<void> {
    if (
      status.kind !== 'picked' &&
      status.kind !== 'error' &&
      status.kind !== 'done'
    ) return
    const file = status.file
    if (!file) return

    const myGen = ++generationRef.current
    setStatus({ kind: 'analysing', file, step: null, preparing: true })

    try {
      const result = await analyse(file, {
        onProgress: (step) => {
          if (myGen !== generationRef.current) return
          setStatus((prev) => {
            if (prev.kind !== 'analysing') return prev
            return { ...prev, step, preparing: false }
          })
        },
      })

      if (myGen !== generationRef.current) return
      setStatus({ kind: 'done', file, signals: result })
    } catch (err) {
      if (myGen !== generationRef.current) return
      const { cause, detail } = deriveCause(err)
      setStatus({ kind: 'error', file, cause, detail })
    }
  }

  function onCancel(): void {
    generationRef.current += 1
    if (status.kind === 'analysing') {
      setStatus({ kind: 'picked', file: status.file })
    }
  }

  function onRetry(): void {
    // startAnalyse handles error state directly — no intermediate state update needed
    void startAnalyse()
  }

  function onSkip(): void {
    if (status.kind === 'error') {
      setStatus({ kind: 'picked', file: status.file })
    }
  }

  // ── Phase 4-5: derived computations ──

  const niche = settingsData?.default_niche ?? DEFAULT_NICHE
  const enabledPlatforms = (settingsData?.enabled_platforms as Platform[] | undefined) ?? DEFAULT_ENABLED
  const aiProvider = settingsData?.ai_provider ?? 'gemini'

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

  // ── Phase 5: generate copy ──

  async function handleGenerate(opts: { isSecondPass?: boolean } = {}): Promise<void> {
    if (aiLoading) return

    setAiLoading(true)
    setAiError(null)
    setAiErrorKey(null)

    try {
      const { api_key: apiKey } = await fetchApiKey()

      if (!apiKey) {
        setAiError(ERROR_MESSAGES.no_api_key)
        setAiErrorKey('no_api_key')
        setAiLoading(false)
        return
      }

      const scriptOutline = opts.isSecondPass ? (aiOutput?.script_outline ?? undefined) : undefined

      const [topHooks, topHashtags] = await Promise.all([
        fetchTopHooks(niche),
        fetchTopHashtags(niche, enabledPlatforms[0]),
      ])
      const learningData: LearningData = { topHooks, topHashtags }

      const prompt = buildPrompt(signals, description, niche, {
        enabledPlatforms,
        scriptOutline,
      }, learningData)

      const result = await callAI({
        provider: aiProvider,
        apiKey,
        prompt,
        selectedFile: selectedFile ?? undefined,
        frames: opts.isSecondPass ? undefined : (signals?.framesBase64 ?? undefined),
      })

      setAiOutput(result)

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
          setIntelligenceTriggered(true)
        } catch {
          setAiError(ERROR_MESSAGES.post_save_failed)
          setAiErrorKey('post_save_failed')
        }
      }
    } catch (err: unknown) {
      const parsed = parseProviderError(aiProvider, err)
      setAiError(parsed.message)
      setAiErrorKey(parsed.kind)
    } finally {
      setAiLoading(false)
    }
  }

  // ── Phase 6: upload handlers ──

  async function handleUpload(platform: Platform): Promise<void> {
    if (platform === 'tiktok' || platform === 'x') return

    if (platform === 'instagram' && selectedFile && selectedFile.size > 100 * 1024 * 1024) {
      const sizeMB = Math.ceil(selectedFile.size / 1024 / 1024)
      setUploadError(`Instagram: video is ${sizeMB}MB, max is 100MB. Compress before uploading.`)
      return
    }

    setUploadError(null)
    setScheduleModal({ platform })
  }

  async function handleScheduleConfirm(scheduledAt: string | null): Promise<void> {
    if (!scheduleModal || !selectedFile || !postId) {
      setScheduleModal(null)
      return
    }
    const { platform } = scheduleModal
    setScheduleModal(null)

    setUploadStatuses(prev => ({ ...prev, [platform]: 'uploading' }))

    try {
      const { fileId } = await uploadFile(selectedFile)

      const output = aiOutput
      let caption = ''
      let hashtags: string[] = []
      if (output) {
        if (platform === 'youtube') {
          caption = output.youtube.title + '\n\n' + output.youtube.description
          hashtags = output.youtube.tags
        } else if (platform === 'instagram') {
          caption = output.instagram.caption
          hashtags = output.instagram.hashtags
        } else if (platform === 'facebook') {
          caption = output.facebook.caption + '\n\n' + output.facebook.cta
          hashtags = output.facebook.hashtags
        }
      }

      await scheduleUpload({
        postId,
        platform,
        fileId,
        caption,
        hashtags,
        scheduledAt: scheduledAt ?? undefined,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'upload_failed'
      if (msg.startsWith('oauth_expired:')) {
        const platform2 = msg.split(':')[1] ?? 'platform'
        setUploadError(`${platform2.charAt(0).toUpperCase() + platform2.slice(1)} connection expired. Reconnect in Settings.`)
      } else {
        setUploadError(msg)
      }
      setUploadStatuses(prev => ({ ...prev, [platform]: 'failed' }))
    }
  }

  const canGenerate = (selectedFile !== null || description.trim().length > 0) && !aiLoading

  const sidebarStep = toSidebarStep(status)
  const sidebarProgress = status.kind === 'done' ? 100 : 0

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white">
      <ProgressSidebar currentStep={sidebarStep} progress={sidebarProgress} />

      <main className={`flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] transition-all ${
        sidebarStep !== 'idle' ? 'pr-80' : ''
      }`}>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">

          {/* Page header */}
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-sm shadow-black/20">
            <h1 className="text-3xl font-bold text-white">Viral Copy Generator</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Upload video content or describe the clip, then generate professional platform copy in one place.
            </p>
          </section>

          {/* ── Phase 3: upload / analysis UI ── */}

          {touchOrNarrow && status.kind !== 'wasm_blocked' && <MobileAdvisoryBanner />}

          {status.kind === 'wasm_blocked' && (
            <WasmFallbackBanner
              reason={status.reason}
              description={description}
              onDescriptionChange={setDescription}
              onGenerateCopy={() => { void handleGenerate() }}
            />
          )}

          {status.kind === 'idle' && (
            <>
              {errorBanner && (
                <div
                  role="alert"
                  className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200"
                  data-testid="upload-error"
                >
                  {errorBanner}
                </div>
              )}
              <UploadDropzone onFile={onFile} onError={onUploadError} />
              {/* Description section for idle state (description-only generation) */}
              <div className="flex flex-col gap-3 p-5 rounded-xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800">
                <label htmlFor="description-input" className="block text-sm font-semibold text-white">
                  ✍️ Add Context (Optional)
                </label>
                <textarea
                  id="description-input"
                  rows={3}
                  maxLength={280}
                  placeholder="E.g., 'A travel vlog of hiking in the mountains with sunset views'"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-purple-500 resize-none border border-zinc-700"
                />
                <span className="text-xs text-zinc-500 text-right">{description.length}/280</span>
              </div>
            </>
          )}

          {(status.kind === 'picked' || status.kind === 'done') && (
            <>
              {showAdvisory && (
                <div
                  className="rounded-md border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200"
                  data-testid="advisory-200mb"
                >
                  Large file — analysis may be slow on this device.
                </div>
              )}
              <VideoPreview
                file={status.file}
                description={description}
                onDescriptionChange={setDescription}
              />
              <UploadDropzone onFile={onFile} onError={onUploadError} className="mt-2" />
              {status.kind === 'picked' && (
                <button
                  type="button"
                  onClick={() => { void startAnalyse() }}
                  className="w-full rounded-md bg-zinc-100 px-4 py-3 text-sm font-bold text-zinc-900 hover:bg-zinc-200"
                  data-testid="analyse-button"
                >
                  Analyse
                </button>
              )}
            </>
          )}

          {status.kind === 'analysing' && (
            <>
              {showAdvisory && (
                <div
                  className="rounded-md border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200"
                  data-testid="advisory-200mb"
                >
                  Large file — analysis may be slow on this device.
                </div>
              )}
              <VideoPreview
                file={status.file}
                description={description}
                onDescriptionChange={setDescription}
              />
              <AnalysisProgress
                step={status.step}
                preparingModels={status.preparing && status.step === null}
                onCancel={onCancel}
              />
            </>
          )}

          {status.kind === 'error' && (
            <>
              <VideoPreview
                file={status.file}
                description={description}
                onDescriptionChange={setDescription}
              />
              <AnalysisError
                cause={status.cause}
                detail={status.detail}
                onRetry={onRetry}
                onSkip={onSkip}
              />
            </>
          )}

          {/* ── Phase 5: generate copy button ── */}
          {status.kind !== 'wasm_blocked' && (
            <button
              type="button"
              disabled={!canGenerate}
              onClick={() => { void handleGenerate() }}
              className={`w-full py-4 px-6 rounded-lg font-bold text-white text-lg transition flex items-center justify-center gap-3 ${
                !canGenerate
                  ? 'bg-purple-600/50 cursor-not-allowed text-zinc-300'
                  : aiLoading
                    ? 'bg-purple-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 shadow-lg hover:shadow-purple-500/50'
              }`}
            >
              {aiLoading && (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              <span>
                {aiLoading ? 'Generating copy…' : aiOutput ? '✨ Regenerate' : '🚀 Generate Copy'}
              </span>
            </button>
          )}

          {/* AI error */}
          {aiError && (
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-red-900/20 border border-red-800/50">
              <div className="flex items-start gap-2">
                <span className="text-lg">❌</span>
                <p className="text-sm font-medium text-red-200">{aiError}</p>
              </div>
              {aiErrorKey && RETRYABLE_ERRORS.has(aiErrorKey) && (
                <button
                  type="button"
                  onClick={() => { void handleGenerate() }}
                  className="self-start mt-1 px-3 py-1.5 rounded bg-red-900/50 hover:bg-red-900 text-xs font-medium text-red-200 transition border border-red-800"
                >
                  🔄 Try Again
                </button>
              )}
            </div>
          )}

          {/* Generated copy cards (Phase 5) */}
          {aiOutput && (
            <div className="flex flex-col gap-4 pt-2">
              <div className="flex items-center gap-2 px-1">
                <span className="text-lg">📋</span>
                <h2 className="text-lg font-semibold text-white">Your Copy</h2>
                <span className="ml-auto text-xs text-zinc-500">Choose platforms and upload</span>
              </div>
              <div className="flex flex-col gap-3">
                {PLATFORM_ORDER.map(platform => (
                  <PlatformCopyCard
                    key={platform}
                    platform={platform}
                    aiOutput={aiOutput}
                    uploadStatus={(uploadStatuses[platform] as UploadStatus | undefined) ?? 'idle'}
                    onUpload={() => { void handleUpload(platform) }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Get Better Version (Phase 5) */}
          {aiOutput && (
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => { void handleGenerate({ isSecondPass: true }) }}
              className={`w-full py-3 px-6 rounded-lg font-semibold transition flex items-center justify-center gap-2 border ${
                aiLoading
                  ? 'border-zinc-700 bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'border-purple-500/50 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 hover:border-purple-500'
              }`}
            >
              {aiLoading && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {aiLoading ? '⏳ Improving copy…' : '✨ Get Better Version'}
            </button>
          )}

          {/* ── Phase 4 + 11: analysis results ── */}
          {status.kind === 'done' && signals && scoreResult && checklistItems && gapMessages && (
            <div data-testid="analysis-done" className="flex flex-col gap-4 pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-2 px-1">
                <span className="text-lg">📊</span>
                <h2 className="text-lg font-semibold text-white">Video Analysis</h2>
              </div>
              <ScorePanel score={scoreResult.overall} dataPoints={dataPoints} />
              <PlatformCardGrid perPlatform={scoreResult.perPlatform} />
              <ChecklistAccordion items={checklistItems} />
              <GapAnalysisPanel gaps={gapMessages} />
              {intelligenceTriggered && postId && signals && settingsData && (
                <IntelligencePanel
                  postId={postId}
                  niche={settingsData.default_niche}
                  engineSignals={signals}
                  enabledPlatforms={settingsData.enabled_platforms as Platform[]}
                />
              )}
            </div>
          )}

          {/* Upload error alert (Phase 6) */}
          {uploadError && (
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-yellow-900/20 border border-yellow-800/50">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <p className="text-sm font-medium text-yellow-200">{uploadError}</p>
              </div>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="self-start text-xs text-yellow-300 hover:text-yellow-100 transition font-medium"
              >
                Dismiss
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Schedule modal (Phase 6) */}
      {scheduleModal && (
        <ScheduleModal
          platform={scheduleModal.platform}
          onConfirm={(scheduledAt) => { void handleScheduleConfirm(scheduledAt) }}
          onCancel={() => setScheduleModal(null)}
        />
      )}
    </div>
  )
}
