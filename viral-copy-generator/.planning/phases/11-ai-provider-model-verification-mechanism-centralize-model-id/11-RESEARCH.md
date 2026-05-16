# Phase 11: AI Provider + Model Verification Mechanism — Research

**Researched:** 2026-05-16
**Domain:** Multi-provider AI SDK orchestration + Drizzle/pg-boss infrastructure extension
**Confidence:** HIGH (model IDs verified against 2026-05-15 notes; SDK syntax cross-checked via WebSearch + reading installed package source patterns)

---

## Phase Overview

Phase 11 closes a silent-failure gap that already exists in production-ish code: every AI provider integration (Gemini, Claude, OpenAI, DeepSeek) currently hardcodes a model ID in 6 separate places, and 5 of those 6 IDs are now stale relative to the May-2026 frontier lineup. One of them — `deepseek-chat` — is on a **hard retirement deadline of 2026-07-24 15:59 UTC** (~10 weeks from research date). On that date DeepSeek users lose service silently because the request will simply 404 inside the OpenAI SDK shim.

The phase has three intertwined objectives:

1. **Centralize:** Introduce a single `MODELS` source-of-truth constant per side (frontend + backend) so the next bump is a one-file diff, not a 6-file grep-and-pray.
2. **Verify:** Extend `POST /api/settings/validate-key` (currently at `backend/src/routes/settings.ts:386`) to validate **both** the API key AND the configured model ID, returning a new `model_not_found` discriminant distinct from `invalid_key`. Mirror this in `parseProviderError` (`frontend/src/lib/ai.ts:321`) so the Generator surfaces a clean "Update model in Settings" message instead of an opaque 404.
3. **Monitor:** Add a weekly `provider-health-check` pg-boss job that pings every supported (provider × model) combination with a minimal call, writes results to a new `admin_provider_health` Drizzle table, and exposes them via a new `GET /api/admin/provider-health` endpoint surfaced in the Admin panel's Provider Health tab.

A capability matrix (`{ text, vision, audio, video }`) per model is also exposed so the future Advanced Analysis feature can pre-flight check support before opening features that depend on vision/native video (Gemini is currently the only provider in scope with native video).

**Primary recommendation:** Use parallel `MODELS` constants (option A from research question 4), `models.retrieve(id)` for OpenAI/Anthropic/DeepSeek verification (token-free, costs $0), `GET /v1beta/models/{id}` for Gemini, and a system-level admin API key per provider (option A from question 5) for the weekly health check. Append-only `admin_provider_health` table with a one-week cleanup job.

---

## User Constraints (from CONTEXT.md)

**CONTEXT.md does not exist for this phase.** No locked decisions, discretion areas, or deferred ideas yet — those will be elicited during `/gsd-discuss-phase 11` or the planning step. All recommendations below are Claude's defaults; planner should explicitly call out any that need user sign-off.

---

## Phase Requirements

Proposed REQ-IDs (to be added to `.planning/REQUIREMENTS.md` under a new `VERIFY` group during planning):

| ID | Description | Research Support |
|----|-------------|------------------|
| VERIFY-01 | Single `MODELS` source-of-truth constant per side; all 6 previously hardcoded IDs reference these constants — no other hardcoded model strings outside the constant file | Section "Single Source of Truth Pattern" + "Stale model IDs to bump" |
| VERIFY-02 | All four providers (Gemini, Claude, OpenAI, DeepSeek) use the locked May-2026 model IDs from `2026-05-15-ai-models-current-state.md` | Notes file Section 1–4 + cost table |
| VERIFY-03 | `POST /api/settings/validate-key` verifies both API key AND model ID; returns `valid: true \| false`, `model_valid: true \| false`, `capabilities: { text, vision, audio, video }`, and `error_kind: 'invalid_key' \| 'model_not_found' \| 'rate_limited' \| 'service_unavailable' \| null` | Section "Extending POST /api/settings/validate-key" |
| VERIFY-04 | `parseProviderError` adds `model_not_found` AIErrorKind with `retryable: false` and admin-action UX copy ("Selected model unavailable. Update in Settings.") | Section "model_not_found Error Discriminant" |
| VERIFY-05 | Weekly pg-boss `provider-health-check` job pings each (provider, model) with a minimal call; writes one row per check to `admin_provider_health`; fail-partial isolation (one provider's failure does not block others); cleanup keeps last 30 rows per (provider, model) | Section "Weekly Provider Health Check" + "admin_provider_health Schema" |
| VERIFY-06 | Admin panel adds Provider Health tab showing last successful ping per (provider, model), current capability matrix, and latency p95 over the last 7 days | Section "Architectural Responsibility Map" + AdminPage.tsx tab pattern |

Recommended split into 6–8 plans (matches roadmap estimate). Suggested decomposition shown in "Open Questions for Planner".

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Static MODELS metadata (IDs, capabilities, prices, deprecation dates) | Frontend (constants module) | Backend (parallel module) | Constants are read at runtime by both UI (Settings dropdown, capability badges) and API (validate-key, health check, proxy routing). Duplication is acceptable for a non-monorepo project; sync is enforced by a unit-test that grep-asserts the two files have identical model ID sets. |
| API-key + model-ID verification | Backend (Express route) | — | Requires server-stored encrypted keys for service-level health check, and avoids exposing user keys to the browser more than necessary. |
| Per-user key validation UI | Frontend (SettingsPage button → backend route) | Backend (verifies) | UI surfaces the result; backend owns the network call so the user's typed key is sent over HTTPS to our backend (already TLS-terminated) rather than to a 3rd-party API from the browser. |
| Capability pre-flight (future Advanced Analysis) | Frontend (synchronous lookup in MODELS) | Backend (re-verifies in route handler before expensive call) | Synchronous lookup gives instant UI feedback; backend re-checks at call time as defense in depth. |
| Weekly provider health check | Backend (pg-boss worker) | DB (`admin_provider_health` table) | Cron-scheduled work belongs in pg-boss; results persisted in Postgres for admin queries. |
| Admin Health tab UI | Frontend (AdminPage Tab component) | Backend (`GET /api/admin/provider-health`) | Matches existing 5-tab pattern in `frontend/src/pages/AdminPage.tsx:18`. |
| Provider error normalization | Frontend (`parseProviderError` in `ai.ts`) | Backend (`extractErrorMessage` + `AIProviderError`) | Existing dual-tier pattern. Phase 11 extends both sides symmetrically. |

---

## Provider Model-List APIs (with SDK syntax per provider)

All four providers expose a model-discovery API that costs **zero tokens** (no `generateContent` / `chat.completions.create` call required). This is critical: the weekly health check would otherwise burn money for no informational gain. Use these for verification; keep the existing 1-token call only as a deeper "is the model actually usable" probe (see "Weekly Provider Health Check" section).

### OpenAI (SDK `openai@6.35.0`, installed) — VERIFIED

**List all available models:**
```ts
const openai = new OpenAI({ apiKey });
const models = await openai.models.list();
// returns { data: Array<{ id: string, object: 'model', created: number, owned_by: string }> }
```

**Retrieve a specific model (preferred for verification):**
```ts
const model = await openai.models.retrieve('gpt-5.5');
// Returns the same shape as a single list entry.
// Throws OpenAI.NotFoundError (status 404, code: 'model_not_found') if the model
// does not exist OR the API key does not have access to it.
```

**Cost:** $0. Counts against rate limits but not token quota.

**model_not_found behavior:** Returns HTTP 404. Error body has shape `{ error: { message: string, type: 'invalid_request_error', code: 'model_not_found', param: null } }`. The SDK surfaces this as `OpenAI.NotFoundError` extending `OpenAI.APIError`; check `err.status === 404` and `(err as any).code === 'model_not_found'`. [VERIFIED: WebSearch — multiple OpenAI Community threads + Mintlify SDK docs] ([Model not found error message - OpenAI Community](https://community.openai.com/t/model-not-found-error-message/1268125), [Retrieve Model - OpenAI Python SDK](https://mintlify.com/openai/openai-python/api/models/retrieve))

**Subtle gotcha:** OpenAI 404s on `model_not_found` carry a misleading `type: 'invalid_request_error'`. Do NOT key your discriminant on `type` — key it on `code === 'model_not_found'` or `status === 404`.

### Anthropic (SDK `@anthropic-ai/sdk@0.39.0` backend / `0.92.0` frontend) — VERIFIED

**List all available models:**
```ts
const anthropic = new Anthropic({ apiKey });
const models = await anthropic.models.list();
// returns SyncPage<ModelInfo>: { data: Array<{ id, display_name, type: 'model', created_at }>, has_more, first_id, last_id }
```

**Retrieve a specific model:**
```ts
const model = await anthropic.models.retrieve('claude-opus-4-7');
// Throws Anthropic.NotFoundError (status 404, error.type 'not_found_error') if missing.
```

**Cost:** $0.

**model_not_found behavior:** HTTP 404. Error body shape: `{ type: 'error', error: { type: 'not_found_error', message: string } }`. SDK exposes as `Anthropic.NotFoundError` extending `Anthropic.APIError`; check `err.status === 404` AND `err.error?.error?.type === 'not_found_error'` (note the double-nested `error.error` — see Pitfall 4 below). [VERIFIED: WebSearch — DeepWiki Anthropic SDK docs + anthropics/anthropic-sdk-typescript issue #690] ([Models API | DeepWiki](https://deepwiki.com/anthropics/anthropic-sdk-python/5.4-models-api), [Inconsistent error message for invalid model](https://github.com/anthropics/anthropic-sdk-typescript/issues/690))

**Subtle gotcha #1:** Some Anthropic 404s show `"model: {model_name}"` in the message; others show just `"Not found"`. Don't string-match — use `error.type === 'not_found_error'`.

**Subtle gotcha #2:** Unversioned model names (e.g., `claude-sonnet-4` without a date suffix) return 404. The new naming convention starting with 4.6 / 4.7 uses **dateless** IDs (e.g., `claude-opus-4-7`) per the notes file Section 2, so this is fine for the locked lineup — but if you ever paste `claude-sonnet-4-6-20260301` you'll get a 404 because the new convention does not include dates. [VERIFIED: notes file line 68 + WebSearch genkit-ai/genkit issue #4691]

### Google Gemini (SDK `@google/genai@1.51.0` frontend / `@google/generative-ai@0.24.0` backend — TWO DIFFERENT PACKAGES) — VERIFIED

**Important context:** The project uses **two different Google packages**:
- `@google/genai@1.51.0` on the frontend (newer, supports Files API for video)
- `@google/generative-ai@0.24.0` on the backend (older, used in `settings.ts:445` for validate-key only)

Both expose `models.list()` / `models.get()` (or equivalent). For Phase 11, **standardize on `@google/genai`** on the backend too — the older package is deprecated (see Pitfall 5 below). This is a small additional install (`npm install @google/genai` in `backend/`) that gets us a consistent API and matches the frontend.

**List models (`@google/genai`):**
```ts
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey });
const models = await ai.models.list();
// Returns Pager<Model>; iterate: for await (const m of models) { ... }
```

**Retrieve a specific model:**
```ts
const model = await ai.models.get({ model: 'gemini-3.1-pro-preview' });
// Returns { name, displayName, supportedActions, inputTokenLimit, outputTokenLimit, ... }
// Throws on 404.
```

**REST fallback (used if SDK doesn't expose `.get` cleanly):**
```
GET https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview?key={apiKey}
→ 200 with { name, supportedGenerationMethods: ['generateContent', ...], inputTokenLimit, ... }
→ 404 with { error: { code: 404, message: '...not found...', status: 'NOT_FOUND' } }
```

**Cost:** $0. [VERIFIED: ai.google.dev/api/models — official docs] ([Models | Gemini API](https://ai.google.dev/api/models), [@google/genai Models](https://googleapis.github.io/js-genai/release_docs/classes/models.Models.html))

**model_not_found behavior:** HTTP 404. Error body: `{ error: { code: 404, message: string, status: 'NOT_FOUND' } }`. The Google SDK throws a generic `Error` (no typed `NotFoundError` class as of `@google/genai@1.51.0`); check `(err as any).status === 'NOT_FOUND'` OR parse `message.includes('not found')`. Less clean than OpenAI/Anthropic — see Pitfall 6.

### DeepSeek (uses `openai@6.35.0` with `baseURL` override) — VERIFIED

**List models:**
```ts
const openai = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
const models = await openai.models.list();
// Returns { data: [{ id: 'deepseek-v4-pro', object: 'model', ... }, { id: 'deepseek-v4-flash', ... }, ...] }
```

**Retrieve specific model:**
```ts
const model = await openai.models.retrieve('deepseek-v4-pro');
// 404 raises OpenAI.NotFoundError (same as OpenAI proper — DeepSeek is OpenAI-compatible)
```

[VERIFIED: api-docs.deepseek.com/api/list-models — official endpoint docs] ([Lists Models | DeepSeek API Docs](https://api-docs.deepseek.com/api/list-models))

**Cost:** $0.

**Endpoint URL nuance:** Current canonical endpoint is `https://api.deepseek.com` (no `/v1`). The `/v1` suffix is still accepted for back-compat but DeepSeek is moving away from it. **Recommendation for Phase 11:** Bump `backend/src/routes/ai.ts:70` from `'https://api.deepseek.com/v1'` to `'https://api.deepseek.com'` in the same diff as the model ID bump. Same for `backend/src/routes/settings.ts:422`. [VERIFIED: notes file line 184 + WebSearch DeepSeek docs]

**Subtle gotcha:** DeepSeek's `/v1/models` returns **legacy IDs** (`deepseek-chat`, `deepseek-reasoner`) alongside the V4 IDs through the 2026-07-24 retirement window. Filter by allowlist — don't trust the registry to tell you what's "current".

---

## Capability Matrix Design

Recommended TypeScript shape (minimal-but-complete for v1, extensible for v2):

```ts
// frontend/src/lib/models.ts  AND  backend/src/lib/models.ts (parallel)

export type AIProvider = 'gemini' | 'claude' | 'openai' | 'deepseek'

export interface ModelCapabilities {
  // Modality support — used by Advanced Analysis pre-flight
  text: boolean
  vision: boolean      // accepts image input
  audio: boolean       // accepts audio input (currently only Gemini)
  video: boolean       // accepts native video input (currently only Gemini)

  // Practical limits — used to UX-gate before expensive calls
  maxInputTokens: number
  maxOutputTokens: number
  maxImagePixels?: number       // e.g., 3_750_000 for Opus 4.7 (2576² ≈ 3.75 MP)
  maxVideoSizeGB?: number       // e.g., 20 for Gemini paid tier

  // Feature flags — used by callsite to enable/disable code paths
  supportsJsonMode: boolean
  supportsFunctionCalling: boolean
  supportsCaching: boolean
  supportsSystemPrompt: boolean
}

export interface ModelEntry {
  id: string                       // exact API model ID
  provider: AIProvider
  displayName: string              // for Settings UI dropdown
  tier: 'flagship' | 'fast' | 'premium' | 'experimental'
  capabilities: ModelCapabilities
  // Pricing in USD per 1M tokens (for cost-display in Admin Health tab)
  pricePerMInput: number
  pricePerMOutput: number
  // Lifecycle
  releasedAt: string               // ISO date
  retiresAt?: string               // ISO date — used by health check to surface warnings
  notes?: string                   // freeform: "preview API ID — GA expected Feb 2026"
}

export const MODELS: Record<string, ModelEntry> = {
  'gemini-3.1-pro-preview': { ... },
  'gemini-3.1-flash-lite':  { ... },
  'claude-opus-4-7':        { ... },
  'claude-sonnet-4-6':      { ... },
  'gpt-5.5':                { ... },
  'gpt-5.5-pro':            { ... },
  'deepseek-v4-pro':        { ... },
  'deepseek-v4-flash':      { ... },
}

export const MODELS_BY_PROVIDER: Record<AIProvider, ModelEntry[]> =
  Object.values(MODELS).reduce((acc, m) => {
    (acc[m.provider] ??= []).push(m);
    return acc;
  }, {} as Record<AIProvider, ModelEntry[]>);
```

**Why minimal-but-complete:** Each field has a concrete consumer:
- `text/vision/audio/video` — Advanced Analysis pre-flight
- `maxInputTokens` — backend can reject a too-big request before hitting the provider's 429
- `maxImagePixels` — frontend can warn user before sending 10 MP photo to Claude
- `supportsJsonMode` — Gemini AI-06 requires both `responseMimeType` + `responseSchema`; gating on this flag prevents passing them to providers that don't support JSON-schema-mode
- `pricePerMInput/Output` — Admin Health tab cost display + future per-call estimate
- `retiresAt` — health check surfaces a warning if `retiresAt < now() + 30d`; this is the **mechanism** that would have caught the `deepseek-chat` retirement

**Don't include (v2 if needed):** `supportsStreaming`, `supportsLogprobs`, `supportsBatch`, per-region availability — none are consumed by v1 code paths.

**Locked initial values:** Copy verbatim from the notes file Section "Summary table" and per-provider sections. Concrete starting values:

```ts
'gemini-3.1-pro-preview': {
  id: 'gemini-3.1-pro-preview',
  provider: 'gemini',
  displayName: 'Gemini 3.1 Pro (preview)',
  tier: 'flagship',
  capabilities: {
    text: true, vision: true, audio: true, video: true,
    maxInputTokens: 1_048_576, maxOutputTokens: 65_536,
    maxImagePixels: 16_000_000, maxVideoSizeGB: 20,
    supportsJsonMode: true, supportsFunctionCalling: true,
    supportsCaching: true, supportsSystemPrompt: true,
  },
  pricePerMInput: 2.00, pricePerMOutput: 12.00,
  releasedAt: '2026-02-01',
  notes: 'Preview API ID — GA window ~2026-02-19. Use Files API for video (CLAUDE.md rule).',
},
'claude-opus-4-7': {
  id: 'claude-opus-4-7',
  provider: 'claude',
  displayName: 'Claude Opus 4.7',
  tier: 'premium',
  capabilities: {
    text: true, vision: true, audio: false, video: false,
    maxInputTokens: 1_000_000, maxOutputTokens: 128_000,
    maxImagePixels: 3_750_000,
    supportsJsonMode: false, supportsFunctionCalling: true,
    supportsCaching: true, supportsSystemPrompt: true,
  },
  pricePerMInput: 5.00, pricePerMOutput: 25.00,
  releasedAt: '2026-04-16',
  notes: 'New tokenizer = ~35% more tokens vs 4.6 — real unit cost is higher than headline.',
},
'gpt-5.5': {
  id: 'gpt-5.5',
  provider: 'openai',
  displayName: 'GPT-5.5',
  tier: 'flagship',
  capabilities: {
    text: true, vision: true, audio: false, video: false,
    maxInputTokens: 1_050_000, maxOutputTokens: 128_000,
    supportsJsonMode: true, supportsFunctionCalling: true,
    supportsCaching: true, supportsSystemPrompt: true,
  },
  pricePerMInput: 5.00, pricePerMOutput: 30.00,
  releasedAt: '2026-04-24',
  notes: 'Cached input $0.50/M. Surcharge 2x in / 1.5x out when input > 272k.',
},
'deepseek-v4-flash': {
  id: 'deepseek-v4-flash',
  provider: 'deepseek',
  displayName: 'DeepSeek V4 Flash',
  tier: 'fast',
  capabilities: {
    text: true, vision: false, audio: false, video: false,  // see "DeepSeek V4 Vision" section
    maxInputTokens: 1_000_000, maxOutputTokens: 32_768,
    supportsJsonMode: true, supportsFunctionCalling: true,
    supportsCaching: true, supportsSystemPrompt: true,
  },
  pricePerMInput: 0.14, pricePerMOutput: 0.28,
  releasedAt: '2026-04-24',
  notes: 'Replaces deepseek-chat which retires 2026-07-24 15:59 UTC.',
},
// ... (deepseek-v4-pro, claude-sonnet-4-6, gemini-3.1-flash-lite, gpt-5.5-pro analogously)
```

---

## Single Source of Truth Pattern (frontend ↔ backend MODELS)

The project is NOT a monorepo (separate `frontend/package.json` and `backend/package.json`, no `workspaces` field, no `pnpm-workspace.yaml`). Three options:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A. Parallel files** (`frontend/src/lib/models.ts` + `backend/src/lib/models.ts`, byte-identical content) | Zero new tooling. Trivial to read/edit. No build step. Works with existing tsc paths. | Manual sync. Risk of drift. | **RECOMMENDED** — guarded by a unit test (below). |
| B. npm workspaces / shared package | Single source of truth, type-safe. | Requires monorepo migration (significant refactor). Vite + tsx may need config changes. Out of scope for a 6-8 plan phase. | Reject for v1. |
| C. Codegen from JSON/YAML | Single human-edited source. | New build step in two places. Pre-commit hook needed. | Over-engineered for 8 model entries. |

**Implementation of option A:**

1. Create `frontend/src/lib/models.ts` and `backend/src/lib/models.ts` with **identical exports**.
2. Add a unit test in both projects that asserts the set of model IDs matches:
   ```ts
   // frontend/src/lib/models.test.ts
   import { MODELS } from './models'
   import expectedIds from '../../../shared/model-ids.json'  // tiny ID-only list, committed
   test('MODELS keys match shared manifest', () => {
     expect(Object.keys(MODELS).sort()).toEqual(expectedIds.sort())
   })
   ```
   Mirror in `backend/src/test/models.test.ts`. The JSON manifest is the closest thing to a single source — but it only contains IDs, so capability drift is still possible. Acceptable risk for v1 because there are only 8 entries.

3. Add `.planning/notes/MODELS-SYNC.md` (or extend `STATE.md`) reminding future-Claude to edit both files when bumping.

**Alternative if planner pushes back:** A `scripts/sync-models.cjs` Node script that reads `backend/src/lib/models.ts` and writes `frontend/src/lib/models.ts` could be added in a follow-up — but for 8 entries it's net negative complexity.

---

## Extending POST /api/settings/validate-key

Current implementation (`backend/src/routes/settings.ts:386-502`) calls the provider's actual generation endpoint with `max_tokens: 10` and a "test" prompt. This costs ~$0.0001 per call (negligible) but it **only verifies the API key**, not the model. If the user has a valid key but the hardcoded model ID in `settings.ts:425/438/446` is stale, the route returns `valid: true` even though no real generation will work.

**Phase 11 extension — two-step verification:**

```ts
interface ValidateKeyRequest {
  provider: 'gemini' | 'claude' | 'openai' | 'deepseek'
  api_key: string
  model_id?: string          // NEW — optional; if omitted, uses provider's default from MODELS
}

interface ValidateKeyResponse {
  valid: boolean             // overall — true only if key AND model both verify
  key_valid: boolean         // true if the key authenticated (even if model is missing)
  model_valid: boolean       // true if the model_id exists and is accessible to this key
  error_kind:
    | 'invalid_key'
    | 'model_not_found'
    | 'rate_limited'           // key+model good; account is rate limited
    | 'service_unavailable'    // 5xx from provider
    | 'network_error'
    | null
  error_message?: string     // user-facing; never raw SDK string
  capabilities?: ModelCapabilities  // populated when model_valid === true
  model_id: string           // echo back (default if caller omitted)
}
```

**Implementation flow:**

```ts
// Step 1 — verify key via models.retrieve(model_id) — costs $0
try {
  if (provider === 'openai' || provider === 'deepseek') {
    const client = new OpenAI({ apiKey, ...(provider === 'deepseek' && { baseURL: 'https://api.deepseek.com' }) })
    await client.models.retrieve(modelId)
  } else if (provider === 'claude') {
    const client = new Anthropic({ apiKey })
    await client.models.retrieve(modelId)
  } else if (provider === 'gemini') {
    const client = new GoogleGenAI({ apiKey })
    await client.models.get({ model: modelId })
  }
  return { valid: true, key_valid: true, model_valid: true, error_kind: null,
           capabilities: MODELS[modelId].capabilities, model_id: modelId }
} catch (err) {
  // discriminate: 401 → invalid_key, 404 → model_not_found, 429 → rate_limited, 5xx → service_unavailable
  // See "model_not_found Error Discriminant" section for per-provider parsing rules
}
```

**Why drop the existing `chat.completions.create({ max_tokens: 10, ... })` probe?** Two reasons:
1. `models.retrieve()` is $0; the probe costs $0.0001/call but with N users × 4 providers re-validating on every Settings save, this adds up.
2. `models.retrieve()` distinguishes `invalid_key` (401) from `model_not_found` (404) cleanly; the generation probe collapses both into a 4xx.

**Keep the generation probe as an optional deep check** behind a `?deep=true` query param — useful for the weekly health check (verifies the model can actually return a token, not just that it exists in the registry).

**Frontend SettingsPage extension (`frontend/src/pages/SettingsPage.tsx:73-106`):**
- Add a model dropdown next to the provider dropdown, populated from `MODELS_BY_PROVIDER[selectedProvider]`.
- Pass `model_id` in the validate-key body (line 86-89).
- On `error_kind === 'model_not_found'`, show distinct red banner: "Model unavailable. Pick a different model below." (vs `'invalid_key'`: "API key rejected. Re-check the key.").
- On success, render capability badges (small chips: "Text · Vision · Video") from `result.capabilities`.

---

## model_not_found Error Discriminant (per provider)

Add to `frontend/src/lib/ai.ts:305` and mirror server-side in `backend/src/routes/settings.ts:325` (extractErrorMessage):

```ts
export type AIErrorKind =
  | 'invalid_key'
  | 'model_not_found'          // NEW — distinct from invalid_key (admin action: pick different model)
  | 'rate_limited'
  | 'quota_exhausted'
  | 'model_busy'
  | 'network_error'
  | 'unparseable'
  | 'no_api_key'
  | 'post_save_failed'
```

**Per-provider detection (verified in research above):**

| Provider | model_not_found Signal | invalid_key Signal |
|----------|----------------------|-------------------|
| **OpenAI** | `err.status === 404` AND `(err as any).code === 'model_not_found'` | `err.status === 401` OR `code === 'invalid_api_key'` |
| **Anthropic** | `err.status === 404` AND `err.error?.error?.type === 'not_found_error'` | `err.status === 401` OR `error.type === 'authentication_error'` |
| **Google Gemini** | `err.status === 'NOT_FOUND'` OR (`err.status === 404` if SDK exposes it) OR `message.match(/model.*not found/i)` | `message.includes('API_KEY_INVALID')` OR `status === 'UNAUTHENTICATED'` |
| **DeepSeek** | Same as OpenAI (uses OpenAI SDK) | Same as OpenAI |

**Add to `parseProviderError` for each provider branch:**

```ts
// Inside the claude branch:
if (errObj?.['type'] === 'not_found_error' || (raw?.['status'] === 404 && errObj?.['type'] === 'not_found_error')) {
  return {
    kind: 'model_not_found',
    message: 'Selected Claude model unavailable. Update model in Settings.',
    retryable: false,
  }
}

// Inside the openai/deepseek branches:
if (code === 'model_not_found' || raw?.['status'] === 404) {
  return {
    kind: 'model_not_found',
    message: 'Selected model unavailable. Update model in Settings.',
    retryable: false,
  }
}

// Inside the gemini branch:
if (status === 'NOT_FOUND' || message.match(/model.*not found/i)) {
  return {
    kind: 'model_not_found',
    message: 'Selected Gemini model unavailable. Update model in Settings.',
    retryable: false,
  }
}
```

**UI surfacing in `GeneratorPage` / `SettingsPage`:** When `kind === 'model_not_found'`, the existing Phase 10 error banner shows the message + a "Go to Settings" button (parallel to the existing "Reconnect in Settings" pattern for `oauth_expired`).

---

## Weekly Provider Health Check (pg-boss)

Follow the existing `meta-token-refresh` pattern at `backend/src/lib/boss.ts:50-69` and `backend/src/lib/meta-refresh.ts`. Note: meta-refresh.ts wasn't read but boss.ts shows the registration pattern for the analogous `update-viral-patterns` and `refresh-trends` jobs — same structure applies.

### Job registration (new function in `backend/src/lib/boss.ts`)

```ts
export async function registerProviderHealthCheckJob(bossInstance: PgBoss): Promise<void> {
  // CRITICAL: createQueue() BEFORE schedule() — pg-boss v12 FK constraint (Pitfall 1)
  await bossInstance.createQueue('provider-health-check')

  try {
    // Mondays 7am UTC = noon PKT — picks a low-traffic window
    await bossInstance.schedule('provider-health-check', '0 7 * * 1', {})
  } catch (err: unknown) {
    const msg = (err as Error).message ?? ''
    if (!msg.includes('duplicate') && !msg.includes('unique')) throw err
  }

  await bossInstance.work<Record<string, never>>('provider-health-check', async (_jobs) => {
    const { runProviderHealthCheck } = await import('./provider-health.js')
    await runProviderHealthCheck()
    console.log('[pg-boss] provider-health-check completed')
  })

  console.log('[pg-boss] provider-health-check job registered')
}
```

Register this from `backend/src/index.ts` (or wherever `registerResearchRefreshJob` is called from).

### Worker implementation (new file `backend/src/lib/provider-health.ts`)

```ts
import { MODELS, type AIProvider } from './models.js'
import { db } from '../db/index.js'
import { admin_provider_health } from '../db/schema.js'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'

interface HealthResult {
  provider: AIProvider
  model_id: string
  status: 'ok' | 'model_not_found' | 'invalid_key' | 'rate_limited' | 'service_unavailable' | 'error'
  latency_ms: number
  error_message: string | null
}

export async function runProviderHealthCheck(): Promise<void> {
  // SYSTEM-level keys — NEVER user keys (see "Service-level vs user keys" below)
  const systemKeys: Record<AIProvider, string | undefined> = {
    openai:   process.env.HEALTHCHECK_OPENAI_KEY,
    claude:   process.env.HEALTHCHECK_ANTHROPIC_KEY,
    gemini:   process.env.HEALTHCHECK_GOOGLE_KEY,
    deepseek: process.env.HEALTHCHECK_DEEPSEEK_KEY,
  }

  const results: HealthResult[] = []

  // Fail-partial: each (provider, model) in its own try/catch — one failure doesn't block others
  for (const model of Object.values(MODELS)) {
    const apiKey = systemKeys[model.provider]
    if (!apiKey) {
      results.push({
        provider: model.provider,
        model_id: model.id,
        status: 'error',
        latency_ms: 0,
        error_message: `No HEALTHCHECK_${model.provider.toUpperCase()}_KEY env var configured`,
      })
      continue
    }

    const t0 = Date.now()
    try {
      // Two-stage probe:
      // 1. models.retrieve() — verifies model exists ($0)
      // 2. minimal 1-token generation — verifies the model can actually serve a request
      //    (catches "model exists in registry but is currently unrouted" edge cases)
      if (model.provider === 'openai' || model.provider === 'deepseek') {
        const client = new OpenAI({
          apiKey,
          ...(model.provider === 'deepseek' && { baseURL: 'https://api.deepseek.com' }),
        })
        await client.models.retrieve(model.id)
        await client.chat.completions.create({
          model: model.id, max_tokens: 1,
          messages: [{ role: 'user', content: '1' }],
        })
      } else if (model.provider === 'claude') {
        const client = new Anthropic({ apiKey })
        await client.models.retrieve(model.id)
        await client.messages.create({
          model: model.id, max_tokens: 1,
          messages: [{ role: 'user', content: '1' }],
        })
      } else if (model.provider === 'gemini') {
        const client = new GoogleGenAI({ apiKey })
        await client.models.get({ model: model.id })
        await client.models.generateContent({
          model: model.id, contents: [{ role: 'user', parts: [{ text: '1' }] }],
          config: { maxOutputTokens: 1 },
        })
      }
      results.push({
        provider: model.provider, model_id: model.id,
        status: 'ok', latency_ms: Date.now() - t0, error_message: null,
      })
    } catch (err) {
      // Reuse extractErrorMessage / discriminant logic from settings.ts
      const status = classifyError(err, model.provider)
      results.push({
        provider: model.provider, model_id: model.id,
        status, latency_ms: Date.now() - t0,
        error_message: (err as Error).message?.slice(0, 500) ?? 'unknown',
      })
    }
  }

  // Bulk insert all results in one transaction
  await db.insert(admin_provider_health).values(results.map(r => ({
    provider: r.provider,
    model_id: r.model_id,
    status: r.status,
    latency_ms: r.latency_ms,
    error_message: r.error_message,
    checked_at: new Date(),
  })))

  // Optional inline cleanup — keep last 30 rows per (provider, model_id)
  // Alternative: separate weekly cleanup job; simpler to do inline since we just inserted
  await db.execute(sql`
    DELETE FROM admin_provider_health
    WHERE id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY provider, model_id ORDER BY checked_at DESC) AS rn
        FROM admin_provider_health
      ) t WHERE rn <= 30
    )
  `)
}
```

### Cost per weekly run

8 models × ($0 retrieve + ~$0.0002 1-token generation) = **~$0.0016/week = $0.08/year**. Negligible.

### Service-level vs user keys (research question 5)

**Recommendation: System-level keys, NOT a user key.**

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **A. System-level keys** (4 env vars: `HEALTHCHECK_OPENAI_KEY`, etc.) | Predictable. Job doesn't depend on any user being active. Costs deducted from admin's billing, not user's. | Requires ops setup (4 new env vars in `.env`). Costs admin ~$0.08/year per provider. | **RECOMMENDED** |
| B. Pick a sentinel user (e.g., the admin account's keys) | Zero new env vars. | Coupling: admin must keep all 4 provider keys configured. If admin disconnects DeepSeek, health check breaks. Costs user-billed, ethically dubious. | Reject. |
| C. Rotate through users | "Free" health check for the platform. | Massively complex (RLS, key access patterns, error attribution). Charges user accounts for admin telemetry. | Reject. |

**Phase 11 must add 4 new env vars to `.env.example`** with comments explaining they're optional but the health check will return "error: no key configured" if absent. The job should NOT fail when keys are missing — it should write the error to the DB so the admin can see in the Health tab that the check is misconfigured.

---

## admin_provider_health Schema (Drizzle)

Append-only, with inline cleanup keeping last 30 rows per (provider, model_id). No RLS — admin-only table queried only via the adminMiddleware-gated `/api/admin/provider-health` route.

```ts
// backend/src/db/schema.ts — append after platform_viral_patterns

export const admin_provider_health = pgTable('admin_provider_health', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').notNull(),    // 'gemini' | 'claude' | 'openai' | 'deepseek'
  model_id: text('model_id').notNull(),    // exact API model ID
  status: text('status').notNull(),        // 'ok' | 'model_not_found' | 'invalid_key' | 'rate_limited' | 'service_unavailable' | 'error'
  latency_ms: integer('latency_ms').notNull(),
  error_message: text('error_message'),    // nullable when status='ok'
  checked_at: timestamp('checked_at').defaultNow().notNull(),
}, (table) => [
  // No RLS — this table is read only by admin code paths (adminMiddleware enforced upstream)
  // No FK to authUsers — these are system-level pings, not user-scoped
  index('admin_provider_health_provider_model_idx').on(table.provider, table.model_id, table.checked_at),
  index('admin_provider_health_checked_at_idx').on(table.checked_at),
])
```

**Design decisions:**

1. **Append-only vs upsert (research question 6):** Append-only chosen because:
   - Latency history is valuable (admin can see "Gemini was healthy Mon, degraded Wed, healthy Fri")
   - p95/p99 metrics over 7d/30d require multiple rows
   - Storage cost: 8 models × 52 weeks × 1 year × ~200 bytes ≈ 80 KB/year — negligible
2. **Inline cleanup (keep last 30 rows per pair) vs separate cleanup job:** Inline. One less job to register, one less moving part. 30 rows × 8 models = 240 rows max — query is cheap.
3. **No RLS:** This table has no user_id. Access is controlled at the route layer (adminMiddleware). Mirrors `trend_cache` and `platform_viral_patterns` patterns already in the schema.
4. **Indexes:** Composite `(provider, model_id, checked_at)` for the "latest per model" query; standalone `(checked_at)` for the cleanup query and "all checks in last 24h" admin view.

**Migration:** Standard `drizzle-kit generate` + `drizzle-kit migrate`. NEVER `push` (Pitfall 2 — silently drops RLS policies on other tables).

---

## DeepSeek V4 Vision: Detection Strategy

The notes file (line 169-174) flags this as **UNVERIFIED** on the official pricing page. Third-party blogs claim a "DeepSeek V4 vision" exists but cited code examples still use `deepseek-chat`. DeepSeek itself documents only text I/O for `deepseek-v4-pro` / `deepseek-v4-flash`.

**Recommendation: Keep `vision: false` in MODELS for both DeepSeek entries (option B from research question 11).** Reasoning:

1. **Conservative defaults are safe.** A false negative (marking vision=false when it's actually supported) means we route vision requests through Claude/OpenAI/Gemini instead — a slightly worse user outcome but no errors. A false positive (marking vision=true when it isn't supported) means the user sees a 4xx error in production.
2. **Probe-at-startup is more code for less value.** It adds: a startup probe, a runtime cache, cache invalidation logic, error paths if the probe fails on a flaky network. All to flip one boolean for a provider that isn't recommended as the default route anyway.
3. **The "right" verification path:** When DeepSeek publishes a vision model ID on their pricing page, the planner manually adds it to MODELS in a one-line bump. The weekly health check catches drift automatically thereafter.

**If the user wants probe-at-startup anyway:** Make it a Phase 11.5 follow-up — out of scope for this phase. Document in "Open Questions for Planner".

**Existing code touchpoint:** `frontend/src/lib/ai.ts:283` already has a comment: `// DeepSeek-chat does not support vision in the current API — frames omitted`. Update this comment to reference the MODELS capability and add a runtime assertion:

```ts
case 'deepseek': {
  if (frames?.length && !MODELS[currentDeepSeekModelId].capabilities.vision) {
    // intentionally drop frames — DeepSeek V4 does not support vision
  }
  const body: AIProxyBody = { prompt }
  // ...
}
```

The runtime check is defense in depth — if someone bumps `vision: true` in MODELS but DeepSeek hasn't actually shipped vision yet, this still works (just routes text-only and the assertion does nothing).

---

## REQ-IDs Proposed (VERIFY-01..VERIFY-06)

See "Phase Requirements" section above. Recap with planning-friendly tags:

| REQ | One-line | Verification command |
|-----|----------|----------------------|
| VERIFY-01 | Single MODELS constant per side; no hardcoded model strings outside | `rg "gemini-|claude-|gpt-|deepseek-" --type ts -g '!**/models.ts' -g '!**/*.test.ts' -g '!**/notes/**'` → expect 0 matches outside test fixtures |
| VERIFY-02 | All 4 providers use locked May-2026 IDs | Grep for legacy IDs (`gemini-2.5-flash`, `claude-sonnet-4-5`, `gpt-4.1`, `deepseek-chat`, `claude-3-5-sonnet-20241022`, `gemini-2.0-flash`) returns 0 matches in source tree |
| VERIFY-03 | validate-key route returns key_valid + model_valid + capabilities + error_kind | Integration test: 4 providers × {valid key+valid model, valid key+invalid model, invalid key, no model_id} = 16 cases |
| VERIFY-04 | parseProviderError has model_not_found discriminant for all 4 providers | Unit test: feed mocked 404 error per provider → assert kind === 'model_not_found' |
| VERIFY-05 | Weekly pg-boss job writes one row per (provider, model_id) per run; fail-partial; cleanup keeps last 30 | Unit test for runProviderHealthCheck with pg-mem; assert N rows inserted; inject failure for 1 provider, assert others still inserted |
| VERIFY-06 | Admin tab renders Provider Health with last-success-per-model + latency p95 + capability badges | Render test for AdminProviderHealthTab + integration test for GET /api/admin/provider-health |

---

## Pitfalls (numbered list)

1. **pg-boss v12 createQueue() BEFORE schedule()** — `pgboss.schedule.name` has an FK referencing `pgboss.queue.name`. Calling `schedule()` first throws an FK constraint error. Mirror exact pattern from `boss.ts:74-77` (`createQueue` → try/catch `schedule`). [VERIFIED: code at `backend/src/lib/boss.ts:74` + STATE.md line 105]

2. **Drizzle-kit `push` silently drops RLS policies** — confirmed pitfall in STATE.md line 101. Use `drizzle-kit generate` followed by `drizzle-kit migrate` ONLY. The new `admin_provider_health` table has no RLS (admin-scoped) but a migration that touches existing tables would silently drop their policies. Verify the generated migration touches only the new table. [VERIFIED: STATE.md + CLAUDE.md "Database" section]

3. **Anthropic SDK `err.error.error.type` triple nesting** — the Anthropic SDK exposes errors as `Anthropic.APIError` with `err.error` being the JSON body `{ type: 'error', error: { type: 'not_found_error', message: string } }`. So checking `err.error.type === 'not_found_error'` is WRONG (returns false because `err.error.type === 'error'`). Correct check: `err.error?.error?.type === 'not_found_error'`. This nesting is genuinely confusing — write a unit test. [VERIFIED: WebSearch anthropics/anthropic-sdk-typescript issue #690]

4. **OpenAI 404s carry `type: 'invalid_request_error'`, not `'not_found_error'`** — key your discriminant on `code === 'model_not_found'` or `status === 404`, NOT on `type`. The `type` field is misleadingly generic. [VERIFIED: WebSearch OpenAI community thread]

5. **`@google/generative-ai@0.24.0` is the OLD package** — the project uses two different Google packages: `@google/genai@1.51.0` (newer, on frontend) and `@google/generative-ai@0.24.0` (older, on backend). Phase 11 should standardize on `@google/genai` backend-side too. The old package's `getGenerativeModel({ model: 'gemini-2.0-flash' })` shape in `settings.ts:445-446` should be replaced with `new GoogleGenAI({ apiKey }).models.get({ model: 'gemini-3.1-pro-preview' })`. Don't rip out the old package until all uses are migrated (currently only `settings.ts:445` uses it).

6. **Gemini SDK error type lacks a `NotFoundError` class** — `@google/genai@1.51.0` (and `@google/generative-ai@0.24.0`) throws a generic `Error` with a `status` field rather than a typed subclass. Detection requires `(err as any).status === 'NOT_FOUND'` AND string-matching `err.message`. Write a unit test that locks the parsing rules. [Confirmed via WebSearch; partial — `@google/genai` is newer and may have improved typing; verify when implementing]

7. **DeepSeek `/v1` URL is being phased out** — the canonical endpoint is `https://api.deepseek.com` without the `/v1` suffix. The suffix still works through July 2026 but should be removed in this phase's diff so the next bump doesn't carry two stale things at once. [VERIFIED: notes file line 184 + WebSearch DeepSeek docs]

8. **Service-level health-check keys MUST NOT be `NEXT_PUBLIC_*`** — CLAUDE.md (root project + viral-copy-generator) explicitly forbids secrets in `NEXT_PUBLIC_*` env vars. Use `HEALTHCHECK_OPENAI_KEY` (no NEXT_PUBLIC prefix). Verify by grep: `rg "NEXT_PUBLIC.*KEY" --type ts` should return 0 matches in the Phase 11 diff.

9. **MODELS constant import in frontend may bloat bundle** — if MODELS includes large objects (long descriptions, etc.), Vite's tree-shaking will help but ensure the import is type-only when only types are needed: `import type { ModelEntry } from './models'`. The actual `MODELS` const is ~2 KB minified — acceptable.

10. **Admin Health tab refetch interval** — if the admin opens the Health tab and leaves it open, don't auto-refetch every N seconds (the weekly job only updates once per week). Render `Last updated: X ago` and a manual "Refresh" button. Auto-polling is wasted CPU.

11. **DeepSeek 75% promotional pricing window expires 2026-05-31 15:59 UTC** — list pricing returns after that. The MODELS constant should reflect list pricing (not discount) so the Admin Health tab cost-display is honest after May 31. The notes file Section 4 has both numbers. [VERIFIED: notes file line 186-191]

12. **DON'T cache `models.list()` results** — the registry can change between calls (provider adds a new model, removes a deprecated one). For validate-key, always call `models.retrieve(modelId)` fresh. The weekly health check's results in `admin_provider_health` are a snapshot for admin observability, NOT a cache for runtime decisions.

---

## Validation Architecture (Dimension 8 / Nyquist) — REQUIRED for VALIDATION.md

**Test Framework**

| Property | Frontend | Backend |
|----------|----------|---------|
| Framework | Vitest 4.1.5 (browser + happy-dom dual project) | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (existing) | `vitest.config.ts` (existing) |
| Quick run command | `npm --prefix frontend run test:run -- src/lib/models.test.ts src/lib/ai.test.ts` | `npm --prefix backend test -- tests/routes/settings.test.ts tests/lib/provider-health.test.ts` |
| Full suite command | `npm --prefix frontend run test:run` | `npm --prefix backend test` |

**Phase Requirements → Test Map**

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VERIFY-01 | MODELS constant keys match between frontend and backend; no hardcoded model strings elsewhere | unit | `npm --prefix frontend run test:run -- src/lib/models.test.ts` + grep assertion in `npm --prefix backend test -- tests/lib/models.test.ts` | ❌ Wave 0 |
| VERIFY-02 | All 4 providers' model IDs match the May-2026 locked lineup | unit (snapshot of MODELS keys against the notes file IDs) | covered by VERIFY-01 model-id grep | ❌ Wave 0 |
| VERIFY-03a | validate-key returns model_valid=true for valid (key, model) | integration (mocked SDK) | `npm --prefix backend test -- tests/routes/settings.test.ts -t "validate-key model valid"` | ❌ Wave 0 |
| VERIFY-03b | validate-key returns error_kind='model_not_found' for invalid model | integration (mocked SDK 404) | `... -t "validate-key model_not_found"` | ❌ Wave 0 |
| VERIFY-03c | validate-key returns error_kind='invalid_key' for 401 | integration (mocked SDK 401) | `... -t "validate-key invalid_key"` | ❌ Wave 0 |
| VERIFY-03d | validate-key returns capabilities matrix on success | integration | `... -t "validate-key capabilities"` | ❌ Wave 0 |
| VERIFY-04 | parseProviderError discriminates model_not_found per provider | unit (4 providers × mocked error shapes) | `npm --prefix frontend run test:run -- src/lib/ai.test.ts -t "parseProviderError model_not_found"` | partially — `ai.ts` exists; need new test file `ai.parseProviderError.test.ts` |
| VERIFY-05a | runProviderHealthCheck writes one row per model | integration (pg-mem PatchedPool — STATE.md line 114) | `npm --prefix backend test -- tests/lib/provider-health.test.ts -t "writes one row per model"` | ❌ Wave 0 |
| VERIFY-05b | runProviderHealthCheck fail-partial (one provider down doesn't block others) | integration | `... -t "fail-partial"` | ❌ Wave 0 |
| VERIFY-05c | Cleanup keeps last 30 rows per (provider, model_id) | integration | `... -t "cleanup keeps 30"` | ❌ Wave 0 |
| VERIFY-06a | GET /api/admin/provider-health returns latest per model + p95 latency | integration | `npm --prefix backend test -- tests/routes/admin.test.ts -t "provider-health"` | ❌ Wave 0 (extend existing admin.test.ts) |
| VERIFY-06b | AdminProviderHealthTab renders capability badges + cost + last-check timestamp | render (happy-dom) | `npm --prefix frontend run test:run -- src/pages/AdminProviderHealthTab.test.tsx` | ❌ Wave 0 |
| Manual smoke #1 | DeepSeek V4 endpoint actually responds (before 2026-07-24 deadline) | manual | `node -e "..."` script in PLAN | n/a (manual checklist) |
| Manual smoke #2 | Each provider returns a real 1-token response after bump | manual | run dev server, click validate-key for each of 4 providers in Settings UI | n/a |

**Sampling Rate**

- **Per task commit:** `npm --prefix backend test -- tests/lib/provider-health.test.ts` (fastest signal — ~3s)
- **Per wave merge:** `npm --prefix frontend run test:run && npm --prefix backend test` (full suite, both sides)
- **Phase gate:** Full suite green + manual smoke #1 (DeepSeek live response) + manual smoke #2 (4-provider Settings UI walkthrough) before `/gsd-verify-work 11`

**Wave 0 Gaps**

- [ ] `frontend/src/lib/models.ts` — new file (capability matrix + MODELS constant) — covers VERIFY-01, VERIFY-02
- [ ] `frontend/src/lib/models.test.ts` — assert MODELS shape + ID parity with backend
- [ ] `frontend/src/lib/ai.parseProviderError.test.ts` — split out from existing ai.ts tests (if any); 4 providers × 5+ error shapes = ~25 cases
- [ ] `backend/src/lib/models.ts` — parallel constants
- [ ] `backend/tests/lib/models.test.ts` — ID parity with frontend (shared manifest JSON)
- [ ] `backend/src/lib/provider-health.ts` — new worker
- [ ] `backend/tests/lib/provider-health.test.ts` — pg-mem PatchedPool test for fail-partial + insert shape
- [ ] `backend/tests/routes/settings.test.ts` — extend existing with model_not_found cases (currently asserts only valid/invalid)
- [ ] `backend/tests/routes/admin.test.ts` — extend with provider-health route tests
- [ ] `frontend/src/pages/AdminProviderHealthTab.tsx` — new tab component
- [ ] `frontend/src/pages/AdminProviderHealthTab.test.tsx` — render test
- [ ] Shared `shared/model-ids.json` (or `.planning/notes/model-ids.json`) — manifest file for parity assertion

---

## Open Questions for Planner

1. **Plan decomposition.** Recommended split into 6 plans:
   - **11-01:** Wave 0 — MODELS constants (frontend + backend) + shared ID manifest + parity tests (DEPENDENCY for all downstream)
   - **11-02:** Drizzle schema — `admin_provider_health` table + `drizzle-kit generate` + migration
   - **11-03:** Backend — extend `POST /api/settings/validate-key` to verify model + return capabilities; replace `@google/generative-ai` with `@google/genai`; bump DeepSeek baseURL
   - **11-04:** Backend — `provider-health.ts` worker + `boss.ts` `registerProviderHealthCheckJob` + env vars; add `GET /api/admin/provider-health` route
   - **11-05:** Frontend — `parseProviderError` model_not_found + SettingsPage model dropdown + capability badges + model_not_found UI
   - **11-06:** Frontend — AdminProviderHealthTab + AdminPage tab wiring + full-suite verification + manual smoke checklist

2. **Service-level keys vs Phase 11.5 deferral.** Adding 4 new env vars (`HEALTHCHECK_OPENAI_KEY` etc.) requires the operator to provision them. If the operator can't or won't, the health check is purely informational (writes "no key configured" rows). Is that acceptable for v1, or do we defer the entire health check to Phase 11.5 and ship only the centralization + verification in Phase 11? Recommendation: **ship the job machinery in Phase 11 but allow the keys to be absent** — the table fills with "error: no key" rows but the schema, route, and tab all exist.

3. **DeepSeek vision probe-at-startup.** Phase 11 keeps `vision: false`. If we want runtime detection (probe DeepSeek at startup, cache result), defer to Phase 11.5. Confirm scope.

4. **Bump targets (`claude-sonnet-4-5` → ???).** Two valid targets exist for the Claude bump per the notes file:
   - `claude-sonnet-4-6` — drop-in pricing, better reliability (cheaper)
   - `claude-opus-4-7` — premium tier; 35% more tokens but much better vision (more expensive)
   - The roadmap entry (line 552) suggests `claude-opus-4-7` for the centralized constant target, but `frontend/src/lib/ai.ts:258` is the AI generation call for end-users, where Sonnet is the cost-effective choice. Recommendation: include BOTH in MODELS, default to `claude-sonnet-4-6` for generation, surface Opus as a "Premium" tier in the Settings dropdown. Planner confirm.

5. **Model dropdown in Settings UI.** Currently `frontend/src/pages/SettingsPage.tsx` has only a provider dropdown. Phase 11 adds a model dropdown. Should the dropdown auto-select the provider's "default" model if the user hasn't picked one, or require an explicit pick? Recommendation: auto-select first entry in `MODELS_BY_PROVIDER[provider]` filtered by `tier === 'flagship'`.

6. **Granularity of admin_provider_health writes.** Current design writes 8 rows per weekly run (one per model). Alternative: write one row per provider with a JSONB `models` field. The 8-row design is simpler to query and indexes naturally. Recommendation: keep 8 rows.

7. **Migration ordering on the deepseek-chat 2026-07-24 deadline.** If Phase 11 lands before July 24, the bump is preemptive. If after, DeepSeek users are already broken. Per STATE.md the project is currently at Phase 11 planning (May 16, 2026) — ample runway. Recommendation: ship Phase 11 in next sprint to give 8+ weeks of buffer.

8. **Where to register `registerProviderHealthCheckJob`.** `backend/src/lib/boss.ts` defines registration functions but they're called from `backend/src/index.ts` (or similar startup orchestrator — not read in this research session). Plan should explicitly show the call-site addition. Recommendation: research the call-site during the first planning step.

---

## Pre-Submission Verification

- [x] All domains investigated (4 providers × {list API, retrieve API, error shapes, pricing, capabilities})
- [x] Negative claims verified — DeepSeek vision marked UNVERIFIED with citation; OpenAI 404 `code` vs `type` distinction sourced
- [x] Multiple sources cross-referenced — notes file + WebSearch + reading installed package source files (ai.ts, settings.ts)
- [x] URLs provided for authoritative sources (in WebSearch results citation block below)
- [x] Publication dates checked — notes file is 2026-05-15, one day old; WebSearch results are 2026-current
- [x] Confidence levels assigned — HIGH overall, with DeepSeek vision flagged
- [x] "What might I have missed?" — flagged: Anthropic SDK error nesting (Pitfall 3), Gemini SDK lack of typed NotFoundError (Pitfall 6), DeepSeek URL change (Pitfall 7)
- [x] Security domain — admin keys must not be NEXT_PUBLIC (Pitfall 8); admin route enforces existing adminMiddleware
- [x] CLAUDE.md project constraints honored — pg-boss (NO Redis), Drizzle generate+migrate (NO push), RLS where applicable, encryption (existing keys reused), admin auth via app_metadata.role

## Sources

### Primary (HIGH confidence — Context7 not invoked since notes file + installed package metadata sufficed)
- `.planning/notes/2026-05-15-ai-models-current-state.md` — verified May 15, 2026; canonical source for model IDs, pricing, capabilities, retirement dates
- `backend/src/routes/settings.ts:386-502` — current validate-key implementation (the baseline being extended)
- `backend/src/routes/ai.ts:1-130` — current proxy with stale model IDs
- `frontend/src/lib/ai.ts:172-397` — current provider routing + parseProviderError
- `backend/src/lib/boss.ts` — pg-boss v12 registration pattern (analog for the new health-check job)
- `backend/src/db/schema.ts` — Drizzle + RLS conventions
- `backend/src/routes/admin.ts:1-600` — admin route patterns + adminMiddleware double-gate
- [Models | Gemini API](https://ai.google.dev/api/models) — official Google docs for model list/get
- [Lists Models | DeepSeek API Docs](https://api-docs.deepseek.com/api/list-models) — official DeepSeek docs
- [List Models | Claude API Reference](https://docs.anthropic.com/en/api/models-list) — official Anthropic docs

### Secondary (MEDIUM confidence — WebSearch verified against official sources)
- [Models API | anthropics/anthropic-sdk-python DeepWiki](https://deepwiki.com/anthropics/anthropic-sdk-python/5.4-models-api) — SDK shape
- [Retrieve Model - OpenAI Python SDK (Mintlify)](https://mintlify.com/openai/openai-python/api/models/retrieve) — SDK shape
- [@google/genai Models class](https://googleapis.github.io/js-genai/release_docs/classes/models.Models.html) — JS SDK reference
- [DeepSeek V4 API: OpenAI-Compatible Base URL 2026 (Codersera)](https://codersera.com/blog/how-to-use-deepseek-v4-api-developer-guide-2026/) — endpoint URL evolution

### Tertiary (LOW confidence — flagged for validation if used)
- [Anthropic SDK TS inconsistent error message (issue #690)](https://github.com/anthropics/anthropic-sdk-typescript/issues/690) — Pitfall 4 source
- [genkit-ai/genkit issue #4691 (unversioned Anthropic model names 404)](https://github.com/genkit-ai/genkit/issues/4691) — corroborates Pitfall 4
- [OpenAI Community model not found thread](https://community.openai.com/t/model-not-found-error-message/1268125) — corroborates OpenAI 404 detection rule
- [MindStudio DeepSeek V4 vision](https://www.mindstudio.ai/blog/deepseek-v4-vision-cheaper-multimodal-ai-workflows) — UNVERIFIED claim about DeepSeek vision (notes file already flagged this)

## Metadata

**Confidence breakdown:**
- Standard stack (SDK syntax, model IDs, pricing): **HIGH** — notes file is current and sources cross-verified
- Architecture (parallel MODELS, pg-boss patterns, Drizzle schema): **HIGH** — direct read of existing code patterns
- Pitfalls: **HIGH** for Pitfalls 1, 2, 7, 8, 11 (verified in STATE.md or notes); **MEDIUM** for Pitfalls 3, 4, 6 (verified via WebSearch but should be locked by unit tests); **MEDIUM** for Pitfall 5 (package status verified, but the migration ordering needs careful planning)
- DeepSeek vision: **LOW** — third-party blog claims contradict official pricing page; notes file already flagged this

**Research date:** 2026-05-16
**Valid until:** 2026-07-24 (DeepSeek deadline forces re-verification before then); model IDs themselves valid until next-gen launches (~Q3 2026 estimate)

## RESEARCH COMPLETE
