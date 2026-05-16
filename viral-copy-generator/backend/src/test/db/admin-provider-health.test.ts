import { describe, it } from 'vitest'

// Wave 0 stubs for Plan 04 (admin_provider_health Drizzle table).
// Each it.todo becomes a real test in Plan 04 Task 2.
describe('admin_provider_health Drizzle schema (VERIFY-05 prerequisite)', () => {
  it.todo('table accepts insert with provider, model_id, status, latency_ms, error_message, checked_at')
  it.todo('id column auto-generates UUID')
  it.todo('checked_at defaults to NOW()')
  it.todo('error_message is nullable when status=ok')
  it.todo('composite index (provider, model_id, checked_at) exists in generated migration SQL')
  it.todo('standalone index (checked_at) exists for cleanup query')
  it.todo('NO RLS policies on this table (admin-scoped, matches trend_cache pattern)')
  it.todo('migration file is additive only (does NOT touch RLS on other tables — Pitfall 2)')
})
