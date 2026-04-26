/**
 * packages/db/src/__tests__/migrate-dry-run.test.ts
 *
 * Unit tests for migration runner core — buildDirectUrl, applyCustomDdl, dryRun.
 * All tests are unit-level; postgres client and migrate import are mocked.
 * No DB required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks must be declared before imports that depend on them
// ---------------------------------------------------------------------------

vi.mock('drizzle-orm/postgres-js/migrator', () => ({
  migrate: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn().mockReturnValue({}),
}))

const mockUnsafe = vi.fn().mockResolvedValue([])
const mockEnd = vi.fn().mockResolvedValue(undefined)
// The tagged-template mock: client`SQL` returns []
const mockSql = vi.fn().mockResolvedValue([])

vi.mock('postgres', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      const client = mockSql
      // Attach the methods that postgres-js clients expose
      ;(client as any).unsafe = mockUnsafe
      ;(client as any).end = mockEnd
      return client
    }),
  }
})

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn().mockResolvedValue([]),
}))

// ---------------------------------------------------------------------------
// Subject under test — imported AFTER mocks are set up
// ---------------------------------------------------------------------------

import { buildDirectUrl } from '../connection.js'
import { applyCustomDdl } from '../migrate/apply-custom.js'
import { dryRun } from '../migrate/dry-run.js'
import { runAllMigrations } from '../migrate/runner.js'
import { migrate as migrateMock } from 'drizzle-orm/postgres-js/migrator'
import { readFile as readFileMock } from 'node:fs/promises'

// ---------------------------------------------------------------------------
// Test 1: buildDirectUrl returns port-5432 URL
// ---------------------------------------------------------------------------

describe('buildDirectUrl', () => {
  it('returns a port-5432 URL with migrations_runner role for known slug', () => {
    const url = buildDirectUrl('ecommerce', 'pw')
    expect(url).toBe('postgresql://migrations_runner:pw@127.0.0.1:5432/ecommerce_db')
  })

  it('encodes special characters in password', () => {
    const url = buildDirectUrl('brand', 'p@ss/w0rd')
    expect(url).toContain('migrations_runner')
    expect(url).toContain('127.0.0.1:5432')
    expect(url).toContain('brand_db')
    // password must be URL-encoded
    expect(url).not.toContain('p@ss/w0rd')
  })

  it('throws for unknown slug', () => {
    // Type assertion required to test runtime guard
    expect(() => buildDirectUrl('unknown_agency' as any, 'pw')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Test 2: applyCustomDdl substitutes app_role placeholder
// ---------------------------------------------------------------------------

describe('applyCustomDdl — app_role substitution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUnsafe.mockResolvedValue([])
    mockEnd.mockResolvedValue(undefined)
  })

  it("replaces :'app_role' with <slug>_user before applying SQL", async () => {
    vi.mocked(readFileMock).mockResolvedValue("GRANT SELECT TO :'app_role';")

    const client: any = {
      unsafe: mockUnsafe,
      end: mockEnd,
    }

    await applyCustomDdl(client, 'ecommerce')

    // Both custom files are iterated; check that the substitution happened on every call
    const calls = mockUnsafe.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    for (const [sql] of calls) {
      expect(sql).toContain('ecommerce_user')
      expect(sql).not.toContain(":'app_role'")
    }
  })
})

// ---------------------------------------------------------------------------
// Test 3: applyCustomDdl strips psql meta-commands
// ---------------------------------------------------------------------------

describe('applyCustomDdl — psql meta-command stripping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUnsafe.mockResolvedValue([])
    mockEnd.mockResolvedValue(undefined)
  })

  it('removes lines beginning with \\ before passing SQL to client', async () => {
    vi.mocked(readFileMock).mockResolvedValue(
      '\\connect ecommerce_db\nCREATE TABLE foo (id int);'
    )

    const client: any = {
      unsafe: mockUnsafe,
      end: mockEnd,
    }

    await applyCustomDdl(client, 'ecommerce')

    const calls = mockUnsafe.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    for (const [sql] of calls) {
      expect(sql).not.toContain('\\connect')
      expect(sql).toContain('CREATE TABLE foo')
    }
  })
})

// ---------------------------------------------------------------------------
// Test 4: dryRun returns count of pending migrations
// ---------------------------------------------------------------------------

describe('dryRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSql.mockResolvedValue([{ hash: 'abc123' }, { hash: 'def456' }])
    mockEnd.mockResolvedValue(undefined)
  })

  it('returns slug, appliedCount, and pending array', async () => {
    const result = await dryRun('brand', 'pw')

    expect(result.slug).toBe('brand')
    expect(typeof result.appliedCount).toBe('number')
    expect(Array.isArray(result.pending)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 5: runAllMigrations with dryRun:true does NOT call migrate()
// ---------------------------------------------------------------------------

describe('runAllMigrations — dryRun flag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSql.mockResolvedValue([])
    mockEnd.mockResolvedValue(undefined)
  })

  it('does not call migrate() when dryRun is true', async () => {
    process.env.MIGRATIONS_DB_PASSWORD = 'test_password'

    await runAllMigrations({ dryRun: true })

    expect(vi.mocked(migrateMock)).toHaveBeenCalledTimes(0)
  })
})
