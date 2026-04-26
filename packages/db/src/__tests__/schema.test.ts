/**
 * packages/db/src/__tests__/schema.test.ts
 *
 * Unit tests for schema module exports.
 * NO Postgres connection required — tests compile-time structure only.
 *
 * Run: pnpm --filter=@mjagency/db vitest run src/__tests__/schema.test.ts
 */

import { describe, it, expect } from 'vitest'
import * as schema from '../schema/index.js'
import { createAgencyDb, withAgencyContext } from '../client.js'

describe('schema exports', () => {
  it('exports the six expected table objects', () => {
    expect(schema.agencies).toBeDefined()
    expect(schema.users).toBeDefined()
    expect(schema.sessions).toBeDefined()
    expect(schema.permissionsVault).toBeDefined()
    expect(schema.auditLog).toBeDefined()
    expect(schema.seedState).toBeDefined()
  })

  it('exports agencyBaseColumns spread object', () => {
    expect(schema.agencyBaseColumns).toBeDefined()
    expect(typeof schema.agencyBaseColumns).toBe('object')
    expect('id' in schema.agencyBaseColumns).toBe(true)
    expect('agencyId' in schema.agencyBaseColumns).toBe(true)
    expect('createdAt' in schema.agencyBaseColumns).toBe(true)
    expect('updatedAt' in schema.agencyBaseColumns).toBe(true)
  })

  it('agencies table has id, slug, name, createdAt, updatedAt — NOT agencyId', () => {
    const cols = Object.keys(schema.agencies)
    expect(cols).toContain('id')
    expect(cols).toContain('slug')
    expect(cols).toContain('name')
    expect(cols).toContain('createdAt')
    expect(cols).toContain('updatedAt')
    expect(cols).not.toContain('agencyId')
  })

  it('users table has agencyBaseColumns (id, agencyId, createdAt, updatedAt)', () => {
    const cols = Object.keys(schema.users)
    expect(cols).toContain('id')
    expect(cols).toContain('agencyId')
    expect(cols).toContain('createdAt')
    expect(cols).toContain('updatedAt')
    expect(cols).toContain('email')
    expect(cols).toContain('role')
  })

  it('sessions table has agencyBaseColumns plus session-specific columns', () => {
    const cols = Object.keys(schema.sessions)
    expect(cols).toContain('id')
    expect(cols).toContain('agencyId')
    expect(cols).toContain('createdAt')
    expect(cols).toContain('updatedAt')
    expect(cols).toContain('userId')
    expect(cols).toContain('tokenFamilyId')
    expect(cols).toContain('expiresAt')
    expect(cols).toContain('revokedAt')
  })

  it('permissionsVault table has agencyBaseColumns plus vault-specific columns', () => {
    const cols = Object.keys(schema.permissionsVault)
    expect(cols).toContain('id')
    expect(cols).toContain('agencyId')
    expect(cols).toContain('permissionKey')
    expect(cols).toContain('encryptedValue')
    expect(cols).toContain('keyVersion')
    expect(cols).toContain('expiresAt')
    expect(cols).toContain('revokedAt')
  })

  it('auditLog table has id, occurredAt, tableName, op, rowPk, actorId, agencyId, dbUser, txid, correlationId, oldRow, newRow, prevHash, rowHash', () => {
    const cols = Object.keys(schema.auditLog)
    const required = [
      'id',
      'occurredAt',
      'tableName',
      'op',
      'rowPk',
      'actorId',
      'agencyId',
      'dbUser',
      'txid',
      'correlationId',
      'oldRow',
      'newRow',
      'prevHash',
      'rowHash',
    ]
    for (const col of required) {
      expect(cols, `auditLog should have column: ${col}`).toContain(col)
    }
  })

  it('auditLog is defined and has expected structure (RLS disabled per pitfall 8.8)', () => {
    // auditLog does NOT call .enableRLS() and has no pgPolicy.
    // Pitfall 8.8: enabling RLS on audit_log creates a circular dependency with
    // the audit trigger. Tenant isolation is via agency_id column + REVOKE UPDATE/DELETE.
    // This test verifies the table is structurally correct and compiles without RLS.
    expect(schema.auditLog).toBeDefined()

    // Verify the table has the hash-chain columns (prevHash, rowHash) that are
    // the distinctive feature of the audit_log schema
    const cols = Object.keys(schema.auditLog)
    expect(cols).toContain('prevHash')
    expect(cols).toContain('rowHash')
    expect(cols).toContain('agencyId') // agency isolation via column, not RLS
  })

  it('seedState table has stepName as primary key', () => {
    const cols = Object.keys(schema.seedState)
    expect(cols).toContain('stepName')
    expect(cols).toContain('status')
    expect(cols).toContain('startedAt')
    expect(cols).toContain('completedAt')
    expect(cols).toContain('errorText')
    expect(cols).toContain('metadata')
  })

  it('type inference works for users table', () => {
    // This is a compile-time check — if it type-checks, the inference works
    type User = typeof schema.users.$inferSelect
    type NewUser = typeof schema.users.$inferInsert

    // Verify the types are defined (value-level proof of compile-time types)
    const _userTypeCheck: User = {
      id: '00000000-0000-0000-0000-000000000000',
      agencyId: '00000000-0000-0000-0000-000000000000',
      email: 'test@example.com',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const _newUserTypeCheck: NewUser = {
      agencyId: '00000000-0000-0000-0000-000000000000',
      email: 'test@example.com',
      role: 'admin',
    }

    expect(_userTypeCheck.email).toBe('test@example.com')
    expect(_newUserTypeCheck.role).toBe('admin')
  })
})

describe('client exports', () => {
  it('createAgencyDb is exported and is a function', () => {
    expect(typeof createAgencyDb).toBe('function')
  })

  it('withAgencyContext is exported and is a function', () => {
    expect(typeof withAgencyContext).toBe('function')
  })
})
