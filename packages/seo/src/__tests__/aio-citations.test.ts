/**
 * packages/seo/src/__tests__/aio-citations.test.ts
 *
 * Unit tests for the aio-citations scoring plugin (REQ-070).
 * Tests stat detection, citation link adjacency check, and 0–100 score.
 */
import { describe, it, expect } from 'vitest'
import { scoreAioCitations } from '../plugins/aio-citations.js'
import type { AioCitationsConfig } from '../plugins/aio-citations.js'
import type { LexicalExtracts } from '../lexical-parser.js'

const DEFAULT_CONFIG: AioCitationsConfig = {
  requiredSourceTypes: ['government', 'academic', 'news'],
  maxCitationAgeMonths: 24,
  blockPublishOnUnsourcedStat: false,
}

function makeExtracts(paragraphs: string[]): LexicalExtracts {
  return {
    plainText: paragraphs.join(' '),
    wordCount: paragraphs.join(' ').split(/\s+/).filter(Boolean).length,
    headings: [],
    internalLinks: 0,
    paragraphs,
  }
}

// ---------------------------------------------------------------------------
// scoreAioCitations
// ---------------------------------------------------------------------------

describe('scoreAioCitations', () => {
  it('returns score=100 and unsourcedStatCount=0 when paragraphs are empty', () => {
    const result = scoreAioCitations(makeExtracts([]), null, DEFAULT_CONFIG)
    expect(result.score).toBe(100)
    expect(result.unsourcedStatCount).toBe(0)
    expect(result.totalStatCount).toBe(0)
  })

  it('returns score=100 when paragraphs have no stat-like sentences', () => {
    const result = scoreAioCitations(
      makeExtracts(['This is a general statement about marketing without any numbers.']),
      null,
      DEFAULT_CONFIG
    )
    expect(result.score).toBe(100)
    expect(result.unsourcedStatCount).toBe(0)
  })

  it('detects unsourced stat: "According to research, 42% of users" with no adjacent link → score < 100', () => {
    const result = scoreAioCitations(
      makeExtracts(['According to research, 42% of users abandon mobile sites that take longer than three seconds to load.']),
      null,
      DEFAULT_CONFIG
    )
    expect(result.unsourcedStatCount).toBeGreaterThanOrEqual(1)
    expect(result.score).toBeLessThan(100)
  })

  it('stat with lexicalRaw containing adjacent "url":"https://source.com" → hasAdjacentLink=true → score=100', () => {
    const stat = 'According to research, 42% of users prefer mobile sites'
    // Build a lexical-like JSON that puts a URL near the stat text
    const lexicalRaw = {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: stat },
              { type: 'link', url: 'https://source.com', children: [{ type: 'text', text: 'source' }] },
            ],
          },
        ],
      },
    }
    const result = scoreAioCitations(
      makeExtracts([stat]),
      lexicalRaw,
      DEFAULT_CONFIG
    )
    expect(result.score).toBe(100)
    expect(result.unsourcedStatCount).toBe(0)
  })

  it('2 total stats, 1 unsourced → score = 50', () => {
    const stat1 = 'According to research, 42% of users prefer mobile sites that load quickly'
    const stat2 = 'Studies show that 3 out of 4 consumers trust online reviews as much as personal recommendations'
    // The adjacency algorithm checks a window of ~400 chars (100 before + 300 after the stat snippet).
    // To reliably have only stat2 sourced (with a link), we must place the link at least 300+ chars
    // AFTER stat1's position in the JSON so it falls outside stat1's window but inside stat2's window.
    // We achieve this by placing a large padding text node between the two paragraphs.
    const padding = 'x'.repeat(400) // 400 chars of filler to push stat2's link beyond stat1's window
    const lexicalRaw = {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: stat1 }],
          },
          {
            // Padding paragraph to push stat2's link out of stat1's detection window
            type: 'paragraph',
            children: [{ type: 'text', text: padding }],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: stat2 },
              { type: 'link', url: 'https://brightlocal.com/survey', children: [{ type: 'text', text: 'BrightLocal' }] },
            ],
          },
        ],
      },
    }
    const result = scoreAioCitations(
      makeExtracts([stat1, stat2]),
      lexicalRaw,
      DEFAULT_CONFIG
    )
    expect(result.totalStatCount).toBe(2)
    expect(result.unsourcedStatCount).toBe(1)
    expect(result.score).toBe(50)
  })

  it('3 total stats, 0 unsourced → score = 100', () => {
    const stats = [
      'According to research, 42% of users prefer mobile sites that load quickly enough',
      'Studies show that 3 out of 4 consumers trust online reviews as much as personal ones',
      'Revenue increased by $1,200 per month on average for clients who adopted the strategy',
    ]
    // Put all stats near URLs in the lexical raw
    const lexicalRaw = {
      root: {
        children: stats.map(text => ({
          type: 'paragraph',
          children: [
            { type: 'text', text },
            { type: 'link', url: 'https://source.example.com/study', children: [{ type: 'text', text: 'source' }] },
          ],
        })),
      },
    }
    const result = scoreAioCitations(makeExtracts(stats), lexicalRaw, DEFAULT_CONFIG)
    expect(result.totalStatCount).toBe(3)
    expect(result.unsourcedStatCount).toBe(0)
    expect(result.score).toBe(100)
  })

  it('blockPublishOnUnsourcedStat:true config flag does NOT affect the score', () => {
    const config: AioCitationsConfig = { ...DEFAULT_CONFIG, blockPublishOnUnsourcedStat: true }
    const result = scoreAioCitations(
      makeExtracts(['According to research, 42% of users abandon slow mobile sites due to performance.']),
      null,
      config
    )
    // Score is still computed normally; blockPublishOnUnsourcedStat only affects publish hook
    expect(result.score).toBeLessThan(100)
    expect(typeof result.score).toBe('number')
  })

  it('findings array contains one entry per detected stat sentence', () => {
    const result = scoreAioCitations(
      makeExtracts(['According to research, 42% of users abandon slow mobile sites due to performance issues.']),
      null,
      DEFAULT_CONFIG
    )
    expect(result.findings.length).toBe(result.totalStatCount)
    if (result.findings.length > 0) {
      expect(result.findings[0]).toHaveProperty('rule')
      expect(result.findings[0]).toHaveProperty('passed')
      expect(result.findings[0]).toHaveProperty('detail')
    }
  })
})
