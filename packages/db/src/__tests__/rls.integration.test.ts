/**
 * packages/db/src/__tests__/rls.integration.test.ts
 *
 * Integration tests for RLS cross-agency isolation.
 * Verifies that:
 *   1. Queries within withAgencyContext only see own-agency rows
 *   2. Queries in a different context (different agency_id) return zero rows
 *   3. INSERT with mismatched agency_id is blocked by WITH CHECK clause
 *   4. Queries without context return zero rows
 *   5. migrations_runner (BYPASSRLS) can see all rows across agencies
 *
 * Skipped automatically when INTEGRATION_DATABASE_URL is not set.
 *
 * Test 5 note: BYPASSRLS proves FORCE ROW LEVEL SECURITY is the correct safety pin —
 * without FORCE, this test would also pass for the table owner because tables exempt
 * their owner from RLS by default. FORCE ensures even migrations_runner (table owner)
 * would be subject to RLS policies if it did NOT have BYPASSRLS.
 *
 * Required env vars to run:
 *   INTEGRATION_DATABASE_URL     - URL for brand_db (or any single agency DB)
 *   INTEGRATION_APP_DB_URL       - URL connecting as <slug>_user (RLS enforced)
 *   INTEGRATION_MIGRATIONS_URL   - URL connecting as migrations_runner (BYPASSRLS)
 *
 * Example:
 *   INTEGRATION_DATABASE_URL=postgresql://brand_user:pw@127.0.0.1:5432/brand_db \
 *   INTEGRATION_APP_DB_URL=postgresql://brand_user:pw@127.0.0.1:5432/brand_db \
 *   INTEGRATION_MIGRATIONS_URL=postgresql://migrations_runner:pw@127.0.0.1:5432/brand_db \
 *   pnpm --filter=@mjagency/db vitest run src/__tests__/rls.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import * as schema from '../schema/index.js'
import { withAgencyContext } from '../client.js'
import type { AgencyDb } from '../client.js'

const INTEGRATION_DATABASE_URL = process.env['INTEGRATION_DATABASE_URL']
const INTEGRATION_APP_DB_URL = process.env['INTEGRATION_APP_DB_URL'] ?? INTEGRATION_DATABASE_URL
const INTEGRATION_MIGRATIONS_URL = process.env['INTEGRATION_MIGRATIONS_URL']

const hasDb = Boolean(INTEGRATION_DATABASE_URL)

let appClient: ReturnType<typeof postgres>
let migrationClient: ReturnType<typeof postgres>
let appDb: AgencyDb
let migrationsDb: ReturnType<typeof drizzle>

// Use random UUIDs so tests are repeatable and don't depend on pre-existing data
const agencyA = randomUUID()
const agencyB = randomUUID()

/**
 * getAppRoleDb: connects as the per-agency app role (RLS enforced).
 * In a real deployment this is <slug>_user connecting through PgBouncer.
 * For test simplicity we connect directly to Postgres port 5432.
 */
function getAppRoleDb(): AgencyDb {
  if (!appClient) {
    appClient = postgres(INTEGRATION_APP_DB_URL!, { prepare: false, max: 5 })
    appDb = drizzle({ client: appClient }) as unknown as AgencyDb
  }
  return appDb
}

/**
 * getMigrationsRunnerDb: connects as migrations_runner (BYPASSRLS).
 * Used for test cleanup and to verify BYPASSRLS behavior (Test 5).
 * Note: connects directly to Postgres port 5432, NOT through PgBouncer.
 * Pitfall 8.2: migrations_runner should never go through PgBouncer.
 */
function getMigrationsRunnerDb(): ReturnType<typeof drizzle> {
  if (!migrationClient) {
    const url = INTEGRATION_MIGRATIONS_URL ?? INTEGRATION_DATABASE_URL!
    migrationClient = postgres(url, { prepare: false, max: 2 })
    migrationsDb = drizzle({ client: migrationClient })
  }
  return migrationsDb
}

describe('RLS cross-agency isolation', () => {
  beforeAll(() => {
    if (!hasDb) return
    getAppRoleDb()
    getMigrationsRunnerDb()
  })

  afterAll(async () => {
    if (!hasDb) return
    // Clean up test rows by agency UUIDs (BYPASSRLS sees everything)
    const mdb = getMigrationsRunnerDb()
    await mdb.execute(sql`DELETE FROM users WHERE agency_id = ${agencyA}`)
    await mdb.execute(sql`DELETE FROM users WHERE agency_id = ${agencyB}`)
    if (appClient) await appClient.end()
    if (migrationClient) await migrationClient.end()
  })

  beforeEach(async () => {
    if (!hasDb) return
    // Clear test rows before each test for a clean slate
    const mdb = getMigrationsRunnerDb()
    await mdb.execute(sql`DELETE FROM users WHERE agency_id = ${agencyA}`)
    await mdb.execute(sql`DELETE FROM users WHERE agency_id = ${agencyB}`)
  })

  it.skipIf(!hasDb)('Test 1 — in-context read returns own rows', async () => {
    const db = getAppRoleDb()

    // Insert a row as agencyA
    await withAgencyContext(db, agencyA, async (tx) => {
      await tx.insert(schema.users).values({
        agencyId: agencyA,
        email: 'user-a@test.example',
        role: 'admin',
      })
    })

    // Read back within agencyA context
    const rows = await withAgencyContext(db, agencyA, async (tx) => {
      return tx.select().from(schema.users)
    })

    expect(rows.length).toBeGreaterThanOrEqual(1)
    for (const row of rows) {
      expect(row.agencyId).toBe(agencyA)
    }
  })

  it.skipIf(!hasDb)('Test 2 — cross-agency read returns zero rows', async () => {
    const db = getAppRoleDb()

    // Seed: insert row for agencyA (as agencyA)
    await withAgencyContext(db, agencyA, async (tx) => {
      await tx.insert(schema.users).values({
        agencyId: agencyA,
        email: 'user-a2@test.example',
        role: 'editor',
      })
    })

    // Query as agencyB — should see zero rows (RLS hides agencyA rows)
    const rows = await withAgencyContext(db, agencyB, async (tx) => {
      return tx.select().from(schema.users)
    })

    expect(rows.length).toBe(0)
  })

  it.skipIf(!hasDb)('Test 3 — INSERT with mismatched agency_id is blocked by WITH CHECK', async () => {
    const db = getAppRoleDb()

    // Context is agencyA but we try to insert a row with agencyId = agencyB
    // The WITH CHECK clause should reject this
    await expect(
      withAgencyContext(db, agencyA, async (tx) => {
        await tx.insert(schema.users).values({
          agencyId: agencyB, // MISMATCH — context says agencyA
          email: 'leak@test.example',
          role: 'admin',
        })
      })
    ).rejects.toThrow()
  })

  it.skipIf(!hasDb)('Test 4 — without context, queries return zero rows', async () => {
    const db = getAppRoleDb()

    // First seed a row as agencyA
    await withAgencyContext(db, agencyA, async (tx) => {
      await tx.insert(schema.users).values({
        agencyId: agencyA,
        email: 'user-no-ctx@test.example',
        role: 'admin',
      })
    })

    // Query WITHOUT withAgencyContext — app.agency_id is not set
    // current_setting('app.agency_id', true) returns NULL
    // policy: agency_id = NULL::uuid is NULL (not true) => row hidden
    // Use the same appClient but a fresh drizzle instance (no context set)
    const noCtxDb = drizzle({ client: appClient })
    const rows = await noCtxDb.select().from(schema.users)

    expect(rows.length).toBe(0)
  })

  it.skipIf(!hasDb)('Test 5 — migrations_runner (BYPASSRLS) sees all rows', async () => {
    const appDb = getAppRoleDb()
    const mdb = getMigrationsRunnerDb()

    // Seed: insert one row for agencyA and one for agencyB
    await withAgencyContext(appDb, agencyA, async (tx) => {
      await tx.insert(schema.users).values({
        agencyId: agencyA,
        email: 'bypassrls-a@test.example',
        role: 'admin',
      })
    })
    await withAgencyContext(appDb, agencyB, async (tx) => {
      await tx.insert(schema.users).values({
        agencyId: agencyB,
        email: 'bypassrls-b@test.example',
        role: 'admin',
      })
    })

    // migrations_runner (BYPASSRLS) can see both rows WITHOUT withAgencyContext
    // This proves FORCE ROW LEVEL SECURITY is correctly bypassed by the BYPASSRLS role.
    // Without FORCE: table owner would bypass RLS anyway, making FORCE redundant.
    // With FORCE: BYPASSRLS is the ONLY escape hatch — app roles cannot bypass RLS.
    const allRows = await mdb.select().from(schema.users).where(
      sql`agency_id = ${agencyA} OR agency_id = ${agencyB}`
    )

    expect(allRows.length).toBeGreaterThanOrEqual(2)

    const agencyIds = allRows.map((r) => r.agencyId)
    expect(agencyIds).toContain(agencyA)
    expect(agencyIds).toContain(agencyB)
  })
})
