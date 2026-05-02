import type {
  EngineSignals,
  ChecklistItem,
  Niche,
  Platform,
  AIOutput,
} from './types'

export interface ChecklistOptions {
  niche: Niche
  enabledPlatforms: Platform[]
}

const NO_FACE_NICHES: Niche[] = ['travel', 'hotels', 'cars', 'bikes']

function pass(id: string, category: ChecklistItem['category'], label: string): ChecklistItem {
  return { id, category, label, status: 'pass', fix: '' }
}

function fail(id: string, category: ChecklistItem['category'], label: string, fix: string): ChecklistItem {
  return { id, category, label, status: 'fail', fix }
}

function pending(id: string, category: ChecklistItem['category'], label: string): ChecklistItem {
  return { id, category, label, status: 'pending', fix: '' }
}

// Format helpers — short, deterministic, no locale variation.
function fmt1(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1) : 'unknown'
}
function fmt2(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : 'unknown'
}
function fmtInt(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toString() : 'unknown'
}

export function buildChecklist(
  signals: EngineSignals,
  options: ChecklistOptions,
  aiOutput?: AIOutput,
): ChecklistItem[] {
  const items: ChecklistItem[] = []

  // ============================================================================
  // D-15: Video Technical (5 items)
  // ============================================================================

  // 1. aspect_ratio_vertical: pass if aspectRatio < 0.6
  if (Number.isNaN(signals.aspectRatio)) {
    items.push(fail(
      'aspect_ratio_vertical',
      'video-technical',
      'Vertical aspect ratio (9:16)',
      'Aspect ratio could not be determined.',
    ))
  } else if (signals.aspectRatio < 0.6) {
    items.push(pass('aspect_ratio_vertical', 'video-technical', 'Vertical aspect ratio (9:16)'))
  } else {
    items.push(fail(
      'aspect_ratio_vertical',
      'video-technical',
      'Vertical aspect ratio (9:16)',
      `Aspect is ${fmt2(signals.aspectRatio)}; vertical (9:16 = 0.5625) gets ~3× more reach on Reels and Shorts.`,
    ))
  }

  // 2. duration_in_band: pass if durationSec between 10..90s
  if (signals.durationSec >= 10 && signals.durationSec <= 90) {
    items.push(pass('duration_in_band', 'video-technical', 'Duration 10-90s'))
  } else {
    items.push(fail(
      'duration_in_band',
      'video-technical',
      'Duration 10-90s',
      `Length is ${fmt1(signals.durationSec)}s; short-form sweet spot is 10-90s.`,
    ))
  }

  // 3. has_audio: pass if hasAudio===true
  if (signals.hasAudio) {
    items.push(pass('has_audio', 'video-technical', 'Audio track present'))
  } else {
    items.push(fail(
      'has_audio',
      'video-technical',
      'Audio track present',
      'Video has no audio track. Even ambient sound or music helps autoplay-with-sound platforms.',
    ))
  }

  // 4. brightness_healthy: pass if 0.3 <= brightnessScore <= 0.7
  if (signals.brightnessScore >= 0.3 && signals.brightnessScore <= 0.7) {
    items.push(pass('brightness_healthy', 'video-technical', 'Brightness 0.3-0.7'))
  } else {
    items.push(fail(
      'brightness_healthy',
      'video-technical',
      'Brightness 0.3-0.7',
      `Brightness is ${fmt2(signals.brightnessScore)}; aim for 0.3-0.7 (avoid washed-out or too-dark footage).`,
    ))
  }

  // 5. resolution_min: pass if width >= 720
  if (signals.width >= 720) {
    items.push(pass('resolution_min', 'video-technical', 'Minimum 720p'))
  } else {
    items.push(fail(
      'resolution_min',
      'video-technical',
      'Minimum 720p',
      `Resolution is ${fmtInt(signals.width)}×${fmtInt(signals.height)}; minimum 720p for clean upscaling on platform delivery.`,
    ))
  }

  // ============================================================================
  // D-16: Metadata Quality (8 items)
  // Phase 4: all pending. Phase 5: re-evaluated when aiOutput is provided (D-09..D-12).
  // ============================================================================
  if (!aiOutput) {
    // Phase 4 default — all pending until AI output arrives
    items.push(pending('caption_length_youtube',      'metadata-quality', 'YouTube caption length'))
    items.push(pending('caption_length_instagram',    'metadata-quality', 'Instagram caption length'))
    items.push(pending('caption_length_tiktok',       'metadata-quality', 'TikTok caption length'))
    items.push(pending('hashtag_count_in_band',       'metadata-quality', 'Hashtag count per platform'))
    items.push(pending('hook_in_first_line',          'metadata-quality', 'Hook present in first line'))
    items.push(pending('cta_present',                 'metadata-quality', 'Call-to-action present'))
    items.push(pending('language_match_niche',        'metadata-quality', 'Language matches niche'))
    items.push(pending('description_keyword_density', 'metadata-quality', 'Description keyword density'))
  } else {
    // D-09: Character count checks
    const ytTitleLen = aiOutput.youtube.title.length
    if (ytTitleLen <= 60) {
      items.push(pass('caption_length_youtube', 'metadata-quality', 'YouTube caption length'))
    } else {
      items.push(fail(
        'caption_length_youtube', 'metadata-quality', 'YouTube caption length',
        `Title is ${ytTitleLen} chars; keep ≤60.`,
      ))
    }

    const igCaptionLen = aiOutput.instagram.caption.length
    if (igCaptionLen >= 150 && igCaptionLen <= 200) {
      items.push(pass('caption_length_instagram', 'metadata-quality', 'Instagram caption length'))
    } else {
      items.push(fail(
        'caption_length_instagram', 'metadata-quality', 'Instagram caption length',
        `Caption is ${igCaptionLen} chars; aim for 150-200 chars.`,
      ))
    }

    const ttCaptionLen = aiOutput.tiktok.caption.length
    if (ttCaptionLen <= 150) {
      items.push(pass('caption_length_tiktok', 'metadata-quality', 'TikTok caption length'))
    } else {
      items.push(fail(
        'caption_length_tiktok', 'metadata-quality', 'TikTok caption length',
        `TikTok caption is ${ttCaptionLen} chars; keep ≤150.`,
      ))
    }

    // D-11: Hashtag count — evaluate ONLY enabled platforms; skip disabled ones
    let hashtagPass = true
    let hashtagFailFix = ''

    if (options.enabledPlatforms.includes('instagram')) {
      const igCount = aiOutput.instagram.hashtags.length
      if (igCount < 25 || igCount > 30) {
        hashtagPass = false
        hashtagFailFix = `Instagram: use 25-30 hashtags; got ${igCount}.`
      }
    }
    if (hashtagPass && options.enabledPlatforms.includes('tiktok')) {
      const ttCount = aiOutput.tiktok.hashtags.length
      if (ttCount < 4 || ttCount > 6) {
        hashtagPass = false
        hashtagFailFix = `TikTok: use 4-6 hashtags; got ${ttCount}.`
      }
    }
    if (hashtagPass && options.enabledPlatforms.includes('youtube')) {
      const ytCount = aiOutput.youtube.tags.length
      if (ytCount < 10 || ytCount > 15) {
        hashtagPass = false
        hashtagFailFix = `YouTube: use 10-15 tags; got ${ytCount}.`
      }
    }

    if (hashtagPass) {
      items.push(pass('hashtag_count_in_band', 'metadata-quality', 'Hashtag count per platform'))
    } else {
      items.push(fail('hashtag_count_in_band', 'metadata-quality', 'Hashtag count per platform', hashtagFailFix))
    }

    // D-10: Presence checks
    const ytEnabled = options.enabledPlatforms.includes('youtube')
    const ttEnabled = options.enabledPlatforms.includes('tiktok')
    const hookPresent =
      (ytEnabled && aiOutput.youtube.hook.trim().length > 0) ||
      (ttEnabled && aiOutput.tiktok.hook.trim().length > 0)

    if (hookPresent) {
      items.push(pass('hook_in_first_line', 'metadata-quality', 'Hook present in first line'))
    } else {
      items.push(fail(
        'hook_in_first_line', 'metadata-quality', 'Hook present in first line',
        'Add a hook suggestion — first line should grab attention in 3 seconds.',
      ))
    }

    const fbEnabled = options.enabledPlatforms.includes('facebook')
    if (!fbEnabled || aiOutput.facebook.cta.trim().length > 0) {
      items.push(pass('cta_present', 'metadata-quality', 'Call-to-action present'))
    } else {
      items.push(fail(
        'cta_present', 'metadata-quality', 'Call-to-action present',
        'Add a call-to-action to the Facebook caption.',
      ))
    }

    // D-12: Language / keyword density — presence-only checks (trust the prompt)
    const igEnabled = options.enabledPlatforms.includes('instagram')
    if (!igEnabled || aiOutput.instagram.caption.trim().length > 0) {
      items.push(pass('language_match_niche', 'metadata-quality', 'Language matches niche'))
    } else {
      items.push(fail(
        'language_match_niche', 'metadata-quality', 'Language matches niche',
        'Instagram caption is empty.',
      ))
    }

    if (!ytEnabled || aiOutput.youtube.description.trim().length > 0) {
      items.push(pass('description_keyword_density', 'metadata-quality', 'Description keyword density'))
    } else {
      items.push(fail(
        'description_keyword_density', 'metadata-quality', 'Description keyword density',
        'YouTube description is empty — add SEO keywords.',
      ))
    }
  }

  // ============================================================================
  // D-17: Virality Boosters (5 items)
  // ============================================================================

  // 1. strong_hook: pass if sceneTimestamps[0] < 1.5
  const firstSceneT = signals.sceneTimestamps[0]
  if (firstSceneT !== undefined && firstSceneT < 1.5) {
    items.push(pass('strong_hook', 'virality-boosters', 'Strong hook (first cut < 1.5s)'))
  } else {
    const shown = firstSceneT !== undefined ? fmt1(firstSceneT) : 'none'
    items.push(fail(
      'strong_hook',
      'virality-boosters',
      'Strong hook (first cut < 1.5s)',
      `First scene change at ${shown}s; cut to action before 1.5s to hook scrollers.`,
    ))
  }

  // 2. multiple_scene_cuts: pass if sceneCount >= 3
  if (signals.sceneCount >= 3) {
    items.push(pass('multiple_scene_cuts', 'virality-boosters', '3+ scene cuts'))
  } else {
    items.push(fail(
      'multiple_scene_cuts',
      'virality-boosters',
      '3+ scene cuts',
      `Only ${fmtInt(signals.sceneCount)} scene change(s) detected; 3-7 cuts keep viewers watching.`,
    ))
  }

  // 3. motion_present: pass if motionScore > 0.15
  if (signals.motionScore > 0.15) {
    items.push(pass('motion_present', 'virality-boosters', 'Motion present'))
  } else {
    items.push(fail(
      'motion_present',
      'virality-boosters',
      'Motion present',
      `Motion score is ${fmt2(signals.motionScore)}; static shots underperform — add camera movement or subject motion.`,
    ))
  }

  // 4. beat_aligned_audio: pass if beatPresent && hasAudio; pending if no audio
  if (!signals.hasAudio) {
    items.push(pending('beat_aligned_audio', 'virality-boosters', 'Audio with detectable beat'))
  } else if (signals.beatPresent) {
    items.push(pass('beat_aligned_audio', 'virality-boosters', 'Audio with detectable beat'))
  } else {
    items.push(fail(
      'beat_aligned_audio',
      'virality-boosters',
      'Audio with detectable beat',
      'No clear beat detected; trending audio or music with beat increases retention.',
    ))
  }

  // 5. no_long_silence: pass if all gaps < 1.5s; pending when hasAudio=false (D-25)
  if (!signals.hasAudio) {
    items.push(pending('no_long_silence', 'virality-boosters', 'No silence gaps over 1.5s'))
  } else {
    const longest = signals.silenceGapsSec.length > 0 ? Math.max(...signals.silenceGapsSec) : 0
    if (longest < 1.5) {
      items.push(pass('no_long_silence', 'virality-boosters', 'No silence gaps over 1.5s'))
    } else {
      items.push(fail(
        'no_long_silence',
        'virality-boosters',
        'No silence gaps over 1.5s',
        `Silence gap of ${fmt1(longest)}s detected; trim gaps over 1.5s to maintain pacing.`,
      ))
    }
  }

  // ============================================================================
  // D-18: Niche-Pakistan (3 items)
  // ============================================================================

  // 1. vertical_for_reels_shorts: pass if aspectRatio<0.6 AND user has IG/TikTok/YT enabled
  const hasShortFormPlatform = options.enabledPlatforms.some(
    (p) => p === 'instagram' || p === 'tiktok' || p === 'youtube',
  )
  const verticalOk = !Number.isNaN(signals.aspectRatio) && signals.aspectRatio < 0.6
  if (!hasShortFormPlatform) {
    // No relevant platform enabled — show as pass with empty fix (info, not penalising)
    items.push(pass('vertical_for_reels_shorts', 'niche-pakistan', 'Vertical for Reels/Shorts/TikTok'))
  } else if (verticalOk) {
    items.push(pass('vertical_for_reels_shorts', 'niche-pakistan', 'Vertical for Reels/Shorts/TikTok'))
  } else {
    items.push(fail(
      'vertical_for_reels_shorts',
      'niche-pakistan',
      'Vertical for Reels/Shorts/TikTok',
      'Vertical (9:16) is required for IG Reels and TikTok native feed.',
    ))
  }

  // 2. no_face_niche_ok: info-only (D-18). Pass with empty fix.
  // Special label when faceCount=0 AND niche in NO_FACE_NICHES — reassures the creator.
  const noFaceMatch = signals.faceCount === 0 && NO_FACE_NICHES.includes(options.niche)
  items.push({
    id: 'no_face_niche_ok',
    category: 'niche-pakistan',
    label: noFaceMatch
      ? 'No-face content matches travel/hotel/drive niche — algorithm penalty offset by niche relevance.'
      : 'No-face niche check',
    status: 'pass',
    fix: '',
  })

  // 3. pkt_posting_window_hint: always pass info row (D-18)
  items.push({
    id: 'pkt_posting_window_hint',
    category: 'niche-pakistan',
    label: 'Peak PKT posting window: 8-10pm — schedule via auto-upload (Phase 6).',
    status: 'pass',
    fix: '',
  })

  return items
}
