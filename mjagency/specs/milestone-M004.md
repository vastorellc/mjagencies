MILESTONE M004 - DESIGN SYSTEM + THEME ENGINE
Branch: milestone/M004-design-system-theme
Model: claude-sonnet-4-6
Depends on: M003 complete

GOAL: Token schema, theme engine, 12 niche default themes, A/B.

SLICES:

SLICE 1: CSS Variable Token Schema
  Task 1.1: packages/ui/tokens/
    - Define all 6 token layers:
      primitive: raw values (colors, sizes, spacing)
      semantic:  purpose-mapped (color.brand.primary, spacing.section)
      component: per-component (button.padding, card.radius)
      illustration: --ill-primary, --ill-secondary, --ill-accent, --ill-neutral, --ill-bg, --ill-shadow
      icon:      --icon-primary, --icon-secondary, --icon-accent, --icon-neutral, etc
      animation: duration, easing, delay tokens
    - Export as CSS variables in :root
    - TypeScript types for all tokens
    - Token validation: no hardcoded hex in component code (ESLint rule)

  Task 1.2: theme.json manifest + JSON Schema
    - Define theme.json schema (all 20 customization scopes)
    - JSON Schema validator (rejects invalid themes)
    - 20 scopes: brand, color, type, spacing, layout, components,
      header, footer, hero, blocks, templates, motion, icons,
      imagery, theme, a11y, perf, SEO-defaults, custom-CSS, code-injection

SLICE 2: Theme Resolution Stack
  Task 2.1: Resolution engine in packages/ui/theme/
    - Stack: base -> agency-overrides -> page-overrides -> preview -> compiled
    - CSS variable compilation from theme.json tokens
    - Runtime: single CSS variable update = instant theme switch (<16ms)
    - Dark mode: token swap only, no asset reload
    - Conflict resolution: page overrides win over agency overrides

  Task 2.2: Theme validation
    - Hex literal linter for SVG files (ESLint custom rule)
    - Token transformer: rewrites hex in SVGs to var(--ill-*)
    - DeltaE color check utility (LAB distance calculation)
    - Niche palette guardrails (per-agency allowlist of color ranges)

SLICE 3: 12 Niche Default Themes
  Task 3.1: packages/ui/themes/default/
    Create one theme.json per agency niche:
    - theme-main.json          (architectural, neutral warm)
    - theme-ecommerce.json     (bold accent, saturated, product-forward)
    - theme-growth.json        (indigo/purple SaaS palette, dashboard feel)
    - theme-webdev.json        (cool blue, technical, grid-based)
    - theme-ai.json            (violet + warm cream, abstract)
    - theme-branding.json      (bold black + warm, editorial)
    - theme-strategy.json      (navy + gold, corporate refined)
    - theme-finance.json       (navy + muted green, trustworthy)
    - theme-engineering.json   (charcoal + amber, industrial)
    - theme-product.json       (cream + coral, human-centered)
    - theme-video.json         (warm contrasty, cinematic)
    - theme-graphic.json       (bold contrast, typographic)

  Task 3.2: Per-niche font stacks
    - Google Fonts or system fonts per niche (no render-blocking)
    - Variable fonts preferred (weight range in one file)
    - Font-display: optional for above-fold, swap for body
    - Preload: only first 2 fonts per page

SLICE 4: Theme A/B + Versioning
  Task 4.1: A/B theme framework
    - Variant A/B stored in DB per agency (variants table)
    - Traffic split configurable (50/50 default)
    - Winner detection (conversion rate comparison)
    - Auto-promote winner after statistical significance
  Task 4.2: Theme versioning + rollback
    - theme_versions table (20 versions per agency)
    - Rollback: one click restores previous theme
    - Diff view: compare two theme versions

SLICE 5: DB Schema (theme persistence)
  Task 5.1: Drizzle schema for theme storage
    - agency_themes table:
        id, agency_id (FK, immutable), theme_json (JSONB),
        version (int), is_active (bool), created_at, updated_at
    - theme_versions table:
        id, agency_id, version, theme_json (JSONB), label, created_at
        max 20 rows per agency (oldest pruned on insert)
    - theme_ab_variants table:
        id, agency_id, variant_a_id (FK), variant_b_id (FK),
        traffic_split (default 50), winner_id (nullable), status, created_at
    - RLS: all tables filtered by agency_id
    - Migration: 001_create_theme_tables.sql
  Task 5.2: Theme API routes (tRPC)
    - theme.getCurrent (agency-scoped)
    - theme.save (validate JSON Schema before insert)
    - theme.rollback (restore from theme_versions by version number)
    - theme.listVersions (last 20 for sidebar diff view)
    - theme.setABVariant (create/update ab_variants row)

SLICE 6: Storybook + Visual Regression
  Task 6.1: Storybook setup in packages/ui
    - Storybook 8.x configured for Turborepo
    - One story per block (45 blocks) showing all variants
    - Theme switcher: test each block across all 12 niche themes
    - Dark mode story variant for every block
  Task 6.2: Visual regression baseline
    - Playwright screenshots of all 45 blocks in default state
    - Screenshots stored in packages/ui/__snapshots__/
    - CI compares on PR: fails if pixel diff >0.1%

SUCCESS CRITERIA:
  Theme switch measurable at <16ms (Playwright performance.now() test)
  Dark mode: all 12 agencies switch correctly, zero color leaks
  Hex literal linter: ESLint rule blocks any hardcoded hex in component code
  All 12 niche themes render correctly in dev (Storybook build passes)
  Token types: TypeScript strict compilation passes with no errors
  DB: agency_themes row created for each of 12 agencies (seed test)
  Rollback: restoring version N-1 reflects correctly in theme (integration test)
  A/B: traffic split stored and readable from tRPC (unit test)
  JSON Schema validator: rejects theme.json with missing required scopes
  Storybook build: completes with zero errors (CI gate)
