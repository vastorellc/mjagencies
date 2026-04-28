/**
 * packages/analytics/src/ga4-data-api.ts
 * REQ-140 + REQ-143 dashboard reads.
 *
 * Pitfall 1.3 mitigation: 5-min Redis cache to stay under 25K tokens/day GA4 quota.
 * Cache key: agency:<agencyId>:dashboard:ga4:<sha256-prefix-16> (per-agency isolation).
 *
 * Used by: Plan 11-04 dashboard sessions card + top pages table.
 *
 * Per-agency env vars (server-only — getAgencySecret throws if missing):
 *   GA4_PROPERTY_ID_${SLUG_UPPER}                       (numeric property id)
 *   GOOGLE_APPLICATION_CREDENTIALS_PATH_${SLUG_UPPER}   (service-account JSON path)
 */
import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { getAgencySecret } from '@mjagency/config'
import { createHash } from 'node:crypto'
import Redis from 'ioredis'

export interface GA4ReportRequest {
  agencyId: string
  dateRanges: Array<{ startDate: string; endDate: string }>
  dimensions?: Array<{ name: string }>
  metrics: Array<{ name: string }>
  limit?: number
  orderBys?: unknown[]
}

export interface GA4ReportRow {
  dimensionValues: Array<{ value: string }>
  metricValues: Array<{ value: string }>
}

const CACHE_TTL_SEC = 300 // Pitfall 1.3 — 5 minute cache per (agency, request hash)

let _redis: Redis | null = null
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    })
  }
  return _redis
}

/** Test-only: inject a mock Redis client. */
export function __setRedisForTest(client: Redis | null): void {
  _redis = client
}

function cacheKey(agencyId: string, request: GA4ReportRequest): string {
  // Hash a deterministic JSON of the request so identical requests collide on cache.
  // Strip agencyId from the hashed payload (it's already in the namespace prefix).
  const { agencyId: _omit, ...rest } = request
  void _omit
  const hash = createHash('sha256').update(JSON.stringify(rest)).digest('hex').slice(0, 16)
  return `agency:${agencyId}:dashboard:ga4:${hash}`
}

const _clientByAgency = new Map<string, BetaAnalyticsDataClient>()
function getClient(agencyId: string): BetaAnalyticsDataClient {
  let client = _clientByAgency.get(agencyId)
  if (!client) {
    const keyFile = getAgencySecret('GOOGLE_APPLICATION_CREDENTIALS_PATH', agencyId)
    client = new BetaAnalyticsDataClient({ keyFilename: keyFile })
    _clientByAgency.set(agencyId, client)
  }
  return client
}

/** Test-only: inject a mock GA4 Data client. */
export function __setClientForTest(agencyId: string, client: BetaAnalyticsDataClient | null): void {
  if (client === null) {
    _clientByAgency.delete(agencyId)
  } else {
    _clientByAgency.set(agencyId, client)
  }
}

/**
 * Runs a GA4 Data API report with 5-minute Redis cache.
 *
 * @throws Error if GA4_PROPERTY_ID_<SLUG> or GOOGLE_APPLICATION_CREDENTIALS_PATH_<SLUG> missing
 * @throws Error from BetaAnalyticsDataClient on quota / auth failure
 */
export async function runReport(request: GA4ReportRequest): Promise<GA4ReportRow[]> {
  const redis = getRedis()
  const key = cacheKey(request.agencyId, request)
  const cached = await redis.get(key)
  if (cached) return JSON.parse(cached) as GA4ReportRow[]

  const propertyId = getAgencySecret('GA4_PROPERTY_ID', request.agencyId)
  const client = getClient(request.agencyId)
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: request.dateRanges,
    dimensions: request.dimensions,
    metrics: request.metrics,
    limit: request.limit,
    orderBys: request.orderBys as never,
  })

  const rows: GA4ReportRow[] = (response.rows ?? []).map((r) => ({
    dimensionValues: (r.dimensionValues ?? []).map((d) => ({ value: d.value ?? '' })),
    metricValues: (r.metricValues ?? []).map((m) => ({ value: m.value ?? '' })),
  }))

  await redis.setex(key, CACHE_TTL_SEC, JSON.stringify(rows))
  return rows
}
