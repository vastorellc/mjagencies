import { describe, it, expect } from 'vitest'
import { buildChecklist, type ChecklistOptions } from './checklist'
import type { EngineSignals, ChecklistItem } from './types'

function mockSignals(overrides: Partial<EngineSignals> = {}): EngineSignals {
  return {
    durationSec: 25,
    width: 1080,
    height: 1920,
    aspectRatio: 0.5625,
    fps: 30,
    bitrate: 5_000_000,
    hasAudio: true,
    audioEnergy: 0.7,
    beatPresent: true,
    silenceGapsSec: [0.3, 0.5],
    sceneCount: 8,
    sceneTimestamps: [0.8, 3.5, 7.0, 11.0, 14.5, 18.0, 21.5, 24.0],
    faceCount: 1,
    faceConfidence: 0.9,
    objectLabels: [],
    motionScore: 0.4,
    brightnessScore: 0.5,
    framesBase64: [],
    ...overrides,
  }
}

const baseOpts: ChecklistOptions = {
  niche: 'travel',
  enabledPlatforms: ['youtube', 'instagram', 'tiktok'],
}

function findItem(items: ChecklistItem[], id: string): ChecklistItem {
  const it = items.find((x) => x.id === id)
  if (!it) throw new Error(`item not found: ${id}`)
  return it
}

describe('buildChecklist — shape', () => {
  it('returns exactly 21 items', () => {
    const items = buildChecklist(mockSignals(), baseOpts)
    expect(items).toHaveLength(21)
  })

  it('5 video-technical + 8 metadata-quality + 5 virality-boosters + 3 niche-pakistan', () => {
    const items = buildChecklist(mockSignals(), baseOpts)
    const counts = {
      'video-technical': items.filter(i => i.category === 'video-technical').length,
      'metadata-quality': items.filter(i => i.category === 'metadata-quality').length,
      'virality-boosters': items.filter(i => i.category === 'virality-boosters').length,
      'niche-pakistan': items.filter(i => i.category === 'niche-pakistan').length,
    }
    expect(counts).toEqual({
      'video-technical': 5,
      'metadata-quality': 8,
      'virality-boosters': 5,
      'niche-pakistan': 3,
    })
  })

  it('item ordering is stable: video-tech, metadata, virality, niche', () => {
    const items = buildChecklist(mockSignals(), baseOpts)
    const cats = items.map(i => i.category)
    // First 5 video-technical, next 8 metadata, next 5 virality, last 3 niche
    expect(cats.slice(0, 5).every(c => c === 'video-technical')).toBe(true)
    expect(cats.slice(5, 13).every(c => c === 'metadata-quality')).toBe(true)
    expect(cats.slice(13, 18).every(c => c === 'virality-boosters')).toBe(true)
    expect(cats.slice(18, 21).every(c => c === 'niche-pakistan')).toBe(true)
  })
})

describe('Metadata Quality — D-16: all pending in Phase 4', () => {
  const ids = [
    'caption_length_youtube',
    'caption_length_instagram',
    'caption_length_tiktok',
    'hashtag_count_in_band',
    'hook_in_first_line',
    'cta_present',
    'language_match_niche',
    'description_keyword_density',
  ]
  it.each(ids)('%s is pending with empty fix', (id) => {
    const it = findItem(buildChecklist(mockSignals(), baseOpts), id)
    expect(it.status).toBe('pending')
    expect(it.fix).toBe('')
  })
})

describe('Video Technical — D-15', () => {
  it('aspect_ratio_vertical pass at 0.5625', () => {
    const it = findItem(buildChecklist(mockSignals({ aspectRatio: 0.5625 }), baseOpts), 'aspect_ratio_vertical')
    expect(it.status).toBe('pass')
  })
  it('aspect_ratio_vertical fail at 1.0 with interpolated value', () => {
    const it = findItem(buildChecklist(mockSignals({ aspectRatio: 1.0 }), baseOpts), 'aspect_ratio_vertical')
    expect(it.status).toBe('fail')
    expect(it.fix).toContain('1.00')
    expect(it.fix).toContain('9:16')
  })
  it('aspect_ratio_vertical fail with NaN aspect (D-25)', () => {
    const it = findItem(buildChecklist(mockSignals({ aspectRatio: NaN }), baseOpts), 'aspect_ratio_vertical')
    expect(it.status).toBe('fail')
    expect(it.fix).toContain('could not be determined')
  })

  it('duration_in_band pass at 25s', () => {
    const it = findItem(buildChecklist(mockSignals({ durationSec: 25 }), baseOpts), 'duration_in_band')
    expect(it.status).toBe('pass')
  })
  it('duration_in_band fail at 5s with interpolated value', () => {
    const it = findItem(buildChecklist(mockSignals({ durationSec: 5 }), baseOpts), 'duration_in_band')
    expect(it.status).toBe('fail')
    expect(it.fix).toContain('5.0s')
  })
  it('duration_in_band fail at durationSec=0 (D-25)', () => {
    const it = findItem(buildChecklist(mockSignals({ durationSec: 0 }), baseOpts), 'duration_in_band')
    expect(it.status).toBe('fail')
  })

  it('has_audio fail when hasAudio=false (D-25)', () => {
    const it = findItem(buildChecklist(mockSignals({ hasAudio: false }), baseOpts), 'has_audio')
    expect(it.status).toBe('fail')
    expect(it.fix).toContain('no audio track')
  })

  it('brightness_healthy pass at 0.5', () => {
    const it = findItem(buildChecklist(mockSignals({ brightnessScore: 0.5 }), baseOpts), 'brightness_healthy')
    expect(it.status).toBe('pass')
  })
  it('brightness_healthy fail at 0.85 with interpolated value', () => {
    const it = findItem(buildChecklist(mockSignals({ brightnessScore: 0.85 }), baseOpts), 'brightness_healthy')
    expect(it.status).toBe('fail')
    expect(it.fix).toContain('0.85')
  })

  it('resolution_min pass at 1080×1920', () => {
    const it = findItem(buildChecklist(mockSignals({ width: 1080, height: 1920 }), baseOpts), 'resolution_min')
    expect(it.status).toBe('pass')
  })
  it('resolution_min fail at 480×640 with interpolated values', () => {
    const it = findItem(buildChecklist(mockSignals({ width: 480, height: 640 }), baseOpts), 'resolution_min')
    expect(it.status).toBe('fail')
    expect(it.fix).toContain('480')
    expect(it.fix).toContain('640')
  })
})

describe('Virality Boosters — D-17', () => {
  it('strong_hook pass at firstSceneT 0.8', () => {
    const it = findItem(buildChecklist(mockSignals({ sceneTimestamps: [0.8, 3] }), baseOpts), 'strong_hook')
    expect(it.status).toBe('pass')
  })
  it('strong_hook fail at firstSceneT 2.5 with interpolated value', () => {
    const it = findItem(buildChecklist(mockSignals({ sceneTimestamps: [2.5, 5] }), baseOpts), 'strong_hook')
    expect(it.status).toBe('fail')
    expect(it.fix).toContain('2.5s')
  })
  it('strong_hook fail when sceneCount=0 (D-25)', () => {
    const it = findItem(buildChecklist(mockSignals({ sceneCount: 0, sceneTimestamps: [] }), baseOpts), 'strong_hook')
    expect(it.status).toBe('fail')
    expect(it.fix).toContain('none')
  })

  it('multiple_scene_cuts pass at sceneCount 3', () => {
    const it = findItem(buildChecklist(mockSignals({ sceneCount: 3 }), baseOpts), 'multiple_scene_cuts')
    expect(it.status).toBe('pass')
  })
  it('multiple_scene_cuts fail at sceneCount 1 (D-25 sceneCount=0 also fails)', () => {
    const it = findItem(buildChecklist(mockSignals({ sceneCount: 1 }), baseOpts), 'multiple_scene_cuts')
    expect(it.status).toBe('fail')
    expect(it.fix).toContain('1')
  })

  it('motion_present pass at 0.4', () => {
    const it = findItem(buildChecklist(mockSignals({ motionScore: 0.4 }), baseOpts), 'motion_present')
    expect(it.status).toBe('pass')
  })
  it('motion_present fail at 0.05', () => {
    const it = findItem(buildChecklist(mockSignals({ motionScore: 0.05 }), baseOpts), 'motion_present')
    expect(it.status).toBe('fail')
    expect(it.fix).toContain('0.05')
  })

  it('beat_aligned_audio pass when beat present', () => {
    const it = findItem(buildChecklist(mockSignals({ beatPresent: true }), baseOpts), 'beat_aligned_audio')
    expect(it.status).toBe('pass')
  })
  it('beat_aligned_audio fail when no beat but hasAudio', () => {
    const it = findItem(buildChecklist(mockSignals({ beatPresent: false, hasAudio: true }), baseOpts), 'beat_aligned_audio')
    expect(it.status).toBe('fail')
  })
  it('beat_aligned_audio pending when hasAudio=false (D-25)', () => {
    const it = findItem(buildChecklist(mockSignals({ hasAudio: false }), baseOpts), 'beat_aligned_audio')
    expect(it.status).toBe('pending')
  })

  it('no_long_silence pass when all gaps < 1.5', () => {
    const it = findItem(buildChecklist(mockSignals({ silenceGapsSec: [0.5, 0.8] }), baseOpts), 'no_long_silence')
    expect(it.status).toBe('pass')
  })
  it('no_long_silence fail at 2.5s gap with interpolated value', () => {
    const it = findItem(buildChecklist(mockSignals({ silenceGapsSec: [0.3, 2.5] }), baseOpts), 'no_long_silence')
    expect(it.status).toBe('fail')
    expect(it.fix).toContain('2.5s')
  })
  it('no_long_silence pending when hasAudio=false (D-25)', () => {
    const it = findItem(buildChecklist(mockSignals({ hasAudio: false }), baseOpts), 'no_long_silence')
    expect(it.status).toBe('pending')
  })
})

describe('Niche-Pakistan — D-18', () => {
  it('vertical_for_reels_shorts pass when vertical + IG/TikTok enabled', () => {
    const it = findItem(buildChecklist(mockSignals({ aspectRatio: 0.5625 }), { niche: 'travel', enabledPlatforms: ['instagram'] }), 'vertical_for_reels_shorts')
    expect(it.status).toBe('pass')
  })
  it('vertical_for_reels_shorts fail when not vertical AND IG/TikTok/YT enabled', () => {
    const it = findItem(buildChecklist(mockSignals({ aspectRatio: 1.0 }), { niche: 'travel', enabledPlatforms: ['instagram'] }), 'vertical_for_reels_shorts')
    expect(it.status).toBe('fail')
    expect(it.fix).toContain('Vertical (9:16)')
  })
  it('vertical_for_reels_shorts pass when no short-form platform enabled (info-only)', () => {
    const it = findItem(buildChecklist(mockSignals({ aspectRatio: 1.0 }), { niche: 'travel', enabledPlatforms: ['x'] }), 'vertical_for_reels_shorts')
    expect(it.status).toBe('pass')
  })

  it('no_face_niche_ok shows reassurance label for travel niche with no face', () => {
    const it = findItem(buildChecklist(mockSignals({ faceCount: 0, faceConfidence: undefined }), { niche: 'travel', enabledPlatforms: [] }), 'no_face_niche_ok')
    expect(it.status).toBe('pass')
    expect(it.label).toContain('No-face content matches travel')
    expect(it.fix).toBe('')
  })
  it('no_face_niche_ok shows generic label for non-niche match', () => {
    const it = findItem(buildChecklist(mockSignals({ faceCount: 0, faceConfidence: undefined }), { niche: 'coding', enabledPlatforms: [] }), 'no_face_niche_ok')
    expect(it.status).toBe('pass')
    expect(it.label).not.toContain('No-face content matches travel')
    expect(it.fix).toBe('')
  })

  it('pkt_posting_window_hint always pass info row', () => {
    const it = findItem(buildChecklist(mockSignals(), baseOpts), 'pkt_posting_window_hint')
    expect(it.status).toBe('pass')
    expect(it.label).toContain('8-10pm')
    expect(it.fix).toBe('')
  })
})
