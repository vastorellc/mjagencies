/**
 * packages/db/src/__tests__/immutable.integration.test.ts
 *
 * Integration test for agency_id immutability trigger.
 * Verifies that the prevent_agency_id_change() trigger defined in
 * custom/001_agency_id_immutable.sql raises an integrity_constraint_violation
 * when agency_id is changed on any agency-scoped table.
 *
 * Skipped automatically when INTEGRATION_DATABASE_URL is not set.
 *
 * To run locally:
 *   INTEGRATION_DATABASE_URL=postgresql://migrations_runner:pw@127.0.0.1:5432/brand_db \
 *   pnpm --filter=@mjagency/db vitest run src/__tests__/immutable.integration.test.ts
 *
 * Prerequisites:
 *   1. Plan 02-03 migration runner has applied all migrations to the target DB
 *   2. migrations_runner role exists with BYPASSRLS
 *   3. INTEGRATION_DATABASE_URL points to the target DB as migrations_runner
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as schema from '../schema/index.js'

const INTEGRATION_DATABASE_URL = process.env['INTEGRATION_DATABASE_URL']
const hasDb = Boolean(INTEGRATION_DATABASE_URL)

// Connect as migrations_runner (BYPASSRLS) so RLS doesn't interfere with test setup.
// Only the immutability trigger is under test here.
let client: ReturnType<typeof postgres>
let db: ReturnType<typeof drizzle>

describe('agency_id immutability trigger', () => {
  beforeAll(() => {
    if (!hasDb) return
    client = postgres(INTEGRATION_DATABASE_URL!, { prepare: false, max: 1 })
    db = drizzle({ client })
  })

  afterAll(async () => {
    if (!hasDb || !client) return
    // Clean up test data
    await db.execute(sql`TRUNCATE TABLE users CASCADE`)
    await client.end()
  })

  it.skipIf(!hasDb)('setup: truncates users table for clean state', async () => {
    await db.execute(sql`TRUNCATE TABLE users CASCADE`)
    const rows = await db.select().from(schema.users)
    expect(rows).toHaveLength(0)
  })

  it.skipIf(!hasDb)('INSERT sets agency_id correctly', async () => {
    const agencyId = '11111111-1111-1111-1111-111111111111'
    await db.insert(schema.users).values({
      agencyId,
      email: 'test-immutable@example.com',
      role: 'admin',
    })
    // As migrations_runner (BYPASSRLS) we can see all rows
    const rows = await db.select().from(schema.users)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.agencyId).toBe(agencyId)
  })

  it.skipIf(!hasDb)('UPDATE agency_id raises integrity_constraint_violation (ERRCODE 23000)', async () => {
    const rows = await db.select().from(schema.users)
    const insertedId = rows[0]!.id

    const newAgencyId = '22222222-2222-2222-2222-222222222222'

    await expect(
      db.execute(
        sql`UPDATE users SET agency_id = ${newAgencyId} WHERE id = ${insertedId}`
      )
    ).rejects.toThrow(/agency_id is immutable/)
  })

  it.skipIf(!hasDb)('UPDATE agency_id error code is integrity_constraint_violation (23000)', async () => {
    const rows = await db.select().from(schema.users)
    const insertedId = rows[0]!.id
    const newAgencyId = '33333333-3333-3333-3333-333333333333'

    let thrownError: unknown = null
    try {
      await db.execute(
        sql`UPDATE users SET agency_id = ${newAgencyId} WHERE id = ${insertedId}`
      )
    } catch (err) {
      thrownError = err
    }

    expect(thrownError).not.toBeNull()
    // postgres-js error has a code property
    const pgError = thrownError as { code?: string; message?: string }
    expect(pgError.code).toBe('23000')
  })

  it.skipIf(!hasDb)('UPDATE other columns (email) succeeds — trigger is column-specific', async () => {
    const rows = await db.select().from(schema.users)
    const insertedId = rows[0]!.id

    // This should NOT throw — trigger only fires on agency_id column changes
    await expect(
      db.execute(
        sql`UPDATE users SET email = 'updated@example.com' WHERE id = ${insertedId}`
      )
    ).resolves.not.toThrow()

    const updated = await db
      .select()
      .from(schema.users)
      .where(sql`id = ${insertedId}`)
    expect(updated[0]!.email).toBe('updated@example.com')
  })
})
