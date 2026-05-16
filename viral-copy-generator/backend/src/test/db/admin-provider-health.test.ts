import { describe, test, expect, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { admin_provider_health } from '../../db/schema.js'
import { createTestDb } from '../../../tests/_helpers.js'

// Integration tests for the admin_provider_health Drizzle table (VERIFY-05 prerequisite).
// All tests run in-process against pg-mem (PatchedPool) — no real DB connection required.

describe('admin_provider_health Drizzle table (VERIFY-05 prerequisite)', () => {
  let db: Awaited<ReturnType<typeof createTestDb>>['db']

  beforeEach(async () => {
    ;({ db } = await createTestDb())
    // pg-mem does not run drizzle-kit migrations — bootstrap the table via raw SQL.
    // Keep in sync with backend/drizzle/migrations/ CREATE TABLE for admin_provider_health.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_provider_health (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider TEXT NOT NULL,
        model_id TEXT NOT NULL,
        status TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        error_message TEXT,
        checked_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
  })

  test('insert with all columns succeeds and row is retrievable', async () => {
    await db.insert(admin_provider_health).values({
      provider: 'openai',
      model_id: 'gpt-5.5',
      status: 'ok',
      latency_ms: 123,
      error_message: null,
    })
    const rows = await db.select().from(admin_provider_health)
    expect(rows).toHaveLength(1)
    expect(rows[0].provider).toBe('openai')
    expect(rows[0].model_id).toBe('gpt-5.5')
    expect(rows[0].status).toBe('ok')
    expect(rows[0].latency_ms).toBe(123)
  })

  test('id auto-generates as UUID (matches UUID v4 format)', async () => {
    await db.insert(admin_provider_health).values({
      provider: 'claude',
      model_id: 'claude-sonnet-4-6',
      status: 'ok',
      latency_ms: 50,
    })
    const rows = await db.select().from(admin_provider_health)
    expect(rows[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  test('checked_at defaults to NOW() (within ±5 s of insert time)', async () => {
    const before = Date.now()
    await db.insert(admin_provider_health).values({
      provider: 'gemini',
      model_id: 'gemini-3.1-pro-preview',
      status: 'ok',
      latency_ms: 200,
    })
    const after = Date.now()
    const rows = await db.select().from(admin_provider_health)
    const ts = new Date(rows[0].checked_at).getTime()
    expect(ts).toBeGreaterThanOrEqual(before - 5000)
    expect(ts).toBeLessThanOrEqual(after + 5000)
  })

  test('error_message is null when status=ok', async () => {
    await db.insert(admin_provider_health).values({
      provider: 'deepseek',
      model_id: 'deepseek-v4-flash',
      status: 'ok',
      latency_ms: 10,
      error_message: null,
    })
    const rows = await db.select().from(admin_provider_health)
    expect(rows[0].error_message).toBeNull()
  })

  test('error_message stores string when status=model_not_found', async () => {
    await db.insert(admin_provider_health).values({
      provider: 'deepseek',
      model_id: 'deepseek-v4-pro',
      status: 'model_not_found',
      latency_ms: 0,
      error_message: 'Model not found: bad-id',
    })
    const rows = await db.select().from(admin_provider_health)
    expect(rows[0].error_message).toBe('Model not found: bad-id')
  })

  test('bulk insert of 8 models in one call succeeds (all 4 providers)', async () => {
    const values = [
      { provider: 'openai',   model_id: 'gpt-5.5',                status: 'ok', latency_ms: 100 },
      { provider: 'openai',   model_id: 'gpt-5.5-pro',            status: 'ok', latency_ms: 110 },
      { provider: 'claude',   model_id: 'claude-opus-4-7',        status: 'ok', latency_ms: 120 },
      { provider: 'claude',   model_id: 'claude-sonnet-4-6',      status: 'ok', latency_ms: 90  },
      { provider: 'gemini',   model_id: 'gemini-3.1-pro-preview', status: 'ok', latency_ms: 200 },
      { provider: 'gemini',   model_id: 'gemini-3.1-flash-lite',  status: 'ok', latency_ms: 80  },
      { provider: 'deepseek', model_id: 'deepseek-v4-pro',        status: 'ok', latency_ms: 60  },
      { provider: 'deepseek', model_id: 'deepseek-v4-flash',      status: 'ok', latency_ms: 50  },
    ] as const
    await db.insert(admin_provider_health).values([...values])
    const rows = await db.select().from(admin_provider_health)
    expect(rows).toHaveLength(8)
  })

  test('SELECT DISTINCT ON (provider, model_id) returns latest row per pair', async () => {
    // Three rows for the same (provider, model) at different timestamps.
    // DISTINCT ON with ORDER BY checked_at DESC should return the most recent one (latency_ms=120).
    await db.insert(admin_provider_health).values({
      provider: 'openai', model_id: 'gpt-5.5', status: 'ok', latency_ms: 100,
      checked_at: new Date('2026-05-01T00:00:00Z'),
    })
    await db.insert(admin_provider_health).values({
      provider: 'openai', model_id: 'gpt-5.5', status: 'ok', latency_ms: 110,
      checked_at: new Date('2026-05-08T00:00:00Z'),
    })
    await db.insert(admin_provider_health).values({
      provider: 'openai', model_id: 'gpt-5.5', status: 'ok', latency_ms: 120,
      checked_at: new Date('2026-05-15T00:00:00Z'),
    })

    // Use the same DISTINCT ON query that the admin Health tab route will use.
    const result = await db.execute(sql`
      SELECT DISTINCT ON (provider, model_id)
        provider, model_id, latency_ms, checked_at
      FROM admin_provider_health
      ORDER BY provider, model_id, checked_at DESC
    `)

    // pg-mem returns rows in different shapes depending on query mode; normalise both.
    const rows = (result as unknown as { rows?: unknown[] }).rows ?? (result as unknown[])
    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toHaveLength(1)
    // The latest row should be returned (latency_ms=120)
    const row = rows[0] as Record<string, unknown>
    expect(Number(row.latency_ms)).toBe(120)
  })
})
