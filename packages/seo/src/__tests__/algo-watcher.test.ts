import { describe, it, expect, vi } from 'vitest'
import type { AlgoAlert } from '../algo-watcher/rss.js'

// ---------------------------------------------------------------------------
// Minimal in-memory Redis mock — covers sismember, sadd, expire, pipeline
// ---------------------------------------------------------------------------
function makeRedisMock(seenGuids: Set<string> = new Set()) {
  const seen = seenGuids
  const pipeline = () => ({
    sadd: (_key: string, value: string) => { seen.add(value); return pipeline() },
    expire: () => pipeline(),
    exec: vi.fn().mockResolvedValue([]),
  })
  return {
    sismember: vi.fn(async (_key: string, value: string) => (seen.has(value) ? 1 : 0)),
    sadd: vi.fn(async (_key: string, value: string) => { seen.add(value); return 1 }),
    expire: vi.fn().mockResolvedValue(1),
    pipeline: vi.fn(() => pipeline()),
  }
}

// ---------------------------------------------------------------------------
// Mock rss-parser so tests do not make outbound HTTP calls
// ---------------------------------------------------------------------------
vi.mock('rss-parser', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      parseURL: vi.fn(),
    })),
  }
})

import Parser from 'rss-parser'
import { processRssFeed } from '../algo-watcher/rss.js'

const KEYWORDS = ['core update', 'helpful content', 'ranking']

function makeItem(overrides: Partial<{ guid: string; title: string; link: string; contentSnippet: string; isoDate: string }> = {}) {
  return {
    guid: 'guid-001',
    title: 'Test Item',
    link: 'https://example.com/item',
    contentSnippet: 'Some snippet text',
    isoDate: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Test: known GUID is skipped, no AlgoAlert returned
// ---------------------------------------------------------------------------
describe('processRssFeed — GUID deduplication', () => {
  it('skips item whose GUID is already in the seen set and returns no alert', async () => {
    const seenGuids = new Set(['guid-already-seen'])
    const redis = makeRedisMock(seenGuids)

    ;(Parser as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      parseURL: vi.fn().mockResolvedValue({
        items: [makeItem({ guid: 'guid-already-seen', title: 'core update article' })],
      }),
    }))

    const alerts = await processRssFeed(
      'https://fake-feed.example.com/rss.xml',
      'google_search_central',
      KEYWORDS,
      redis as unknown as import('ioredis').Redis,
    )

    expect(alerts).toHaveLength(0)
    // sismember was called and returned 1 (seen), so no SADD should have been attempted via pipeline
    expect(redis.sismember).toHaveBeenCalledWith('seo:algo-watcher:seen-guids', 'guid-already-seen')
  })
})

// ---------------------------------------------------------------------------
// Test: new GUID with keyword match produces AlgoAlert
// ---------------------------------------------------------------------------
describe('processRssFeed — keyword matching', () => {
  it('returns an AlgoAlert for a new GUID whose text matches a keyword', async () => {
    const redis = makeRedisMock()

    ;(Parser as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      parseURL: vi.fn().mockResolvedValue({
        items: [
          makeItem({
            guid: 'guid-new-match',
            title: 'Google announces core update rollout',
            contentSnippet: 'Details about the core update affecting rankings.',
          }),
        ],
      }),
    }))

    const alerts = await processRssFeed(
      'https://fake-feed.example.com/rss.xml',
      'google_search_central',
      KEYWORDS,
      redis as unknown as import('ioredis').Redis,
    )

    expect(alerts).toHaveLength(1)
    const alert = alerts[0] as AlgoAlert
    expect(alert.guid).toBe('guid-new-match')
    expect(alert.matchedKeywords).toContain('core update')
    expect(alert.source).toBe('google_search_central')
  })
})

// ---------------------------------------------------------------------------
// Test: new GUID without keyword match — added to seen set, no AlgoAlert
// ---------------------------------------------------------------------------
describe('processRssFeed — no keyword match', () => {
  it('adds GUID to seen set but returns no AlgoAlert when no keyword matches', async () => {
    const redis = makeRedisMock()
    const pipelineExecSpy = vi.fn().mockResolvedValue([])
    const pipelineObj = {
      sadd: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: pipelineExecSpy,
    }
    redis.pipeline = vi.fn(() => pipelineObj)

    ;(Parser as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      parseURL: vi.fn().mockResolvedValue({
        items: [
          makeItem({
            guid: 'guid-no-match',
            title: 'An unrelated blog post about TypeScript',
            contentSnippet: 'TypeScript tips and tricks.',
          }),
        ],
      }),
    }))

    const alerts = await processRssFeed(
      'https://fake-feed.example.com/rss.xml',
      'configurable_feed',
      KEYWORDS,
      redis as unknown as import('ioredis').Redis,
    )

    expect(alerts).toHaveLength(0)
    // Pipeline exec should have been called to mark GUID as seen even with no keyword match
    expect(pipelineExecSpy).toHaveBeenCalled()
  })
})
