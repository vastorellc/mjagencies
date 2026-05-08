import { useMemo, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Screen,
  EngineSignals,
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
import { fetchSettings, createPost, fetchApiKey, uploadFile, scheduleUpload, fetchTopHooks, fetchTopHashtags, fetchLearningWeights } from '../lib/api'
import type { LearningData } from '../lib/types'
import { analyzeVideoWithProgressTracking } from '../lib/engineWithProgress'
import ScheduleModal from '../components/ScheduleModal'
import ScorePanel from '../components/ScorePanel'
import PlatformCardGrid from '../components/PlatformCardGrid'
import ChecklistAccordion from '../components/ChecklistAccordion'
import GapAnalysisPanel from '../components/GapAnalysisPanel'
import PlatformCopyCard from '../components/PlatformCopyCard'
import IntelligencePanel from '../components/IntelligencePanel'
import ProgressSidebar, { type AnalysisStep } from '../components/ProgressSidebar'

interface Props {
  onNavigate: (s: Screen) => void
  __testSignals?: EngineSignals
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

export default function GeneratorPage({ onNavigate, __testSignals }: Props) {
  // Phase 3/4 state
  const [signals, _setSignals] = useState<EngineSignals | null>(__testSignals ?? null)
  const [learnedWeights, setLearnedWeights] = useState<LearnedWeights | null>(null)
  const [dataPoints, setDataPoints] = useState<number>(0)

  // Phase 5 state
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [description, setDescription] = useState<string>('')
  const [aiOutput, setAiOutput] = useState<AIOutput | null>(null)
  const [settingsData, setSettingsData] = useState<SettingsResponse | null>(null)
  const [aiLoading, setAiLoading] = useState<boolean>(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiErrorKey, setAiErrorKey] = useState<AIErrorKind | null>(null)
  const [postId, setPostId] = useState<string | null>(null)
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, string>>({})
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const isFirstGenerationRef = useRef<boolean>(true)

  // Phase 6: upload modal state
  const [scheduleModal, setScheduleModal] = useState<{ platform: Platform } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Phase 11: Content Intelligence state
  const [intelligenceTriggered, setIntelligenceTriggered] = useState<boolean>(false)

  // Video analysis progress tracking
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle')
  const [analysisProgress, setAnalysisProgress] = useState<number>(0)

  // D-13: Fetch settings on mount; populate userId from auth session
  useEffect(() => {
    fetchSettings()
      .then(data => setSettingsData(data))
      .catch(() => { /* fall back to defaults — non-blocking per D-13 */ })

    fetchLearningWeights()
      .then(data => {
        setDataPoints(data.data_points)
        setLearnedWeights(data.learned_weights as LearnedWeights | null)
      })
      .catch(() => { /* non-blocking -- defaults to 0 / null */ })

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
          const row = payload.new as { platform: string; upload_status: string; error_message?: string }
          setUploadStatuses(prev => ({ ...prev, [row.platform]: row.upload_status }))
          // Phase 10: detect oauth_expired from worker-written error_message (Pitfall 3 in RESEARCH.md)
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

  // Derived settings values with fallbacks
  const niche = settingsData?.default_niche ?? DEFAULT_NICHE
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

      // LEARNING-06: fresh fetch -- no caching; queries < 5ms (backend raw SQL)
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

  // Phase 6: handle upload button click — open ScheduleModal after gates pass
  async function handleUpload(platform: Platform) {
    // TikTok: never called (button disabled in PlatformCopyCard), but guard anyway
    if (platform === 'tiktok' || platform === 'x') return

    // STORE-05: Instagram 100 MB gate — enforce before modal opens (UX; backend enforces authoritatively)
    if (platform === 'instagram' && selectedFile && selectedFile.size > 100 * 1024 * 1024) {
      const sizeMB = Math.ceil(selectedFile.size / 1024 / 1024)
      setUploadError(`Instagram: video is ${sizeMB}MB, max is 100MB. Compress before uploading.`)
      return
    }

    setUploadError(null)
    setScheduleModal({ platform })
  }

  // Phase 6: called when user confirms the schedule modal
  async function handleScheduleConfirm(scheduledAt: string | null) {
    if (!scheduleModal || !selectedFile || !postId) {
      setScheduleModal(null)
      return
    }
    const { platform } = scheduleModal
    setScheduleModal(null)

    // Update optimistic status to uploading
    setUploadStatuses(prev => ({ ...prev, [platform]: 'uploading' }))

    try {
      // 1. Upload file to VPS — backend returns fileId
      const { fileId } = await uploadFile(selectedFile)

      // 2. Build caption + hashtags from aiOutput
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

      // 3. Schedule the pg-boss upload job
      // filePath and publicUrl are derived server-side from userId + fileId — not sent from client
      await scheduleUpload({
        postId,
        platform,
        fileId,
        caption,
        hashtags,
        scheduledAt: scheduledAt ?? undefined,
      })
      // Realtime subscription will push the status update when worker runs
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

  // Drag and drop state
  const [isDragging, setIsDragging] = useState<boolean>(false)

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('video/')) {
        setSelectedFile(file)
        setPostId(null)
        setUploadStatuses({})
        isFirstGenerationRef.current = true
        setAiOutput(null)
        extractThumbnail(file)
      } else {
        setUploadError('Please drop a video file (MP4, MOV, AVI, MKV)')
      }
    }
  }

  // Extract first frame of video as thumbnail
  const extractThumbnail = (file: File) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      video.currentTime = 0.5 // Capture at 0.5 seconds to avoid black frame
    }

    video.onseeked = () => {
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const thumbUrl = canvas.toDataURL('image/jpeg', 0.7)
        setThumbnail(thumbUrl)
      }
    }

    video.onerror = () => {
      console.warn('Could not extract video thumbnail')
      setThumbnail(null)
    }

    video.src = URL.createObjectURL(file)
  }

  // Manual video analysis when button clicked
  const startVideoAnalysis = async () => {
    if (!selectedFile) return

    setAnalysisStep('loading')
    setAnalysisProgress(0)

    try {
      const signals = await analyzeVideoWithProgressTracking(selectedFile, {
        onStepStart: (stepId: string) => {
          const step = parseInt(stepId, 10)
          if (step <= 2) setAnalysisStep('loading')
          else if (step <= 4) setAnalysisStep('extracting-frames')
          else if (step <= 6) setAnalysisStep('detecting-scenes')
          else if (step <= 8) setAnalysisStep('detecting-faces')
          else if (step <= 10) setAnalysisStep('analyzing-audio')
          else setAnalysisStep('computing-scores')
        },
        onProgress: (_stepId: string, progress: number) => {
          setAnalysisProgress(progress)
        },
        onStepComplete: () => null,
        onStepError: () => setAnalysisStep('error'),
      })

      if (signals) {
        _setSignals(signals)
        setAnalysisStep('complete')
        setAnalysisProgress(100)
      }
    } catch (err) {
      console.error('Analysis failed:', err)
      setAnalysisStep('error')
    }
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white">
      <ProgressSidebar currentStep={analysisStep} progress={analysisProgress} />

      <main className={`flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] transition-all ${
        analysisStep !== 'idle' ? 'pr-80' : ''
      }`}>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-sm shadow-black/20">
            <h1 className="text-3xl font-bold text-white">Viral Copy Generator</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Upload video content or describe the clip, then generate professional platform copy in one place.
            </p>
          </section>

          {/* Upload Video Section */}
          <div className="flex flex-col gap-3 p-5 rounded-xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 hover:border-zinc-700 transition">
            <div className="flex items-start justify-between">
              <div>
                <label htmlFor="video-upload" className="block text-sm font-semibold text-white mb-2">
                  📹 Upload Your Video
                </label>
                <p className="text-xs text-zinc-400">Upload a video file or describe your content to get AI-generated copy</p>
              </div>
            </div>

            <label
              htmlFor="video-upload"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`cursor-pointer flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition ${
                isDragging
                  ? 'border-purple-500 bg-purple-900/20'
                  : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-900'
              }`}
            >
              <div className="flex flex-col items-center gap-3 w-full">
                {selectedFile ? (
                  <>
                    {thumbnail && (
                      <img
                        src={thumbnail}
                        alt="Video thumbnail"
                        className="w-full max-w-xs h-40 object-cover rounded-lg border border-zinc-600"
                      />
                    )}
                    <div className="text-center">
                      <span className="text-2xl">✓</span>
                      <p className="font-medium text-white break-all max-w-sm mt-2">{selectedFile.name}</p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-3xl">+</span>
                    <p className="text-sm font-medium text-white">Click to upload a video</p>
                    <p className="text-xs text-zinc-400">or drag and drop (MP4, MOV, AVI, MKV)</p>
                    <p className="text-xs text-zinc-500 mt-1">Max 500 MB</p>
                  </>
                )}
              </div>
              <input
                id="video-upload"
                type="file"
                accept="video/*"
                className="sr-only"
                aria-label="Upload video file for analysis"
                onChange={e => {
                  const file = e.target.files?.[0] ?? null
                  setSelectedFile(file)
                  if (file) {
                    setPostId(null)
                    setUploadStatuses({})
                    isFirstGenerationRef.current = true
                    setAiOutput(null)
                    extractThumbnail(file)
                  } else {
                    setThumbnail(null)
                  }
                }}
              />
            </label>

            {/* Analysis button - only show after file selected */}
            {selectedFile && (
              <div className="mt-3 flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => { void startVideoAnalysis() }}
                  disabled={analysisStep !== 'idle'}
                  className="rounded px-3 py-2 font-medium text-blue-400 hover:text-blue-300 disabled:text-zinc-600 bg-zinc-800 hover:bg-zinc-700 transition"
                >
                  📊 Analyze Video
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null)
                    setThumbnail(null)
                  }}
                  className="rounded px-3 py-2 font-medium text-zinc-400 hover:text-red-400 bg-zinc-800 hover:bg-zinc-700 transition"
                >
                  ✕ Remove
                </button>
              </div>
            )}
          </div>

          {/* Description Section */}
          <div className="flex flex-col gap-3 p-5 rounded-xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800">
            <div>
              <label htmlFor="description-input" className="block text-sm font-semibold text-white mb-2">
                ✍️ Add Context (Optional)
              </label>
              <p className="text-xs text-zinc-400">Describe what's in your video to get better AI copy. Leave blank if uploading.</p>
            </div>
            <textarea
              id="description-input"
              rows={3}
              maxLength={280}
              placeholder="E.g., 'A travel vlog of hiking in the mountains with sunset views' or 'Product unboxing and review of new laptop'"
              aria-label="Optional description to help AI generate better copy"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-purple-500 resize-none border border-zinc-700"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">{description.length}/280 characters</span>
              <span className={`text-xs font-medium ${description.length > 250 ? 'text-yellow-500' : 'text-zinc-500'}`}>
                {description.length > 250 ? '⚠️ Getting long' : description.length > 0 ? '✓ Good' : 'Optional'}
              </span>
            </div>
          </div>

          {/* Generate Copy Button */}
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

          {/* Hint text */}
          {!canGenerate && !selectedFile && (
            <p className="text-center text-xs text-zinc-500 px-4">
              👆 Upload a video or describe your content to get started
            </p>
          )}

          {/* Error display with better styling */}
          {aiError && (
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-red-900/20 border border-red-800/50">
              <div className="flex items-start gap-2">
                <span className="text-lg">❌</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-200">{aiError}</p>
                </div>
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

          {/* Generated Copy Cards */}
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

          {/* Get Better Version Button */}
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

          {/* Video Analysis Results */}
          {signals && scoreResult && checklistItems && gapMessages && (
            <div data-testid="score-results" className="flex flex-col gap-4 pt-4 border-t border-zinc-800">
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

          {/* Upload Error Alert */}
          {uploadError && (
            <div className="flex flex-col gap-2 p-4 rounded-lg bg-yellow-900/20 border border-yellow-800/50">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-200">{uploadError}</p>
                </div>
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

      {/* Phase 6: Schedule Modal — rendered outside main scroll area to avoid clipping */}
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
