export type Screen = 'generator' | 'settings' | 'history' | 'learning' | 'admin' | 'research'

export type AIProvider = 'claude' | 'gemini' | 'openai' | 'deepseek'
export const AI_PROVIDERS: AIProvider[] = ['claude', 'gemini', 'openai', 'deepseek']

export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'x'
export const ALL_PLATFORMS: Platform[] = ['youtube', 'instagram', 'tiktok', 'facebook', 'x']

export interface SettingsResponse {
  ai_provider: AIProvider
  api_key_masked: string | null
  default_niche: string
  enabled_platforms: string[]
  available_niches: string[]
  connected: { youtube: boolean; instagram: boolean; facebook: boolean }
  timezone: 'Asia/Karachi'
}

export const DEFAULT_NICHES = ['travel', 'hotels', 'cars', 'bikes', 'coding', 'lifestyle', 'food', 'other'] as const
export type Niche = string

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

// ============================================================================
// Phase 8: Admin Panel
// ============================================================================

// AdminJob — shape returned by GET /api/admin/jobs
// data field contains safe fields only (ADMIN-10: no tokens, no api keys)
export interface AdminJobData {
  userId?: string
  platform?: string
  fileId?: string
  scheduledAt?: string
  postId?: string
}

export interface AdminJob {
  id: string
  name: string
  state: 'created' | 'retry' | 'active' | 'completed' | 'cancelled' | 'failed'
  data: AdminJobData
  createdon: string
  startedon: string | null
  completedon: string | null
}

// AdminUser — shape returned by GET /api/admin/users (ADMIN-04)
// ADMIN-10: no api_key_encrypted, no OAuth tokens
export interface AdminUser {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  banned: boolean
  upload_count: number
  connected_platforms: string[]
}

// AdminHealthResponse — shape returned by GET /api/admin/health (ADMIN-07)
export interface AdminDiskInfo {
  size: string
  used: string
  avail: string
  usePct: string
}

export interface AdminHealthResponse {
  cpu: { count: number }
  memory: { total_mb: number; free_mb: number; used_mb: number; use_pct: number }
  disk: AdminDiskInfo | { error: string }
  database: { size: string } | { error: string }
  queue: { pending_jobs: number }
  apis: Record<string, { connected: boolean; error?: string }>
  timestamp: string
}

// AdminLogsResponse — shape returned by GET /api/admin/logs (ADMIN-08)
export interface AdminLogsMeta {
  total_lines: number
  filtered_lines: number
  returned: number
  error?: string
}

export interface AdminLogsResponse {
  lines: string[]
  meta: AdminLogsMeta
}

// AdminPlatformStat — one platform row from GET /api/admin/stats/platforms (ADMIN-09)
export interface AdminPlatformStat {
  platform: string
  total_uploads: number
  succeeded: number
  failed: number
  success_rate: number
  avg_virality_score: number | null
}

export interface AdminPlatformStatsResponse {
  platform_stats: AdminPlatformStat[]
  totals: {
    uploads: number
    succeeded: number
    overall_success_rate: number
  }
}

// ============================================================================
// Phase 9: Content Research Engine
// ============================================================================

export type ResearchTab = 'ideas' | 'hashtags' | 'calendar' | 'saved'

export interface TrendItem {
  title: string
  score: number
  source: 'youtube' | 'google-trends' | 'reddit' | 'exploding-topics'
  url?: string
}

// RESEARCH-09: Full content idea schema returned by POST /api/research/generate
export interface ContentIdeaData {
  id?: string                 // UUID from content_ideas table — present after /generate, absent in raw AI parse
  title: string
  angle: string
  hookVariants: [string, string, string]
  scriptOutline: string
  keyMoments: Array<{ timestamp: string; description: string }>
  brollSuggestions: string[]
  platforms: string[]
  estimatedStrength: number   // 0-100
  gapWarnings: string[]       // RESEARCH-10: rule-based pre-analysis warnings
  hashtagSuggestions: string[]
}

// RESEARCH-11: Hashtag ranked by trendVelocity * (1 + userAvgViews / 1000)
export interface HashtagIntel {
  hashtag: string
  trendScore: number
  userAvgViews: number
  combinedScore: number
  source: 'external' | 'user' | 'both'
}

// RESEARCH-12: 7-day calendar slot
export interface CalendarSlot {
  platform: string
  hour: number              // 0-23, PKT (UTC+5)
  idea: ContentIdeaData | null
}

export interface CalendarDay {
  date: string              // YYYY-MM-DD
  dow: number               // 0=Sunday...6=Saturday
  slots: CalendarSlot[]
}

// RESEARCH-15: fetchedAt used to compute "Last updated: Xh ago"
export interface ResearchTrendsResponse {
  trends: TrendItem[]
  fromCache: boolean
  fetchedAt: string         // ISO-8601
}

export interface ResearchGenerateResponse {
  ideas: ContentIdeaData[]
  calendar: CalendarDay[]
  hashtags: HashtagIntel[]
}

// RESEARCH-13: Saved idea row from content_ideas table
export interface SavedIdea {
  id: string
  idea: ContentIdeaData
  niches: string[]
  platforms: string[]
  generated_at: string
  saved: boolean
}

// ============================================================================
// Phase 11: AI Provider + Model Verification (VERIFY-03, VERIFY-04, VERIFY-06)
// ============================================================================

// ModelCapabilities shape (mirrors models.ts — kept in sync manually; no circular import)
export interface ModelCapabilities {
  text: boolean
  vision: boolean
  audio: boolean
  video: boolean
  maxInputTokens: number
  maxOutputTokens: number
  maxImagePixels?: number
  maxVideoSizeGB?: number
  supportsJsonMode: boolean
  supportsFunctionCalling: boolean
  supportsCaching: boolean
  supportsSystemPrompt: boolean
}

export interface AdminProviderHealth {
  provider: AIProvider
  model_id: string
  displayName: string
  tier: 'flagship' | 'fast' | 'premium' | 'experimental'
  capabilities: ModelCapabilities
  pricePerMInput: number
  pricePerMOutput: number
  retiresAt: string | null
  latestStatus: 'ok' | 'model_not_found' | 'invalid_key' | 'rate_limited' | 'service_unavailable' | 'error' | 'not_configured' | 'unknown'
  latestErrorMessage: string | null
  latestCheckedAt: string | null
  latencyP95Last7dMs: number | null
}

export type ValidateKeyErrorKind =
  | 'invalid_key'
  | 'model_not_found'
  | 'rate_limited'
  | 'service_unavailable'
  | 'network_error'

export interface ValidateKeyResponse {
  valid: boolean
  key_valid: boolean
  model_valid: boolean
  error_kind: ValidateKeyErrorKind | null
  error?: string
  error_message?: string
  capabilities?: ModelCapabilities
  model_id: string
}

// ============================================================================
// Phase 11: Content Intelligence Layer
// ============================================================================

export interface IntelligenceGap {
  field: string         // 'motion' | 'faces' | 'audio_energy' | 'duration' | 'brightness'
  current: number
  pattern_avg: number
  difference: number    // positive = video is higher
}

export interface IntelligenceRecommendation {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  estimated_impact: string
}

export interface IntelligencePlatformResult {
  platform: string
  viewTier: string
  similarity: number
  gaps: IntelligenceGap[]
  aiInsights: {
    recommendations: IntelligenceRecommendation[]
    confidenceScore: number
    summary: string | null
  } | null
}

export interface IntelligenceVideoData {
  videoAnalysis: { id: string; niche: string; created_at: string }
  patterns: IntelligencePlatformResult[]
}

// ============================================================================
// Phase 3: Engine Progress / Preflight types (D-11, ANALYSIS-09)
// ============================================================================

export type ProgressStep =
  | 'metadata' | 'frames' | 'scenes'
  | 'faces' | 'objects' | 'audio' | 'brightness' | 'done'

export interface AnalyseOptions {
  onProgress?: (step: ProgressStep) => void
  signal?: AbortSignal
}

export type EnginePreflight = { ok: true } | { ok: false; reason: string }
