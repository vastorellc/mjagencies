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
