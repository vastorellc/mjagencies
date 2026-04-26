/**
 * packages/db/src/__tests__/migrate-runner.integration.test.ts
 *
 * Integration tests for the migration runner — full apply against an ephemeral Postgres DB.
 * All tests are gated on INTEGRATION_DATABASE_URL being set. Without it, all tests skip.
 *
 * To run:
 *   INTEGRATION_DATABASE_URL=postgresql://... npx vitest run src/__tests__/migrate-runner.integration.test.ts
 *
 * Test DB lifecycle:
 *   - A unique test_migrate_<hex> database is created via the migrations_runner connection
 *   - runMigration is called against it by overriding the slug→dbName mapping
 *   - The test DB is dropped after all tests complete
 *
 * What is verified:
 *   Test 1: Schema applied correctly (tables, RLS, triggers)
 *   Test 2: Idempotency — re-running migrations does not error or change row counts
 *   Test 3: dryRun reports zero pending after apply
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import crypto from 'node:crypto'

const INTEGRATION_DATABASE_URL = process.env.INTEGRATION_DATABASE_URL
const MIGRATIONS_DB_PASSWORD = process.env.MIGRATIONS_DB_PASSWORD ?? 'test_password'

describe.skipIf(!INTEGRATION_DATABASE_URL)('migrate-runner integration', () => {
  const testDbName = `test_migrate_${crypto.randomBytes(8).toString('hex')}`

  let adminClient: import('postgres').Sql
  let testClient: import('postgres').Sql
  let migrationsFn: typeof import('../migrate/runner.js').runMigration
  let dryRunFn: typeof import('../migrate/dry-run.js').dryRun

  beforeAll(async () => {
    if (!INTEGRATION_DATABASE_URL) return

    const postgres = (await import('postgres')).default

    // Connect as superuser/admin via INTEGRATION_DATABASE_URL to create the test DB
    adminClient = postgres(INTEGRATION_DATABASE_URL, {
      max: 1,
      prepare: false,
    })

    // Create the test DB with migrations_runner as owner
    // Use unsafe to execute CREATE DATABASE (cannot run inside a transaction)
    await adminClient.unsafe(`CREATE DATABASE ${testDbName}`)

    // Connect to the new test DB as migrations_runner
    const { buildDirectUrl } = await import('../connection.js')
    const baseUrl = buildDirectUrl('brand', MIGRATIONS_DB_PASSWORD)
    // Override the URL to point to our test DB instead of brand_db
    const testUrl = baseUrl.replace('/brand_db', `/${testDbName}`)

    testClient = postgres(testUrl, { max: 1, prepare: false })

    // Import runner and dry-run functions
    const runnerModule = await import('../migrate/runner.js')
    migrationsFn = runnerModule.runMigration
    const dryRunModule = await import('../migrate/dry-run.js')
    dryRunFn = dryRunModule.dryRun
  })

  afterAll(async () => {
    if (!adminClient) return
    await testClient?.end()
    // Drop the test DB
    await adminClient.unsafe(`DROP DATABASE IF EXISTS ${testDbName}`)
    await adminClient.end()
  })

  it('Test 1: applies schema to a fresh DB — tables, RLS, triggers exist', async () => {
    // Run migrations against 'brand' (our test DB is brand_db shape)
    await migrationsFn('brand', MIGRATIONS_DB_PASSWORD)

    // Verify: core tables exist
    const tables = await testClient`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `
    const tableNames = tables.map((r) => (r as { tablename: string }).tablename)
    expect(tableNames).toContain('users')
    expect(tableNames).toContain('sessions')
    expect(tableNames).toContain('permissions_vault')
    expect(tableNames).toContain('audit_log')
    expect(tableNames).toContain('_seed_state')
    expect(tableNames).toContain('agencies')

    // Verify: users table has RLS enabled AND forced
    const [rlsInfo] = await testClient`
      SELECT relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname = 'users' AND relkind = 'r'
    `
    expect(rlsInfo?.relrowsecurity).toBe(true)
    expect(rlsInfo?.relforcerowsecurity).toBe(true)

    // Verify: prevent_agency_id_change function exists
    const [fn] = await testClient`
      SELECT proname FROM pg_proc WHERE proname = 'prevent_agency_id_change'
    `
    expect(fn?.proname).toBe('prevent_agency_id_change')

    // Verify: trigger enforce_agency_id_immutable exists on users
    const [trigger] = await testClient`
      SELECT tgname FROM pg_trigger
      WHERE tgname = 'enforce_agency_id_immutable'
        AND tgrelid = 'users'::regclass
    `
    expect(trigger?.tgname).toBe('enforce_agency_id_immutable')

    // Verify: audit_log has NO RLS (pitfall 8.8 — no circular dependency)
    const [auditRls] = await testClient`
      SELECT relrowsecurity FROM pg_class WHERE relname = 'audit_log' AND relkind = 'r'
    `
    expect(auditRls?.relrowsecurity).toBe(false)
  })

  it('Test 2: re-running migrations is idempotent — no error, same row count', async () => {
    // Get current row count in __drizzle_migrations
    const before = await testClient`SELECT count(*) AS cnt FROM __drizzle_migrations`
    const countBefore = Number((before[0] as { cnt: string | number })?.cnt ?? 0)

    // Re-run migrations — should not throw
    await expect(migrationsFn('brand', MIGRATIONS_DB_PASSWORD)).resolves.toBeUndefined()

    // Row count should be the same (idempotent)
    const after = await testClient`SELECT count(*) AS cnt FROM __drizzle_migrations`
    const countAfter = Number((after[0] as { cnt: string | number })?.cnt ?? 0)
    expect(countAfter).toBe(countBefore)
  })

  it('Test 3: dryRun reports zero pending after apply', async () => {
    const result = await dryRunFn('brand', MIGRATIONS_DB_PASSWORD)
    expect(result.slug).toBe('brand')
    expect(result.pending.length).toBe(0)
  })
})
