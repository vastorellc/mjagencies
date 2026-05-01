// backend/tests/_helpers.ts
// pg-mem-backed test DB fixture — reused by all Phase 2 test files
import { newDb, type IMemoryDb } from 'pg-mem'
import { drizzle } from 'drizzle-orm/node-postgres'
import { vi } from 'vitest'
import * as schema from '../src/db/schema.js'

let testDbInstance: IMemoryDb | null = null
let testDrizzle: ReturnType<typeof drizzle> | null = null

// pg-mem v3 does not support:
//   - query.types / getTypeParser (used by drizzle prepared statements)
//   - query.rowMode = 'array' (used by drizzle ORM queries)
//   - JSONB || merge operator (used by disconnect endpoint)
//
// PatchedPool intercepts all three limitations at the Pool/Client level so
// that the drizzle ORM layer and all route handlers work unchanged against
// the in-process pg-mem database.
//
// IMPORTANT: this shim is test-only and must never be imported in production code.

function makeQueryInterceptor(originalQuery: Function) {
  return async function patchedQuery(queryTextOrConfig: unknown, values?: unknown[]) {
    if (typeof queryTextOrConfig === 'object' && queryTextOrConfig !== null) {
      const cfg = queryTextOrConfig as Record<string, unknown>
      const { rowMode, types: _types, ...rest } = cfg
      const text = (rest.text as string) ?? ''

      // Intercept JSONB merge: COALESCE(col, '{}')::jsonb || $N::jsonb
      // pg-mem does not support the || operator on jsonb — we merge in JavaScript.
      const jsonbMergeRe = /COALESCE\([^)]+\)::jsonb\s*\|\|\s*\$(\d+)::jsonb/i
      if (jsonbMergeRe.test(text) && text.toUpperCase().includes('UPDATE')) {
        const userIdMatch = text.match(/"settings"\."user_id"\s*=\s*\$(\d+)/i)
        const patchMatch = text.match(jsonbMergeRe)
        if (userIdMatch && patchMatch) {
          const userIdParamIdx = parseInt(userIdMatch[1], 10) - 1
          const patchParamIdx = parseInt(patchMatch[1], 10) - 1
          const userId = (values ?? [])[userIdParamIdx]
          const patchJson = (values ?? [])[patchParamIdx]
          if (userId && patchJson !== undefined) {
            const patchObj: Record<string, unknown> =
              typeof patchJson === 'string' ? JSON.parse(patchJson) : (patchJson as Record<string, unknown>)
            // Fetch current value
            const selectResult = await (originalQuery as Function)(
              'SELECT platform_config FROM settings WHERE user_id = $1',
              [userId],
            )
            const current = (selectResult.rows[0]?.platform_config ?? {}) as Record<string, unknown>
            const merged = { ...current, ...patchObj }
            const mergedLiteral = JSON.stringify(merged).replace(/'/g, "''")
            // Rebuild SQL: replace COALESCE expr with literal, renumber remaining params
            let newText = text.replace(jsonbMergeRe, `'${mergedLiteral}'::jsonb`)
            newText = newText.replace(/\$(\d+)/g, (_m, numStr) => {
              const num = parseInt(numStr as string, 10)
              return num > patchParamIdx + 1 ? `$${num - 1}` : `$${num}`
            })
            const newValues = (values ?? []).filter((_v, i) => i !== patchParamIdx)
            const result = await (originalQuery as Function)({ ...rest, text: newText }, newValues)
            if (rowMode === 'array') {
              return { ...result, rows: (result.rows as unknown[]).map((r) => Object.values(r as Record<string, unknown>)), fields: result.fields }
            }
            return result
          }
        }
      }

      // Strip types (getTypeParser) — pg-mem throws NotSupported for this
      const result = await (originalQuery as Function)(rest, values)
      if (rowMode === 'array') {
        return { ...result, rows: (result.rows as unknown[]).map((r) => Object.values(r as Record<string, unknown>)), fields: result.fields }
      }
      return result
    }
    return (originalQuery as Function)(queryTextOrConfig, values)
  }
}

export async function createTestDb() {
  const mem = newDb({ autoCreateForeignKeyIndices: true })

  // Register PG functions used by drizzle / our SQL
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: 'uuid' as unknown as 'text',
    implementation: () => crypto.randomUUID(),
    impure: true,
  })

  // pg-mem provides a node-postgres-compatible adapter
  const { Pool: MemPool } = mem.adapters.createPg()

  // Subclass Pool to: (a) strip drizzle's incompatible query options (types/rowMode)
  // and (b) patch every checked-out client used inside db.transaction() for the same
  // reason — drizzle calls pool.connect() for transactions (drizzle node-postgres session.js:182).
  class PatchedPool extends MemPool {
    override async query(queryTextOrConfig: unknown, values?: unknown[]) {
      return makeQueryInterceptor(super.query.bind(this))(queryTextOrConfig, values)
    }
    override async connect() {
      const client = await super.connect() as Record<string, unknown>
      const origClientQuery = (client.query as Function).bind(client)
      client.query = makeQueryInterceptor(origClientQuery)
      return client
    }
  }

  const pool = new PatchedPool()

  // Apply the canonical Phase 1 schema for the settings table.
  // pg-mem cannot run drizzle-kit migrate (some PG features unsupported), so we apply DDL directly.
  // NOTE: keep this in sync with the migration in backend/drizzle/. If it drifts, the tests fail loudly.
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL UNIQUE,
      ai_provider text NOT NULL DEFAULT 'gemini',
      api_key_encrypted text,
      default_niche text NOT NULL DEFAULT 'travel',
      enabled_platforms text[] NOT NULL DEFAULT ARRAY['youtube','instagram','facebook']::text[],
      platform_config jsonb,
      learned_weights jsonb,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
  `
  await pool.query(schemaSql)

  testDrizzle = drizzle(pool as unknown as ConstructorParameters<typeof drizzle>[0], { schema })
  testDbInstance = mem

  // Wire the pg-mem-backed drizzle into the app so route handlers see this DB.
  vi.doMock('../src/db/index.js', () => ({ db: testDrizzle }))

  return { db: testDrizzle, pool, mem }
}

export async function resetTestDb() {
  if (!testDrizzle) return
  await (testDrizzle as ReturnType<typeof drizzle>).execute(
    'DELETE FROM settings' as unknown as Parameters<typeof testDrizzle.execute>[0],
  )
}
