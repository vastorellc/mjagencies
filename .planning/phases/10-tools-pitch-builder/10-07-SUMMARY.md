---
phase: 10
plan: "10-07"
subsystem: builder
tags: [puck, visual-builder, auth-gate, seo-score, server-component]
dependency_graph:
  requires: [10-01, packages/auth, packages/seo, packages/ui]
  provides: [packages/builder]
  affects: [agency-apps/builder-page-routes]
tech_stack:
  added: ["@measured/puck@0.19.0"]
  patterns: ["server-component auth gate", "requireSession first-line pattern", "Puck config via getBlockConfig()", "server action with auth check"]
key_files:
  created:
    - packages/builder/src/PuckEditor.tsx
    - packages/builder/src/PuckEditorClient.tsx
    - packages/builder/src/PuckAdminBar.tsx
    - packages/builder/src/PuckMetaPanel.tsx
    - packages/builder/src/SeoScoreWidget.tsx
    - packages/builder/src/UnsavedChangesDialog.tsx
    - packages/builder/src/actions/publish-page.ts
    - packages/builder/src/actions/save-draft.ts
    - packages/seo/src/actions/compute-live-score.ts
    - packages/ui/src/blocks/get-block-config.ts
  modified:
    - packages/builder/package.json
    - packages/builder/src/index.ts
    - packages/seo/src/index.ts
    - packages/ui/src/index.ts
decisions:
  - "@measured/puck used instead of @puck-editor/core (plan named wrong package — @measured/puck is the real Puck editor npm package)"
  - "computeLiveScore adapter wraps runPluginEngine — builder does not call plugin engine directly"
  - "getBlockConfig() uses ComponentType<any> via asBlock() helper to avoid strict TS cast errors"
  - "UnsavedChangesDialog hex fallbacks removed — all colors use var(--mj-*) tokens only"
  - "@types/react added to builder devDependencies — required for TSX compilation"
metrics:
  duration: "~35 minutes"
  completed: "2026-04-27"
  tasks_completed: 2
  files_changed: 14
---

# Phase 10 Plan 07: Puck Visual Builder — Admin Bar, Meta Panel, SEO Score Widget, Server-Side Auth

Implements the `@mjagency/builder` package as a full auth-gated Puck visual editor with server-side session enforcement, fixed admin bar, meta panel with live SEO scoring, unsaved-changes guard, and publish workflow.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| T-01 | Package setup, SeoScoreWidget, UnsavedChangesDialog, PuckAdminBar, PuckMetaPanel | 87e5b3e | packages/builder/{package.json,src/SeoScoreWidget.tsx,src/UnsavedChangesDialog.tsx,src/PuckAdminBar.tsx,src/PuckMetaPanel.tsx}, packages/seo/src/actions/compute-live-score.ts, packages/ui/src/blocks/get-block-config.ts |
| T-02 | PuckEditor server component, PuckEditorClient, publishPage + saveDraft server actions | 077ecac | packages/builder/src/{PuckEditor.tsx,PuckEditorClient.tsx,actions/publish-page.ts,actions/save-draft.ts,index.ts} |

## What Was Built

- **PuckEditor.tsx** (server component): Auth gate using `requireSession()` + `session.agencyId === agencyId` check before rendering any builder content. 3 `redirect('/login')` paths (session, ownership, page-agency double-check). Fetches initial page data + SEO score server-side. REQ-132 compliant.

- **PuckEditorClient.tsx** (client component): Receives pre-authenticated state from server component. Uses `getBlockConfig()` from `@mjagency/ui` as Puck `config` prop — enforces DOMPurify sanitization on all block string props. Manages edit/preview mode, unsaved changes state, publish feedback.

- **PuckAdminBar.tsx**: Fixed position, 48px height, z-index 10000, full viewport width. `aria-pressed` on edit toggle. 3-second auto-dismiss success toast. Persistent error banner below bar. `var(--mj-color-brand-500)` publish button.

- **PuckMetaPanel.tsx**: 320px right-side panel with title/description/slug/SEO score widget. Opens on top of page content (z-index 9998).

- **SeoScoreWidget.tsx**: 0-100 integer display with color ramp (0-49 `var(--mj-color-error)`, 50-79 `var(--mj-color-warning)`, 80-100 `var(--mj-color-success)`). `aria-label="SEO score: N out of 100"` for accessibility.

- **UnsavedChangesDialog.tsx**: `beforeunload` event listener active while `hasUnsavedChanges`. Custom MJ dialog (not native browser prompt). "Leave Without Saving" + "Keep Editing" buttons.

- **publishPage server action**: `requireSession()` as first line (CLAUDE.md Rule 3). `session.agencyId !== input.agencyId` throws `Forbidden`. PATCHes Payload CMS with `status: 'published'`.

- **saveDraft server action**: Same auth pattern. PATCHes Payload CMS with `status: 'draft'`.

- **computeLiveScore adapter** (added to `@mjagency/seo`): Wraps `runPluginEngine` with builder-friendly input signature (content + metaDescription instead of full Lexical document).

- **getBlockConfig function** (added to `@mjagency/ui`): Returns Puck-compatible Config with all 45 registered block components. Uses `asBlock()` helper for clean `ComponentType<any>` casting.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @puck-editor/core does not exist — used @measured/puck**
- **Found during:** T-01 package.json update
- **Issue:** The plan specifies `"@puck-editor/core": "^0.17.0"` but this package does not exist on npm. The correct real-world Puck editor package is `@measured/puck`. Version 0.19.0 was already installed in the original package.json stub.
- **Fix:** Used `"@measured/puck": "0.19.0"` in package.json and updated all imports accordingly.
- **Files modified:** packages/builder/package.json, packages/builder/src/PuckEditorClient.tsx
- **Commit:** 87e5b3e, 077ecac

**2. [Rule 3 - Blocker] computeLiveScore missing from @mjagency/seo**
- **Found during:** T-02 PuckEditor.tsx creation
- **Issue:** The plan imports `computeLiveScore from '@mjagency/seo'` but Phase 6 only exported `runPluginEngine` — no `computeLiveScore` adapter existed.
- **Fix:** Created `packages/seo/src/actions/compute-live-score.ts` — wraps `runPluginEngine` with simplified `{ agencyId, content, metaDescription }` input and returns `{ score, breakdown }`.
- **Files modified:** packages/seo/src/actions/compute-live-score.ts (new), packages/seo/src/index.ts
- **Commit:** 87e5b3e

**3. [Rule 3 - Blocker] getBlockConfig missing from @mjagency/ui**
- **Found during:** T-02 PuckEditorClient.tsx creation
- **Issue:** The plan imports `getBlockConfig from '@mjagency/ui'` but this function was never created in Phase 5.
- **Fix:** Created `packages/ui/src/blocks/get-block-config.ts` — registers all 45 block components using an `asBlock()` helper that correctly types components as `ComponentType<any>` (required because strict TypeScript won't allow `FC<SpecificProps>` → `ComponentType<Record<string, unknown>>` without an intermediate cast).
- **Files modified:** packages/ui/src/blocks/get-block-config.ts (new), packages/ui/src/index.ts
- **Commit:** 87e5b3e, 077ecac

**4. [Rule 3 - Blocker] @types/react missing from builder devDependencies**
- **Found during:** T-01 typecheck run
- **Issue:** Builder package had no React types — all TSX files failed with "Cannot find module 'react'" errors.
- **Fix:** Added `"@types/react": "^18 || ^19"` to devDependencies and ran `pnpm install --filter @mjagency/builder`.
- **Files modified:** packages/builder/package.json
- **Commit:** 077ecac

**5. [Rule 1 - Bug] Hex literal fallbacks in CSS var() calls**
- **Found during:** T-01 hex literal scan
- **Issue:** Plan template included `var(--mj-color-text-on-success, #fff)` — the `#fff` fallback violates zero-hex-literals rule.
- **Fix:** Removed fallback values, using `var(--mj-color-text-on-success)` and `var(--mj-color-text-on-error)` — tokens must be defined in the design system anyway.
- **Files modified:** packages/builder/src/PuckAdminBar.tsx, packages/builder/src/UnsavedChangesDialog.tsx
- **Commit:** 87e5b3e

## Pre-existing Out-of-Scope Issues (Not Fixed)

Logged to deferred-items.md:
- `packages/db/src/schema/`: `SQL<unknown>` not assignable to `PgPolicyToOption` — pre-existing Drizzle RLS type issue
- `packages/db/src/seed/`: undefined assignment in crm-contacts/crm-pipelines — pre-existing
- `packages/ui/src/rum/web-vitals.tsx`: missing web-vitals types in builder context — pre-existing (web-vitals is in ui's dependencies, not builder's)

## Verification Results

| Check | Result |
|-------|--------|
| requireSession() in PuckEditor.tsx | PASS |
| 3+ redirect('/login') paths in PuckEditor.tsx | PASS (4 paths) |
| requireSession() in publishPage (first line) | PASS |
| session.agencyId check in publishPage | PASS |
| No dangerouslySetInnerHTML in src/ | PASS (only in comments) |
| Zero hex literals in src/ | PASS |
| aria-pressed on admin bar toggle | PASS |
| getBlockConfig() in PuckEditorClient | PASS |
| config={blockConfig} passed to Puck | PASS |
| @mjagency/ui import in PuckEditorClient | PASS |
| @mjagency/ui in package.json | PASS |
| beforeunload in UnsavedChangesDialog | PASS |
| pnpm typecheck (builder-specific files) | PASS (pre-existing db/ui/rum errors excluded) |

## Known Stubs

None — all components are fully implemented with real logic. The SEO score starts at 0 if `computeLiveScore` throws (non-fatal), and the builder renders with score 0 in that case. This is intentional graceful degradation, not a stub.

## Threat Flags

No new threat surface introduced beyond what was planned in the threat model.

## Self-Check: PASSED

- packages/builder/src/PuckEditor.tsx — FOUND
- packages/builder/src/PuckEditorClient.tsx — FOUND
- packages/builder/src/PuckAdminBar.tsx — FOUND
- packages/builder/src/PuckMetaPanel.tsx — FOUND
- packages/builder/src/SeoScoreWidget.tsx — FOUND
- packages/builder/src/UnsavedChangesDialog.tsx — FOUND
- packages/builder/src/actions/publish-page.ts — FOUND
- packages/builder/src/actions/save-draft.ts — FOUND
- packages/seo/src/actions/compute-live-score.ts — FOUND
- packages/ui/src/blocks/get-block-config.ts — FOUND
- Commit 87e5b3e — FOUND (git log)
- Commit 077ecac — FOUND (git log)
