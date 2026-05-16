import { describe, it } from 'vitest'

// Wave 0 stubs for Plan 05 (provider-health-check pg-boss job).
// Each it.todo becomes a real test in Plan 05 Task 2.
describe('runProviderHealthCheck (VERIFY-05)', () => {
  it.todo('writes one row per model in MODELS (8 rows on success)')
  it.todo('fail-partial: when one provider SDK throws, other providers still insert rows')
  it.todo('writes status="error", error_message="No HEALTHCHECK_<provider>_KEY env var configured" when key absent — does NOT throw')
  it.todo('cleanup keeps last 30 rows per (provider, model_id) — older rows deleted')
  it.todo('records latency_ms for each successful ping')
  it.todo('classifies SDK 404 as status="model_not_found"')
  it.todo('classifies SDK 401 as status="invalid_key"')
  it.todo('classifies SDK 429 as status="rate_limited"')
  it.todo('classifies SDK 5xx as status="service_unavailable"')
})

describe('registerProviderHealthCheckJob pg-boss wiring (VERIFY-05)', () => {
  it.todo('calls createQueue("provider-health-check") BEFORE schedule() — Pitfall 1')
  it.todo('schedule cron is "0 7 * * 1" (Mondays 7am UTC = noon PKT)')
  it.todo('swallows duplicate-schedule error on restart (idempotent registration)')
  it.todo('worker callback lazy-imports provider-health.ts (avoids circular dep)')
})
