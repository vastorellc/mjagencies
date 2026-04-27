---
phase: 06-seo-plugin-engine
plan: "01"
subsystem: seo
tags: [seo, lexical, ioredis, redis, vitest, plugin-engine, payload-hooks, server-actions]

# Dependency graph
requires:
  - phase: 05-central-cms
    provides: Payload CMS wired, SeoPanel stub, computeSeoScore stub, settings collection, ioredis infrastructure
  - phase: 03-auth-sso-edge
    provides: requireSession() server action auth pattern
provides:
  - parseLexicalJson recursive Lexical JSON walker
  - PLUGIN_DEFAULTS constant for seo_classic/aio_citations/geo_chunking/score_thresholds
  - getAgencySeoConfig/setAgencySeoConfig/deleteSeoConfigCache Redis-backed config cache
  - runPluginEngine + registerPlugin plugin registry pattern (plans 02-04 plug scoring logic in)
  - computeLiveScore + generateTldr server actions (auth-checked)
  - SeoPanel upgraded with useAllFormFields + 500ms debounce + 3 ScoreBars + AggregateScore + TldrField
  - settings afterOperation cache invalidation hook
affects:
  - 06-02 (seo-classic plugin registers into engine)
  - 06-03 (aio-citations plugin registers into engine)
  - 06-04 (geo-chunking plugin registers into engine)

# Tech tracking
tech-stack:
  added:
    - lexical 0.41.0 (SerializedLexicalNode/SerializedEditorState types for JSON parsing)
    - ioredis 5.10.1 (added as direct dep to @mjagency/seo)
    - rss-parser 3.13.0 (added to @mjagency/seo for plans 02-04 use)
    - schema-dts 2.0.0 (added to @mjagency/seo for FAQ JSON-LD type safety)
  patterns:
    - Plugin registry pattern: plugins map + registerPlugin() + runPluginEngine()
    - Merge-patch config: { ...PLUGIN_DEFAULTS, ...agencyOverride } at read time
    - Redis config cache with agency namespace: agency:<id>:seo-config (TTL 300s)
    - afterOperation hook with Pitfall 3 findByID fallback for partial saves
    - Server action auth: requireSession() + session.agencyId !== input.agencyId guard
    - useAllFormFields with 500ms debounce in SeoPanel (prevent keystroke-per-request storm)

key-files:
  created:
    - packages/seo/src/lexical-parser.ts
    - packages/seo/src/plugin-defaults.ts
    - packages/seo/src/config-cache.ts
    - packages/seo/src/engine.ts
    - packages/seo/src/__tests__/plugin-engine.test.ts
    - packages/seo/vitest.config.ts
    - apps/web-main/src/actions/seo-score.ts
  modified:
    - packages/seo/src/index.ts (extended with Phase 6 exports; Phase 5 exports preserved)
    - packages/seo/package.json (added ioredis, lexical, rss-parser, schema-dts)
    - packages/cms/src/collections/settings.ts (seo_plugins, algo_watcher_feeds, algo_watcher_keywords fields + afterOperation hook)
    - packages/cms/package.json (added @mjagency/seo dependency)
    - apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx (full upgrade: Phase 5 stub removed)
    - apps/web-main/package.json (added @mjagency/ai, @mjagency/seo)
    - packages/media/package.json (color-thief-node ^2.0.2 → 1.0.4, pre-existing bug fix)

key-decisions:
  - "SerializedLexicalNode and SerializedEditorState imported from 'lexical' package (not @payloadcms/richtext-lexical)"
  - "config-cache merge is deep-shallow: each top-level category spread separately to preserve category defaults not in override"
  - "computeLiveScore uses requireSession() (not auth()) — the project's actual server action auth helper"
  - "SeoPanel uses void+async IIFE inside setTimeout to avoid unhandled promise in useEffect"

requirements-completed:
  - REQ-071
  - REQ-072
  - REQ-075

# Metrics
duration: 14min
completed: 2026-04-27
---

# Phase 06 Plan 01: Plugin Engine Infrastructure Summary

**Shared plugin runtime infrastructure: Lexical JSON parser, per-agency Redis config cache, plugin engine registry with registerPlugin/runPluginEngine, auth-guarded computeLiveScore/generateTldr server actions, and upgraded SeoPanel with live scoring and TL;DR editor**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-27T01:24:04Z
- **Completed:** 2026-04-27T01:37:54Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Plugin engine skeleton built: `registerPlugin()` + `runPluginEngine()` — returns score=0 for all unregistered plugins (plans 02-04 wire real implementations)
- Redis config cache with merge-patch pattern: `getAgencySeoConfig()` merges `PLUGIN_DEFAULTS + agencyOverride` on cache hit, falls back to defaults on miss; `deleteSeoConfigCache()` invalidated on settings save
- SeoPanel upgraded from Phase 5 stub to live scoring with `useAllFormFields` + 500ms debounce, 3 ScoreBars (with threshold ticks + expand/collapse findings), AggregateScoreDisplay, and TldrField with char counter + Regenerate button

## Task Commits

Each task was committed atomically:

1. **Task 1: Lexical parser, plugin defaults, config cache, and engine skeleton** - `08e886b` (feat)
2. **Task 2: Settings collection update + computeLiveScore server action + SeoPanel upgrade** - `d522e15` (feat)

**Plan metadata:** (docs commit created below)

## Files Created/Modified

- `packages/seo/src/lexical-parser.ts` — Recursive Lexical JSON tree walker (parseLexicalJson)
- `packages/seo/src/plugin-defaults.ts` — PLUGIN_DEFAULTS constant with seo_classic/aio_citations/geo_chunking/score_thresholds
- `packages/seo/src/config-cache.ts` — Redis-backed getAgencySeoConfig/setAgencySeoConfig/deleteSeoConfigCache
- `packages/seo/src/engine.ts` — registerPlugin + runPluginEngine plugin registry
- `packages/seo/src/__tests__/plugin-engine.test.ts` — 9 unit tests: parseLexicalJson, PLUGIN_DEFAULTS, cache miss/merge, zero scores
- `packages/seo/vitest.config.ts` — Vitest node environment config
- `packages/seo/src/index.ts` — Extended with Phase 6 exports; Phase 5 exports preserved
- `apps/web-main/src/actions/seo-score.ts` — computeLiveScore + generateTldr server actions
- `apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx` — Full upgrade; Phase 5 stub removed
- `packages/cms/src/collections/settings.ts` — seo_plugins, algo_watcher_feeds, algo_watcher_keywords + afterOperation hook

## Decisions Made

- `SerializedLexicalNode` imported from `lexical` package (not `@payloadcms/richtext-lexical`) — the latter re-exports it internally but doesn't expose it in the public dist
- Merge-patch implementation uses per-category spread (deep-shallow) rather than top-level spread to preserve sub-category defaults not overridden by agency
- Project uses `requireSession()` (not `auth()`) — CLAUDE.md Rule 3 pattern adapted to actual codebase auth helper
- `SeoPanel` TldrField reads from `fields['aio_tldr']` on load but manages its own local state for smooth editing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed color-thief-node non-existent version blocking pnpm install**
- **Found during:** Task 1 (package installation)
- **Issue:** `packages/media/package.json` referenced `color-thief-node@^2.0.2` — this version range does not exist (latest is 1.0.4). Blocked all `pnpm install` runs across the monorepo.
- **Fix:** Changed `color-thief-node: "^2.0.2"` to `"1.0.4"` in `packages/media/package.json`
- **Files modified:** `packages/media/package.json`
- **Verification:** `pnpm install` completed successfully after fix
- **Committed in:** `08e886b` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed wrong import source for Lexical types**
- **Found during:** Task 2 (typecheck)
- **Issue:** `lexical-parser.ts` imported `SerializedEditorState` and `SerializedLexicalNode` from `@payloadcms/richtext-lexical` — these types are not publicly exported from that package's dist. They come from the `lexical` base package.
- **Fix:** Changed import to `from 'lexical'`; added `lexical: "0.41.0"` dependency to `packages/seo/package.json`
- **Files modified:** `packages/seo/src/lexical-parser.ts`, `packages/seo/package.json`
- **Verification:** No type errors from new code in `pnpm --filter @mjagency/cms typecheck`
- **Committed in:** `d522e15` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking, 1 Rule 1 bug)
**Impact on plan:** Both auto-fixes necessary for installation and type safety. No scope creep.

## Issues Encountered

- All remaining `pnpm --filter @mjagency/cms typecheck` errors are pre-existing (media-assets.ts, build-payload-config.ts, dam/search.ts, lexical-features.ts, svg-sanitize.ts, otel-node.ts, db schema files). None are caused by plan 06-01 changes. Logged to deferred-items.

## Known Stubs

- `runPluginEngine` returns `seoClassicScore=0, aioCitationsScore=0, geoChunkingScore=0` — plans 06-02, 06-03, 06-04 register the real plugin functions via `registerPlugin()`. This is intentional by design (plan says "all 0 until plans 02-04 register plugins").
- SeoPanel shows score=0 for all three bars until plans 02-04 are executed. This is correct behavior per the plan objective.

## User Setup Required

None - no external service configuration required for this plan. Redis must be running (pre-existing Docker Compose infrastructure from Phase 2).

## Next Phase Readiness

- Plans 06-02 (seo-classic), 06-03 (aio-citations), 06-04 (geo-chunking) can now be executed — they call `registerPlugin()` with their scoring functions
- `getAgencySeoConfig(agencyId)` ready for plans 02-04 to consume
- `deleteSeoConfigCache` wired into settings afterOperation hook — config invalidation is live
- SeoPanel will show real scores the moment any plugin registers itself

---
*Phase: 06-seo-plugin-engine*
*Completed: 2026-04-27*

## Self-Check: PASSED

Files verified:
- packages/seo/src/lexical-parser.ts: EXISTS
- packages/seo/src/plugin-defaults.ts: EXISTS
- packages/seo/src/config-cache.ts: EXISTS
- packages/seo/src/engine.ts: EXISTS
- packages/seo/src/__tests__/plugin-engine.test.ts: EXISTS
- packages/seo/vitest.config.ts: EXISTS
- apps/web-main/src/actions/seo-score.ts: EXISTS
- apps/web-main/src/app/(payload)/admin/components/SeoPanel.tsx: MODIFIED

Commits verified:
- 08e886b: EXISTS (Task 1)
- d522e15: EXISTS (Task 2)

Tests: 9/9 passing
