import { describe, it } from 'vitest'

// Wave 0 stubs for Plan 03 (extended validate-key with model verification).
// Each it.todo becomes a real test in Plan 03 Task 2.
describe('POST /api/settings/validate-key — model verification (VERIFY-03)', () => {
  it.todo('returns key_valid=true, model_valid=true, capabilities populated when valid (key, model) — OpenAI')
  it.todo('returns key_valid=true, model_valid=true, capabilities populated when valid (key, model) — Claude')
  it.todo('returns key_valid=true, model_valid=true, capabilities populated when valid (key, model) — Gemini')
  it.todo('returns key_valid=true, model_valid=true, capabilities populated when valid (key, model) — DeepSeek')
  it.todo('returns error_kind="model_not_found" + model_valid=false when SDK throws 404 (OpenAI code=model_not_found)')
  it.todo('returns error_kind="model_not_found" when SDK throws 404 (Claude err.error.error.type=not_found_error — triple nesting per Pitfall 3)')
  it.todo('returns error_kind="model_not_found" when SDK throws 404 (Gemini status=NOT_FOUND)')
  it.todo('returns error_kind="model_not_found" when DeepSeek throws 404 via OpenAI SDK shim')
  it.todo('returns error_kind="invalid_key" + key_valid=false when SDK throws 401 — all 4 providers')
  it.todo('returns error_kind="rate_limited" when SDK throws 429')
  it.todo('returns error_kind="service_unavailable" when SDK throws 5xx')
  it.todo('defaults model_id to defaultModelFor(provider) when caller omits it')
})
