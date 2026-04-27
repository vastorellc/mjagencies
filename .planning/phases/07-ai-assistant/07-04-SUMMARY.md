---
phase: 07-ai-assistant
plan: "04"
subsystem: cms-ai
tags: [brand-voice, brand-glossary, payload-collections, getBrandVoiceContext, brand-context, server-actions, ai-editor]
dependency_graph:
  requires:
    - packages/ai editor-actions.ts + aiBrandVoiceRewrite (07-02)
    - packages/cms CORE_COLLECTIONS pattern (05-02)
    - apps/web-main brandVoiceRewrite server action (07-02)
    - packages/cms/src/access/collection-access.ts (collectionAccess, superAdminOnly, fieldImmutable)
  provides:
    - packages/cms/src/collections/brand-voice.ts (brand_voice Payload collection, REQ-083)
    - packages/cms/src/collections/brand-glossary.ts (brand_glossary Payload collection, REQ-083)
    - packages/ai/src/brand-context.ts (getBrandVoiceContext loader)
    - apps/web-main/src/actions/ai-editor.ts — brandVoiceRewrite wired to real brand context
  affects:
    - packages/cms (2 new collections + 1 users collection + lexical-features rename + payload-blocks editor fix + living-brand-book deep import)
    - packages/ai (brand-context.ts new file, index.ts extended, peerDependencies updated)
    - packages/config (otel-node.ts incubating import fix)
    - packages/ui (package.json exports extended)
tech_stack:
  added:
    - "payload peerDep + devDep in @mjagency/ai for getBrandVoiceContext type resolution"
  patterns:
    - Payload local API with overrideAccess:true for system-level brand context reads (getBrandVoiceContext)
    - Deep package exports (@mjagency/ui/theme/validate-theme) to avoid server-only barrel loading in non-Next.js CLI context
    - Per-agency brand voice as system-prompt string (TONE/STYLE/AUDIENCE/FORMALITY/GOOD EXAMPLE/AVOID PATTERN/GLOSSARY lines)
key_files:
  created:
    - packages/cms/src/collections/brand-voice.ts
    - packages/cms/src/collections/brand-glossary.ts
    - packages/cms/src/collections/users.ts
    - packages/ai/src/brand-context.ts
  modified:
    - packages/cms/src/collections/index.ts
    - packages/cms/src/editor/lexical-features.ts
    - packages/cms/src/blocks/payload-blocks.ts
    - packages/cms/src/dam/living-brand-book.ts
    - packages/config/src/otel-node.ts
    - packages/ui/package.json
    - packages/ai/src/index.ts
    - packages/ai/package.json
    - apps/web-main/src/actions/ai-editor.ts
decisions:
  - getBrandVoiceContext accepts Payload instance as param (not importing payload) — @mjagency/ai is a leaf package; caller obtains payload via getPayload() and passes it in
  - Deep import @mjagency/ui/theme/validate-theme (not barrel) in living-brand-book.ts — avoids loading server-only via resolve-theme.ts during Payload migrate CLI run
  - payload 3.82.1 added to peerDependencies AND devDependencies in @mjagency/ai — peerDep for runtime consumers, devDep for tsc type resolution
  - users collection (auth:true) added as Rule 2 fix — Payload requires admin.user collection to be registered in collections; previously missing causing InvalidConfiguration
metrics:
  duration: "~35 minutes"
  completed_date: "2026-04-27"
  tasks_completed: 4
  files_created: 4
  files_modified: 9
  commits: 4
---

# Phase 07 Plan 04: Brand Voice + Glossary Collections Summary

**One-liner:** Per-agency brand voice + glossary Payload collections (REQ-083), getBrandVoiceContext loader returning TONE/STYLE/AUDIENCE/FORMALITY/GLOSSARY system-prompt string, brandVoiceRewrite server action wired to real brand context from CMS.

## What Was Built

### packages/cms/src/collections/brand-voice.ts (new)

Payload 3.82.1 collection `brand_voice` (per-agency):

| Field | Type | Description |
|-------|------|-------------|
| agency_id | text (required, sidebar) | fieldImmutable — cross-tenant tamper prevention |
| tone_description | textarea (required) | 2-3 sentence tone description (positive LLM example) |
| writing_style_notes | textarea | Style guide bullets (sentence length, voice, perspective) |
| target_audience | text | Primary audience description |
| formality_level | select: casual/neutral/formal (sidebar) | Default: neutral |
| example_good_paragraph | textarea | Positive example for LLM |
| example_bad_paragraph | textarea | Negative example for LLM |

Admin group: `Branding`. Access: `collectionAccess` + `superAdminOnly` delete.

### packages/cms/src/collections/brand-glossary.ts (new)

Payload 3.82.1 collection `brand_glossary` (per-agency):

| Field | Type | Description |
|-------|------|-------------|
| agency_id | text (required, sidebar) | fieldImmutable |
| term | text (required) | Brand term (e.g. "Customer Success") |
| definition | textarea | Term definition in agency context |
| preferred_usage | textarea | How/when to use this term in copy |
| avoid_phrases | array → { phrase: text (required) } | Phrases banned in copy for this term |

Admin group: `Branding`. Access: `collectionAccess` + `superAdminOnly` delete.

### packages/ai/src/brand-context.ts (new)

`getBrandVoiceContext(agencyId: string, payload: Payload): Promise<string>`

Loads brand_voice (limit 1) + brand_glossary (limit 100) in parallel via Payload local API with `overrideAccess: true`. Caller MUST validate session before invoking.

Example output format:
```
TONE: Confident, data-driven, no jargon. We speak directly to results.
STYLE: Short sentences. Active voice. Second person for CTAs. Avoid passive.
AUDIENCE: VPs of Marketing at B2B SaaS companies
FORMALITY: neutral
GOOD EXAMPLE:
  [example paragraph text]
AVOID PATTERN:
  [bad example text]
GLOSSARY (use preferred terms; never the avoid phrases):
- Customer Success: Use for the team and discipline. (NEVER use: customer support, help desk)
- Revenue Operations: RevOps is acceptable abbreviation. (NEVER use: sales ops only)
```

Returns `''` (empty string) on error — graceful degradation, action continues without brand context.

### apps/web-main/src/actions/ai-editor.ts — brandVoiceRewrite updated

Updated `brandVoiceRewrite` to load brand context before calling `aiBrandVoiceRewrite`:

```typescript
export async function brandVoiceRewrite(input: AiActionInput): Promise<AiEditorActionResult> {
  const session = await requireSession()                              // CLAUDE.md Rule 3 line 1
  if (session.agencyId !== input.agencyId) throw new Error('Forbidden') // CLAUDE.md Rule 3 line 2

  const { aiBrandVoiceRewrite, getBrandVoiceContext } = await import('@mjagency/ai')

  let brandVoiceContext = input.brandVoiceContext ?? ''
  if (!brandVoiceContext) {
    const { getPayload } = await import('payload')
    const config = await import('@payload-config')
    const payload = await getPayload({ config: config.default })
    brandVoiceContext = await getBrandVoiceContext(input.agencyId, payload)
  }

  return aiBrandVoiceRewrite(input.text, input.agencyId, { agencySlug: input.agencySlug, brandVoiceContext })
}
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `9cac55d` | feat | add brand_voice + brand_glossary Payload collections |
| `9d1f3eb` | feat | brand context loader + wire into brandVoiceRewrite server action |
| `45ea67f` | fix | align lexical-features imports with @payloadcms/richtext-lexical exports |
| `af55a76` | fix | pre-flight fixes for Payload migrate config load |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 10 renamed lexical feature imports in lexical-features.ts**
- **Found during:** Task 3a pre-flight typecheck
- **Issue:** @payloadcms/richtext-lexical 3.82.1 renamed multiple features. 10 imports failed with TS2724/TS2305.
- **Fix:** Renamed BoldTextFeature→BoldFeature, ItalicTextFeature→ItalicFeature, UnderlineTextFeature→UnderlineFeature, StrikethroughTextFeature→StrikethroughFeature, InlineCodeTextFeature→InlineCodeFeature, AlignmentFeature→AlignFeature, CheckListFeature→ChecklistFeature, TableFeature→EXPERIMENTAL_TableFeature. Removed CodeHighlightFeature, TextColorFeature, BackgroundColorFeature, FontSizeFeature, ClearFormattingFeature, SlashMenuFeature (not exported by 3.82.1). Fixed return type to FeatureProviderServer<any, any, any>[].
- **Files modified:** packages/cms/src/editor/lexical-features.ts
- **Commit:** 45ea67f

**2. [Rule 3 - Blocking] Fixed otel-node.ts semantic conventions import path**
- **Found during:** Task 3a Payload migrate attempt
- **Issue:** `ATTR_SERVICE_NAMESPACE` and `ATTR_DEPLOYMENT_ENVIRONMENT_NAME` are in the `/incubating` export path of @opentelemetry/semantic-conventions@1.36.0 — not the main index.
- **Fix:** Import from `@opentelemetry/semantic-conventions/incubating` instead of `@opentelemetry/semantic-conventions`.
- **Files modified:** packages/config/src/otel-node.ts
- **Commit:** af55a76

**3. [Rule 3 - Blocking] Fixed server-only barrel loading in Payload migrate context**
- **Found during:** Task 3a Payload migrate attempt
- **Issue:** `packages/cms/src/dam/living-brand-book.ts` imported from `@mjagency/ui` barrel which exports `resolveTheme` from `resolve-theme.ts` which imports `server-only`. The `server-only` package unconditionally throws outside Next.js context, blocking Payload migrate CLI.
- **Fix:** Changed living-brand-book.ts to use deep imports: `@mjagency/ui/theme/types` (for ThemeJson type) and `@mjagency/ui/theme/validate-theme` (for assertValidTheme). Added export entries to packages/ui/package.json for both paths.
- **Files modified:** packages/cms/src/dam/living-brand-book.ts, packages/ui/package.json
- **Commit:** af55a76

**4. [Rule 2 - Missing] Added required Payload users collection**
- **Found during:** Task 3a Payload migrate attempt
- **Issue:** `build-payload-config.ts` sets `admin.user = 'users'` but no `users` collection existed in CORE_COLLECTIONS. Payload throws `InvalidConfiguration: users is not a valid admin user collection`.
- **Fix:** Created `packages/cms/src/collections/users.ts` with `auth: true`, `role` select field (super_admin/admin/editor), and `agencyId` text field. Registered in CORE_COLLECTIONS (first entry, as Payload convention).
- **Files modified:** packages/cms/src/collections/users.ts (new), packages/cms/src/collections/index.ts
- **Commit:** af55a76

**5. [Rule 3 - Blocking] Fixed richText fields in blocks missing editor prop**
- **Found during:** Task 3a Payload migrate attempt (after fixing users collection)
- **Issue:** Payload 3.82.1 throws `MissingEditorProp` for richText fields nested inside blocks that don't have an explicit `editor` prop. Affected: richTextBlock.content, twoColumnBlock.left_content/.right_content, threeColumnBlock.columns[].content, imageTextBlock.body, textImageBlock.body, serviceDetailBlock.description.
- **Fix:** Added `editor: lexicalEditor({})` (default features) to all 7 affected richText fields. Imported `lexicalEditor` from `@payloadcms/richtext-lexical`.
- **Files modified:** packages/cms/src/blocks/payload-blocks.ts
- **Commit:** af55a76

### Deferred Items

**Payload migrate deferred — no local Postgres instance in dev environment**
- The Payload config now loads without errors (all 5 pre-existing blockers fixed above)
- Running `CI=true PAYLOAD_MIGRATING=true DATABASE_URL=... npx payload migrate` in `apps/web-main` gets past config loading and fails only on `ECONNREFUSED 127.0.0.1:5432`
- Migrate will succeed when run with a live Postgres instance
- Migration files will be auto-generated under `apps/web-main/migrations/`
- Tables `brand_voice` and `brand_glossary` will be created then

**Removed lexical editor features (no upstream export in 3.82.1):**
- CodeHighlightFeature, TextColorFeature, BackgroundColorFeature, FontSizeFeature, ClearFormattingFeature, SlashMenuFeature
- These were listed in specs/cms.md but are not exported by @payloadcms/richtext-lexical 3.82.1
- Deferred to Phase 8 when upstream adds them or an alternative is found

## Security Review (STRIDE Threat Model)

| Threat | Mitigation |
|--------|-----------|
| T-07-04-01: Cross-tenant brand_voice read | collectionAccess enforces agency_id equality in Payload queries |
| T-07-04-02: agency_id tampered post-create | fieldImmutable blocks update access; Payload rejects the write |
| T-07-04-03: getBrandVoiceContext cross-tenant leak | where: { agency_id: { equals: agencyId } } — function is agency-scoped at query level |
| T-07-04-04: Editor adds banned phrase to glossary | Accept — Payload audit log captures change |

## Known Stubs

None. All plan goals achieved:
- brand_voice collection: created with all 7 fields
- brand_glossary collection: created with avoid_phrases array
- getBrandVoiceContext: full implementation loading both collections
- brandVoiceRewrite: wired to real brand context (no longer empty string)

The only deferral is the DB migrate itself (environment constraint, not a code stub).

## Self-Check: PASSED

Files exist:
- packages/cms/src/collections/brand-voice.ts: FOUND
- packages/cms/src/collections/brand-glossary.ts: FOUND
- packages/cms/src/collections/users.ts: FOUND
- packages/ai/src/brand-context.ts: FOUND
- packages/ai/src/index.ts (modified): FOUND
- apps/web-main/src/actions/ai-editor.ts (modified): FOUND

Commits exist:
- 9cac55d: FOUND
- 9d1f3eb: FOUND
- 45ea67f: FOUND
- af55a76: FOUND

Typecheck (@mjagency/ai): exit 0
Typecheck (@mjagency/cms): no new errors (pre-existing only)
Brand voice + glossary in CORE_COLLECTIONS: VERIFIED (grep confirmed both in index.ts)
brandVoiceRewrite calls getBrandVoiceContext: VERIFIED (grep confirmed)
