export type Screen = 'generator' | 'settings' | 'history' | 'learning'

export type AIProvider = 'claude' | 'gemini' | 'openai'
export const AI_PROVIDERS: AIProvider[] = ['claude', 'gemini', 'openai']

export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'x'
export const ALL_PLATFORMS: Platform[] = ['youtube', 'instagram', 'tiktok', 'facebook', 'x']

export interface SettingsResponse {
  ai_provider: AIProvider
  api_key_masked: string | null
  default_niche: string
  enabled_platforms: string[]
  connected: { youtube: boolean; instagram: boolean; facebook: boolean }
  timezone: 'Asia/Karachi'
}

export const NICHES = ['travel', 'hotels', 'cars', 'bikes', 'coding', 'lifestyle', 'food', 'other'] as const
export type Niche = typeof NICHES[number]

// ============================================================================
// Phase 4: Virality Score + Checklist (D-03)
// ============================================================================

export type ColorBand = 'red' | 'amber' | 'green' | 'bright-green'

export type ChecklistStatus = 'pass' | 'fail' | 'pending'

export type ChecklistCategory =
  | 'video-technical'
  | 'metadata-quality'
  | 'virality-boosters'
  | 'niche-pakistan'

export interface ChecklistItem {
  id: string
  category: ChecklistCategory
  label: string
  status: ChecklistStatus
  fix: string
}

// EngineSignals — produced by Phase 3 engine.ts (frontend/src/lib/engine.ts).
// Phase 4 ships this interface first since Phase 4 lands before Phase 3 unblocks
// (per D-02 cross-phase awareness). Phase 3 will import and produce this shape.
export interface EngineSignals {
  durationSec: number
  width: number
  height: number
  aspectRatio: number          // width/height; may be NaN for 0-size edge cases (D-25)
  fps: number
  bitrate: number
  hasAudio: boolean
  audioEnergy: number          // 0..1
  beatPresent: boolean
  silenceGapsSec: number[]     // gap durations in seconds
  sceneCount: number
  sceneTimestamps: number[]    // seconds, sorted ascending
  faceCount: number
  faceConfidence?: number      // 0..1; undefined when faceCount === 0
  objectLabels: string[]
  motionScore: number          // 0..1 (centroid delta normalised)
  brightnessScore: number      // 0..1 (luma 0=black, 1=white)
  framesBase64: string[]       // 10 representative frames for AI providers
}

// Score weight table — keys are the seven signals; values sum to 1.0
export interface BaselineWeights {
  hook: number
  pacing: number
  face: number
  audio: number
  duration_fit: number
  aspect_ratio: number
  brightness: number
}

// Learned-weights JSON shape persisted in `settings.learned_weights` (Phase 7 fills).
// Each value is a delta in [-0.15, +0.15]; applied via clamp + re-normalise (D-20).
export interface LearnedWeights {
  hook?: number
  pacing?: number
  face?: number
  audio?: number
  duration_fit?: number
  aspect_ratio?: number
  brightness?: number
}

export interface PerPlatformScores {
  youtube: number
  instagram: number
  tiktok: number
  facebook: number
  x: number
}

export interface ScoreResult {
  overall: number
  perPlatform: PerPlatformScores
}

// ============================================================================
// Phase 5: AI Output + Platform Cards (D-03)
// ============================================================================

export interface YouTubeOutput {
  title: string
  description: string
  tags: string[]
  hook: string
}

export interface InstagramOutput {
  caption: string
  hashtags: string[]
  cover_text: string
}

export interface TikTokOutput {
  hook: string
  caption: string
  hashtags: string[]
}

export interface FacebookOutput {
  caption: string
  cta: string
  hashtags: string[]
}

export interface XOutput {
  tweet: string
  hashtags: string[]
}

export interface AIOutput {
  youtube: YouTubeOutput
  instagram: InstagramOutput
  tiktok: TikTokOutput
  facebook: FacebookOutput
  x: XOutput
  script_outline: string
}

export type UploadStatus = 'idle' | 'uploading' | 'posted' | 'failed'

export interface PostSaveResponse {
  postId: string
}

export interface CreatePostBody {
  title: string
  niche: string
  virality_score: number
  engine_signals: Record<string, unknown>
  ai_output: Record<string, unknown>
  enabled_platforms: string[]
}

export interface AIProxyBody {
  prompt: string
  frames?: string[]  // base64 JPEGs; omit on second pass (D-05)
}

// ============================================================================
// Phase 6: Auto-Upload + Scheduling
// ============================================================================

export interface UploadFileResponse {
  fileId: string
  publicUrl: string
}

export interface ScheduleUploadBody {
  postId: string
  platform: string
  fileId: string
  caption: string
  hashtags: string[]
  scheduledAt?: string   // ISO-8601 UTC; omit for immediate dispatch
}

export interface ScheduleUploadResponse {
  ok: boolean
  platformPostId: string
}

// ============================================================================
// Phase 7: History + Learning Loops
// ============================================================================

// PlatformPostRow — matches platform_posts DB row shape returned by GET /api/posts
export interface PlatformPostRow {
  id: string
  user_id: string
  post_id: string
  platform: string
  upload_status: string
  platform_post_id: string | null
  actual_views: number | null
  predicted_low: number | null
  predicted_high: number | null
  error_message: string | null
  posted_at: string | null    // ISO-8601 string (serialized from DB timestamp)
  created_at: string
}

// PostWithPlatforms — shape returned by GET /api/posts
export interface PostWithPlatforms {
  id: string
  user_id: string
  title: string
  niche: string
  virality_score: number
  engine_signals: Record<string, unknown>
  ai_output: Record<string, unknown>
  description: string | null
  created_at: string           // ISO-8601 string
  updated_at: string
  platforms: PlatformPostRow[]
}

// Accuracy label — returned by POST /api/platform-posts/:id/views and
// derived from PlatformPostRow.actual_views vs predicted_low/predicted_high
export type AccuracyLabel = 'overperformed' | 'matched' | 'underperformed'

// LogViewsResponse — from POST /api/platform-posts/:id/views
export interface LogViewsResponse {
  ok: boolean
  accuracy: AccuracyLabel
}

// TopHook — from GET /api/learning/hooks
export interface TopHook {
  hook_text: string
  max_views: number
}

// TopHashtag — from GET /api/learning/hashtags
export interface TopHashtag {
  hashtag: string
  avg_views: number
}

// PostingTimeSlot — from GET /api/learning/posting-times
export interface PostingTimeSlot {
  dow: number          // 0=Sunday … 6=Saturday
  hour: number         // 0–23, PKT (UTC+5)
  platform: string
  avg_views: number
  post_count: number
}

// NichePerformance — from GET /api/learning/niche-performance
export interface NichePerformance {
  niche: string
  avg_views: number
  max_views: number
  total_posts: number
}

// LearningWeightsResponse — from GET /api/learning/weights
export interface LearningWeightsResponse {
  learned_weights: Record<string, number> | null
  data_points: number
  is_calibrated: boolean
}

// LearningData — passed into buildPrompt() for LEARNING-06 injection
export interface LearningData {
  topHooks: TopHook[]
  topHashtags: TopHashtag[]
}

// PostFilters — used by HistoryPage to build GET /api/posts query string
export interface PostFilters {
  platform?: string
  niche?: string
  from?: string    // YYYY-MM-DD
  to?: string      // YYYY-MM-DD
}
