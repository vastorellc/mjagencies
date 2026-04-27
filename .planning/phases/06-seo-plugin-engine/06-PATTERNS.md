# Phase 6: SEO/AIO/GEO Plugin Engine - Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** 14 new/modified files
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/seo/src/stub-scorer.ts` | utility (replace) | transform | `packages/seo/src/stub-scorer.ts` (self — preserve signature) | exact |
| `packages/seo/src/index.ts` | barrel | transform | `packages/cms/src/collections/index.ts` | exact |
| `packages/seo/src/plugins/seo-classic.ts` | utility/scoring | transform | `packages/seo/src/stub-scorer.ts` + RESEARCH.md Pattern 2 | role-match |
| `packages/seo/src/plugins/aio-citations.ts` | utility/scoring | transform | `packages/seo/src/stub-scorer.ts` + RESEARCH.md Pattern 3 | role-match |
| `packages/seo/src/plugins/geo-chunking.ts` | utility/scoring | transform | `packages/seo/src/stub-scorer.ts` + RESEARCH.md Pattern 4 | role-match |
| `packages/seo/src/lexical-parser.ts` | utility | transform | `packages/cms/src/hooks/content-validators.ts` (`countWords`) | partial-match |
| `packages/seo/src/self-learning/index.ts` | worker | batch | `apps/web-main/instrumentation.node.ts` + `packages/queue/src/encrypted-queue.ts` | role-match |
| `packages/cms/src/collections/faqs.ts` | collection | CRUD | `packages/cms/src/collections/categories.ts` | exact |
| `packages/cms/src/collections/algo-alerts.ts` | collection | event-driven | `packages/cms/src/collections/redirects.ts` + `superAdminOnly` access | role-match |
| `packages/cms/src/collections/pages.ts` | collection (modify) | CRUD | `packages/cms/src/collections/pages.ts` (self — add fields) | exact |
| `packages/cms/src/collections/settings.ts` | collection (modify) | CRUD | `packages/cms/src/collections/settings.ts` (self — add field) | exact |
| `packages/cms/src/hooks/content-validators.ts` | hook (extend) | request-response | `packages/cms/src/hooks/content-validators.ts` (self — add `validateAioTldr`) | exact |
| `apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx` | component (replace) | request-response | `apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx` + existing `SeoPanel.tsx` | exact |
| `apps/web-main/src/jobs/algo-watcher.ts` | worker | event-driven | `apps/web-main/instrumentation.node.ts` + `packages/cms/src/hooks/scheduled-publish.ts` | role-match |

---

## Pattern Assignments

### `packages/seo/src/stub-scorer.ts` (utility, transform — preserve)

**Analog:** `packages/seo/src/stub-scorer.ts` (self)
**Action:** Preserve this file exactly. Phase 6 does not modify it — it remains the backward-compat interface for the content sprint seed script.

**Preserve signature** (lines 11-27):
```typescript
export interface SeoScoreInput {
  text: string
  metaTitle?: string
  metaDescription?: string
  aioTldr?: string
  focusKeyword?: string
}

export interface SeoScoreOutput {
  seoScore: number
  wordCount: number
  internalLinkCount: number
  hasAioTldr: boolean
  metaTitleLength: number
  metaDescriptionLength: number
  passesMinimum: boolean
}

export function computeSeoScoreForContent(input: SeoScoreInput, wordCountFloor = 1500): SeoScoreOutput
```

---

### `packages/seo/src/index.ts` (barrel, extend)

**Analog:** `packages/cms/src/collections/index.ts`

**Current barrel** (lines 1-7 of `packages/seo/src/index.ts`):
```typescript
export { computeSeoScoreForContent } from './stub-scorer.js'
export type { SeoScoreInput, SeoScoreOutput } from './stub-scorer.js'
```

**Extension pattern** — copy the additive import style from `packages/cms/src/collections/index.ts` (lines 1-50). Append new exports below the existing lines without removing them:
```typescript
// New Phase 6 exports appended below Phase 5 exports:
export { runPluginEngine } from './engine.js'
export type { PluginEngineInput, PluginEngineOutput, LiveSeoScore } from './engine.js'
export { scoreSeoClassic } from './plugins/seo-classic.js'
export { scoreAioCitations } from './plugins/aio-citations.js'
export { scoreGeoChunking } from './plugins/geo-chunking.js'
export { parseLexicalJson } from './lexical-parser.js'
export type { LexicalExtracts } from './lexical-parser.js'
export { PLUGIN_DEFAULTS } from './plugin-defaults.js'
```

---

### `packages/seo/src/plugins/seo-classic.ts` (utility/scoring, transform)

**Analog:** `packages/seo/src/stub-scorer.ts` for interface shape; RESEARCH.md Pattern 2 for the algorithm.

**Interface pattern** — copy from `packages/seo/src/stub-scorer.ts` lines 11-27 (typed input/output, explicit return types on all functions per CLAUDE.md §9):
```typescript
export interface SeoClassicConfig {
  titleMinChars: number
  titleMaxChars: number
  metaDescMinChars: number
  metaDescMaxChars: number
  keywordDensityMin: number
  keywordDensityMax: number
  wordCountFloor: number
  internalLinkMin: number
}

export interface SeoClassicResult {
  score: number  // 0-100
  findings: Array<{ rule: string; passed: boolean; detail: string }>
}

export function scoreSeoClassic(
  extracts: LexicalExtracts,
  meta: { title?: string; metaDescription?: string; focusKeyword?: string },
  config: SeoClassicConfig
): SeoClassicResult
```

**Pure function pattern** — no side effects, no I/O; same style as `computeSeoScoreForContent` in `packages/seo/src/stub-scorer.ts` (lines 33-57): take inputs, return output synchronously.

**Error handling pattern** — none needed: pure transform; invalid input returns `score: 0` with a finding, never throws.

---

### `packages/seo/src/plugins/aio-citations.ts` (utility/scoring, transform)

**Analog:** Same pattern as `seo-classic.ts` above.

**Interface shape** (copy from RESEARCH.md Pattern 3 with typed interfaces matching CLAUDE.md §9 strict mode):
```typescript
export interface AioCitationsConfig {
  requiredSourceTypes: string[]
  maxCitationAgeMonths: number
  blockPublishOnUnsourcedStat: boolean
}

export interface AioCitationsResult {
  score: number
  unsourcedStatCount: number
  totalStatCount: number
  findings: Array<{ sentenceSnippet: string; hasAdjacentLink: boolean }>
}

export function scoreAioCitations(
  extracts: LexicalExtracts,
  lexicalRaw: unknown,
  config: AioCitationsConfig
): AioCitationsResult
```

**Stat detection regex pattern** (from RESEARCH.md Pattern 3) — extract STAT_PATTERNS array and `detectUnsourcedStats` logic verbatim into this file.

---

### `packages/seo/src/plugins/geo-chunking.ts` (utility/scoring, transform)

**Analog:** Same pure function pattern as `seo-classic.ts`.

**Interface shape** (from RESEARCH.md Pattern 4):
```typescript
export interface GeoChunkingConfig {
  targetRadius: number
  targetCities: string[]
  chunkCountMin: number
  requiredOnServicePages: boolean
}

export interface GeoChunkingResult {
  score: number
  geoMentionCount: number
  findings: Array<{ city: string; mentionCount: number }>
}

export function scoreGeoChunking(
  extracts: LexicalExtracts,
  pageType: string,
  config: GeoChunkingConfig
): GeoChunkingResult
```

---

### `packages/seo/src/lexical-parser.ts` (utility, transform)

**Analog:** `packages/cms/src/hooks/content-validators.ts`, functions `countWords` (lines 35-39) and `countInternalLinks` (lines 43-53).

The existing `countWords` approach (line 37 — `JSON.stringify(lexicalJson).replace(/"type":"[^"]+"/g, '')`) is the current codebase pattern, but RESEARCH.md confirms this is approximate. The new file uses the recursive walker instead. Use content-validators.ts as the import-style reference.

**Import pattern** (copy from `packages/cms/src/hooks/content-validators.ts` lines 1-13):
```typescript
/**
 * packages/seo/src/lexical-parser.ts
 *
 * Recursive Lexical JSON walker for SEO plugin analysis.
 * Replaces the approximate JSON.stringify approach in content-validators.ts
 * for per-plugin scoring that requires accurate heading/link extraction.
 */
import type { SerializedEditorState, SerializedLexicalNode } from '@payloadcms/richtext-lexical'
```

**Core walker pattern** — use RESEARCH.md "Full Lexical content extraction" code example as the implementation. The `LexicalExtracts` interface and `parseLexicalJson` function are the primary exports.

**Error handling pattern** — same defensive fallback as `countWords` (content-validators.ts line 36): if input is falsy/invalid, return empty/zero result rather than throwing:
```typescript
export function parseLexicalJson(raw: unknown): LexicalExtracts {
  const state = raw as SerializedEditorState | undefined
  if (!state?.root?.children) {
    return { plainText: '', wordCount: 0, headings: [], internalLinks: 0, paragraphs: [] }
  }
  // ... recursive walk
}
```

---

### `packages/seo/src/self-learning/index.ts` (worker, batch)

**Analog:** `apps/web-main/instrumentation.node.ts` (lines 1-42) for the BullMQ worker pattern; `packages/cms/src/hooks/scheduled-publish.ts` for queue + redis options shape.

**Worker registration pattern** (copy from `apps/web-main/instrumentation.node.ts` lines 8-42):
```typescript
import { createEncryptedWorker } from '@mjagency/queue'

const REDIS_HOST = process.env['REDIS_HOST'] ?? 'localhost'
const REDIS_PORT = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)

createEncryptedWorker<SelfLearningJobData>(
  'seo-self-learning',
  async (job) => {
    // 1. Pull GSC impressions/CTR/position for all agency pages (last 28d)
    // 2. Pull GA4 bounceRate/sessionDuration for same pages (last 28d)
    // 3. Call generateContent() with signals summary prompt → weight adjustment suggestions
    // 4. Write suggestions to seo_suggestions collection with status: 'pending_review'
  },
  { host: REDIS_HOST, port: REDIS_PORT },
)
```

**LiteLLM call pattern** — copy from `packages/ai/src/generate-content.ts` lines 53-131. Use `generateContent({ prompt, agencySlug, pageType: 'blog', maxTokens: 500 })` for the AI tuner step. Fallback to empty suggestions (no throw) when `LITELLM_API_URL` is absent — same as lines 61-88 of generate-content.ts.

**Redis connection pattern** (from `packages/cms/src/hooks/scheduled-publish.ts` lines 49-57):
```typescript
const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)
```

**Google API auth pattern** — use RESEARCH.md Pattern 10 verbatim (googleapis service account + BetaAnalyticsDataClient). No codebase analog — these are new dependencies (`@googleapis/searchconsole`, `@google-analytics/data`).

---

### `packages/cms/src/collections/faqs.ts` (collection, CRUD)

**Analog:** `packages/cms/src/collections/categories.ts` (lines 1-56) — closest match: simple agency-scoped collection with text + richText fields, no hooks.

**Import pattern** (copy from `packages/cms/src/collections/categories.ts` lines 1-11):
```typescript
/**
 * packages/cms/src/collections/faqs.ts
 *
 * Payload 3.82.1 CollectionConfig for the `faqs` collection.
 * Agency-scoped FAQ items for FAQPage JSON-LD generation (REQ-076).
 *
 * REQ-076: FAQ schema auto-generated on publish
 */
import type { CollectionConfig, Field } from 'payload'
import { collectionAccess, deleteAccess, fieldImmutable } from '../access/collection-access.js'
```

**AGENCY_ID_FIELD pattern** (copy exactly from `packages/cms/src/collections/categories.ts` lines 12-18):
```typescript
const AGENCY_ID_FIELD: Field = {
  name: 'agency_id',
  type: 'text',
  required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}
```

**Collection config pattern** (copy structure from `packages/cms/src/collections/categories.ts` lines 20-56):
```typescript
export const faqsCollection: CollectionConfig = {
  slug: 'faqs',
  admin: {
    useAsTitle: 'question',
    defaultColumns: ['question', 'agency_id', 'updatedAt'],
    group: 'SEO',  // matches redirects.ts group convention
  },
  access: {
    read: collectionAccess,
    create: collectionAccess,
    update: collectionAccess,
    delete: deleteAccess,
  },
  fields: [
    AGENCY_ID_FIELD,
    {
      name: 'question',
      type: 'text',
      required: true,
    },
    {
      name: 'answer',
      type: 'textarea',  // plain text for clean JSON-LD output (D-09)
      required: true,
    },
  ],
}
```

---

### `packages/cms/src/collections/algo-alerts.ts` (collection, event-driven)

**Analog:** `packages/cms/src/collections/redirects.ts` for field structure (simple status/date fields); `packages/cms/src/access/collection-access.ts` `superAdminOnly` for access (lines 79-83).

**Critical access pattern** — MUST use `superAdminOnly` for ALL operations (read, create, update, delete). No `collectionAccess`. This is a global collection (no `agency_id`). Copy from `packages/cms/src/collections/settings.ts` line 34 (`delete: superAdminOnly`) but apply to ALL access operations:

```typescript
import { superAdminOnly } from '../access/collection-access.js'

export const algoAlertsCollection: CollectionConfig = {
  slug: 'algo_alerts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'source', 'matched_keywords', 'status', 'createdAt'],
    group: 'SEO',
  },
  access: {
    read: superAdminOnly,
    create: superAdminOnly,
    update: superAdminOnly,
    delete: superAdminOnly,
  },
  fields: [
    // NO agency_id field — this is a global collection (D-12)
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'source',
      type: 'select',
      options: [
        { label: 'Google Search Central', value: 'google_search_central' },
        { label: 'Configurable Feed', value: 'configurable_feed' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'link',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    {
      name: 'matched_keywords',
      type: 'json',
      admin: { description: 'Array of keywords that triggered this alert.' },
    },
    {
      name: 'snippet',
      type: 'textarea',
    },
    {
      name: 'pub_date',
      type: 'date',
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Reviewed', value: 'reviewed' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'guid',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'RSS item GUID used for dedup.',
      },
    },
  ],
}
```

---

### `packages/cms/src/collections/pages.ts` (collection, CRUD — modify)

**Analog:** `packages/cms/src/collections/pages.ts` (self — lines 1-183)

**`aio_tldr` field** — this field already exists at lines 158-165 of `pages.ts`. Phase 6 does NOT need to add it again. Confirm the existing field definition matches D-05:
```typescript
// Already present at lines 158-165 — no change needed:
{
  name: 'aio_tldr',
  type: 'text',
  maxLength: 120,
  admin: {
    position: 'sidebar',
    description: 'AIO TL;DR — required on all indexable pages (REQ-055).',
  },
},
```

**`faqs` relationship field** — add after the existing `aio_tldr` field, following the relationship pattern from `packages/cms/src/collections/posts.ts` lines 96-102:
```typescript
{
  name: 'faqs',
  type: 'relationship',
  relationTo: 'faqs',
  hasMany: true,
  admin: {
    description: 'FAQ items for FAQPage JSON-LD structured data (REQ-076).',
  },
},
```

**`focus_keyword` field** — new field needed for seo-classic keyword density scoring (referenced in SeoPanel.tsx Pattern 5 in RESEARCH.md). Add alongside `meta_title`/`meta_description`:
```typescript
{
  name: 'focus_keyword',
  type: 'text',
  admin: {
    position: 'sidebar',
    description: 'Focus keyword for SEO scoring (seo-classic plugin).',
  },
},
```

**Hook addition** — add `validateAioTldr` to the existing `beforeOperation` array (lines 65-72 of pages.ts). Copy the array extension pattern from the same file:
```typescript
hooks: {
  beforeOperation: [
    validateWordCount,
    validateInternalLinks,
    validatePlaybookNumbers,
    validateFtcDisclaimer,
    validateFtcTestimonial,
    validateAioTldr,  // ADD — Phase 6
  ],
  afterChange: [schedulePublishHook],
},
```

---

### `packages/cms/src/collections/settings.ts` (collection, CRUD — modify)

**Analog:** `packages/cms/src/collections/settings.ts` (self — lines 1-87)

**`seo_plugins` JSON field** — add after the existing `seo_defaults` field (line 68). Use identical pattern to the existing `seo_defaults` field (lines 64-70):
```typescript
// Existing analog at lines 64-70:
{
  name: 'seo_defaults',
  type: 'json',
  admin: {
    description: 'Default SEO configuration applied across all pages.',
  },
},

// ADD immediately after:
{
  name: 'seo_plugins',
  type: 'json',
  admin: {
    description: 'Per-agency SEO plugin weight overrides (merge-patch against global defaults). Keys: seo_classic, aio_citations, geo_chunking, score_thresholds. Leave empty to use global defaults (D-02).',
  },
},
```

**`afterOperation` hook** — add `invalidateSeoConfigCache` hook to the settings collection. Copy the hook registration pattern from `packages/cms/src/collections/media-assets.ts` lines 49-99 (the `afterOperation` array). Reference the `invalidateSeoConfigCache` function from RESEARCH.md Pattern 6 as the implementation guide.

```typescript
// In settingsCollection, add hooks property (currently absent in settings.ts):
hooks: {
  afterOperation: [invalidateSeoConfigCache],
},
```

**RSS feed config fields** (D-10, D-11) — also add to settings:
```typescript
{
  name: 'algo_watcher_feeds',
  type: 'json',
  admin: {
    description: 'Additional RSS feed URLs for algorithm watcher (D-10). Array of strings.',
  },
},
{
  name: 'algo_watcher_keywords',
  type: 'json',
  admin: {
    description: 'Keyword array for RSS match detection (D-11). e.g. ["core update", "helpful content"].',
  },
},
```

---

### `packages/cms/src/hooks/content-validators.ts` (hook, request-response — extend)

**Analog:** `packages/cms/src/hooks/content-validators.ts` (self — lines 1-178). Copy `validateWordCount` (lines 67-88) as the exact template.

**`validateAioTldr` pattern** — copy structure from `validateWordCount` (lines 67-88):
```typescript
// Template from validateWordCount (lines 67-88):
export const validateWordCount: CollectionBeforeOperationHook = async ({ args, operation }) => {
  if (operation !== 'create' && operation !== 'update') return
  const data = args.data as Record<string, unknown> | undefined
  if (!data) return

  const isPublish = data['status'] === 'published'
  // ... check logic
  if (violation) {
    if (isPublish) {
      throw new Error(`... (REQ-XXX).`)
    } else {
      console.warn(`[CMS] ... (draft).`)
    }
  }
}

// New export to add at end of file, following same pattern:
export const validateAioTldr: CollectionBeforeOperationHook = async ({ args, operation }) => {
  if (operation !== 'create' && operation !== 'update') return
  const data = args.data as Record<string, unknown> | undefined
  if (!data) return

  if (data['status'] !== 'published') return  // only enforce at publish

  const pageType = (data['page_type'] as string | undefined) ?? 'blog'
  const noIndexTypes = ['legal']  // from RESEARCH.md validateAioTldr code example
  if (noIndexTypes.includes(pageType)) return

  const tldr = data['aio_tldr'] as string | undefined
  if (!tldr || tldr.trim().length === 0) {
    throw new Error('AIO TL;DR is required on all indexable pages before publishing (REQ-075).')
  }
  if (tldr.length > 120) {
    throw new Error(`AIO TL;DR must be ≤120 characters (current: ${tldr.length}) (REQ-075).`)
  }
}
```

---

### `apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx` (component, request-response — replace)

**Analog:** `apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx` (self — lines 1-105 for `ScoreBar` component and styling tokens); `apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx` (lines 1-97 for `useState`/`loading`/button interaction pattern).

**Keep from current SeoPanel.tsx:**
- `'use client'` directive (line 1)
- `ScoreBar` component (lines 15-54) — copy unchanged
- All CSS variable tokens (`--mj-color-success`, `--mj-color-warning`, etc.)
- The outer `<div>` container + `<h3>` header (lines 63-81)

**Replace from current SeoPanel.tsx:**
- Remove `useDocumentInfo` docConfig approach (lines 57-61)
- Remove `computeSeoScore()` import from `@mjagency/cms`
- Replace with `useAllFormFields` + `useEffect` debounce pattern from RESEARCH.md Pattern 5

**Import pattern** — merge existing imports with new ones:
```typescript
'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useAllFormFields, useDocumentInfo } from '@payloadcms/ui'
// computeLiveScore server action (new — Phase 6):
import { computeLiveScore } from '../../../../../actions/seo-score.js'
import type { LiveSeoScore } from '@mjagency/seo'
```

**State + debounce pattern** (from RESEARCH.md Pattern 5):
```typescript
export default function SeoPanel(): React.ReactElement {
  const [fields] = useAllFormFields()
  const { id } = useDocumentInfo()
  const [scores, setScores] = useState<LiveSeoScore | null>(null)
  const [loading, setLoading] = useState(false)  // copy from AiPanel.tsx line 19
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const agencyId = fields['agency_id']?.value as string | undefined
      if (!agencyId) return
      setLoading(true)
      try {
        const result = await computeLiveScore({ ... })
        setScores(result)
      } finally {
        setLoading(false)
      }
    }, 500)
  }, [fields])
  // render 3 ScoreBars + TL;DR editor + Regenerate button
}
```

**Button interaction pattern** — copy from `AiPanel.tsx` lines 62-80 (onClick handler with `e.preventDefault()`, `disabled={loading}`, inline button style using CSS variable tokens).

**TL;DR editor** — inline `<textarea>` or `<input>` bound to `fields['aio_tldr']?.value` with a character counter `{tldr.length}/120`. Same inline style pattern as the existing `<div>` blocks in `SeoPanel.tsx` lines 88-104.

---

### `apps/web-main/src/jobs/algo-watcher.ts` (worker, event-driven)

**Analog:** `apps/web-main/instrumentation.node.ts` (lines 1-42) for the BullMQ worker structure; `packages/cms/src/hooks/scheduled-publish.ts` (lines 28-72) for queue add + redis config pattern.

**Worker file pattern** (new file, modeled on instrumentation.node.ts lines 8-42):
```typescript
/**
 * apps/web-main/src/jobs/algo-watcher.ts
 *
 * BullMQ repeatable worker for RSS algorithm watcher (REQ-074).
 * Registered at server startup in instrumentation.node.ts.
 * Cron: every 6 hours ('0 */6 * * *').
 */
import { createEncryptedWorker, createEncryptedQueue } from '@mjagency/queue'

export interface AlgoWatcherJobData {
  // Empty — triggered by repeatable schedule, no input data
}

const REDIS_HOST = process.env['REDIS_HOST'] ?? 'localhost'
const REDIS_PORT = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)

// Called from instrumentation.node.ts to register the repeatable trigger + worker
export async function registerAlgoWatcher(): Promise<void> {
  // Register repeatable trigger (idempotency check before add — Pitfall 7):
  const watcherQueue = createEncryptedQueue<AlgoWatcherJobData>('seo-algo-watcher', {
    host: REDIS_HOST,
    port: REDIS_PORT,
  })
  const existing = await (watcherQueue as unknown as { getRepeatableJobs: () => Promise<unknown[]> }).getRepeatableJobs()
  // ... dedup check

  createEncryptedWorker<AlgoWatcherJobData>(
    'seo-algo-watcher',
    async (_job) => {
      // 1. Load feed URLs + keywords from Payload settings (global instance config)
      // 2. processRssFeed() for each URL (rss-parser + Redis SADD/SISMEMBER)
      // 3. Create algo_alerts records via Payload local API for new matches
    },
    { host: REDIS_HOST, port: REDIS_PORT },
  )
}
```

**RSS + GUID dedup pattern** — use RESEARCH.md "rss-parser feed fetch with GUID dedup" code example (`processRssFeed` function) as the implementation. Redis SADD/EXPIRE pipeline pattern is codebase-standard (same `redis.pipeline()` approach referenced in RESEARCH.md).

**Payload local API call pattern** (copy from `apps/web-main/instrumentation.node.ts` lines 27-39):
```typescript
const { getPayload } = await import('payload')
const config = await import('./payload.config.js')
const payload = await getPayload({ config: config.default })

await payload.create({
  collection: 'algo_alerts',
  data: { title, source, link, matched_keywords, snippet, pub_date, guid, status: 'new' },
  overrideAccess: true,  // worker is not user-scoped
})
```

**Registration in instrumentation.node.ts** — add to existing file after line 42:
```typescript
// ADD to apps/web-main/instrumentation.node.ts:
import { registerAlgoWatcher } from './src/jobs/algo-watcher.js'
import { registerSelfLearning } from './src/jobs/self-learning.js'
await registerAlgoWatcher()
await registerSelfLearning()
```

---

## Shared Patterns

### Agency Isolation (CLAUDE.md §8)
**Source:** `packages/cms/src/access/collection-access.ts` lines 43-54 (`collectionAccess`) and lines 79-83 (`superAdminOnly`)
**Apply to:** `faqs.ts` (use `collectionAccess`); `algo-alerts.ts` (use `superAdminOnly` on ALL operations)
```typescript
// Agency-scoped collections (faqs):
access: {
  read: collectionAccess,
  create: collectionAccess,
  update: collectionAccess,
  delete: deleteAccess,
}

// Global super-admin-only collections (algo_alerts, seo_suggestions):
access: {
  read: superAdminOnly,
  create: superAdminOnly,
  update: superAdminOnly,
  delete: superAdminOnly,
}
```

### `AGENCY_ID_FIELD` Constant
**Source:** All agency-scoped collections — e.g. `packages/cms/src/collections/categories.ts` lines 12-18 (identical across all 9 agency-scoped collections)
**Apply to:** `faqs.ts` only (not `algo-alerts.ts` — global collection has no `agency_id`)
```typescript
const AGENCY_ID_FIELD: Field = {
  name: 'agency_id',
  type: 'text',
  required: true,
  admin: { readOnly: true, position: 'sidebar' },
  access: { update: fieldImmutable },
}
```

### Redis Key Naming
**Source:** `packages/cms/src/hooks/scheduled-publish.ts` lines 52-57 (uses `REDIS_KEY.bullPrefix(agencyId)`) and CONTEXT.md D-03
**Apply to:** All new Redis operations in seo package
```typescript
// Config cache key (D-03):
`agency:${agencyId}:seo-config`

// GUID dedup set (D-13):
`seo:algo-watcher:seen-guids`
```

### `afterOperation` Hook (Cache Invalidation)
**Source:** `packages/cms/src/collections/media-assets.ts` lines 51-99 (the `afterOperation` array pattern)
**Apply to:** `packages/cms/src/collections/settings.ts` — add `invalidateSeoConfigCache` hook
```typescript
// Pattern from media-assets.ts lines 51-58:
hooks: {
  afterOperation: [
    async ({ args, result, operation }) => {
      if (operation !== 'create' && operation !== 'update') return result
      // ... side effect (color extraction → redis cache invalidation)
      return result
    },
  ],
},
```

### BullMQ Worker Registration
**Source:** `apps/web-main/instrumentation.node.ts` lines 8-42
**Apply to:** `algo-watcher.ts`, `self-learning/index.ts` — both registered at startup
```typescript
import { createEncryptedWorker } from '@mjagency/queue'

const REDIS_HOST = process.env['REDIS_HOST'] ?? 'localhost'
const REDIS_PORT = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)

createEncryptedWorker<JobData>('queue-name', async (job) => {
  const { fieldA, fieldB } = job.data
  // ... process
}, { host: REDIS_HOST, port: REDIS_PORT })
```

### `CollectionBeforeOperationHook` Validator
**Source:** `packages/cms/src/hooks/content-validators.ts` lines 67-88 (`validateWordCount`)
**Apply to:** `validateAioTldr` new export in content-validators.ts
```typescript
export const validateX: CollectionBeforeOperationHook = async ({ args, operation }) => {
  if (operation !== 'create' && operation !== 'update') return
  const data = args.data as Record<string, unknown> | undefined
  if (!data) return
  // publish-only checks:
  if (data['status'] !== 'published') return
  // ... validate; throw on violation
}
```

### Payload Local API (Worker Context)
**Source:** `apps/web-main/instrumentation.node.ts` lines 27-39
**Apply to:** `algo-watcher.ts` (create algo_alerts), `self-learning/index.ts` (create seo_suggestions)
```typescript
const { getPayload } = await import('payload')
const config = await import('./payload.config.js')
const payload = await getPayload({ config: config.default })

await payload.update({
  collection: 'collection-slug',
  id: docId,
  data: { ... },
  overrideAccess: false,  // keep false unless truly system-only
})
```

### Payload Admin CSS Variable Tokens
**Source:** `apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx` lines 23-54 (ScoreBar) and `AiPanel.tsx` lines 44-97
**Apply to:** Any new UI elements added to upgraded `SeoPanel.tsx`
```typescript
// Color tokens (copy from SeoPanel.tsx lines 18-22):
const color =
  score >= 70 ? 'var(--mj-color-success, #22c55e)'
  : score >= 40 ? 'var(--mj-color-warning, #f59e0b)'
  : 'var(--mj-color-danger, #ef4444)'

// Spacing/typography tokens (copy from AiPanel.tsx lines 44-57):
style={{ padding: 'var(--mj-space-4, 16px)', border: '1px solid var(--mj-color-border, #e5e7eb)', ... }}
```

### Test Structure for Hooks
**Source:** `packages/cms/src/__tests__/content-validators.test.ts` lines 1-44 (import pattern + `callHook` helper)
**Apply to:** All new test files for Phase 6 — `seo-classic.test.ts`, `aio-citations.test.ts`, `algo-watcher.test.ts`, `content-validators.test.ts` extension
```typescript
import { describe, it, expect } from 'vitest'
import type { CollectionBeforeOperationHook } from 'payload'

function callHook(
  hook: CollectionBeforeOperationHook,
  data: Record<string, unknown>,
  operation: 'create' | 'update' = 'update'
) {
  const arg = { args: { data }, operation, req: {} }
  return hook(arg as unknown as Parameters<CollectionBeforeOperationHook>[0])
}
```

---

## No Analog Found

Files with no close codebase match (planner references RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/seo/src/engine.ts` | utility/orchestrator | transform | No multi-plugin aggregator exists yet — use RESEARCH.md architecture diagram |
| `packages/seo/src/plugin-defaults.ts` | config | — | No global defaults file pattern in codebase — simple object export, no analog needed |
| `packages/seo/src/config-cache.ts` | utility | request-response | No Redis config cache helper exists yet — use RESEARCH.md Pattern 6 + CLAUDE.md Redis prefix convention |
| `packages/seo/src/algo-watcher/rss.ts` | utility | event-driven | No RSS parsing in codebase — use RESEARCH.md Pattern 8 (`rss-parser` 3.13.0) |
| `packages/cms/src/collections/seo-suggestions.ts` | collection | CRUD | New collection for REQ-073 — use `algo-alerts.ts` as the template (same `superAdminOnly` access, no `agency_id`) |
| `apps/web-main/src/actions/seo-score.ts` | server action | request-response | No existing scoring server action — use CLAUDE.md §3 server action pattern; engine call is local |

---

## Metadata

**Analog search scope:** `packages/seo/src/`, `packages/cms/src/`, `packages/queue/src/`, `packages/ai/src/`, `apps/web-main/src/`, `apps/web-main/instrumentation.node.ts`
**Files scanned:** 18 source files read directly
**Pattern extraction date:** 2026-04-26
