// Research AI prompt builder + idea parser tests — Wave 0 stubs (RED state)
// These become GREEN in Plan 09-03 (research-ai.ts implementation).
import { describe, it, expect } from 'vitest'

describe('buildResearchPrompt', () => {
  it('includes trend data in the prompt string', async () => {
    const { buildResearchPrompt } = await import('../src/lib/research-ai.js')
    const prompt = buildResearchPrompt({
      trends: [{ title: 'Trip to Lahore', score: 80, source: 'youtube' }],
      topHooks: [],
      topHashtags: [],
      bestNiche: 'travel',
      postingTimes: [],
      userNiches: ['travel'],
    })
    expect(typeof prompt).toBe('string')
    expect(prompt).toContain('Trip to Lahore')
    expect(prompt).toContain('travel')
  })

  it('prompt requests JSON array output schema', async () => {
    const { buildResearchPrompt } = await import('../src/lib/research-ai.js')
    const prompt = buildResearchPrompt({
      trends: [],
      topHooks: [],
      topHashtags: [],
      bestNiche: 'travel',
      postingTimes: [],
      userNiches: ['travel'],
    })
    expect(prompt).toContain('JSON')
    expect(prompt).toContain('hookVariants')
  })
})

describe('safeParseIdeas', () => {
  it('parses clean JSON array into ContentIdeaData[]', async () => {
    const { safeParseIdeas } = await import('../src/lib/research-ai.js')
    const raw = JSON.stringify([{
      title: 'Test', angle: 'A', hookVariants: ['h1', 'h2', 'h3'],
      scriptOutline: 'outline', keyMoments: [], brollSuggestions: [],
      platforms: ['youtube'], estimatedStrength: 70, gapWarnings: [], hashtagSuggestions: [],
    }])
    const result = safeParseIdeas(raw)
    expect(result).toHaveLength(1)
    expect(result[0]?.title).toBe('Test')
  })

  it('returns [] on malformed JSON (never throws)', async () => {
    const { safeParseIdeas } = await import('../src/lib/research-ai.js')
    expect(safeParseIdeas('not json')).toEqual([])
    expect(safeParseIdeas('```json\nnot json\n```')).toEqual([])
  })

  it('strips markdown fences before parsing', async () => {
    const { safeParseIdeas } = await import('../src/lib/research-ai.js')
    const fenced = '```json\n[{"title":"T","angle":"A","hookVariants":["h1","h2","h3"],"scriptOutline":"s","keyMoments":[],"brollSuggestions":[],"platforms":[],"estimatedStrength":50,"gapWarnings":[],"hashtagSuggestions":[]}]\n```'
    const result = safeParseIdeas(fenced)
    expect(result).toHaveLength(1)
    expect(result[0]?.title).toBe('T')
  })
})
