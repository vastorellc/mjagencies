---
phase: 04-design-system
plan: "05"
subsystem: ab-framework-marketplace-storybook-ci
status: complete
completed: 2026-04-26
duration: ~40min
tags:
  - a/b-testing
  - marketplace
  - storybook
  - visual-regression
  - ci
---

# Phase 4 Plan 05: A/B Framework + Marketplace Stub + Storybook Visual-Regression CI

**Types-only A/B experiment framework, theme marketplace stub, Storybook v9.1.20 with visual regression CI, and theme-validation CI gate.**

## Accomplishments

### Task 5.1 — A/B Framework Types + Marketplace Stub
- `packages/ui/src/theme/ab-types.ts` — `AbVariant`, `AbAssignment`, `AbExperimentConfig` types (REQ-044, REQ-048). Swap point comments for M009 GA4 adapter and M011 edge-cookie deterministic assignment.
- `packages/ui/src/theme/ab-assignment.ts` — `assignVariant()` (random with optional deterministic seed), `resolveVariantFromCookie()`. M004: random; M009+: GA4 experiment cookie hash.
- `packages/ui/src/theme/ab-analytics-hook.ts` — `useAbAnalytics()` React hook stub (noop; M009 GA4 adapter replaces).
- `packages/ui/src/marketplace/types.ts` — `MarketplaceTheme`, `ThemeMarketplaceQuery`, `ThemeMarketplaceResult` interfaces; tRPC service deferred to M010.
- `packages/ui/src/marketplace/stub.ts` — `getMarketplaceThemes()` returning hardcoded 12 default themes with valid metadata; serves as the zero-dependency M004 data source.
- `packages/ui/src/index.ts` — all A/B + marketplace exports added.
- 10 unit tests: 5 for ab-assignment (variant distribution, deterministic seed, cookie resolver) + 5 for marketplace stub (returns all 12 agencies, required fields present).

### Task 5.2 — Storybook v9.1.20 Setup
- `packages/ui/.storybook/main.ts` — `@storybook/nextjs-vite` framework; viteFinal externals blocking otel-node + prom-client (prevents Vite browser build from importing Node-only code); discovers all `*.stories.tsx` in `src/`.
- `packages/ui/.storybook/preview.tsx` — global `ThemeDecorator` wrapping every story in `[data-agency]` and `[data-theme]` attributes from story args; `globalTypes` for agency (12 slugs) and theme (light/dark).
- `packages/ui/.storybook/test-runner.ts` — Playwright-based test runner: `checkA11y()` axe-core accessibility gate; `page.screenshot()` for visual baseline capture; runs against running Storybook dev server on port 6006.
- `packages/ui/src/blocks/SmokeBlock/SmokeBlock.tsx` — minimal presentational block proving token cascade works (background, text, border all via CSS var references).
- `packages/ui/src/blocks/SmokeBlock/SmokeBlock.stories.tsx` — story with agency/theme args; validates visual rendering per theme.
- `packages/ui/package.json` — `@storybook/nextjs-vite@9.1.20`, `@storybook/test-runner@9.1.20`, `storybook@9.1.20`, `@vitest/browser`, Playwright added to devDependencies; scripts: `storybook:dev`, `storybook:build`, `storybook:test`.

### Task 5.3 — CI Visual-Regression + Theme-Validation Gate
- `.github/workflows/pr.yml` — two new CI jobs:
  - `theme-validation`: runs `pnpm tsx packages/ui/scripts/validate-themes.ts`; exits 1 if any theme.json has hex literals or missing required tokens; blocks PR merge (REQ-043).
  - `storybook-visual-regression`: spins up Storybook dev server, waits for port 6006, runs `pnpm --filter @mjagency/ui storybook:test`; diff threshold 0.01 to avoid font-rendering flakiness (REQ-046).
- `.gitignore` — `storybook-static/` and `__snapshots__/` added.
- `docs/runbooks/storybook-visual-regression.md` — local setup guide, updating visual baselines (`--update-snapshots`), CI failure triage, 45-block expansion roadmap (REQ-046: 45 blocks × 12 themes = 540 stories target).

## Key Decisions Locked

1. **Self-hosted visual regression**: @storybook/test-runner + Playwright (no Chromatic SaaS). Axe-core accessibility gate included. REQ-046 baseline at 1 SmokeBlock × 12 themes; expands to 45 × 12 in Phase 5 as blocks are built.
2. **A/B framework types-only at M004**: No GA4 integration until Phase 9. Swap points explicitly commented in code. `[data-variant="b"]` CSS override pattern is the runtime hook.
3. **Marketplace stub**: Hardcoded 12 default themes from `AGENCIES` const. M010 replaces with live tRPC endpoint + DB-backed catalog.
4. **Storybook v9 addon strategy**: `@storybook/addon-essentials` is bundled in Storybook 9 core — not imported separately. `@chromatic-com/storybook` removed (requires Storybook v10+). All addons through core APIs.

## Self-Check

- [x] ab-types.ts, ab-assignment.ts, ab-analytics-hook.ts exported from index.ts
- [x] marketplace types.ts + stub.ts exported
- [x] 10 unit tests for A/B + marketplace
- [x] Storybook v9.1.20 (`@storybook/nextjs-vite`) configured
- [x] ThemeDecorator applies [data-agency] + [data-theme] globally
- [x] SmokeBlock + SmokeBlock.stories.tsx committed
- [x] CI: theme-validation + storybook-visual-regression jobs in pr.yml
- [x] No hex literals in any theme.json (validator enforces REQ-043)
- [x] viteFinal externals block Node-only imports from browser Vite build
- [x] Commits: 8a0e7ec (A/B + marketplace), 865d151 (Storybook), 2de315f (CI)

## Phase 4 Complete

All 5 plans done:
- 04-01 ✓ CSS variable token schema — 6 layers (OKLCH, zero hex literals)
- 04-02 ✓ theme.json manifest + AJV validator (rejects hex literals)
- 04-03 ✓ Theme resolution stack (5-layer CSS cascade, FOUC prevention)
- 04-04 ✓ 12 niche default themes pre-built (one per agency slug)
- 04-05 ✓ A/B framework + marketplace stub + Storybook v9 visual-regression CI

## Next

**Phase 5: Central CMS + Block Library + Lexical Editor** — Payload CMS integration, 45 block types, rich-text Lexical editor, page builder.
