---
phase: 07-ai-assistant
plan: "03"
subsystem: cms
tags: [cms, anti-fabrication, ai-disclosure, tdd, validators, publish-gates, req-082, req-086, req-409]
dependency_graph:
  requires:
    - packages/cms content-validators.ts hook pattern (Phase 5)
    - packages/cms pages.ts + posts.ts collections (Phase 5)
  provides:
    - packages/cms validateStatSources (blocks unsourced stats on publish)
    - packages/cms validateQuoteSources (blocks unsourced quotes on publish)
    - packages/cms validateNoPlaceholders (blocks placeholder text on publish)
    - packages/cms computeAiContentRatio (sets ai_content_ratio + ai_disclosure_required on data)
    - pages + posts collections: 4 new Phase 7 beforeOperation hooks
    - pages + posts collections: 3 new fields (ai_content_ratio, ai_disclosure_required, ai_generated_fields)
  affects:
    - packages/cms (2 new hook files, 2 new test files, 2 modified collections)
tech_stack:
  added: []
  patterns:
    - TDD red/green cycle (RED commit e1c9ed4 precedes GREEN commit c4cb048)
    - CollectionBeforeOperationHook throw-on-publish/warn-on-draft contract (matches Phase 5 pattern)
    - Dynamic denominator for AI ratio (populatedTracked = non-empty tracked fields only)
    - Negative lookbehind regex to exclude ranges (30-45%) from stat detection
    - Broader quote attribution pattern (plain parenthetical + "said Name" counts as attribution)
key_files:
  created:
    - packages/cms/src/hooks/anti-fab-validators.ts
    - packages/cms/src/hooks/ai-disclosure.ts
    - packages/cms/src/__tests__/anti-fab-validators.test.ts
    - packages/cms/src/__tests__/ai-disclosure.test.ts
  modified:
    - packages/cms/src/collections/pages.ts
    - packages/cms/src/collections/posts.ts
decisions:
  - computeAiContentRatio uses dynamic populatedTracked denominator — count of non-empty tracked fields per document, not a constant 4 (already captured in STATE.md)
  - validateQuoteSources uses broader QUOTE_ATTRIBUTION_PATTERN (accepts plain parenthetical "(Source Name Year)" and "said Name" as valid attribution) — markdown links are not the only valid attribution format in prose
  - AI_DISCLOSURE_THRESHOLD = 0.70 (plan spec exact value)
  - STAT_CITATION_WINDOW = 150 chars, QUOTE_CITATION_WINDOW = 200 chars (as specified)
  - PLACEHOLDER_PATTERNS covers [insert*], [TBD], [TODO], coming soon, lorem ipsum (case-insensitive) per CLAUDE.md §5
metrics:
  duration: "~12 minutes"
  completed_date: "2026-04-27"
  tasks_completed: 3
  files_created: 4
  files_modified: 2
  tests_added: 34
  commits: 3
---

# Phase 07 Plan 03: Anti-Fabrication Validators + AI Disclosure Summary

**One-liner:** Four publish-gate CMS hooks — validateStatSources/validateQuoteSources/validateNoPlaceholders blocking unsourced content on publish, and computeAiContentRatio auto-setting ai_content_ratio + ai_disclosure_required on pages/posts — enforcing REQ-082, REQ-086, REQ-409.

## What Was Built

### packages/cms/src/hooks/anti-fab-validators.ts (new)

Three CollectionBeforeOperationHook exports (throw-on-publish, warn-on-draft):

**`validateStatSources`** (REQ-082)
- Regex patterns: bare percentages `(?<!\d[-–])\b(\d+\.?\d*)\s*%(?!\s*[-–]\s*\d)`, dollar amounts `\$\d+...`, "N percent", "N out of M"
- Each match checked for a citation link within 150 chars (markdown link, `<a href`, or Lexical JSON `"url":"https://..."`)
- Ranges like "30-45%" are excluded via negative lookbehind (consistent with Phase 5 hasExactFigures)

**`validateQuoteSources`** (REQ-082)
- Inline `"..."` strings of 6+ chars checked for attribution within 200 chars
- Lexical blockquote nodes (`"type":"quote"`) checked for attribution within 200 chars
- Uses broader `QUOTE_ATTRIBUTION_PATTERN` that recognises: markdown links, `<a href`, Lexical URL, `said Name`, and plain parenthetical `(Source Name Year)`

**`validateNoPlaceholders`** (REQ-082, CLAUDE.md §5)
- Case-insensitive detection of: `[insert*]`, `[TBD]`, `[TODO]`, `coming soon`, `lorem ipsum`
- Blocks publish; warns on draft

### packages/cms/src/hooks/ai-disclosure.ts (new)

**`computeAiContentRatio`** (REQ-086, REQ-409)
- Reads `data.ai_generated_fields` (string[]) set by AI editor actions
- Tracked fields: `['title', 'content', 'meta_description', 'aio_tldr']`
- Dynamic denominator: `populatedTracked` = count of tracked fields that are non-empty in the current document
- Guards against zero denominator: `Math.max(populatedTracked, 1)`
- Sets `data.ai_content_ratio` (number, 0..1, 3 decimal places)
- Sets `data.ai_disclosure_required = ratio > 0.70`

**`AI_DISCLOSURE_THRESHOLD = 0.70`** (exported constant)

### packages/cms/src/collections/pages.ts + posts.ts (modified)

Both collections extended:
- **Imports**: `validateStatSources`, `validateQuoteSources`, `validateNoPlaceholders` from `anti-fab-validators.js`; `computeAiContentRatio` from `ai-disclosure.js`
- **beforeOperation**: 4 new hooks appended after existing 5/6 (pages: 10 total; posts: 9 total)
- **Fields**: 3 new read-only fields added: `ai_content_ratio` (number sidebar), `ai_disclosure_required` (checkbox sidebar), `ai_generated_fields` (JSON)

## Test Counts

| File | Tests | Type |
|------|-------|------|
| anti-fab-validators.test.ts | 26 | Vitest unit (TDD RED/GREEN) |
| ai-disclosure.test.ts | 8 | Vitest unit (TDD RED/GREEN) |
| content-validators.test.ts | 31 | Pre-existing (unmodified) |
| **Total @mjagency/cms** | **65** | |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `e1c9ed4` | test | RED — failing tests for anti-fab-validators + ai-disclosure (TDD gate) |
| `c4cb048` | feat | GREEN — anti-fab validators + AI disclosure ratio |
| `4f7c5cf` | feat | Wire anti-fab validators + ai-disclosure into pages and posts collections |

## TDD Gate Compliance

- RED commit (`e1c9ed4`) precedes GREEN commit (`c4cb048`) — TDD gate satisfied.
- RED test failure confirmed: `Failed to load url ../hooks/anti-fab-validators.js — Does the file exist?`
- GREEN tests: all 65 tests pass after implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended quote attribution pattern to accept plain parenthetical + "said Name"**
- **Found during:** Task 2 GREEN verification run
- **Issue:** Test case `'"This was a game-changer," said John Doe (Forbes 2024).'` expected to PASS publish, but the implementation only matched markdown links and `<a href` as valid citation. The attribution `said John Doe (Forbes 2024)` is plain text prose — a completely valid citation format in editorial content.
- **Fix:** Changed `CITATION_PATTERN` to `QUOTE_ATTRIBUTION_PATTERN` for the quote validator: added `said\s+\w+` and `\([A-Z][^)]{2,60}\)` patterns. Stat validator continues using strict link-only `STAT_CITATION_PATTERN` (stats require verifiable links, quotes accept prose attribution).
- **Files modified:** `packages/cms/src/hooks/anti-fab-validators.ts`
- **Commit:** `c4cb048`

## Known Stubs

None. All four validators provide real enforcement logic. `computeAiContentRatio` reads from `ai_generated_fields` which is populated by the AI editor action pipeline from Phase 7-02.

## Threat Flags

None. The new validators are read-only hook logic operating on inbound CMS data before save. No new network endpoints, auth paths, or file access patterns introduced.

## Self-Check: PASSED

Files exist:
- packages/cms/src/hooks/anti-fab-validators.ts: FOUND
- packages/cms/src/hooks/ai-disclosure.ts: FOUND
- packages/cms/src/__tests__/anti-fab-validators.test.ts: FOUND
- packages/cms/src/__tests__/ai-disclosure.test.ts: FOUND

Commits exist:
- e1c9ed4 (RED test): FOUND
- c4cb048 (GREEN implementation): FOUND
- 4f7c5cf (wiring): FOUND

Tests: 65/65 passing. No new typecheck errors in plan files.
