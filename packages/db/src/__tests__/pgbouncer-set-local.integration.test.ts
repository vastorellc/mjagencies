/**
 * packages/db/src/__tests__/pgbouncer-set-local.integration.test.ts
 *
 * Integration tests proving that SET LOCAL (via set_config(..., true)) behaves
 * correctly under PgBouncer transaction-mode pooling:
 *
 *   1. SET LOCAL is reverted at transaction end — the setting does NOT leak after COMMIT
 *   2. Two sequential transactions on the same client see independent settings
 *   3. Concurrent transactions on the same pool do NOT cross-contaminate
 *
 * PITFALL 8.1 ENFORCEMENT: These tests validate the mechanism that prevents
 * cross-tenant data leakage through stale app.agency_id on PgBouncer-multiplexed
 * physical connections. See docs/runbooks/pgbouncer-rls.md for background.
 *
 * Skip conditions:
 *   All tests use it.skipIf(!process.env.INTEGRATION_DATABASE_URL).
 *   Without a live PgBouncer-fronted Postgres, all tests are skipped cleanly.
 *
 * Environment (integration mode):
 *   INTEGRATION_DATABASE_URL — connection string through PgBouncer for 'brand' agency
 *   INTEGRATION_BRAND_AGENCY_ID — UUID of the brand agency in the test DB
 *   INTEGRATION_ECOMMERCE_AGENCY_ID — UUID of the ecommerce agency in the test DB
 *
 * Reference: RESEARCH §1.3 (pitfall 8.1), packages/db/src/client.ts, pgbouncer-rls.md
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createAgencyDb, withAgencyContext } from '../client.js'
import { sql } from 'drizzle-orm'

const INTEGRATION_DB = process.env.INTEGRATION_DATABASE_URL
const BRAND_AGENCY_ID = process.env.INTEGRATION_BRAND_AGENCY_ID ?? '00000000-0000-4000-8000-000000000001'
const ECOMMERCE_AGENCY_ID = process.env.INTEGRATION_ECOMMERCE_AGENCY_ID ?? '00000000-0000-4000-8000-000000000002'

// Derive password from env or use dev default
const BRAND_PASSWORD = process.env.BRAND_DB_PASSWORD ?? 'dev-secret-12345'

describe('PgBouncer SET LOCAL integration tests (pitfall 8.1)', () => {
  let db: ReturnType<typeof createAgencyDb>

  beforeAll(() => {
    if (!INTEGRATION_DB) return
    // Create one shared client pointing to brand's PgBouncer port (6432)
    db = createAgencyDb('brand', BRAND_PASSWORD)
  })

  afterAll(async () => {
    // postgres-js clients are lazy; no explicit close needed — connections
    // are returned to PgBouncer pool automatically on idle.
  })

  // ── Test 1: SET LOCAL is reverted at transaction end ─────────────────────
  it.skipIf(!INTEGRATION_DB)(
    'SET LOCAL is reverted at transaction end (pitfall 8.1 — no post-COMMIT leak)',
    async () => {
      // Inside the transaction: setting must be brandId
      await withAgencyContext(db, BRAND_AGENCY_ID, async (tx) => {
        const result = await tx.execute(
          sql`SELECT current_setting('app.agency_id', true) AS agency_setting`
        )
        const rows = result as Array<{ agency_setting: string }>
        expect(rows[0]?.agency_setting).toBe(BRAND_AGENCY_ID)
      })

      // After COMMIT (outside any transaction): setting must be NULL or empty.
      // We use db.execute() directly — no withAgencyContext wrapper — to verify
      // that SET LOCAL was fully reverted on the connection when the transaction ended.
      // In PgBouncer transaction mode, the physical connection is returned to the pool
      // after each transaction. The next use of this connection must see NO agency_id.
      const afterResult = await db.execute(
        sql`SELECT current_setting('app.agency_id', true) AS agency_setting`
      ) as Array<{ agency_setting: string | null }>

      const setting = afterResult[0]?.agency_setting
      // set_config with is_local=true reverts at transaction end.
      // Postgres returns '' (empty string) when the setting has no value via current_setting(…, true).
      expect(setting === null || setting === '').toBe(true)
    }
  )

  // ── Test 2: Two sequential transactions see independent settings ──────────
  it.skipIf(!INTEGRATION_DB)(
    'Two sequential transactions on the same client see independent app.agency_id settings',
    async () => {
      // First transaction: brand context
      let brandSetting: string | undefined
      await withAgencyContext(db, BRAND_AGENCY_ID, async (tx) => {
        const result = await tx.execute(
          sql`SELECT current_setting('app.agency_id', true) AS agency_setting`
        ) as Array<{ agency_setting: string }>
        brandSetting = result[0]?.agency_setting
      })
      expect(brandSetting).toBe(BRAND_AGENCY_ID)

      // Second transaction: ecommerce context — MUST NOT inherit brand's setting
      let ecommerceSetting: string | undefined
      await withAgencyContext(db, ECOMMERCE_AGENCY_ID, async (tx) => {
        const result = await tx.execute(
          sql`SELECT current_setting('app.agency_id', true) AS agency_setting`
        ) as Array<{ agency_setting: string }>
        ecommerceSetting = result[0]?.agency_setting
      })
      expect(ecommerceSetting).toBe(ECOMMERCE_AGENCY_ID)

      // The second transaction must not have seen the brand setting
      expect(ecommerceSetting).not.toBe(BRAND_AGENCY_ID)
    }
  )

  // ── Test 3: Concurrent transactions do not cross-contaminate ─────────────
  it.skipIf(!INTEGRATION_DB)(
    'Concurrent transactions on the same pool see their own agency settings (no cross-contamination)',
    async () => {
      const CONCURRENCY = 20
      const results: Array<{ expected: string; actual: string; index: number }> = []

      // Fire 20 concurrent withAgencyContext calls, alternating between brand and ecommerce
      const tasks = Array.from({ length: CONCURRENCY }, (_, i) => {
        const isEven = i % 2 === 0
        const expectedAgencyId = isEven ? BRAND_AGENCY_ID : ECOMMERCE_AGENCY_ID

        return withAgencyContext(db, expectedAgencyId, async (tx) => {
          // Simulate some work (read + verify setting)
          const settingResult = await tx.execute(
            sql`SELECT current_setting('app.agency_id', true) AS agency_setting`
          ) as Array<{ agency_setting: string }>

          const actualSetting = settingResult[0]?.agency_setting ?? ''
          results.push({ expected: expectedAgencyId, actual: actualSetting, index: i })

          if (actualSetting !== expectedAgencyId) {
            throw new Error(
              `CONCURRENT LEAK: tx ${i} expected agency=${expectedAgencyId} but got agency=${actualSetting}`
            )
          }
        })
      })

      // All tasks must complete without throwing
      await Promise.all(tasks)

      // Verify all results (belt-and-suspenders assertion)
      expect(results).toHaveLength(CONCURRENCY)
      for (const { expected, actual, index } of results) {
        expect(actual).toBe(expected)
        if (actual !== expected) {
          throw new Error(`Post-hoc check failed for tx ${index}: expected=${expected} actual=${actual}`)
        }
      }
    }
  )
})
