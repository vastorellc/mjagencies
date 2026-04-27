import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock ioredis so config-cache tests do not require a live Redis instance
vi.mock('ioredis', () => {
  const mockGet = vi.fn().mockResolvedValue(null)
  const mockSet = vi.fn().mockResolvedValue('OK')
  const mockDel = vi.fn().mockResolvedValue(1)
  const mockQuit = vi.fn().mockResolvedValue('OK')
  const Redis = vi.fn().mockImplementation(() => ({
    get: mockGet,
    set: mockSet,
    del: mockDel,
    quit: mockQuit,
  }))
  return { Redis, default: Redis, __mockGet: mockGet }
})

import { parseLexicalJson } from '../lexical-parser.js'
import { PLUGIN_DEFAULTS } from '../plugin-defaults.js'
import { getAgencySeoConfig } from '../config-cache.js'
import { runPluginEngine } from '../engine.js'

// ---------------------------------------------------------------------------
// parseLexicalJson
// ---------------------------------------------------------------------------
describe('parseLexicalJson', () => {
  it('returns zero-value extracts for null input', () => {
    const result = parseLexicalJson(null)
    expect(result.plainText).toBe('')
    expect(result.wordCount).toBe(0)
    expect(result.headings).toEqual([])
    expect(result.internalLinks).toBe(0)
    expect(result.paragraphs).toEqual([])
  })

  it('extracts h1 heading from a heading node', () => {
    const raw = {
      root: {
        children: [
          { type: 'heading', tag: 'h1', children: [{ type: 'text', text: 'Hello' }] },
        ],
      },
    }
    const result = parseLexicalJson(raw)
    expect(result.headings).toEqual([{ tag: 'h1', text: 'Hello' }])
  })

  it('counts words in a paragraph text node', () => {
    const raw = {
      root: {
        children: [
          { type: 'paragraph', children: [{ type: 'text', text: 'foo bar' }] },
        ],
      },
    }
    const result = parseLexicalJson(raw)
    expect(result.wordCount).toBe(2)
  })

  it('increments internalLinks for a link node with url starting with /', () => {
    const raw = {
      root: {
        children: [
          {
            type: 'link',
            url: '/about',
            children: [{ type: 'text', text: 'About' }],
          },
        ],
      },
    }
    const result = parseLexicalJson(raw)
    expect(result.internalLinks).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// PLUGIN_DEFAULTS
// ---------------------------------------------------------------------------
describe('PLUGIN_DEFAULTS', () => {
  it('seo_classic.titleMinChars is 40', () => {
    expect(PLUGIN_DEFAULTS.seo_classic.titleMinChars).toBe(40)
  })

  it('score_thresholds.seoClassic is 70', () => {
    expect(PLUGIN_DEFAULTS.score_thresholds.seoClassic).toBe(70)
  })
})

// ---------------------------------------------------------------------------
// getAgencySeoConfig — merge-patch behaviour (REQ-072)
// ---------------------------------------------------------------------------
describe('getAgencySeoConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns PLUGIN_DEFAULTS when Redis returns null (cache miss)', async () => {
    // ioredis mock returns null by default (configured above)
    const config = await getAgencySeoConfig('agency-123')
    expect(config.seo_classic.titleMinChars).toBe(PLUGIN_DEFAULTS.seo_classic.titleMinChars)
    expect(config.score_thresholds.seoClassic).toBe(PLUGIN_DEFAULTS.score_thresholds.seoClassic)
  })

  it('merges agency override keys over defaults without clobbering unoverridden defaults', async () => {
    // Re-mock ioredis for this test to return a partial override
    const { Redis } = await import('ioredis') as unknown as { Redis: ReturnType<typeof vi.fn> }
    // Create a new mock instance that returns override data
    const mockInstance = {
      get: vi.fn().mockResolvedValueOnce(
        JSON.stringify({ seo_classic: { titleMinChars: 50 } }),
      ),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      quit: vi.fn().mockResolvedValue('OK'),
    }
    ;(Redis as ReturnType<typeof vi.fn>).mockImplementationOnce(() => mockInstance)

    const config = await getAgencySeoConfig('agency-456')
    // The override takes effect
    expect(config.seo_classic.titleMinChars).toBe(50)
    // Unoverridden defaults are preserved
    expect(config.score_thresholds.seoClassic).toBe(PLUGIN_DEFAULTS.score_thresholds.seoClassic)
  })
})

// ---------------------------------------------------------------------------
// runPluginEngine — registry behaviour (REQ-071)
// ---------------------------------------------------------------------------
describe('runPluginEngine', () => {
  it('returns zero scores when no plugins are registered', async () => {
    const output = await runPluginEngine({
      lexicalRaw: null,
      agencyId: 'agency-test',
    })
    expect(output.seoClassicScore).toBe(0)
    expect(output.aioCitationsScore).toBe(0)
    expect(output.geoChunkingScore).toBe(0)
    expect(output.aggregateScore).toBe(0)
  })
})
