/**
 * packages/ai/src/__tests__/brand-context.test.ts
 *
 * Unit tests for getBrandVoiceContext — loads per-agency brand_voice and
 * brand_glossary docs and assembles them into a system-prompt string for
 * the AI editor (REQ-083).
 *
 * Two correctness/security properties:
 *   1. The Payload `where` clause is agency-scoped. A regression that
 *      omitted the where would leak another agency's brand voice into
 *      this agency's AI prompts.
 *   2. Errors (collection missing, network blip) return '' rather than
 *      throwing. The AI editor degrades gracefully — without brand voice
 *      it just produces generic copy instead of crashing the editor.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getBrandVoiceContext } from '../brand-context.js'

interface MockPayload {
  find: ReturnType<typeof vi.fn>
}

function makePayload(responses: Array<{ collection: string; docs: unknown[] }>): MockPayload {
  return {
    find: vi.fn(async (args: { collection: string }) => {
      const match = responses.find((r) => r.collection === args.collection)
      return { docs: match?.docs ?? [] }
    }),
  }
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {}) // suppress expected warns
})

// ── Agency-scoped queries ─────────────────────────────────────────────────

describe('getBrandVoiceContext — agency-scoped Payload queries', () => {
  it('Test 1: queries brand_voice with where[agency_id][equals]: <agencyId>', async () => {
    const payload = makePayload([
      { collection: 'brand_voice', docs: [] },
      { collection: 'brand_glossary', docs: [] },
    ])

    await getBrandVoiceContext('finance', payload as unknown as Parameters<typeof getBrandVoiceContext>[1])

    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'brand_voice',
      where:      { agency_id: { equals: 'finance' } },
      limit:      1,
    }))
  })

  it('Test 2: queries brand_glossary scoped to the same agency, limit 100', async () => {
    const payload = makePayload([
      { collection: 'brand_voice', docs: [] },
      { collection: 'brand_glossary', docs: [] },
    ])

    await getBrandVoiceContext('web-ecommerce', payload as unknown as Parameters<typeof getBrandVoiceContext>[1])

    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'brand_glossary',
      where:      { agency_id: { equals: 'web-ecommerce' } },
      limit:      100,
    }))
  })

  it('Test 3: agency id never appears in the OTHER agency\'s where clause (no leak)', async () => {
    const payload = makePayload([
      { collection: 'brand_voice', docs: [] },
      { collection: 'brand_glossary', docs: [] },
    ])

    await getBrandVoiceContext('finance', payload as unknown as Parameters<typeof getBrandVoiceContext>[1])

    // Every find call must scope to 'finance' — never to '*' or empty
    for (const call of payload.find.mock.calls) {
      const args = call[0] as { where: { agency_id: { equals: string } } }
      expect(args.where.agency_id.equals).toBe('finance')
    }
  })
})

// ── String assembly ──────────────────────────────────────────────────────

describe('getBrandVoiceContext — string assembly', () => {
  it('Test 4: empty docs → returns empty string (no labels, no errors)', async () => {
    const payload = makePayload([
      { collection: 'brand_voice', docs: [] },
      { collection: 'brand_glossary', docs: [] },
    ])
    const result = await getBrandVoiceContext('finance', payload as unknown as Parameters<typeof getBrandVoiceContext>[1])
    expect(result).toBe('')
  })

  it('Test 5: voice fields produce TONE / STYLE / AUDIENCE / FORMALITY lines', async () => {
    const payload = makePayload([
      { collection: 'brand_voice', docs: [{
        tone_description:    'Confident and direct',
        writing_style_notes: 'Active voice, short sentences',
        target_audience:     'Mid-market CFOs',
        formality_level:     'Professional',
      }] },
      { collection: 'brand_glossary', docs: [] },
    ])

    const result = await getBrandVoiceContext('finance', payload as unknown as Parameters<typeof getBrandVoiceContext>[1])

    expect(result).toContain('TONE: Confident and direct')
    expect(result).toContain('STYLE: Active voice, short sentences')
    expect(result).toContain('AUDIENCE: Mid-market CFOs')
    expect(result).toContain('FORMALITY: Professional')
  })

  it('Test 6: voice example paragraphs produce GOOD EXAMPLE / AVOID PATTERN sections', async () => {
    const payload = makePayload([
      { collection: 'brand_voice', docs: [{
        example_good_paragraph: 'We help CFOs ship faster.',
        example_bad_paragraph:  'In today\'s fast-paced world...',
      }] },
      { collection: 'brand_glossary', docs: [] },
    ])

    const result = await getBrandVoiceContext('finance', payload as unknown as Parameters<typeof getBrandVoiceContext>[1])

    expect(result).toContain('GOOD EXAMPLE:\nWe help CFOs ship faster.')
    expect(result).toContain('AVOID PATTERN:\nIn today\'s fast-paced world...')
  })

  it('Test 7: missing voice fields are silently skipped (no "undefined" leak)', async () => {
    const payload = makePayload([
      { collection: 'brand_voice', docs: [{
        tone_description: 'Direct',
        // other fields omitted
      }] },
      { collection: 'brand_glossary', docs: [] },
    ])
    const result = await getBrandVoiceContext('finance', payload as unknown as Parameters<typeof getBrandVoiceContext>[1])
    expect(result).toBe('TONE: Direct')
    expect(result).not.toContain('undefined')
  })

  it('Test 8: glossary items render with preferred usage + avoid phrases', async () => {
    const payload = makePayload([
      { collection: 'brand_voice', docs: [] },
      { collection: 'brand_glossary', docs: [{
        term:             'CFO services',
        preferred_usage:  'fractional CFO advisory',
        avoid_phrases:    [{ phrase: 'outsourced finance' }, { phrase: 'rent-a-CFO' }],
      }] },
    ])

    const result = await getBrandVoiceContext('finance', payload as unknown as Parameters<typeof getBrandVoiceContext>[1])

    expect(result).toContain('GLOSSARY')
    expect(result).toContain('CFO services: fractional CFO advisory')
    expect(result).toContain('NEVER use: outsourced finance, rent-a-CFO')
  })

  it('Test 9: glossary item with no avoid_phrases skips the "NEVER use" suffix', async () => {
    const payload = makePayload([
      { collection: 'brand_voice', docs: [] },
      { collection: 'brand_glossary', docs: [{
        term:            'CFO services',
        preferred_usage: 'fractional CFO advisory',
        // no avoid_phrases
      }] },
    ])
    const result = await getBrandVoiceContext('finance', payload as unknown as Parameters<typeof getBrandVoiceContext>[1])
    expect(result).toContain('CFO services: fractional CFO advisory')
    expect(result).not.toContain('NEVER use:')
  })

  it('Test 10: voice + glossary combine in a single string with newline separators', async () => {
    const payload = makePayload([
      { collection: 'brand_voice', docs: [{ tone_description: 'Confident' }] },
      { collection: 'brand_glossary', docs: [{
        term:            'tax advisory',
        preferred_usage: 'tax planning',
      }] },
    ])

    const result = await getBrandVoiceContext('finance', payload as unknown as Parameters<typeof getBrandVoiceContext>[1])
    const lines = result.split('\n')
    expect(lines[0]).toBe('TONE: Confident')
    expect(lines[1]).toBe('GLOSSARY (use preferred terms; never the avoid phrases):')
    expect(lines[2]).toContain('tax advisory: tax planning')
  })
})

// ── Error resilience ─────────────────────────────────────────────────────

describe('getBrandVoiceContext — error resilience', () => {
  it('Test 11: payload.find rejection → returns empty string (NOT thrown)', async () => {
    const payload: MockPayload = {
      find: vi.fn(async () => {
        throw new Error('database connection refused')
      }),
    }
    const result = await getBrandVoiceContext('finance', payload as unknown as Parameters<typeof getBrandVoiceContext>[1])
    expect(result).toBe('')
  })

  it('Test 12: only ONE collection failing still degrades to empty (Promise.all is all-or-nothing)', async () => {
    const payload: MockPayload = {
      find: vi.fn(async (args: { collection: string }) => {
        if (args.collection === 'brand_glossary') throw new Error('table missing')
        return { docs: [{ tone_description: 'Direct' }] }
      }),
    }
    const result = await getBrandVoiceContext('finance', payload as unknown as Parameters<typeof getBrandVoiceContext>[1])
    // Promise.all rejects on any reject — the catch returns '' so the AI
    // editor stays functional with no brand voice rather than crashing.
    expect(result).toBe('')
  })

  it('Test 13: error path logs a warning with the agency id and message', async () => {
    const payload: MockPayload = {
      find: vi.fn(async () => {
        throw new Error('boom')
      }),
    }
    await getBrandVoiceContext('finance', payload as unknown as Parameters<typeof getBrandVoiceContext>[1])

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/finance.*boom/),
    )
  })
})
