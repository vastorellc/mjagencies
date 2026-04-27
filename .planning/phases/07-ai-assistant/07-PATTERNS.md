# Phase 7: AI Assistant + Anti-Fabrication — Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 18 new/modified files across 6 plans
**Analogs found:** 17 / 18

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| ~~`packages/ai/src/gateway.ts`~~ _(not created)_ | — gateway is `generate-content.ts` | — | — | see note |
| `packages/ai/src/cost-cap.ts` | service | CRUD | `packages/seo/src/config-cache.ts` | role-match |
| `packages/ai/src/pii-redactor.ts` | middleware | transform | `packages/cms/src/hooks/svg-sanitize.ts` | role-match |
| `packages/ai/src/prompt-guard.ts` | middleware | transform | `packages/cms/src/hooks/svg-sanitize.ts` | role-match |
| `packages/ai/src/index.ts` | config | — | `packages/ai/src/index.ts` | exact (extend) |
| `packages/ai/src/editor-actions.ts` | service | request-response | `packages/cms/src/editor/ai-hooks-stub.ts` | exact |
| `apps/web-main/src/actions/ai-editor.ts` | controller | request-response | `apps/web-main/src/actions/seo-score.ts` | exact |
| `apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx` | component | request-response | `apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx` | exact (replace) |
| `packages/cms/src/hooks/anti-fab-validators.ts` | middleware | transform | `packages/cms/src/hooks/content-validators.ts` | exact |
| `packages/cms/src/hooks/ai-disclosure.ts` | middleware | transform | `packages/cms/src/hooks/content-validators.ts` | role-match |
| `packages/cms/src/collections/brand-voice.ts` | model | CRUD | `packages/cms/src/collections/settings.ts` | exact |
| `packages/cms/src/collections/glossary.ts` | model | CRUD | `packages/cms/src/collections/algo-alerts.ts` | role-match |
| ~~`packages/cms/src/collections/banned-phrases.ts`~~ _(not created)_ | — embedded as `avoid_phrases` in `brand_glossary.ts` | — | — | see note |
| `packages/cms/src/collections/index.ts` | config | — | `packages/cms/src/collections/index.ts` | exact (extend) |
| `packages/seo/src/__tests__/anti-fab.test.ts` | test | — | `packages/cms/src/__tests__/content-validators.test.ts` | exact |
| `packages/ai/src/__tests__/pii-redactor.test.ts` | test | — | `packages/cms/src/__tests__/content-validators.test.ts` | role-match |
| `packages/ai/src/__tests__/prompt-guard.test.ts` | test | — | `packages/cms/src/__tests__/content-validators.test.ts` | role-match |
| ~~`packages/ai/src/__tests__/gateway.test.ts`~~ _(not created)_ | — `generate-content.test.ts` covers this | — | — | see note |

---

## Pattern Assignments

### ~~`packages/ai/src/gateway.ts`~~ — NOT a Phase 7 deliverable

> **Architectural decision (Phase 7):** No separate `gateway.ts` file is created.
> `packages/ai/src/generate-content.ts` IS the gateway — extended in Plan 07-01 to add
> per-agency API key resolution, model routing, cost cap enforcement, and metadata tagging.
> Any plan referencing `gateway.ts` should use `generate-content.ts` instead.
> The LiteLLM call pattern, anti-fabrication system prompt, and stub fallback remain in
> `generate-content.ts` (see Plan 07-01 action for the full extended interface).
---

### `packages/ai/src/cost-cap.ts` (service, CRUD)

**Analog:** `packages/seo/src/config-cache.ts`

**Redis key pattern** (lines 26–30):
```typescript
// Follow agency:<id>:<resource> key pattern (CLAUDE.md §8)
const cached = await redis.get(`agency:${agencyId}:seo-config`)
// For cost caps: agency:<id>:ai-budget:used  (current spend in cents)
//                agency:<id>:ai-budget:cap   (monthly cap in cents)
```

**Redis client creation pattern** (lines 14–19):
```typescript
function createRedisClient(): Redis {
  return new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  })
}
```

**Try/finally Redis quit pattern** (lines 26–52):
```typescript
export async function getAgencySeoConfig(agencyId: string): Promise<PluginDefaults> {
  const redis = createRedisClient()
  try {
    const cached = await redis.get(`agency:${agencyId}:seo-config`)
    // ...
    return PLUGIN_DEFAULTS
  } finally {
    await redis.quit()
  }
}
```

---

### `packages/ai/src/pii-redactor.ts` (middleware, transform)

**Analog:** `packages/cms/src/hooks/svg-sanitize.ts`

**Transform-before-pass-through pattern** (lines 25–78):
```typescript
export const svgSanitizeHook: CollectionBeforeOperationHook = async ({ args, operation }) => {
  if (operation !== 'create' && operation !== 'update') return
  const file = args.req?.file as { data?: Buffer; mimetype?: string; size?: number } | undefined
  if (!file?.data || !Buffer.isBuffer(file.data)) return

  // ... transform in place ...

  // Write the sanitized + optimized content back
  file.data = sanitizedBuf
  file.size = sanitizedBuf.byteLength
}
```

**PII redactor applies the same pattern** — a pure transform function:
```typescript
// packages/ai/src/pii-redactor.ts
export function redactPii(text: string): { redacted: string; hadPii: boolean } {
  // Regex patterns for: email, phone (US), SSN, credit card numbers
  // Replace with [REDACTED-EMAIL], [REDACTED-PHONE], etc.
  // Return redacted string + boolean flag for logging (never log actual PII)
}
```

**Dynamic import pattern for heavy deps** (lines 36–40):
```typescript
const [{ JSDOM }, DOMPurifyModule, { optimize }] = await Promise.all([
  import('jsdom'),
  import('dompurify'),
  import('svgo'),
])
```

---

### `packages/ai/src/prompt-guard.ts` (middleware, transform)

**Analog:** `packages/cms/src/hooks/svg-sanitize.ts` + `packages/cms/src/hooks/content-validators.ts`

**Gate-and-throw pattern** (lines 55–62 of svg-sanitize.ts):
```typescript
if (!sanitized || sanitized.trim() === '') {
  throw new Error('SVG sanitization failed: DOMPurify removed all content. Upload rejected (REQ-305).')
}
```

**Prompt guard applies the same pattern:**
```typescript
// packages/ai/src/prompt-guard.ts
export function guardPrompt(prompt: string): string {
  // 1. XML-wrap user content to isolate it from system instructions
  // 2. Detect jailbreak patterns (ignore previous, DAN, etc.)
  // 3. Throw on confirmed injection attempt
  // 4. Return XML-wrapped safe prompt
}
```

---

### `packages/ai/src/editor-actions.ts` (service, request-response)

**Analog:** `packages/cms/src/editor/ai-hooks-stub.ts`

**Existing stub signatures to implement** (lines 26–68):
```typescript
export interface AiActionResult {
  success: boolean
  text: string
  isStub: true  // Change to false in Phase 7
}

export async function aiRewrite(_selection: string, _agencyId: string): Promise<AiActionResult[]>
export async function aiExpand(_selection: string, _agencyId: string): Promise<AiActionResult>
export async function aiShorten(_selection: string, _agencyId: string): Promise<AiActionResult>
export async function aiBrandVoiceRewrite(_selection: string, _agencyId: string): Promise<AiActionResult>
export async function aiGenerateFaq(_content: string, _agencyId: string): Promise<AiActionResult>
export async function aiSuggestInternalLinks(_content: string, _agencyId: string): Promise<AiActionResult>
export async function aiTldr(_content: string, _agencyId: string): Promise<AiActionResult>
export async function aiMetaDescription(_content: string, _agencyId: string): Promise<AiActionResult>
export async function aiAltText(_imageUrl: string, _agencyId: string): Promise<AiActionResult>
```

**These functions replace stubs with real LiteLLM calls using the gateway pattern from `generate-content.ts`.**

---

### `apps/web-main/src/actions/ai-editor.ts` (controller, request-response)

**Analog:** `apps/web-main/src/actions/seo-score.ts`

**Server action auth pattern — copy exactly** (lines 1–29):
```typescript
'use server'
import { requireSession } from '@mjagency/auth'

export interface AiRewriteInput {
  selection: string
  agencyId: string
}

export async function rewriteSelection(input: AiRewriteInput): Promise<AiActionResult[]> {
  // CLAUDE.md Rule 3: auth check as first lines
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')

  // ... call gateway ...
}
```

**generateTldr pattern for conditional LiteLLM env check** (lines 49–70):
```typescript
export async function generateTldr(input: GenerateTldrInput): Promise<string> {
  const session = await requireSession()
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden')

  // Fallback: if LITELLM_API_URL absent, return '' (D-06)
  if (!process.env['LITELLM_API_URL']) return ''

  const { generateContent } = await import('@mjagency/ai')
  // ...
}
```

---

### `apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx` (component, request-response)

**Analog:** `apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx`

**React client component pattern with useAllFormFields + debounce** (lines 1–14):
```typescript
'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useAllFormFields, useDocumentInfo } from '@payloadcms/ui'
```

**500ms debounce pattern** (lines 341–389):
```typescript
useEffect(() => {
  if (timerRef.current) clearTimeout(timerRef.current)
  timerRef.current = setTimeout(() => {
    void (async () => {
      const agencyId = fields['agency_id']?.value as string | undefined
      if (!agencyId) return
      setLoading(true)
      try {
        const result = await computeLiveScore({ ... })
        setScores(result)
      } catch {
        setScoreError(true)
      } finally {
        setLoading(false)
      }
    })()
  }, 500)
}, [fields])
```

**Loading/error state pattern** (lines 316–327):
```typescript
const [loading, setLoading] = useState(false)
const [scoreError, setScoreError] = useState(false)
// ... async handler:
setLoading(true)
try { ... } catch { setScoreError(true) } finally { setLoading(false) }
```

**Existing AiPanel.tsx to replace:** The current stub at `apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx` (lines 17–97) calls `runStub()` — Phase 7 replaces the stub call with real server actions while keeping the same component structure and `--mj-*` token styling.

**--mj-* token-only styling pattern** (lines 45–95 of AiPanel.tsx):
```typescript
style={{
  padding: 'var(--mj-space-4, 16px)',
  border: '1px solid var(--mj-color-border, #e5e7eb)',
  borderRadius: 'var(--mj-radius-md, 6px)',
  // ...
  fontSize: 'var(--mj-text-xs, 11px)',
  color: 'var(--mj-color-text-primary, #111827)',
}}
```

---

### `packages/cms/src/hooks/anti-fab-validators.ts` (middleware, transform)

**Analog:** `packages/cms/src/hooks/content-validators.ts`

**Hook signature pattern — copy exactly** (lines 67–88):
```typescript
import type { CollectionBeforeOperationHook } from 'payload'

export const validateWordCount: CollectionBeforeOperationHook = async ({ args, operation }) => {
  if (operation !== 'create' && operation !== 'update') return
  const data = args.data as Record<string, unknown> | undefined
  if (!data) return

  const isPublish = data['status'] === 'published'
  // ...
  if (wordCount < floor) {
    if (isPublish) {
      throw new Error(`Word count ${wordCount} is below the required minimum...`)
    } else {
      console.warn(`[CMS] Word count warning: ...`)
    }
  }
}
```

**throw-on-publish / warn-on-draft pattern:** Validators throw `Error` to block publish; use `console.warn` at draft. Anti-fab hooks follow the same contract:
- `validateNoUnsourcedStat` — blocks publish if exact stat (e.g. "42%") present without citation
- `validateNoFakeQuote` — blocks publish if quote block lacks attribution source
- `validateNoPlaceholder` — blocks publish if any of `[TODO]`, `[insert]`, `Lorem ipsum`, `Coming soon` present

**Regex helper pattern** (lines 56–61):
```typescript
function hasExactFigures(text: string): boolean {
  const exactFigurePattern = /(?<!\d[-–])\b(\d{1,3}(?:\.\d+)?)\s*%(?!\s*[-–]\s*\d)/g
  return exactFigurePattern.test(text)
}
```

**countWords helper** (lines 35–40):
```typescript
function countWords(lexicalJson: unknown): number {
  if (!lexicalJson) return 0
  const text = JSON.stringify(lexicalJson).replace(/"type":"[^"]+"/g, '')
  const words = text.match(/\b\w{2,}\b/g) ?? []
  return words.length
}
```

---

### `packages/cms/src/hooks/ai-disclosure.ts` (middleware, transform)

**Analog:** `packages/cms/src/hooks/content-validators.ts`

**Same hook signature, same throw/warn contract.** Applied to the `pages` collection alongside existing validators. Checks `ai_content_ratio` field (set by `generateContent()`) and:
- If `ai_content_ratio > 0.7` and `status === 'published'` and `ai_disclosure_added !== true` → throw
- REQ-086, REQ-409

---

### `packages/cms/src/collections/brand-voice.ts` (model, CRUD)

**Analog:** `packages/cms/src/collections/settings.ts`

**Per-agency collection pattern** (lines 53–146):
```typescript
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, superAdminOnly, fieldImmutable } from '../access/collection-access.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id',
  type: 'text',
  required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}

export const brandVoiceCollection: CollectionConfig = {
  slug: 'brand_voice',
  access: {
    read: collectionAccess,
    create: collectionAccess,
    update: collectionAccess,
    delete: superAdminOnly,
  },
  fields: [
    AGENCY_ID_FIELD,
    // tone, style_adjectives, example_phrases, etc.
  ],
}
```

**brand_voice field already exists** in `settings.ts` (lines 92–99) as a `textarea` — Phase 7 promotes it to a full collection with richer fields (tone adjectives, example phrases, writing style guide).

---

### `packages/cms/src/collections/glossary.ts` (model, CRUD)

**Analog:** `packages/cms/src/collections/algo-alerts.ts`

**Per-agency collection with agency_id required** (pattern from settings.ts AGENCY_ID_FIELD). Glossary differs from algo_alerts in that it IS agency-scoped (not global), so use `collectionAccess` not `superAdminOnly`.

**Field pattern for agency-scoped text collections** (algo-alerts.ts lines 16–93):
```typescript
export const algoAlertsCollection: CollectionConfig = {
  slug: 'algo_alerts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'source', 'matched_keywords', 'status', 'createdAt'],
    group: 'SEO',
  },
  access: {
    read: superAdminOnly,
    // ... for glossary: use collectionAccess instead
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'status', type: 'select', defaultValue: 'new', options: [...] },
    // ...
  ],
}
```

---

### ~~`packages/cms/src/collections/banned-phrases.ts`~~ — NOT a separate collection

> **Architectural decision (Phase 7):** No separate `banned-phrases.ts` collection is created.
> Banned phrases are embedded as an `avoid_phrases` array field within
> `packages/cms/src/collections/brand_glossary.ts` (the glossary collection).
> The `avoid_phrases` field is a Payload `array` type with a `phrase` text child field plus
> optional `reason` textarea, co-located with brand glossary terms per agency.
> Any plan referencing `banned-phrases.ts` should instead add `avoid_phrases` to the glossary fields.
---

### `packages/cms/src/collections/index.ts` (config, extension)

**Analog:** `packages/cms/src/collections/index.ts`

Read the existing barrel to understand the export pattern before extending it with `brandVoiceCollection`, `glossaryCollection` (glossary includes `avoid_phrases` array — no separate bannedPhrasesCollection).

---

## Shared Patterns

### Authentication — MANDATORY on every server action
**Source:** `apps/web-main/src/actions/seo-score.ts` lines 26–29
**Apply to:** All server actions in `apps/web-main/src/actions/ai-editor.ts`
```typescript
'use server'
import { requireSession } from '@mjagency/auth'
// ...
const session = await requireSession()
if (session.agencyId !== input.agencyId) throw new Error('Forbidden')
```

### Agency Isolation — Redis key prefix
**Source:** `packages/seo/src/config-cache.ts` lines 29–30
**Apply to:** `packages/ai/src/cost-cap.ts`, all Redis operations
```typescript
// Pattern: agency:<id>:<resource>:<subkey>
`agency:${agencyId}:ai-budget:used`
`agency:${agencyId}:ai-budget:cap`
`agency:${agencyId}:ai-voice:config`
```

### Redis client lifecycle
**Source:** `packages/seo/src/config-cache.ts` lines 14–52
**Apply to:** `packages/ai/src/cost-cap.ts`
```typescript
function createRedisClient(): Redis {
  return new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  })
}
// Always: try { ... } finally { await redis.quit() }
```

### Payload hook signature
**Source:** `packages/cms/src/hooks/content-validators.ts` lines 14, 67
**Apply to:** `packages/cms/src/hooks/anti-fab-validators.ts`, `packages/cms/src/hooks/ai-disclosure.ts`
```typescript
import type { CollectionBeforeOperationHook } from 'payload'

export const validateXxx: CollectionBeforeOperationHook = async ({ args, operation }) => {
  if (operation !== 'create' && operation !== 'update') return
  const data = args.data as Record<string, unknown> | undefined
  if (!data) return
  // ...
}
```

### Payload collection: per-agency with AGENCY_ID_FIELD
**Source:** `packages/cms/src/collections/settings.ts` lines 11–21
**Apply to:** `brand-voice.ts`, `glossary.ts` (banned phrases embedded in glossary as `avoid_phrases` array — no separate banned-phrases.ts collection)
```typescript
import { collectionAccess, superAdminOnly, fieldImmutable } from '../access/collection-access.js'

const AGENCY_ID_FIELD: Field = {
  name: 'agency_id',
  type: 'text',
  required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}
```

### LiteLLM env guard (fallback when env absent)
**Source:** `packages/ai/src/generate-content.ts` lines 56–88
**Apply to:** All LiteLLM calls in `packages/ai/src/generate-content.ts` (the gateway — no separate gateway.ts)
```typescript
const litellmUrl = process.env['LITELLM_API_URL']
const litellmKey = process.env['LITELLM_API_KEY'] ?? ''
if (!litellmUrl) {
  // Return deterministic stub / empty string for CI/local dev
  return { text: '', aiContentRatio: 0, isAiGenerated: true, model: 'stub' }
}
```

### --mj-* token-only styling
**Source:** `apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx` lines 47–97
**Apply to:** All new admin React components
```typescript
style={{
  padding: 'var(--mj-space-4, 16px)',
  border: '1px solid var(--mj-color-border, #e5e7eb)',
  borderRadius: 'var(--mj-radius-md, 6px)',
  color: 'var(--mj-color-text-primary, #111827)',
}}
// ZERO hex literals. Always provide fallback: var(--token, #fallback)
```

### Publish-gate: throw-on-publish / warn-on-draft
**Source:** `packages/cms/src/hooks/content-validators.ts` lines 79–87
**Apply to:** `anti-fab-validators.ts`, `ai-disclosure.ts`
```typescript
if (isPublish) {
  throw new Error(`[rule description] (REQ-XXX).`)
} else {
  console.warn(`[CMS] Warning: ... (draft).`)
}
```

### BullMQ worker: generateContent() dynamic import
**Source:** `packages/seo/src/self-learning/worker.ts` lines 161–163
**Apply to:** Any background worker that calls LiteLLM
```typescript
const { generateContent } = await import('@mjagency/ai')
const result = await generateContent({ prompt, agencySlug, pageType: 'blog', maxTokens: 500 })
const text = result.text  // NOTE: result.text not result (GenerateContentResult.text — Decision in STATE.md)
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| None | — | — | All 18 files have analogs in the codebase |

---

## Metadata

**Analog search scope:** `packages/ai/`, `packages/cms/`, `packages/seo/`, `apps/web-main/src/actions/`, `apps/web-main/src/app/(payload)/admin/components/`
**Files scanned:** 24 source files
**Pattern extraction date:** 2026-04-27

### Critical decisions carried from STATE.md

1. `generateContent()` returns `GenerateContentResult.text` (not raw string) — use `result.text`
2. `requireSession()` not `auth()` for server actions (Decision: `computeLiveScore uses requireSession()`)
3. Per-agency Postgres + RLS + agency_id immutable — apply `fieldImmutable` to `agency_id` on all new collections
4. `jose` only for JWT — no `jsonwebtoken`
5. BullMQ queue prefix: `agency:<id>:bull` via `REDIS_KEY.bullPrefix(agencyId)`
6. Anti-fabrication system prompt already wired in `generate-content.ts` — `generate-content.ts` IS the gateway (no separate gateway.ts). Phase 7 extended it in Plan 07-01; preserve the anti-fab system prompt.
7. AI hooks stubs in Phase 5 (`isStub: true`) — Phase 7 replaces stubs; `ai-hooks-stub.ts` is replaced, not extended
