# @mjagency/ui

MJAgency Design System — 6-layer CSS token schema. Single Tailwind v4 entry point for all 12 agency apps.

## 6 Layers Overview

| Layer | File | Purpose |
|-------|------|---------|
| 1 — Primitives | `tokens/layer-1-primitives.css` | Raw OKLCH palette (blue scale + neutral scale). Never referenced by components directly. |
| 2 — Semantic Color | `tokens/layer-2-semantic-color.css` | Bg/text/border/brand/accent/state tokens composed from Layer 1. Brand tokens overridden per agency in Plan 04-04. |
| 3 — Typography | `tokens/layer-3-typography.css` | Font families (with `next/font/google` fallback chain), type scale (xs–6xl), weights, line heights, letter spacing. |
| 4 — Layout | `tokens/layer-4-layout.css` | 8px-grid spacing (14 values), container widths (sm–3xl), border radius (none–full), grid columns. |
| 5 — Effects | `tokens/layer-5-effects.css` | Shadows (OKLCH alpha), blurs, transition durations, easing curves. |
| 6 — Components | `tokens/layer-6-components.css` | Composed `--mj-btn-*`, `--mj-card-*`, `--mj-form-*`, `--mj-ill-*` (illustration), `--mj-icon-*` tokens. Only references Layers 2–5. |

A `tokens/dark-mode.css` file ships alongside the 6 layers — it reassigns Layer 2 color tokens under `[data-theme="dark"]`.

## Tailwind v4 Bridge

Import `@mjagency/ui/styles/theme.css` from your app's root CSS entry (e.g., `globals.css`):

```css
@import "@mjagency/ui/styles/theme.css";
```

The bridge in `@theme inline { ... }` maps `--mj-*` tokens to Tailwind's `--color-*`, `--spacing-*`, `--font-*`, `--shadow-*`, `--radius-*` utility namespaces. After this, standard Tailwind utilities resolve through the token layer:

```html
<div class="bg-brand-500 text-text-primary shadow-md rounded-xl p-6">...</div>
```

`@theme inline` preserves `var()` references at use-time — tokens remain dynamic at runtime (important for dark mode + per-agency overrides).

## Dark Mode

Dark mode uses a CSS attribute selector — no class toggling, no JS required:

```html
<html data-theme="dark">...</html>
```

Tailwind `dark:` utilities work via the `@custom-variant dark` declared in `theme.css`:

```css
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
```

Only Layer 2 color tokens flip in dark mode — spacing, typography, and effects remain unchanged (REQ-046).

## Plan-Time Decisions

### Open Q3: @theme inline smoke test

`pnpm --filter=@mjagency/web-main build` must succeed and `.next/static/css/*.css` must contain `mj-color-brand` or `--color-brand-500`. This confirms the `@theme inline` bridge resolves through to the compiled output.

### Open Q3: next/font/google interaction

Layer 3 (`--mj-font-brand`) uses a CSS variable fallback chain: `var(--font-brand, var(--mj-font-sans))`. Per-agency Next.js root layouts can call `Inter({ variable: '--font-brand' })` and the font token automatically picks up the agency-loaded web font without any component changes.

### Namespace prefix

All custom tokens use `--mj-*` prefix. Tailwind's own `--color-*` / `--spacing-*` defaults are mapped only in the `@theme inline` bridge — they never appear in source `tokens/*.css` files (T-04-002 mitigation).

### Layer 6 isolation rule

Component tokens (`--mj-btn-*`, `--mj-card-*`, `--mj-form-*`) NEVER reference Layer 1 primitives directly (exception: `--mj-ill-neutral` for illustration neutrals). Swapping the brand palette only requires touching Layers 1+2.

## REQ Coverage

| Requirement | Status | Evidence |
|-------------|--------|---------|
| REQ-040 — 6-layer CSS variable token schema | Satisfied | `packages/ui/tokens/layer-{1..6}-*.css` + `dark-mode.css` |
| REQ-046 — Dark mode via attribute, no asset reload | Satisfied | `[data-theme="dark"]` selector in `dark-mode.css`; only Layer 2 color tokens flip |
| REQ-047 — No hex literals in token files | Partially satisfied | `packages/ui/tokens/` + `packages/ui/styles/` contain zero hex literals; full SVG enforcement ships in Plan 04-02 |

## Downstream Plans

Plans 04-02 (validator), 04-03 (resolution stack), 04-04 (12 niche themes), and 04-05 (Storybook visual regression) all consume these tokens.

- **04-02** imports `ThemeJson` type from `@mjagency/ui/theme/types`
- **04-03** appends `[data-agency="..."]` blocks on top of Layer 2 brand tokens
- **04-04** references Layer 1 primitives (`var(--mj-primitive-*-500)`) in agency `theme.json` files
- **04-05** imports `packages/ui/styles/theme.css` from `preview.tsx`
