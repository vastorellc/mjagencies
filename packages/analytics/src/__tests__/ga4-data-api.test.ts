/**
 * packages/analytics/src/__tests__/ga4-data-api.test.ts
 * Pitfall 1.3 — 5-minute Redis cache mitigates GA4 25K tokens/day quota.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runReport, __setRedisForTest, __setClientForTest } from '../ga4-data-api.js'

interface MockRedis {
  get: ReturnType<typeof vi.fn>
  setex: ReturnType<typeof vi.fn>
}

interface MockClient {
  runReport: ReturnType<typeof vi.fn>
}

function makeMockRedis(): MockRedis {
  return {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
  }
}

function makeMockClient(rows: Array<{ d: string[]; m: string[] }>): MockClient {
  return {
    runReport: vi.fn().mockResolvedValue([
      {
        rows: rows.map((r) => ({
          dimensionValues: r.d.map((value) => ({ value })),
          metricValues: r.m.map((value) => ({ value })),
        })),
      },
    ]),
  }
}

describe('runReport (GA4 Data API + Redis cache)', () => {
  beforeEach(() => {
    process.env['GOOGLE_APPLICATION_CREDENTIALS_PATH_WEB_ECOMMERCE'] = '/tmp/sa.json'
    process.env['GA4_PROPERTY_ID_WEB_ECOMMERCE'] = '999111'
  })

  afterEach(() => {
    delete process.env['GOOGLE_APPLICATION_CREDENTIALS_PATH_WEB_ECOMMERCE']
    delete process.env['GA4_PROPERTY_ID_WEB_ECOMMERCE']
    __setRedisForTest(null)
    __setClientForTest('web-ecommerce', null)
  })

  it('returns cached rows on cache hit (Pitfall 1.3 — no GA4 call)', async () => {
    const cached = [
      { dimensionValues: [{ value: '/' }], metricValues: [{ value: '500' }] },
    ]
    const redis = makeMockRedis()
    redis.get.mockResolvedValueOnce(JSON.stringify(cached))
    __setRedisForTest(redis as never)
    const client = makeMockClient([])
    __setClientForTest('web-ecommerce', client as never)

    const result = await runReport({
      agencyId: 'web-ecommerce',
      dateRanges: [{ startDate: '2026-04-01', endDate: '2026-04-28' }],
      metrics: [{ name: 'sessions' }],
    })

    expect(result).toEqual(cached)
    expect(client.runReport).not.toHaveBeenCalled()
    expect(redis.setex).not.toHaveBeenCalled()
  })

  it('falls back to BetaAnalyticsDataClient.runReport on cache miss', async () => {
    const redis = makeMockRedis()
    __setRedisForTest(redis as never)
    const client = makeMockClient([{ d: ['/home'], m: ['1234'] }])
    __setClientForTest('web-ecommerce', client as never)

    const result = await runReport({
      agencyId: 'web-ecommerce',
      dateRanges: [{ startDate: '2026-04-01', endDate: '2026-04-28' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'sessions' }],
    })

    expect(client.runReport).toHaveBeenCalledWith(
      expect.objectContaining({ property: 'properties/999111' }),
    )
    expect(result).toEqual([
      { dimensionValues: [{ value: '/home' }], metricValues: [{ value: '1234' }] },
    ])
  })

  it('writes setex with 300 TTL after fresh fetch (Pitfall 1.3)', async () => {
    const redis = makeMockRedis()
    __setRedisForTest(redis as never)
    const client = makeMockClient([{ d: ['/home'], m: ['1234'] }])
    __setClientForTest('web-ecommerce', client as never)

    await runReport({
      agencyId: 'web-ecommerce',
      dateRanges: [{ startDate: '2026-04-01', endDate: '2026-04-28' }],
      metrics: [{ name: 'sessions' }],
    })

    expect(redis.setex).toHaveBeenCalledWith(
      expect.stringMatching(/^agency:web-ecommerce:dashboard:ga4:[a-f0-9]{16}$/),
      300,
      expect.any(String),
    )
  })

  it('cache key includes agencyId namespace (per-agency isolation)', async () => {
    const redis = makeMockRedis()
    __setRedisForTest(redis as never)
    const client = makeMockClient([])
    __setClientForTest('web-ecommerce', client as never)

    await runReport({
      agencyId: 'web-ecommerce',
      dateRanges: [{ startDate: '2026-04-01', endDate: '2026-04-28' }],
      metrics: [{ name: 'sessions' }],
    })

    expect(redis.get).toHaveBeenCalledWith(
      expect.stringMatching(/^agency:web-ecommerce:dashboard:ga4:/),
    )
  })

  it('throws when GA4_PROPERTY_ID_<SLUG> missing', async () => {
    delete process.env['GA4_PROPERTY_ID_WEB_ECOMMERCE']
    const redis = makeMockRedis()
    __setRedisForTest(redis as never)
    const client = makeMockClient([])
    __setClientForTest('web-ecommerce', client as never)

    await expect(
      runReport({
        agencyId: 'web-ecommerce',
        dateRanges: [{ startDate: '2026-04-01', endDate: '2026-04-28' }],
        metrics: [{ name: 'sessions' }],
      }),
    ).rejects.toThrow(/Missing env var: GA4_PROPERTY_ID_WEB_ECOMMERCE/)
  })
})
