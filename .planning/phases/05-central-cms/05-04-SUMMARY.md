---
phase: 05-cms-block-library
plan: "04"
subsystem: cms-editor
tags:
  - lexical
  - payload
  - seo
  - ai-stubs
  - bullmq
  - editor-ux

dependency_graph:
  requires:
    - "05-01 (buildPayloadConfig factory — extended in this plan)"
    - "05-03c (PAYLOAD_BLOCKS — passed to BlocksFeature in lexicalEditor config)"
  provides:
    - "packages/cms/src/editor/lexical-features.ts — getLexicalFeatures() with all 27 Lexical features"
    - "packages/cms/src/editor/seo-panel-stub.ts — computeSeoScore() stub returning SeoScores"
    - "packages/cms/src/editor/ai-hooks-stub.ts — 9 AI editor action stubs"
    - "apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx — SEO/AIO/GEO sidebar panel"
    - "apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx — AI assistant panel stub"
    - "apps/web-main/instrumentation.node.ts — BullMQ cms-scheduled-publish worker"
  affects:
    - "Phase 6 (SEO plugin engine — replaces computeSeoScore stub)"
    - "Phase 7 (AI assistant — replaces ai-hooks-stub with real LiteLLM calls)"

tech_stack:
  added:
    - "@payloadcms/ui: 3.82.1 (added to web-main deps for useDocumentInfo hook in SeoPanel)"
    - "@mjagency/queue: workspace:* (added to web-main deps for createEncryptedWorker in instrumentation.node.ts)"
  patterns:
    - "getLexicalFeatures() returns array of FeatureProviderServer instances — spread into lexicalEditor features array"
    - "BlocksFeature({ blocks: PAYLOAD_BLOCKS }) wires all 45 blocks into Lexical block picker"
    - "SeoPanel registered as relative string path (NOT path.resolve) so importMap resolves correctly"
    - "AI hook stubs use isStub: true field for Phase 7 detection and replacement"
    - "BullMQ worker uses overrideAccess:false to preserve agency field-level access control (T-05-04-02)"
    - "buildPayloadConfig() factory now self-contains editor and db construction — apps only pass dirname/databaseUrl/secret"

key_files:
  created:
    - packages/cms/src/editor/lexical-features.ts
    - packages/cms/src/editor/seo-panel-stub.ts
    - packages/cms/src/editor/ai-hooks-stub.ts
    - apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx
    - apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx
  modified:
    - packages/cms/src/config/build-payload-config.ts
    - packages/cms/src/index.ts
    - apps/web-main/payload.config.ts
    - apps/web-main/instrumentation.node.ts
    - apps/web-main/package.json

key_decisions:
  - "buildPayloadConfig() refactored to self-contain editor and db adapter construction — all 12 agency apps share one canonical Lexical config; apps no longer pass editor/db props"
  - "SeoPanel registered via relative string path './src/app/(payload)/admin/components/SeoPanel' NOT path.resolve() — critical for Payload 3.82.1 importMap resolution"
  - "@payloadcms/ui and @mjagency/queue added as direct dependencies to web-main (Rule 3 fix — required for SeoPanel and instrumentation.node.ts)"
  - "AI hook stubs exported with isStub: true flag so Phase 7 can detect and swap stubs without breaking callers"
  - "BullMQ worker logs agencyId + collection + docId before payload.update for Phase 7 OTel span enrichment"

metrics:
  duration: "12m"
  completed: "2026-04-26"
  tasks: 2
  files_created: 5
  files_modified: 5
---

# Phase 05 Plan 04: Lexical Editor Config + SEO Panel + AI Hooks + BullMQ Worker Summary

**One-liner:** Full 27-feature Lexical editor config + 45-block BlocksFeature + SEO/AIO/GEO stub panel + 9 AI editor hook stubs + cms-scheduled-publish BullMQ worker all wired into Payload 3.82.1 admin.

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-26T15:03:00Z
- **Completed:** 2026-04-26T15:14:32Z
- **Tasks:** 2
- **Files created:** 5
- **Files modified:** 5

## What Was Built

### Task 1: Editor stub files (3 files)

| File | Exports | Purpose |
|------|---------|---------|
| `packages/cms/src/editor/lexical-features.ts` | `getLexicalFeatures()`, `SLASH_COMMANDS`, `SlashCommand` | All 27 Lexical features per specs/cms.md + 19 slash commands |
| `packages/cms/src/editor/seo-panel-stub.ts` | `computeSeoScore()`, `SeoScores` | SEO/AIO/GEO stub scoring (Phase 6 wires real engine) |
| `packages/cms/src/editor/ai-hooks-stub.ts` | `aiRewrite`, `aiExpand`, `aiShorten`, `aiBrandVoiceRewrite`, `aiGenerateFaq`, `aiSuggestInternalLinks`, `aiTldr`, `aiMetaDescription`, `aiAltText`, `AiActionResult` | AI editor action stubs (Phase 7 wires real LiteLLM) |

**getLexicalFeatures() feature list (27 features from specs/cms.md):**
FixedToolbarFeature, InlineToolbarFeature, BoldTextFeature, ItalicTextFeature, UnderlineTextFeature, StrikethroughTextFeature, InlineCodeTextFeature, SubscriptFeature, SuperscriptFeature, HeadingFeature(h1-h6), ParagraphFeature, AlignmentFeature, IndentFeature, UnorderedListFeature, OrderedListFeature, CheckListFeature, BlockquoteFeature, HorizontalRuleFeature, LinkFeature, UploadFeature, TableFeature, CodeHighlightFeature, TextColorFeature, BackgroundColorFeature, FontSizeFeature, ClearFormattingFeature, SlashMenuFeature

**SLASH_COMMANDS (19 commands):** /h1 /h2 /h3 /h4 /h5 /h6 /bullet /numbered /checklist /quote /code /table /image /faq-block /cta-block /callout /ai-write /ai-expand /ai-summarize

### Task 2: Wiring + Components (7 files)

**packages/cms/src/config/build-payload-config.ts** — Refactored to self-contained factory:
- Now imports `lexicalEditor`, `BlocksFeature` from `@payloadcms/richtext-lexical` directly
- `editor: lexicalEditor({ features: ({ defaultFeatures }) => [...defaultFeatures, ...getLexicalFeatures(), BlocksFeature({ blocks: PAYLOAD_BLOCKS })] })`
- `admin.components.afterDocControls: ['./src/app/(payload)/admin/components/SeoPanel']` — relative path per plan constraint
- Dropped `db` and `editor` from `BuildPayloadConfigOptions` interface; builds them internally
- `typescript.outputFile` uses `path.resolve(dirname, 'payload-types.ts')`

**apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx** — Payload admin SEO panel:
- `'use client'` component using `useDocumentInfo()` from `@payloadcms/ui`
- Renders three score bars: SEO, AIO, GEO with color coding (green >=70, amber >=40, red <40)
- Shows word count, internal link count warning (<3), alt coverage
- Imports `computeSeoScore` and `SeoScores` from `@mjagency/cms`

**apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx** — AI assistant panel stub:
- `'use client'` component with 6 action buttons: AI Rewrite, AI Expand, AI Shorten, Generate FAQ, Auto TL;DR, Suggest Meta Desc
- Phase 5 stubs show inline response text; Phase 7 wires real LiteLLM server actions

**apps/web-main/instrumentation.node.ts** — BullMQ worker extended:
- Registers `cms-scheduled-publish` worker via `createEncryptedWorker<ScheduledPublishJobData>`
- Worker checks `publishAt` guard (re-enqueue protection), logs progress, then calls `payload.update()` with `overrideAccess: false` (T-05-04-02 mitigation)
- Uses dynamic imports for `payload` and `./payload.config.js` to avoid circular init

**packages/cms/src/index.ts** — New exports appended:
`getLexicalFeatures`, `SLASH_COMMANDS`, `SlashCommand`, `computeSeoScore`, `SeoScores`, `aiRewrite`, `aiExpand`, `aiShorten`, `aiBrandVoiceRewrite`, `aiGenerateFaq`, `aiSuggestInternalLinks`, `aiTldr`, `aiMetaDescription`, `aiAltText`, `AiActionResult`, `PAYLOAD_BLOCKS`

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create lexical-features.ts, seo-panel-stub.ts, ai-hooks-stub.ts | `5a1d186` | 3 files |
| 2 | Wire full Lexical editor + SeoPanel + BullMQ worker | `e16714d` | 7 files |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated buildPayloadConfig() interface compatibility**
- **Found during:** Task 2
- **Issue:** Original factory accepted `db` and `editor` as parameters; plan's new interface drops them. `apps/web-main/payload.config.ts` would fail to compile with old signature.
- **Fix:** Updated `payload.config.ts` to match new interface (no `db`/`editor` params)
- **Files modified:** `apps/web-main/payload.config.ts`
- **Commit:** `e16714d`

**2. [Rule 3 - Blocking] Added missing dependencies to web-main package.json**
- **Found during:** Task 2
- **Issue:** `SeoPanel.tsx` imports `@payloadcms/ui` (not in web-main deps) and `instrumentation.node.ts` imports `@mjagency/queue` (not in web-main deps). TypeScript resolution would fail.
- **Fix:** Added `@payloadcms/ui: 3.82.1` and `@mjagency/queue: workspace:*` to web-main dependencies
- **Files modified:** `apps/web-main/package.json`
- **Commit:** `e16714d`

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| computeSeoScore() | packages/cms/src/editor/seo-panel-stub.ts | Returns mock scores derived from word count; Phase 6 replaces with real SEO plugin engine |
| SeoPanel content extraction | apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx | Uses `JSON.stringify(docConfig ?? '')` — Phase 6 wires actual Lexical content extraction |
| All aiRewrite/aiExpand/etc. | packages/cms/src/editor/ai-hooks-stub.ts | Return labeled stub strings; Phase 7 wires real LiteLLM Flash-Lite calls |
| AiPanel buttons | apps/web-main/src/app/(payload)/admin/components/AiPanel.tsx | setTimeout(300ms) simulates AI call; Phase 7 wires real server actions |

These stubs are explicitly planned for Phase 5; they do not prevent the plan's goal (full editor config + sidebar panels functional in admin UI) from being achieved.

## Threat Mitigations Applied

| Threat ID | Category | Mitigation | Status |
|-----------|----------|-----------|--------|
| T-05-04-01 | Elevation of Privilege — AI panel stubs | AiPanel buttons are Phase 5 stubs. Phase 7 wires server actions with `requireSession()` as first line per CLAUDE.md §3 | Documented in AiPanel.tsx comment |
| T-05-04-02 | Tampering — scheduled-publish worker | Worker calls `payload.update()` with `overrideAccess: false` — agency field-level access control enforced | Mitigated in instrumentation.node.ts |
| T-05-04-03 | DoS — BullMQ worker | Single worker per queue; BullMQ exponential backoff handles transient failures | Accepted |
| T-05-04-04 | Info Disclosure — SeoPanel | Reads doc from `useDocumentInfo()` — already in admin session context, no extra exposure | Accepted |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `packages/cms/src/editor/lexical-features.ts` contains `FixedToolbarFeature` | FOUND (lines 8, 44, 83) |
| `packages/cms/src/editor/lexical-features.ts` contains `SlashMenuFeature` | FOUND (lines 34, 70, 109) |
| `packages/cms/src/editor/lexical-features.ts` exports `getLexicalFeatures` | FOUND (line 81) |
| `packages/cms/src/editor/seo-panel-stub.ts` exports `computeSeoScore` | FOUND |
| `packages/cms/src/editor/seo-panel-stub.ts` exports `SeoScores` interface | FOUND |
| `packages/cms/src/editor/ai-hooks-stub.ts` exports `aiRewrite` | FOUND |
| `packages/cms/src/editor/ai-hooks-stub.ts` contains `isStub: true` | FOUND |
| `packages/cms/src/config/build-payload-config.ts` contains `getLexicalFeatures` | FOUND (lines 22, 87) |
| `packages/cms/src/config/build-payload-config.ts` contains `BlocksFeature` | FOUND (lines 8, 20, 90) |
| `packages/cms/src/config/build-payload-config.ts` contains `PAYLOAD_BLOCKS` | FOUND (lines 23, 89, 90) |
| `packages/cms/src/config/build-payload-config.ts` does NOT contain `path.resolve.*SeoPanel` | CONFIRMED (no match) |
| `packages/cms/src/config/build-payload-config.ts` contains `afterDocControls` | FOUND (lines 73, 77) |
| `packages/cms/src/config/build-payload-config.ts` contains relative SeoPanel path | FOUND (line 78) |
| `apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx` contains `computeSeoScore` | FOUND (lines 4, 5, 12, 61) |
| `apps/web-main/instrumentation.node.ts` contains `cms-scheduled-publish` | FOUND (lines 6, 17) |
| `packages/cms/src/index.ts` exports `PAYLOAD_BLOCKS` | FOUND (line 73) |
| `packages/cms/src/index.ts` exports `AiActionResult` type (contains `isStub: true`) | FOUND (line 72) |
| `packages/cms/src/editor/ai-hooks-stub.ts` exists | FOUND |
| Task 1 commit `5a1d186` in git log | FOUND |
| Task 2 commit `e16714d` in git log | FOUND |

---
*Phase: 05-cms-block-library*
*Completed: 2026-04-26*
