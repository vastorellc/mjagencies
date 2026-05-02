// Wave 0 stub — tests go GREEN when ai.ts is implemented in Plan 05-03.
// Covers: AI-06 (Gemini needs both responseMimeType + responseSchema),
//         AI-09 (JSON robustness: fences, truncation, bare object),
//         AI-11 (Get Better Version: images NOT re-sent on second pass)
import { describe, it, expect, vi } from 'vitest'

// Import will fail RED until Plan 05-03 creates ai.ts
import { parseAIOutput, buildAICallParams, getGeminiConfig } from './ai'

describe('parseAIOutput — JSON robustness (AI-09)', () => {
  it('parses clean JSON object', () => {
    const raw = JSON.stringify({
      youtube: { title: 'T', description: 'D', tags: ['a'], hook: 'H' },
      instagram: { caption: 'C', hashtags: ['#h'], cover_text: 'CV' },
      tiktok: { hook: 'TH', caption: 'TC', hashtags: ['#t'] },
      facebook: { caption: 'FC', cta: 'CTA', hashtags: ['#f'] },
      x: { tweet: 'TW', hashtags: ['#x'] },
      script_outline: 'SO',
    })
    const result = parseAIOutput(raw)
    expect(result.youtube.title).toBe('T')
    expect(result.script_outline).toBe('SO')
  })

  it('strips markdown code fences', () => {
    const raw = '```json\n{"youtube":{"title":"T","description":"D","tags":[],"hook":""},"instagram":{"caption":"","hashtags":[],"cover_text":""},"tiktok":{"hook":"","caption":"","hashtags":[]},"facebook":{"caption":"","cta":"","hashtags":[]},"x":{"tweet":"","hashtags":[]},"script_outline":""}\n```'
    const result = parseAIOutput(raw)
    expect(result.youtube.title).toBe('T')
  })

  it('handles truncated JSON by returning emptyAIOutput', () => {
    const raw = '{"youtube": {"title": "T"'  // truncated
    const result = parseAIOutput(raw)
    expect(result.youtube.title).toBe('')
    expect(result.instagram.caption).toBe('')
  })

  it('handles completely malformed input by returning emptyAIOutput', () => {
    const result = parseAIOutput('not json at all')
    expect(result.youtube.title).toBe('')
    expect(result.x.tweet).toBe('')
  })

  it('hydrates missing fields with empty defaults', () => {
    // Partial JSON — missing tiktok/facebook/x
    const raw = JSON.stringify({ youtube: { title: 'T', description: 'D', tags: [], hook: '' } })
    const result = parseAIOutput(raw)
    expect(result.tiktok.hook).toBe('')
    expect(result.facebook.cta).toBe('')
    expect(result.x.tweet).toBe('')
  })
})

describe('buildAICallParams — second pass (AI-11)', () => {
  it('second pass (isSecondPass=true) does not include framesBase64', () => {
    const params = buildAICallParams({
      provider: 'claude',
      prompt: 'test prompt',
      frames: ['base64frame1', 'base64frame2'],
      isSecondPass: true,
    })
    expect(params.frames).toBeUndefined()
  })

  it('first pass (isSecondPass=false) includes framesBase64', () => {
    const params = buildAICallParams({
      provider: 'claude',
      prompt: 'test prompt',
      frames: ['base64frame1'],
      isSecondPass: false,
    })
    expect(params.frames).toHaveLength(1)
  })
})

describe('Gemini config — AI-06', () => {
  it('getGeminiConfig includes both responseMimeType and responseSchema', () => {
    const config = getGeminiConfig()
    expect(config.responseMimeType).toBe('application/json')
    expect(config.responseSchema).toBeDefined()
    expect(config.responseSchema.type).toBe('object')
    expect(config.responseSchema.properties.youtube).toBeDefined()
    expect(config.responseSchema.properties.script_outline).toBeDefined()
  })
})
