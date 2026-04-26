/**
 * packages/auth/src/__tests__/guards.integration.test.ts
 *
 * Integration tests for assertNotAgencyOwner.
 * Requirements: REQ-028, REQ-400 (agency owner cannot self-delete).
 * Threat: T-03-022 (last admin self-deletes → agency becomes unmanageable).
 *
 * Gated on INTEGRATION_DATABASE_URL — skip gracefully without a running DB.
 *
 * Seed/teardown uses the migrations_runner connection (INTEGRATION_MIGRATIONS_URL)
 * which has BYPASSRLS — required to insert agency rows without an RLS-satisfying context.
 * The assertNotAgencyOwner call uses createAgencyDb which goes through withAgencyContext.
 *
 * NOTE: postgres is a transitive dep via @mjagency/db. It is imported dynamically
 * inside each test body (which only runs when INTEGRATION_DATABASE_URL is set).
 */

import { describe, it, expect } from 'vitest'
import { assertNotAgencyOwner } from '../guards.js'
import { ForbiddenError } from '../errors.js'

const HAS_DB = !!process.env.INTEGRATION_DATABASE_URL

describe('assertNotAgencyOwner', () => {
  // Test 1: Self-delete blocked when only one admin
  it.skipIf(!HAS_DB)('throws ForbiddenError when requester is the only admin', async () => {
    const [{ createAgencyDb }, postgresModule] = await Promise.all([
      import('@mjagency/db'),
      // postgres-js is a dep of @mjagency/db — available in the workspace node_modules
      import('postgres'),
    ])
    const postgres = postgresModule.default
    const migrationsUrl = process.env.INTEGRATION_MIGRATIONS_URL ?? process.env.INTEGRATION_DATABASE_URL!
    const pg = postgres(migrationsUrl, { prepare: false })
    const db = createAgencyDb('brand', process.env.INTEGRATION_APP_DB_PASSWORD ?? '')

    const agencyId = crypto.randomUUID()
    const adminId = crypto.randomUUID()

    await pg.unsafe(`
      INSERT INTO agencies (id, name, slug, created_at, updated_at)
      VALUES ('${agencyId}', 'Test Agency 1', 'brand', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `)
    await pg.unsafe(`
      INSERT INTO users (id, agency_id, email, role, created_at, updated_at)
      VALUES ('${adminId}', '${agencyId}', 'admin1@guards-test.com', 'admin', NOW(), NOW())
    `)

    try {
      await expect(
        assertNotAgencyOwner(db, agencyId, adminId, adminId)
      ).rejects.toThrow(ForbiddenError)
    } finally {
      await pg.unsafe(`DELETE FROM users WHERE id = '${adminId}'`)
      await pg.unsafe(`DELETE FROM agencies WHERE id = '${agencyId}'`)
      await pg.end()
    }
  })

  // Test 2: Self-delete allowed when 2+ admins
  it.skipIf(!HAS_DB)('does not throw when there are 2 or more admins (self-delete allowed)', async () => {
    const [{ createAgencyDb }, postgresModule] = await Promise.all([
      import('@mjagency/db'),
      import('postgres'),
    ])
    const postgres = postgresModule.default
    const migrationsUrl = process.env.INTEGRATION_MIGRATIONS_URL ?? process.env.INTEGRATION_DATABASE_URL!
    const pg = postgres(migrationsUrl, { prepare: false })
    const db = createAgencyDb('brand', process.env.INTEGRATION_APP_DB_PASSWORD ?? '')

    const agencyId = crypto.randomUUID()
    const admin1Id = crypto.randomUUID()
    const admin2Id = crypto.randomUUID()

    await pg.unsafe(`
      INSERT INTO agencies (id, name, slug, created_at, updated_at)
      VALUES ('${agencyId}', 'Test Agency 2', 'brand', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `)
    await pg.unsafe(`
      INSERT INTO users (id, agency_id, email, role, created_at, updated_at)
      VALUES
        ('${admin1Id}', '${agencyId}', 'admin1@guards-test2.com', 'admin', NOW(), NOW()),
        ('${admin2Id}', '${agencyId}', 'admin2@guards-test2.com', 'admin', NOW(), NOW())
    `)

    try {
      await expect(
        assertNotAgencyOwner(db, agencyId, admin1Id, admin1Id)
      ).resolves.toBeUndefined()
    } finally {
      await pg.unsafe(`DELETE FROM users WHERE agency_id = '${agencyId}'`)
      await pg.unsafe(`DELETE FROM agencies WHERE id = '${agencyId}'`)
      await pg.end()
    }
  })

  // Test 3: Non-self delete allowed (admin deleting editor) regardless of count
  it.skipIf(!HAS_DB)('does not throw when target is different from requester (non-self delete)', async () => {
    const [{ createAgencyDb }, postgresModule] = await Promise.all([
      import('@mjagency/db'),
      import('postgres'),
    ])
    const postgres = postgresModule.default
    const migrationsUrl = process.env.INTEGRATION_MIGRATIONS_URL ?? process.env.INTEGRATION_DATABASE_URL!
    const pg = postgres(migrationsUrl, { prepare: false })
    const db = createAgencyDb('brand', process.env.INTEGRATION_APP_DB_PASSWORD ?? '')

    const agencyId = crypto.randomUUID()
    const adminId = crypto.randomUUID()
    const editorId = crypto.randomUUID()

    await pg.unsafe(`
      INSERT INTO agencies (id, name, slug, created_at, updated_at)
      VALUES ('${agencyId}', 'Test Agency 3', 'brand', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `)
    await pg.unsafe(`
      INSERT INTO users (id, agency_id, email, role, created_at, updated_at)
      VALUES
        ('${adminId}', '${agencyId}', 'admin@guards-test3.com', 'admin', NOW(), NOW()),
        ('${editorId}', '${agencyId}', 'editor@guards-test3.com', 'editor', NOW(), NOW())
    `)

    try {
      // admin deleting editor — non-self, should NOT throw
      await expect(
        assertNotAgencyOwner(db, agencyId, editorId, adminId)
      ).resolves.toBeUndefined()
    } finally {
      await pg.unsafe(`DELETE FROM users WHERE agency_id = '${agencyId}'`)
      await pg.unsafe(`DELETE FROM agencies WHERE id = '${agencyId}'`)
      await pg.end()
    }
  })

  // Test 4: DB trigger fires on direct DELETE of last admin
  it.skipIf(!HAS_DB)('DB trigger raises when deleting last admin directly via SQL', async () => {
    const postgresModule = await import('postgres')
    const postgres = postgresModule.default
    const migrationsUrl = process.env.INTEGRATION_MIGRATIONS_URL ?? process.env.INTEGRATION_DATABASE_URL!
    const pg = postgres(migrationsUrl, { prepare: false })

    const agencyId = crypto.randomUUID()
    const adminId = crypto.randomUUID()

    await pg.unsafe(`
      INSERT INTO agencies (id, name, slug, created_at, updated_at)
      VALUES ('${agencyId}', 'Test Agency 4', 'brand', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `)
    await pg.unsafe(`
      INSERT INTO users (id, agency_id, email, role, created_at, updated_at)
      VALUES ('${adminId}', '${agencyId}', 'lastadmin@guards-test4.com', 'admin', NOW(), NOW())
    `)

    try {
      // Direct DELETE should trigger the DB backstop (006_prevent_last_admin_delete.sql)
      await expect(
        pg.unsafe(`DELETE FROM users WHERE id = '${adminId}'`)
      ).rejects.toThrow()

      // Verify the admin still exists (delete was prevented)
      const rows = await pg.unsafe(`SELECT id FROM users WHERE id = '${adminId}'`)
      expect(rows.length).toBe(1)
    } finally {
      await pg.unsafe(`DELETE FROM users WHERE agency_id = '${agencyId}'`).catch(() => null)
      await pg.unsafe(`DELETE FROM agencies WHERE id = '${agencyId}'`)
      await pg.end()
    }
  })

  // Test 5: DB trigger does NOT fire on DELETE of editor
  it.skipIf(!HAS_DB)('DB trigger does not block deletion of an editor', async () => {
    const postgresModule = await import('postgres')
    const postgres = postgresModule.default
    const migrationsUrl = process.env.INTEGRATION_MIGRATIONS_URL ?? process.env.INTEGRATION_DATABASE_URL!
    const pg = postgres(migrationsUrl, { prepare: false })

    const agencyId = crypto.randomUUID()
    const adminId = crypto.randomUUID()
    const editorId = crypto.randomUUID()

    await pg.unsafe(`
      INSERT INTO agencies (id, name, slug, created_at, updated_at)
      VALUES ('${agencyId}', 'Test Agency 5', 'brand', NOW(), NOW())
      ON CONFLICT DO NOTHING
    `)
    await pg.unsafe(`
      INSERT INTO users (id, agency_id, email, role, created_at, updated_at)
      VALUES
        ('${adminId}', '${agencyId}', 'admin@guards-test5.com', 'admin', NOW(), NOW()),
        ('${editorId}', '${agencyId}', 'editor@guards-test5.com', 'editor', NOW(), NOW())
    `)

    try {
      // Delete editor — trigger should NOT block this
      await expect(
        pg.unsafe(`DELETE FROM users WHERE id = '${editorId}'`)
      ).resolves.toBeDefined()

      // Verify editor is gone
      const rows = await pg.unsafe(`SELECT id FROM users WHERE id = '${editorId}'`)
      expect(rows.length).toBe(0)
    } finally {
      await pg.unsafe(`DELETE FROM users WHERE agency_id = '${agencyId}'`).catch(() => null)
      await pg.unsafe(`DELETE FROM agencies WHERE id = '${agencyId}'`)
      await pg.end()
    }
  })
})
