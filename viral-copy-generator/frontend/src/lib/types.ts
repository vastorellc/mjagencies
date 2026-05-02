export type Screen = 'generator' | 'settings'

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
