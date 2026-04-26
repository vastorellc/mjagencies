/**
 * packages/db/src/__tests__/audit-chain.integration.test.ts
 *
 * Integration tests for the hash-chained audit log.
 * All tests are gated on INTEGRATION_DATABASE_URL — skip gracefully in dev/CI without DB.
 *
 * Tests cover:
 *   - Audit trigger captures DML (REQ-019)
 *   - Hash chain per-stream linking (RESEARCH §5.2, pitfall 8.6)
 *   - actor_id falls back to SYSTEM_ACTOR_ID (Open Q4)
 *   - verifyAuditChain detects tampered rows (T-02-017)
 *   - App role cannot UPDATE/DELETE audit_log (T-02-017 mitigation)
 */

import { describe, it, expect } from 'vitest'
import { sql } from 'drizzle-orm'
import { SYSTEM_ACTOR_ID } from '@mjagency/config'
import { createAgencyDb, withAgencyContext, schema } from '../index.js'
import { verifyAuditChain } from '../audit/verify-chain.js'

const INTEGRATION_DATABASE_URL = process.env.INTEGRATION_DATABASE_URL

// Helper to get a brand DB connection for integration tests
function getBrandDb() {
  return createAgencyDb('brand', process.env.INTEGRATION_DB_PASSWORD ?? '')
}

describe('audit log hash chain (integration)', () => {
  // Test 1: Insert into audited table writes audit_log row
  it.skipIf(!INTEGRATION_DATABASE_URL)(
    'INSERT into users triggers audit_log row with correct fields',
    async () => {
      const db = getBrandDb()
      const testAgencyId = crypto.randomUUID()
      await withAgencyContext(db, testAgencyId, async (tx) => {
        await tx.execute(sql`
          INSERT INTO users (agency_id, email, role) VALUES
            (${testAgencyId}::uuid, ${'test+' + Date.now() + '@example.com'}, 'admin')
        `)
      })
      const rows = await db.execute(
        sql`SELECT op, table_name, agency_id, new_row FROM audit_log WHERE agency_id = ${testAgencyId}::uuid ORDER BY id`
      )
      expect(rows.length).toBe(1)
      const row = rows[0] as { op: string; table_name: string; agency_id: string; new_row: unknown }
      expect(row.op).toBe('INSERT')
      expect(row.table_name).toBe('users')
      expect(row.agency_id).toBe(testAgencyId)
      expect(row.new_row).not.toBeNull()
    }
  )

  // Test 2: Hash chain links rows
  it.skipIf(!INTEGRATION_DATABASE_URL)(
    'second audit_log row prev_hash equals first row_hash (same stream)',
    async () => {
      const db = getBrandDb()
      const testAgencyId = crypto.randomUUID()
      await withAgencyContext(db, testAgencyId, async (tx) => {
        await tx.execute(sql`INSERT INTO users (agency_id, email, role) VALUES (${testAgencyId}::uuid, ${'chain1+' + Date.now() + '@example.com'}, 'admin')`)
      })
      await withAgencyContext(db, testAgencyId, async (tx) => {
        await tx.execute(sql`INSERT INTO users (agency_id, email, role) VALUES (${testAgencyId}::uuid, ${'chain2+' + Date.now() + '@example.com'}, 'admin')`)
      })
      const rows = await db.execute(
        sql`SELECT id, row_hash, prev_hash FROM audit_log WHERE agency_id = ${testAgencyId}::uuid AND table_name = 'users' ORDER BY id`
      )
      expect(rows.length).toBe(2)
      const row1 = rows[0] as { id: bigint; row_hash: Buffer | string; prev_hash: Buffer | string | null }
      const row2 = rows[1] as { id: bigint; row_hash: Buffer | string; prev_hash: Buffer | string | null }
      // Row 1 is genesis — no prev_hash
      expect(row1.prev_hash).toBeNull()
      // Row 2's prev_hash must equal row 1's row_hash
      expect(row2.prev_hash).not.toBeNull()
      const hash1 = Buffer.isBuffer(row1.row_hash) ? row1.row_hash : Buffer.from(row1.row_hash as string, 'hex')
      const prevHash2 = Buffer.isBuffer(row2.prev_hash!) ? row2.prev_hash! : Buffer.from(row2.prev_hash as string, 'hex')
      expect(hash1.equals(prevHash2)).toBe(true)
    }
  )

  // Test 3: Per-stream linking — users stream and sessions stream are independent
  it.skipIf(!INTEGRATION_DATABASE_URL)(
    'users and sessions streams chain independently (per-stream isolation)',
    async () => {
      const db = getBrandDb()
      const testAgencyId = crypto.randomUUID()
      const userId = crypto.randomUUID()
      await withAgencyContext(db, testAgencyId, async (tx) => {
        await tx.execute(sql`INSERT INTO users (id, agency_id, email, role) VALUES (${userId}::uuid, ${testAgencyId}::uuid, ${'s1+' + Date.now() + '@example.com'}, 'admin')`)
      })
      // Insert into sessions (different stream)
      await withAgencyContext(db, testAgencyId, async (tx) => {
        await tx.execute(sql`
          INSERT INTO sessions (agency_id, user_id, token_family_id, expires_at)
          VALUES (${testAgencyId}::uuid, ${userId}::uuid, ${crypto.randomUUID()}::uuid, now() + interval '1 hour')
        `)
      })
      // Second insert into users
      await withAgencyContext(db, testAgencyId, async (tx) => {
        await tx.execute(sql`INSERT INTO users (agency_id, email, role) VALUES (${testAgencyId}::uuid, ${'s3+' + Date.now() + '@example.com'}, 'admin')`)
      })
      // Users stream should have 2 rows with direct chain
      const usersRows = await db.execute(
        sql`SELECT id, row_hash, prev_hash FROM audit_log WHERE agency_id = ${testAgencyId}::uuid AND table_name = 'users' ORDER BY id`
      )
      expect(usersRows.length).toBe(2)
      const u1 = usersRows[0] as { row_hash: Buffer | string }
      const u2 = usersRows[1] as { prev_hash: Buffer | string | null }
      const hash1 = Buffer.isBuffer(u1.row_hash) ? u1.row_hash : Buffer.from(u1.row_hash as string, 'hex')
      const prev2 = u2.prev_hash == null ? null : (Buffer.isBuffer(u2.prev_hash) ? u2.prev_hash : Buffer.from(u2.prev_hash as string, 'hex'))
      // Users row 2's prev_hash links to users row 1's hash (not the sessions row)
      expect(prev2).not.toBeNull()
      expect(hash1.equals(prev2!)).toBe(true)
    }
  )

  // Test 4: actor_id falls back to SYSTEM_ACTOR_ID when app.actor_id not set
  it.skipIf(!INTEGRATION_DATABASE_URL)(
    'audit row actor_id defaults to SYSTEM_ACTOR_ID when app.actor_id is not set',
    async () => {
      const db = getBrandDb()
      const testAgencyId = crypto.randomUUID()
      // Insert without setting app.actor_id
      await withAgencyContext(db, testAgencyId, async (tx) => {
        await tx.execute(sql`INSERT INTO users (agency_id, email, role) VALUES (${testAgencyId}::uuid, ${'actor+' + Date.now() + '@example.com'}, 'admin')`)
      })
      const rows = await db.execute(
        sql`SELECT actor_id FROM audit_log WHERE agency_id = ${testAgencyId}::uuid ORDER BY id LIMIT 1`
      )
      expect(rows.length).toBe(1)
      const row = rows[0] as { actor_id: string }
      expect(row.actor_id).toBe(SYSTEM_ACTOR_ID)
    }
  )

  // Test 5: verifyAuditChain returns no broken rows on valid chain
  it.skipIf(!INTEGRATION_DATABASE_URL)(
    'verifyAuditChain returns { broken: [], total: >= 1 } on intact chain',
    async () => {
      const db = getBrandDb()
      const testAgencyId = crypto.randomUUID()
      await withAgencyContext(db, testAgencyId, async (tx) => {
        await tx.execute(sql`INSERT INTO users (agency_id, email, role) VALUES (${testAgencyId}::uuid, ${'verify+' + Date.now() + '@example.com'}, 'admin')`)
      })
      const result = await verifyAuditChain(db)
      expect(result.broken.length).toBe(0)
      expect(result.total).toBeGreaterThanOrEqual(1)
    }
  )

  // Test 6: verifyAuditChain detects tampering
  it.skipIf(!INTEGRATION_DATABASE_URL)(
    'verifyAuditChain detects broken chain when row_hash is tampered',
    async () => {
      const db = getBrandDb()
      const testAgencyId = crypto.randomUUID()
      await withAgencyContext(db, testAgencyId, async (tx) => {
        await tx.execute(sql`INSERT INTO users (agency_id, email, role) VALUES (${testAgencyId}::uuid, ${'tamper1+' + Date.now() + '@example.com'}, 'admin')`)
      })
      await withAgencyContext(db, testAgencyId, async (tx) => {
        await tx.execute(sql`INSERT INTO users (agency_id, email, role) VALUES (${testAgencyId}::uuid, ${'tamper2+' + Date.now() + '@example.com'}, 'admin')`)
      })
      // Get row IDs
      const rows = await db.execute(
        sql`SELECT id FROM audit_log WHERE agency_id = ${testAgencyId}::uuid ORDER BY id`
      )
      const row2Id = (rows[1] as { id: string | number }).id
      // Tamper via migrations_runner (BYPASSRLS) — UPDATE row_hash directly
      await db.execute(
        sql`UPDATE audit_log SET row_hash = decode(repeat('00', 32), 'hex') WHERE id = ${row2Id}`
      )
      const result = await verifyAuditChain(db)
      expect(result.broken.length).toBeGreaterThanOrEqual(1)
      expect(result.broken).toContain(Number(row2Id))
    }
  )

  // Test 7: REVOKE prevents app role from UPDATE/DELETE on audit_log
  it.skipIf(!INTEGRATION_DATABASE_URL)(
    'app role cannot UPDATE audit_log rows (REVOKE enforced)',
    async () => {
      // Use a per-agency app role connection (not migrations_runner)
      const appDb = createAgencyDb('brand', process.env.BRAND_DB_PASSWORD ?? '')
      const testAgencyId = crypto.randomUUID()
      await withAgencyContext(appDb, testAgencyId, async (tx) => {
        await tx.execute(sql`INSERT INTO users (agency_id, email, role) VALUES (${testAgencyId}::uuid, ${'revoke+' + Date.now() + '@example.com'}, 'admin')`)
      })
      // Attempt to UPDATE audit_log as app role — should throw permission denied
      await expect(
        withAgencyContext(appDb, testAgencyId, async (tx) => {
          await tx.execute(sql`UPDATE audit_log SET op = 'DELETE' WHERE agency_id = ${testAgencyId}::uuid`)
        })
      ).rejects.toThrow(/permission denied/i)
    }
  )
})

// Avoid unused import warning
void schema
