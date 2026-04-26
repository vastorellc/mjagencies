---
phase: 04-design-system
plan: 01
subsystem: design-system/tokens
tags: [tokens, css-variables, tailwind-v4, dark-mode, oklch, typescript]
dependency_graph:
  requires: []
  provides:
    - packages/ui/tokens/layer-1-primitives.css
    - packages/ui/tokens/layer-2-semantic-color.css
    - packages/ui/tokens/layer-3-typography.css
    - packages/ui/tokens/layer-4-layout.css
    - packages/ui/tokens/layer-5-effects.css
    - packages/ui/tokens/layer-6-components.css
    - packages/ui/tokens/dark-mode.css
    - packages/ui/styles/theme.css
    - packages/ui/src/theme/types.ts
    - packages/ui/src/index.ts (extended from Phase 1 stub)
  affects:
    - apps/web-main (globals.css + root layout wired)
    - Plan 04-02 (ThemeJson type stub)
    - Plan 04-03 (Layer 2 brand token override surface)
    - Plan 04-04 (Layer 1 primitive reference surface)
    - Plan 04-05 (theme.css Storybook entry)
tech_stack:
  added:
    - OKLCH color space (all color values)
    - Tailwind v4 @theme inline bridge pattern
    - "@custom-variant dark (CSS attribute selector)"
  patterns:
    - 6-layer CSS token cascade (primitive → semantic → typography → layout → effects → component)
    - CSS variable indirection via var() for next/font/google integration
    - Layer 6 isolation rule (component tokens never reference Layer 1)
key_files:
  created:
    - packages/ui/tokens/layer-1-primitives.css
    - packages/ui/tokens/layer-2-semantic-color.css
    - packages/ui/tokens/layer-3-typography.css
    - packages/ui/tokens/layer-4-layout.css
    - packages/ui/tokens/layer-5-effects.css
    - packages/ui/tokens/layer-6-components.css
    - packages/ui/tokens/dark-mode.css
    - packages/ui/src/theme/types.ts
    - packages/ui/src/__tests__/tokens-shape.test.ts
    - packages/ui/vitest.config.ts
    - apps/web-main/src/app/layout.tsx
    - apps/web-main/src/app/globals.css
  modified:
    - packages/ui/styles/theme.css (Phase 1 hex skeleton replaced with @theme inline bridge)
    - packages/ui/package.json (exports + peerDependencies added)
    - packages/ui/tsconfig.json (include vitest.config.ts)
    - packages/ui/src/index.ts (ThemeJson/MjColorToken/MjThemeLayer/ThemeTokenValue exports)
    - packages/ui/README.md (6-layer docs, bridge, dark mode, REQ coverage)
    - apps/web-main/src/app/(frontend)/layout.tsx (simplified to forward children; root layout handles html/body)
decisions:
  - "Namespace prefix --mj- for all custom tokens; Tailwind --color-*/--spacing-* only appear in @theme inline bridge"
  - "Layer 1 = OKLCH primitives only; Phase 1 hex literals (#f0f9ff, #0ea5e9, #0c4a6e) replaced"
  - "Layer 6 isolation: component tokens compose Layer 2-5 only (exception --mj-ill-neutral)"
  - "Dark mode via [data-theme=dark] attribute selector; only Layer 2 colors flip (REQ-046)"
  - "next/font/google indirection: --mj-font-brand uses var(--font-brand, var(--mj-font-sans))"
  - "web-main smoke test: CSS pipeline wired correctly; build blocked by pre-existing Payload/auth webpack errors (out-of-scope)"
metrics:
  duration: "~35 minutes"
  completed: "2026-04-25"
  tasks: 2
  files: 14
---

# Phase 04 Plan 01: 6-Layer CSS Token Schema + Tailwind v4 Bridge Summary

**One-liner:** 6-layer OKLCH CSS variable token schema in `packages/ui/tokens/` with Tailwind v4 `@theme inline` bridge mapping `--mj-*` tokens to utility classes.

## What Was Built

### 6-Layer Token Architecture

Seven discrete CSS files shipped under `packages/ui/tokens/`:

| Layer | File | Purpose |
|-------|------|---------|
| 1 | `layer-1-primitives.css` | Raw OKLCH palette: 6 blue steps + 12 neutral steps (0..950). Zero hex literals. |
| 2 | `layer-2-semantic-color.css` | Semantic bg/text/border/brand/accent/state colors. Composes Layer 1 only. |
| 3 | `layer-3-typography.css` | Font families with `next/font/google` fallback chain, type scale (xs-6xl), weights, leading, tracking. |
| 4 | `layer-4-layout.css` | 8px-grid spacing (14 values), container widths (sm-3xl), border radius (none-full), grid config. |
| 5 | `layer-5-effects.css` | Shadows (OKLCH alpha, not rgba), blurs, transition durations, easing curves. |
| 6 | `layer-6-components.css` | Composed btn/card/form/ill/icon tokens. Composes Layers 2-5 only (never Layer 1 directly). |
| dark | `dark-mode.css` | `[data-theme="dark"]` - reassigns Layer 2 color tokens only. No asset reload. |

### Tailwind v4 Bridge (`@theme inline`)

`packages/ui/styles/theme.css` is the single CSS entry for all 12 agency apps. Import chain:

```
@import "tailwindcss"
  → @import layer-1-primitives.css
  → @import layer-2-semantic-color.css
  → @import layer-3-typography.css
  → @import layer-4-layout.css
  → @import layer-5-effects.css
  → @import layer-6-components.css
  → @import dark-mode.css
  → @theme inline { --color-brand-500: var(--mj-color-brand-500); ... }
  → @custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
```

`@theme inline` preserves `var()` references at use-time, keeping tokens dynamic for dark mode and per-agency overrides.

### TypeScript Types (`packages/ui/src/theme/types.ts`)

- `MjThemeLayer` - union of 6 layer names
- `MjColorToken` - union of 19 semantic color token names
- `ThemeTokenValue` - `{ value: string; layer: MjThemeLayer }` - value must be `var(--mj-*)` or raw CSS (no hex)
- `ThemeJson` - stub interface (slug/name/niche/version + scopes/dark); Plan 04-02 fills the full AJV-validated schema

## Tests

8 token-shape tests in `packages/ui/src/__tests__/tokens-shape.test.ts`:

1. Layer 1 has 18+ `--mj-primitive-*` tokens; never references `--mj-color-` or `--mj-space-`
2. Layer 2 `var(--mj-*)` references are only `primitive-` or `color-` (self-reference allowed)
3. Layer 3 has font/size/weight/leading/tracking; `--mj-font-brand` uses `var(--font-brand` indirection
4. Layer 4 has 14+ spacing tokens, 6+ container widths, 8+ radius tokens
5. Layer 5 shadows use `oklch(` not `rgba(`
6. Layer 6 only references `--mj-primitive-*` on the `--mj-ill-neutral` line
7. `dark-mode.css` selector is `[data-theme="dark"]`; all declarations start with `color-`/`card-`/`form-`
8. `theme.css` imports 7 files in order + has `@theme inline {` + `@custom-variant dark (`

All 8 tests pass: `pnpm --filter=@mjagency/ui test` exits 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript noUncheckedIndexedAccess errors in test file**
- **Found during:** Task 4-1.2 typecheck
- **Issue:** `tsconfig.base.json` has `noUncheckedIndexedAccess: true`; regex capture groups `m[1]` and `propMatch[1]` typed as `string | undefined`
- **Fix:** Added `?? ''` null coalescing to guard both capture group accesses
- **Files modified:** `packages/ui/src/__tests__/tokens-shape.test.ts`
- **Commit:** 2a901d1

**2. [Rule 3 - Blocking] Fixed pre-existing Next.js root layout error for `/sso` route**
- **Found during:** Task 4-1.2 smoke test (web-main build)
- **Issue:** `apps/web-main/src/app/sso/page.tsx` exists at root level without a root `layout.tsx`; Next.js build rejected with "doesn't have a root layout"
- **Fix:** Created `apps/web-main/src/app/layout.tsx` (minimal root layout importing `globals.css`) + `apps/web-main/src/app/globals.css` (imports `@mjagency/ui/styles/theme.css`); simplified `(frontend)/layout.tsx` to forward children (no duplicate html/body nesting)
- **Files modified:** `apps/web-main/src/app/layout.tsx` (new), `apps/web-main/src/app/globals.css` (new), `apps/web-main/src/app/(frontend)/layout.tsx` (simplified)
- **Commit:** 2a901d1

### Deferred Issues (Out-of-Scope Pre-existing Errors)

The web-main production build continues to fail due to pre-existing webpack errors introduced in Phases 1-3, unrelated to our CSS token work:

- `Duplicate export 'OPTIONS'` in `(payload)/api/[...slug]/route.ts`
- `Module not found: payload.config` in graphql and graphql-playground routes
- `Module not found: ./tokens.js` and `./cookie.js` in `packages/auth/src/index.ts`

These errors were confirmed pre-existing by stashing all plan-04-01 changes and running `pnpm --filter=@mjagency/web-main build` — same failures appeared without our changes.

**Impact on smoke test:** The Open Q3 `@theme inline` smoke test (inspect `.next/static/css/` for `mj-color-brand`) cannot be completed because the build fails at the webpack JS bundle stage before CSS is compiled. The CSS import pipeline is structurally correct: `globals.css → @mjagency/ui/styles/theme.css → @import tailwindcss + 6 layers + @theme inline`. The smoke test outcome is deferred until the pre-existing webpack errors are resolved in a separate fix.

## Stub Tracking

None. All token values are complete OKLCH or var() references. The `ThemeJson` interface in `types.ts` is intentionally marked as a stub because Plan 04-02 fills it from `theme.schema.json` - this is documented in the code comment and README.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. All files are static CSS and TypeScript types. T-04-001 and T-04-002 mitigations are applied:
- T-04-001: Zero hex literals in `packages/ui/tokens/` and `packages/ui/styles/` (REQ-047 partial)
- T-04-002: `--mj-` prefix isolates custom tokens; `@theme inline` is the only place Tailwind utility vars (`--color-*`, `--spacing-*`) are defined

## Self-Check: PASSED

All files verified:
- packages/ui/tokens/layer-1-primitives.css - FOUND
- packages/ui/tokens/layer-2-semantic-color.css - FOUND
- packages/ui/tokens/layer-3-typography.css - FOUND
- packages/ui/tokens/layer-4-layout.css - FOUND
- packages/ui/tokens/layer-5-effects.css - FOUND
- packages/ui/tokens/layer-6-components.css - FOUND
- packages/ui/tokens/dark-mode.css - FOUND
- packages/ui/styles/theme.css - FOUND
- packages/ui/src/theme/types.ts - FOUND
- packages/ui/src/__tests__/tokens-shape.test.ts - FOUND

All commits verified:
- b349ae9: feat(04-01): six token layers + dark mode (Task 1.1)
- be8cfee: test(04-01): add failing token-shape tests (TDD RED)
- 2a901d1: feat(04-01): theme.css bridge + types + 8 shape tests + smoke wiring (Task 1.2)
