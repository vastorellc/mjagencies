---
phase: 04-design-system
plan: "04"
subsystem: design-system/theme-engine
tags: [theme, oklch, niche-palettes, css-generation, vitest, REQ-044, REQ-042, REQ-046, REQ-047]

dependency_graph:
  requires:
    - "04-01: 6-layer CSS token schema (layer-1-primitives.css, dark-mode.css, theme.css base)"
    - "04-02: AJV theme.schema.json validator + assertValidTheme + ThemeJson types"
    - "04-03: compileThemeToCss, resolveTheme, getDataAttrs"
  provides:
    - "12 OKLCH-based niche theme files (packages/ui/themes/default/theme-{slug}.json)"
    - "NICHE_PALETTES TypeScript source of truth for 12 niche OKLCH palettes"
    - "NICHE_FONTS TypeScript source of truth for 12 niche font assignments"
    - "scripts/generate-agency-css.ts: build-time CSS generator (idempotent)"
    - "packages/ui/styles/agencies.generated.css: 12 [data-agency] + 12 dark overlay blocks"
    - "packages/ui/styles/theme.css updated import order: tailwind → 6 layers → dark-mode → agencies.generated → @theme inline → @custom-variant dark"
    - "8 integration tests in niche-themes.test.ts (62 total Phase 4 tests)"
  affects:
    - "04-05: Storybook iterates theme-{slug}.json for 540-story matrix (45 blocks × 12 themes)"
    - "Phase 8 agency apps: <html data-agency='ecommerce'> activates agency CSS block via cascade"
    - "Phase 5 CMS: reads JSON at startup, imports into agency_themes table (Plan 05-CMS)"
    - "Phase 12: visual QA dials dark overlay per niche without changing this contract"

tech_stack:
  added:
    - "OKLCH color model: 12 niche palettes with primary50/500/900 + accent triples"
    - "scripts/generate-agency-css.ts: Node.js build script via tsx"
    - "pnpm theme:generate: root package.json script"
  patterns:
    - "Single TS source + committed JSON: niche-palettes.ts is human-edit source; JSON files derived but committed for CI/editor"
    - "TDD RED/GREEN: niche-themes.test.ts written + passing; 8 integration tests cover 12 themes"
    - "CSS cascade: [data-agency='X'] overrides :root; [data-agency='X'][data-theme='dark'] wins over plain [data-theme='dark']"
    - "T-04-010 drift guard: Test 5 asserts theme.scopes.color.brand-500 === NICHE_PALETTES[agency].primary500"

key_files:
  created:
    - packages/ui/src/theme/niche-palettes.ts
    - packages/ui/src/theme/font-stacks.ts
    - packages/ui/themes/default/theme-brand.json
    - packages/ui/themes/default/theme-ecommerce.json
    - packages/ui/themes/default/theme-growth.json
    - packages/ui/themes/default/theme-webdev.json
    - packages/ui/themes/default/theme-ai.json
    - packages/ui/themes/default/theme-branding.json
    - packages/ui/themes/default/theme-strategy.json
    - packages/ui/themes/default/theme-finance.json
    - packages/ui/themes/default/theme-engineering.json
    - packages/ui/themes/default/theme-product.json
    - packages/ui/themes/default/theme-video.json
    - packages/ui/themes/default/theme-graphic.json
    - packages/ui/src/__tests__/niche-themes.test.ts
    - packages/ui/styles/agencies.generated.css
    - scripts/generate-agency-css.ts
  modified:
    - packages/ui/src/index.ts (added NICHE_PALETTES + NICHE_FONTS exports)
    - packages/ui/styles/theme.css (added @import ./agencies.generated.css)
    - package.json (added theme:generate script)

decisions:
  - "OKLCH-only palettes: All 12 theme files use oklch() functions exclusively; zero hex literals enforced by AJV schema + validator gate (REQ-047)"
  - "Committed generated CSS: agencies.generated.css is committed (not gitignored) so Plan 04-05 Storybook builds without generation step; PRs surface unintended palette changes (T-04-009)"
  - "Single TS source: niche-palettes.ts is human-edit source; JSON files can be regenerated; Test 5 catches drift on CI"
  - "Dark overlay = colors-only: Only Layer 2 color tokens flip in dark overlay per Plan 04-01 dark-mode.css pattern; spacing/typography unchanged"
  - "Open Q4 resolved: NO DB migration in Phase 4; themes are filesystem-only at M004; agency_themes table defers to Phase 5 CMS (005_create_theme_tables.sql)"
  - "Import order: agencies.generated.css sits BETWEEN dark-mode.css and @theme inline — agency overrides fire after :root + dark mode, before Tailwind utility resolution"

metrics:
  duration: "~25 minutes"
  completed: "2026-04-25"
  tasks_completed: 2
  files_created: 17
  files_modified: 3
  tests_added: 8
  total_phase4_tests: 62
---

# Phase 04 Plan 04: 12 Niche Default Themes — OKLCH Palettes + CSS Generator Summary

**One-liner:** 12 OKLCH-based niche themes as filesystem JSON (all 20 scopes, dark overlays, zero hex), compiled to `agencies.generated.css` via `compileThemeToCss`, imported by `theme.css` between dark-mode and `@theme inline`.

---

## What Was Built

### Task 4-4.1: niche-palettes.ts + font-stacks.ts + 12 theme JSON files

**`packages/ui/src/theme/niche-palettes.ts`** — Single TypeScript source of truth for the 12 niche OKLCH palettes per RESEARCH §5.1. Exports `NICHE_PALETTES: Record<AgencyNiche, NichePalette>` with four OKLCH color triples (primary50/500/900 + accent) and a `personality` string per niche. 12 niches mapped: brand=blue, ecommerce=orange, growth=indigo, webdev=cool-blue/teal, ai=violet, branding=near-black/amber, strategy=navy/gold, finance=navy/muted-green, engineering=charcoal/amber, product=cream/coral, video=warm-dark/gold, graphic=near-black/vivid-green.

**`packages/ui/src/theme/font-stacks.ts`** — Single TypeScript source of truth for niche font assignments per RESEARCH §5.2. Exports `NICHE_FONTS: Record<AgencyNiche, NicheFontStack>` with heading + body font family names. Fonts used: Inter, Plus Jakarta Sans, JetBrains Mono, Instrument Sans, Fraunces, Playfair Display, Source Serif 4, Source Sans 3, IBM Plex Sans, DM Sans, Bebas Neue, Space Grotesk.

**12 theme JSON files** at `packages/ui/themes/default/theme-{slug}.json` — one per AGENCIES slug from `@mjagency/config`. Each file:
- Has `$schema: "../schemas/theme.schema.json"` for editor inline validation
- Has all 20 required scopes (brand/color/type/spacing/layout/components/header/footer/hero/blocks/templates/motion/icons/imagery/theme/a11y/perf/seo-defaults/custom-css/code-injection)
- Uses literal OKLCH values for niche-specific brand colors (brand-50/500/900, accent-primary, brand.primary/secondary) — self-contained, no `--mj-primitive-{agency}-*` dependency
- Uses `var(--mj-primitive-neutral-*)` references for shared neutral tokens
- Has `dark.color` overlay flipping 5 tokens: bg-primary, bg-secondary, text-primary, text-secondary, border-default
- Passes `pnpm theme:validate` (AJV, no hex literals)

**`packages/ui/src/index.ts`** extended with `NICHE_PALETTES` and `NICHE_FONTS` barrel exports.

### Task 4-4.2: generate-agency-css.ts + agencies.generated.css + theme.css import + tests

**`scripts/generate-agency-css.ts`** — Build-time script that reads all 12 `theme-{slug}.json` files, validates each via `assertValidTheme`, compiles each via `compileThemeToCss({ agency, theme })`, and writes a single combined `packages/ui/styles/agencies.generated.css`. Throws if any expected file is missing. Logs progress. Includes AUTO-GENERATED header (T-04-009 mitigation).

**`packages/ui/styles/agencies.generated.css`** — Committed generated file containing:
- 12 `[data-agency="X"] { ... }` light-mode override blocks
- 12 `[data-agency="X"][data-theme="dark"] { ... }` dark overlay blocks
- AUTO-GENERATED header warning reviewers not to edit manually
- Zero hex literals

**`packages/ui/styles/theme.css`** import order updated (per plan spec):
```
@import "tailwindcss"
@import "../tokens/layer-1-primitives.css"
@import "../tokens/layer-2-semantic-color.css"
@import "../tokens/layer-3-typography.css"
@import "../tokens/layer-4-layout.css"
@import "../tokens/layer-5-effects.css"
@import "../tokens/layer-6-components.css"
@import "../tokens/dark-mode.css"
@import "./agencies.generated.css"   ← NEW: agency override layer
@theme inline { ... }
@custom-variant dark (...)
```

**`packages/ui/src/__tests__/niche-themes.test.ts`** — 8 integration tests:
1. All 12 theme files exist on disk
2. Every theme parses as JSON + passes `assertValidTheme`
3. `meta.slug` matches filename/agency key
4. `meta.niche` matches AGENCIES enum
5. `scopes.color.brand-500` matches `NICHE_PALETTES[agency].primary500` (T-04-010 drift guard)
6. All 20 scopes present per theme
7. `dark.color` has at least 5 keys (REQ-046)
8. No two themes share the same `meta.slug`

**Root `package.json`** — added `"theme:generate": "tsx scripts/generate-agency-css.ts"`.

---

## Verification Results

| Check | Result |
|-------|--------|
| 12 theme files at `packages/ui/themes/default/` | PASS: exactly 12 |
| `pnpm theme:validate` (all 12) | PASS: `theme OK:` for all 12 |
| All 20 scopes per theme | PASS: verified by AJV schema + Test 6 |
| Dark overlay (>= 5 color keys) | PASS: verified by Test 7 |
| Zero hex literals | PASS: grep returns 0 matches |
| Zero TODO/placeholder text | PASS: grep returns 0 matches |
| `agencies.generated.css` has 12 `[data-agency]` blocks | PASS: 24 occurrences (12 light + 12 dark) |
| `agencies.generated.css` has 12 `[data-theme="dark"]` blocks | PASS: 12 occurrences |
| `pnpm theme:generate` idempotent (run twice, no diff) | PASS |
| `packages/ui/styles/theme.css` has correct `@import` | PASS |
| 62 total Phase 4 vitest tests pass | PASS (54 prior + 8 new) |
| `pnpm --filter=@mjagency/web-main build` | PRE-EXISTING FAILURE: unrelated to 04-04 (packages/auth missing tokens.js + cookie.js — pre-existed before 04-04 commits) |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test path resolution — `process.cwd()` doubled the directory**
- **Found during:** Task 4-4.2 TDD — niche-themes.test.ts failed with path `packages/ui/packages/ui/themes/default`
- **Issue:** `process.cwd()` returns `packages/ui` when vitest runs from that directory; prepending `packages/ui/themes/default` doubled the segment
- **Fix:** Replaced `process.cwd()` path with `__dirname`-relative path using `fileURLToPath(import.meta.url)` → `join(__dirname, '../../themes/default')` (from `packages/ui/src/__tests__/` up two levels to `packages/ui/`, then down to `themes/default`)
- **Files modified:** `packages/ui/src/__tests__/niche-themes.test.ts`
- **Commit:** b45abfa → 245f31b (fixed in place before final commit)

**2. [Rule 1 - Bug] TypeScript strict mode: `Object.keys(darkColor)` where `darkColor` is `Record<string, string> | undefined`**
- **Found during:** Task 4-4.2 typecheck
- **Issue:** TypeScript strict mode rejected `Object.keys(darkColor)` because the type includes `undefined`
- **Fix:** Introduced `const darkColorKeys = Object.keys(darkColor ?? {})` — nullish coalescing narrows the type before `Object.keys`
- **Files modified:** `packages/ui/src/__tests__/niche-themes.test.ts`
- **Commit:** 245f31b

### Pre-existing Issues (Out of Scope, Logged)

- `packages/config/src/otel-node.ts` has two TypeScript errors (`ATTR_SERVICE_NAMESPACE` and `ATTR_DEPLOYMENT_ENVIRONMENT_NAME` not exported from `@opentelemetry/semantic-conventions`). Confirmed pre-existing — present on base commit `4e05e84`. Logged to deferred-items.
- `pnpm --filter=@mjagency/web-main build` fails due to `packages/auth` missing `tokens.js` + `cookie.js` module files. Confirmed pre-existing — fails identically before any 04-04 changes.

---

## Known Stubs

None. All 12 theme files have complete, non-placeholder content. All OKLCH values are real perceptual-uniform color coordinates per RESEARCH §5.1. All font family names are real Google Fonts per RESEARCH §5.2.

---

## Threat Flags

None. No new network endpoints, auth paths, or trust boundary changes introduced. All operations are filesystem-only build-time reads/writes.

T-04-009 (Hand-edit of agencies.generated.css): Mitigated — AUTO-GENERATED header in generated file; Plan 04-05 will add CI check `git diff --exit-code packages/ui/styles/agencies.generated.css` after `pnpm theme:generate`.

T-04-010 (NICHE_PALETTES drift): Mitigated — Test 5 in niche-themes.test.ts asserts `theme.scopes.color['brand-500'] === NICHE_PALETTES[agency].primary500` for all 12 agencies. If niche-palettes.ts changes without re-syncing JSON, CI fails.

---

## Self-Check

### Files exist:
- [x] `packages/ui/src/theme/niche-palettes.ts`
- [x] `packages/ui/src/theme/font-stacks.ts`
- [x] `packages/ui/themes/default/theme-brand.json`
- [x] `packages/ui/themes/default/theme-ecommerce.json`
- [x] `packages/ui/themes/default/theme-growth.json`
- [x] `packages/ui/themes/default/theme-webdev.json`
- [x] `packages/ui/themes/default/theme-ai.json`
- [x] `packages/ui/themes/default/theme-branding.json`
- [x] `packages/ui/themes/default/theme-strategy.json`
- [x] `packages/ui/themes/default/theme-finance.json`
- [x] `packages/ui/themes/default/theme-engineering.json`
- [x] `packages/ui/themes/default/theme-product.json`
- [x] `packages/ui/themes/default/theme-video.json`
- [x] `packages/ui/themes/default/theme-graphic.json`
- [x] `packages/ui/src/__tests__/niche-themes.test.ts`
- [x] `packages/ui/styles/agencies.generated.css`
- [x] `scripts/generate-agency-css.ts`

### Commits exist:
- [x] `b80f6a6` feat(04-04): niche palettes + 12 OKLCH theme.json (Task 4.1)
- [x] `b45abfa` test(04-04): niche-themes integration tests — 8 tests for 12 OKLCH themes (TDD)
- [x] `245f31b` feat(04-04): generate-agency-css + theme.css import + agencies.generated.css (Task 4.2)

## Self-Check: PASSED
