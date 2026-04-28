/**
 * packages/analytics/src/dashboard/__tests__/get-postgres-aggregates.test.ts
 *
 * Verifies the Postgres aggregate helpers route through withAgencyContext so
 * RLS (app.agency_id) is set transaction-locally for every read (Pitfall 8.1
 * regression guard) and that result-shape parsing handles empty results.
 *
 * The withAgencyContext helper is mocked at module boundary so we can inspect
 * the SQL text emitted to drizzle and verify it references the right tables
 * and predicates without running a real Postgres.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgencyDbContext } from '../get-rum-percentiles.js'

// Module-level mock state — the @mjagency/db mock writes to it on each call.
let lastQueriedSql = ''
let mockRows: Array<Record<string, unknown>> = []
const queueOfRows: Array<Array<Record<string, unknown>>> = []

vi.mock('@mjagency/db', () => ({
  withAgencyContext: vi.fn(
    async <T,>(
      _db: unknown,
      _agencyId: string,
      cb: (tx: { execute: (q: unknown) => Promise<{ rows: Array<Record<string, unknown>> }> }) => Promise<T>,
    ): Promise<T> => {
      // Capture the SQL text via Drizzle's `sql` template tag .queryChunks-like
      // structure. The simplest robust approach: stringify each tagged-template
      // chunk and concatenate.
      return cb({
        execute: async (q: unknown) => {
          lastQueriedSql = stringifyDrizzleSql(q)
          const rows = queueOfRows.length > 0 ? (queueOfRows.shift() ?? mockRows) : mockRows
          return { rows }
        },
      })
    },
  ),
}))

function stringifyDrizzleSql(q: unknown): string {
  // Drizzle SQL objects expose a `queryChunks` array. Walk it and concat string
  // chunks; param chunks are ignored (we only care about SQL text matching).
  if (q && typeof q === 'object' && 'queryChunks' in q) {
    const chunks = (q as { queryChunks?: unknown[] }).queryChunks ?? []
    return chunks
      .map((c) => {
        if (typeof c === 'string') return c
        if (c && typeof c === 'object' && 'value' in c && Array.isArray((c as { value: unknown[] }).value)) {
          return (c as { value: unknown[] }).value.join('')
        }
        return ''
      })
      .join('')
  }
  return String(q)
}

import {
  getLeadsCount,
  getOpenPipelineValue,
  getOpenPipelineCount,
  getRevenueMtd,
  getLeadsTrendWoW,
} from '../get-postgres-aggregates.js'

const FAKE_CTX: AgencyDbContext = {
  db: {} as never,
  agencyId: '00000000-0000-0000-0000-000000000001',
}

beforeEach(() => {
  lastQueriedSql = ''
  mockRows = []
  queueOfRows.length = 0
})

describe('Postgres aggregates — agency-scoped via withAgencyContext', () => {
  it('getLeadsCount returns count from crm_contacts', async () => {
    mockRows = [{ c: 42 }]
    const count = await getLeadsCount(FAKE_CTX, 7)
    expect(count).toBe(42)
    expect(lastQueriedSql).toContain('crm_contacts')
  })

  it('getLeadsCount returns 0 on empty result', async () => {
    mockRows = []
    const count = await getLeadsCount(FAKE_CTX, 7)
    expect(count).toBe(0)
  })

  it('getOpenPipelineValue queries crm_deals excluding won/lost stages', async () => {
    mockRows = [{ s: 12500.5 }]
    const value = await getOpenPipelineValue(FAKE_CTX)
    expect(value).toBe(12500.5)
    expect(lastQueriedSql).toContain('crm_deals')
    expect(lastQueriedSql).toContain("'won','lost'")
  })

  it('getOpenPipelineValue returns 0 on empty result', async () => {
    mockRows = []
    const value = await getOpenPipelineValue(FAKE_CTX)
    expect(value).toBe(0)
  })

  it('getOpenPipelineCount excludes won/lost stages', async () => {
    mockRows = [{ c: 7 }]
    const count = await getOpenPipelineCount(FAKE_CTX)
    expect(count).toBe(7)
    expect(lastQueriedSql).toContain("'won','lost'")
  })

  it('getRevenueMtd queries paid invoices since start of month', async () => {
    mockRows = [{ amount: 50000, cnt: 3 }]
    const result = await getRevenueMtd(FAKE_CTX)
    expect(result).toEqual({ amount: 50000, invoiceCount: 3 })
    expect(lastQueriedSql).toContain('invoices')
    expect(lastQueriedSql).toContain("'paid'")
    expect(lastQueriedSql).toContain("date_trunc('month'")
  })

  it('getRevenueMtd returns zeros on empty result', async () => {
    mockRows = []
    const result = await getRevenueMtd(FAKE_CTX)
    expect(result).toEqual({ amount: 0, invoiceCount: 0 })
  })

  it('getLeadsTrendWoW returns 100 when prior week is empty and this week has leads', async () => {
    queueOfRows.push([{ c: 5 }]) // this week
    queueOfRows.push([{ c: 0 }]) // prior week
    const trend = await getLeadsTrendWoW(FAKE_CTX)
    expect(trend).toBe(100)
  })

  it('getLeadsTrendWoW returns 0 when both weeks are empty', async () => {
    queueOfRows.push([{ c: 0 }])
    queueOfRows.push([{ c: 0 }])
    const trend = await getLeadsTrendWoW(FAKE_CTX)
    expect(trend).toBe(0)
  })

  it('getLeadsTrendWoW returns positive percent for growth', async () => {
    queueOfRows.push([{ c: 12 }]) // this week
    queueOfRows.push([{ c: 10 }]) // prior week
    const trend = await getLeadsTrendWoW(FAKE_CTX)
    expect(trend).toBe(20) // (12-10)/10 = 20%
  })
})
