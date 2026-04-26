---
phase: 04-design-system
plan: 03
subsystem: design-system/theme-resolution
tags: [theme-resolution, css-cascade, data-attrs, fouc-prevention, react-hooks, playwright, oklch]
dependency_graph:
  requires:
    - packages/ui/tokens/layer-1-primitives.css (Plan 04-01)
    - packages/ui/src/theme/types.ts (Plan 04-01)
    - packages/ui/src/theme/validate-theme.ts (Plan 04-02)
    - packages/ui/themes/schemas/theme.schema.json (Plan 04-02)
  provides:
    - packages/ui/src/theme/compile-theme.ts
    - packages/ui/src/theme/resolve-theme.ts
    - packages/ui/src/theme/data-attrs.ts
    - packages/ui/src/hooks/use-theme.ts
    - packages/ui/src/hooks/use-page-theme.ts
    - packages/ui/__tests__/theme-switch.spec.ts
    - packages/ui/playwright.config.ts
    - apps/web-main/src/app/layout.tsx (FOUC script + suppressHydrationWarning)
  affects:
    - Plan 04-04 (consumes compileThemeToCss for 12 niche themes)
    - Plan 04-05 (Storybook uses getDataAttrs + useTheme for preview decorator)
    - Phase 8 (agency app layouts spread getDataAttrs; FOUC pattern replicated)
tech_stack:
  added:
    - server-only@0.0.1 (resolve-theme server guard)
    - "@testing-library/react@^16.0.0 (hook testing via renderHook)"
    - "@playwright/test@^1.44.0 (e2e theme-switch perf test)"
    - jsdom@^25.0.0 (vitest jsdom environment for hook tests)
  patterns:
    - Pure CSS cascade: 5 [data-*] layers on <html> (base → agency → page → dark → variant)
    - Build-time CSS emission via compileThemeToCss (zero runtime cost)
    - assertValidTheme gate before CSS generation (fail-fast on invalid theme.json)
    - FOUC prevention: synchronous blocking <script> in <head> before first paint
    - server-only vitest alias → no-op mock for node test environment
key_files:
  created:
    - packages/ui/src/theme/compile-theme.ts
    - packages/ui/src/theme/resolve-theme.ts
    - packages/ui/src/theme/data-attrs.ts
    - packages/ui/src/hooks/use-theme.ts
    - packages/ui/src/hooks/use-page-theme.ts
    - packages/ui/src/__tests__/compile-theme.test.ts
    - packages/ui/src/__tests__/resolve-theme.test.ts
    - packages/ui/src/__tests__/data-attrs.test.ts
    - packages/ui/src/__tests__/use-theme.test.ts
    - packages/ui/src/__tests__/use-page-theme.test.ts
    - packages/ui/src/__tests__/__mocks__/server-only.ts
    - packages/ui/__tests__/theme-switch.spec.ts
    - packages/ui/playwright.config.ts
  modified:
    - packages/ui/src/index.ts (add compile-theme, resolve-theme, data-attrs, useTheme, usePageTheme exports)
    - packages/ui/package.json (server-only dep; react/testing-library/jsdom/playwright devDeps; test:e2e script; peerDeps)
    - packages/ui/vitest.config.ts (server-only alias → no-op mock; import.meta.url resolution)
    - apps/web-main/src/app/layout.tsx (FOUC inline script + suppressHydrationWarning + getDataAttrs spread)
    - .gitignore (add test-results/ + playwright-report/)
decisions:
  - "Pure CSS cascade: zero JS object merging at runtime — setAttribute triggers browser CSS variable inheritance (REQ-045)"
  - "5 attribute layers: :root → [data-agency] → [data-page] → [data-theme] → [data-variant], all on <html> only"
  - "compileThemeToCss is build-time only; Plan 04-04 runs once per agency; runtime cost = zero"
  - "custom-css appended VERBATIM after [data-agency] block (Pitfall 8: not inside scope block)"
  - "resolveTheme M004 filesystem-only; DB migration defers to Phase 5 (Open Q4 resolved)"
  - "FOUC inline script is static string literal; CSP nonce deferred to Phase 11"
  - "server-only aliased to no-op in vitest.config.ts; node test environment can import server modules"
metrics:
  duration: "~45 minutes"
  completed: "2026-04-25"
  tasks: 2
  files: 15
---

# Phase 04 Plan 03: Theme Resolution Stack Summary

**One-liner:** Pure CSS cascade resolution (5 `[data-*]` attribute layers on `<html>`) with build-time `compileThemeToCss`, M004 filesystem `resolveTheme`, Edge-safe `getDataAttrs`, `useTheme`/`usePageTheme` client hooks, and FOUC-prevention inline script wired into web-main layout.

## What Was Built

### 5-Layer Pure CSS Cascade (REQ-043)

The theme resolution stack uses zero JavaScript object merging at runtime. All five attribute layers attach exclusively to `<html>`:

```
[1] :root                        — base token layer (packages/ui/tokens/)
[2] [data-agency="ecommerce"]    — agency override block (Plan 04-04 theme.json compiled)
[3] [data-page="home"]           — page-level override (page meta or CMS)
[4] [data-theme="dark"]          — dark mode token swap (REQ-046, dark-mode.css)
[5] [data-variant="b"]           — A/B variant override (Plan 04-09 stub; full in M009)
```

CSS specificity orders them by selector compound count + cascade order. A single `setAttribute('data-theme', 'dark')` call propagates to all child elements via the existing browser styling pipeline — no style recalculation loops, no `getComputedStyle` polling.

### compileThemeToCss (packages/ui/src/theme/compile-theme.ts)

Build-time CSS emitter. Plan 04-04 calls this once per agency at build time to emit static CSS shipped with the app bundle:

```
[data-agency="X"] { --mj-{scope}-{key}: {value}; ... }
[data-agency="X"][data-theme="dark"] { ... }   // optional dark overlay
{custom-css verbatim}                          // optional, post-block (Pitfall 8)
```

Key behaviors:
- Calls `assertValidTheme(theme, ...)` from Plan 04-02 BEFORE any CSS generation (fail-fast)
- Skips `custom-css` and `code-injection` scopes inside the agency block
- Appends `custom-css` VERBATIM after the closing `}` (M004 admin-only; Phase 10 Builder must add XSS strip)
- Emits `[data-agency][data-theme="dark"]` compound selector only when `theme.dark` has content

### resolveTheme (packages/ui/src/theme/resolve-theme.ts)

M004 filesystem-only server function (imports `server-only`). Reads `packages/ui/themes/default/theme-{agency}.json`, runs `assertValidTheme`, returns `{ theme: ThemeJson, dataAttrs: Record<string, string> }`. Phase 5 CMS will add DB-backed override with this same interface.

Open Q4 resolved: NO `agency_themes` table migration in Phase 4. `005_create_theme_tables.sql` defers to Phase 5.

### getDataAttrs (packages/ui/src/theme/data-attrs.ts)

Edge-safe (no `server-only`, no Node.js imports). Returns the 5-layer data-* prop bag for `<html>` spread. Phase 8 agency app layouts consume this in their root layouts.

### useTheme + usePageTheme (packages/ui/src/hooks/)

Both start with `'use client'` directive:

- `useTheme()`: reads `localStorage` + `document.documentElement.getAttribute('data-theme')` on mount. `setTheme(next)` calls `setAttribute` + `localStorage.setItem` + state update in that order. `toggle()` flips light ↔ dark.
- `usePageTheme()`: `setPageTheme(name|null)` toggles `data-page` on `<html>` via `setAttribute`/`removeAttribute`.

### FOUC Prevention (apps/web-main/src/app/layout.tsx)

Synchronous blocking `<script>` as FIRST child of `<head>`, BEFORE any stylesheet links:

```js
(function(){try{var s=localStorage.getItem('mj-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',s||(d?'dark':'light'));}catch(e){}})();
```

`<html suppressHydrationWarning>` prevents React hydration warnings from the pre-hydration `data-theme` mutation. `getDataAttrs({ agency: 'brand' })` spreads `data-agency="brand" data-theme="light"` on `<html>` for SSR.

### Playwright e2e (packages/ui/__tests__/theme-switch.spec.ts)

Proves REQ-045: `setAttribute` propagation < 16ms (one 60fps frame budget). Suite skips cleanly when `PLAYWRIGHT_AVAILABLE` env var is not set (CI gate — Phase 1/1.5 provisions Chromium).

## Tests

| File | Tests | Coverage |
|------|-------|---------|
| compile-theme.test.ts | 10 | Output shape, token names, dark overlay, custom-css escape hatch, validator gate, determinism |
| resolve-theme.test.ts | 5 | Valid resolution, default attrs, optional attrs, missing file error, invalid fixture |
| data-attrs.test.ts | 3 | Default theme, all 4 attrs, optional field omission |
| use-theme.test.ts | 5 | localStorage read, DOM fallback, setTheme persistence, toggle, default |
| use-page-theme.test.ts | 3 | setPageTheme sets attr, null removes attr, mounts from DOM truth |
| theme-switch.spec.ts | 1 (skip) | Playwright: <16ms setAttribute propagation |

**26 new tests** (18 Task 3.1 + 8 Task 3.2). **Total Phase 4 vitest: 54 passing.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] server-only package throws in vitest node environment**
- **Found during:** Task 3.1 GREEN phase — `resolveTheme` test suite failed to load
- **Issue:** The `server-only` package's `index.js` unconditionally throws: "This module cannot be imported from a Client Component module." This check fires even in Node.js vitest context because the package uses a build-tool convention, not a true runtime guard.
- **Fix:** Added `alias: { 'server-only': './src/__tests__/__mocks__/server-only.ts' }` to `vitest.config.ts`, using `fileURLToPath` + `URL` for portable resolution. Created `__mocks__/server-only.ts` as a no-op `export {}`.
- **Files modified:** `packages/ui/vitest.config.ts`, `packages/ui/src/__tests__/__mocks__/server-only.ts`
- **Commit:** 33af73f

**2. [Rule 2 - Missing critical] Added server-only to packages/ui/package.json dependencies**
- **Found during:** Task 3.1 implementation — `resolve-theme.ts` imports `server-only` but it wasn't listed as a UI package dependency
- **Fix:** Added `"server-only": "0.0.1"` to `dependencies` in `packages/ui/package.json`
- **Files modified:** `packages/ui/package.json`
- **Commit:** 33af73f

**3. [Rule 2 - Missing critical] Added test-results/ to .gitignore**
- **Found during:** Task 3.2 — after running `test:e2e`, Playwright created an empty `test-results/` directory that appeared as untracked
- **Fix:** Added `test-results/` and `playwright-report/` to root `.gitignore`
- **Files modified:** `.gitignore`
- **Commit:** 742ceb2

**4. [Rule 1 - Bug] globals.css already imports @mjagency/ui/styles/theme.css (no duplicate)**
- **Found during:** Task 3.2 layout.tsx update — plan's locked interface shows `import '@mjagency/ui/styles/theme.css'` in layout.tsx, but `apps/web-main/src/app/globals.css` already has `@import "@mjagency/ui/styles/theme.css"` and layout.tsx imports `./globals.css`
- **Fix:** Did not add duplicate CSS import. Kept `import './globals.css'` as the single CSS entry point.
- **Files modified:** None (correct behavior preserved)

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes. T-04-006, T-04-007, T-04-008 from the plan's threat model are acknowledged:

| Flag | File | Description |
|------|------|-------------|
| T-04-006 (accepted M004) | compile-theme.ts | custom-css append VERBATIM post-block; admin-only at M004; Phase 10 Builder must strip XSS vectors |
| T-04-007 (mitigated) | layout.tsx | FOUC script reads localStorage but only uses value as DOM attribute (no innerHTML/eval); CSP nonce Phase 11 |
| T-04-008 (accepted) | CSS cascade | data-agency attribute is cosmetic-only; no auth/data gate |

## Open Q4 Resolution

DB migration timing resolved: **NO migration in Phase 4.** Themes are filesystem-only at M004 (`packages/ui/themes/default/theme-{slug}.json` shipped by Plan 04-04). DB persistence (`agency_themes`, `theme_versions`, `theme_ab_variants`) defers to Phase 5 CMS — `005_create_theme_tables.sql` will live there. `resolveTheme` interface is stable: M005 adds DB-backed override with filesystem fallback.

## Plan Dependencies

| Consumer | What It Needs | Status |
|----------|---------------|--------|
| Plan 04-04 (12 niche themes) | `compileThemeToCss`, `ThemeJson`, `assertValidTheme` | Ready |
| Plan 04-05 (Storybook) | `getDataAttrs`, `useTheme` for preview decorator + toolbar | Ready |
| Phase 8 (agency apps) | `getDataAttrs` in root layouts; FOUC script pattern | Ready |
| Phase 5 CMS | `resolveTheme` interface stable; DB override path deferred | Deferred |
| Phase 9 A/B testing | `data-variant` CSS layer in place; analytics sets attr | Ready |
| Phase 11 CSP | FOUC script needs nonce attribute | Deferred |

## Stub Tracking

None. All implementations are complete and wired. The `resolveTheme` M004 filesystem-only implementation is intentionally scoped (documented decision, not a stub): Phase 5 will add the DB path to the same interface.

## Self-Check: PASSED

Files verified:
- packages/ui/src/theme/compile-theme.ts - FOUND, contains compileThemeToCss + assertValidTheme + data-agency
- packages/ui/src/theme/resolve-theme.ts - FOUND, contains server-only import + resolveTheme + ThemeResolution
- packages/ui/src/theme/data-attrs.ts - FOUND, contains getDataAttrs (no server-only)
- packages/ui/src/hooks/use-theme.ts - FOUND, contains 'use client' + localStorage + documentElement.setAttribute
- packages/ui/src/hooks/use-page-theme.ts - FOUND, contains 'use client' + data-page
- packages/ui/__tests__/theme-switch.spec.ts - FOUND, contains performance.now + toBeLessThan(16)
- packages/ui/playwright.config.ts - FOUND
- apps/web-main/src/app/layout.tsx - FOUND, contains suppressHydrationWarning + mj-theme + dangerouslySetInnerHTML + getDataAttrs
- packages/ui/src/__tests__/compile-theme.test.ts - FOUND (10 tests)
- packages/ui/src/__tests__/resolve-theme.test.ts - FOUND (5 tests)
- packages/ui/src/__tests__/data-attrs.test.ts - FOUND (3 tests)
- packages/ui/src/__tests__/use-theme.test.ts - FOUND (5 tests)
- packages/ui/src/__tests__/use-page-theme.test.ts - FOUND (3 tests)

Commits verified:
- 33af73f: feat(04-03): compileThemeToCss + resolveTheme + data-attrs + 18 tests (Task 3.1)
- 742ceb2: feat(04-03): client hooks + FOUC inline script + Playwright theme-switch (Task 3.2)

Test count: 54 vitest passing (8 token-shape + 14 validate-theme + 6 no-hex-literals + 10 compile-theme + 5 resolve-theme + 3 data-attrs + 5 use-theme + 3 use-page-theme)
