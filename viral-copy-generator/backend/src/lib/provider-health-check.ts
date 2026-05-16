// backend/src/lib/provider-health-check.ts
// Phase 11 VERIFY-05 — Weekly provider health check worker.
// Iterates MODELS (8 entries), pings each (provider, model) with a 2-stage probe
// (models.retrieve + 1-token generation), inserts results into admin_provider_health,
// and cleans up to keep only the last 30 rows per (provider, model_id).
//
// Security (T-11-05): HEALTHCHECK_*_KEY values are NEVER logged or returned in responses.
// Error messages are truncated at 500 chars to prevent key fragments leaking via SDK exceptions.
import { sql } from 'drizzle-orm'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { db } from '../db/index.js'
import { admin_provider_health } from '../db/schema.js'
import { MODELS, type AIProvider } from './models.js'

// ── Types ─────────────────────────────────────────────────────────────────────

type HealthStatus =
  | 'ok'
  | 'model_not_found'
  | 'invalid_key'
  | 'rate_limited'
  | 'service_unavailable'
  | 'error'
  | 'not_configured'

interface HealthResult {
  provider: AIProvider
  model_id: string
  status: HealthStatus
  latency_ms: number
  error_message: string | null
}

// ── Key resolver ──────────────────────────────────────────────────────────────
// Returns the HEALTHCHECK_*_KEY env var for a given provider.
// Never logs the value — only absence is communicated.
// IMPORTANT: NEVER prefix these vars with NEXT_PUBLIC_ — server-side only (T-11-05, Pitfall 8).
function getSystemKey(provider: AIProvider): string | undefined {
  switch (provider) {
    case 'openai':   return process.env.HEALTHCHECK_OPENAI_KEY
    case 'claude':   return process.env.HEALTHCHECK_ANTHROPIC_KEY
    case 'gemini':   return process.env.HEALTHCHECK_GOOGLE_KEY
    case 'deepseek': return process.env.HEALTHCHECK_DEEPSEEK_KEY
  }
}

// ── Error classifier ──────────────────────────────────────────────────────────
// Maps SDK error shapes to canonical HealthStatus values.
// Each provider SDK uses a different error shape — classified separately.
function classifyError(err: unknown, provider: AIProvider): HealthStatus {
  const e = err as {
    status?: number | string
    code?: string
    message?: string
    error?: { error?: { type?: string } }
  }
  const status = e.status
  const code = e.code

  if (provider === 'claude') {
    const nestedType = e.error?.error?.type
    if (status === 401 || nestedType === 'authentication_error') return 'invalid_key'
    if (status === 404 || nestedType === 'not_found_error') return 'model_not_found'
    if (status === 429) return 'rate_limited'
    if (typeof status === 'number' && status >= 500) return 'service_unavailable'
  } else if (provider === 'openai' || provider === 'deepseek') {
    // Both use the OpenAI SDK (DeepSeek is OpenAI-compatible)
    if (status === 401 || code === 'invalid_api_key') return 'invalid_key'
    if (status === 404 || code === 'model_not_found') return 'model_not_found'
    if (status === 429) return 'rate_limited'
    if (typeof status === 'number' && status >= 500) return 'service_unavailable'
  } else {
    // gemini — Google GenAI SDK uses string status codes for gRPC errors
    const msg = e.message ?? ''
    if (status === 'UNAUTHENTICATED' || status === 401 || /API_KEY_INVALID/i.test(msg)) return 'invalid_key'
    if (status === 'NOT_FOUND' || status === 404 || /model.*not found/i.test(msg)) return 'model_not_found'
    if (status === 'RESOURCE_EXHAUSTED' || status === 429) return 'rate_limited'
    if (typeof status === 'number' && status >= 500) return 'service_unavailable'
  }
  return 'error'
}

// ── Single-model probe ────────────────────────────────────────────────────────
// Two-stage probe: (1) models.retrieve to verify the model exists, then
// (2) 1-token generation to confirm the key has generation permissions.
// Never throws — all errors are caught and classified.
async function pingModel(model: { id: string; provider: AIProvider }): Promise<HealthResult> {
  // Check for service-level key — missing key produces 'not_configured' (never throws)
  const apiKey = getSystemKey(model.provider)
  if (!apiKey) {
    const varName = `HEALTHCHECK_${model.provider === 'claude' ? 'ANTHROPIC' : model.provider.toUpperCase()}_KEY`
    return {
      provider: model.provider,
      model_id: model.id,
      status: 'not_configured',
      latency_ms: 0,
      error_message: `No ${varName} env var configured`,
    }
  }

  const t0 = Date.now()
  try {
    if (model.provider === 'openai' || model.provider === 'deepseek') {
      const client = new OpenAI({
        apiKey,
        // DeepSeek is OpenAI-compatible — different base URL, no /v1 path suffix
        ...(model.provider === 'deepseek' && { baseURL: 'https://api.deepseek.com' }),
      })
      // Stage 1: verify model exists (404 → model_not_found)
      await client.models.retrieve(model.id)
      // Stage 2: 1-token generation to confirm key has generation permissions
      await client.chat.completions.create({
        model: model.id,
        max_tokens: 1,
        messages: [{ role: 'user', content: '1' }],
      })
    } else if (model.provider === 'claude') {
      const client = new Anthropic({ apiKey })
      // Stage 1: verify model exists
      await client.models.retrieve(model.id)
      // Stage 2: 1-token generation
      await client.messages.create({
        model: model.id,
        max_tokens: 1,
        messages: [{ role: 'user', content: '1' }],
      })
    } else {
      // gemini — uses @google/genai (NOT @google/generative-ai — different package)
      const client = new GoogleGenAI({ apiKey })
      // Stage 1: get model metadata (throws NOT_FOUND if model id is wrong)
      await client.models.get({ model: model.id })
      // Stage 2: 1-token generation
      await client.models.generateContent({
        model: model.id,
        contents: [{ role: 'user', parts: [{ text: '1' }] }],
        config: { maxOutputTokens: 1 },
      })
    }
    return {
      provider: model.provider,
      model_id: model.id,
      status: 'ok',
      latency_ms: Date.now() - t0,
      error_message: null,
    }
  } catch (err) {
    const status = classifyError(err, model.provider)
    // Truncate error message at 500 chars — prevents SDK exceptions from leaking key fragments (T-11-05)
    const message = ((err as Error).message ?? 'unknown').slice(0, 500)
    return {
      provider: model.provider,
      model_id: model.id,
      status,
      latency_ms: Date.now() - t0,
      error_message: message,
    }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * runProviderHealthCheck — called by the pg-boss worker registered in boss.ts.
 *
 * Fail-partial isolation: each (provider, model) is wrapped independently.
 * One provider outage cannot suppress other providers' health data.
 *
 * Cleanup: DELETE WHERE ROW_NUMBER > 30 per (provider, model_id) keeps storage bounded.
 * With 8 models × 52 weeks: max ~416 live rows if cleanup never ran — cleanup keeps it at 240.
 */
export async function runProviderHealthCheck(): Promise<void> {
  const results: HealthResult[] = []

  // Fail-partial: each model probed independently — one failure does NOT block others
  for (const model of Object.values(MODELS)) {
    try {
      results.push(await pingModel(model))
    } catch (err) {
      // pingModel itself never throws, but defense-in-depth:
      results.push({
        provider: model.provider,
        model_id: model.id,
        status: 'error',
        latency_ms: 0,
        error_message: ((err as Error).message ?? 'unknown').slice(0, 500),
      })
    }
  }

  // Bulk-insert all results in a single Drizzle insert (1 round-trip)
  if (results.length > 0) {
    await db.insert(admin_provider_health).values(
      results.map((r) => ({
        provider: r.provider,
        model_id: r.model_id,
        status: r.status,
        latency_ms: r.latency_ms,
        error_message: r.error_message,
      }))
    )
  }

  // Inline cleanup — keep last 30 rows per (provider, model_id).
  // Uses ROW_NUMBER() OVER (PARTITION BY provider, model_id ORDER BY checked_at DESC)
  // and deletes any row where rn > 30. This bounds storage growth indefinitely.
  await db.execute(sql`
    DELETE FROM admin_provider_health
    WHERE id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY provider, model_id ORDER BY checked_at DESC
        ) AS rn
        FROM admin_provider_health
      ) t WHERE rn <= 30
    )
  `)

  console.log(`[provider-health-check] processed ${results.length} models`)
}
