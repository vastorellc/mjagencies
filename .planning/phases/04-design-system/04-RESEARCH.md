# Phase 4: Design System + Theme Engine — Research

**Researched:** 2026-04-25
**Domain:** CSS design tokens, Tailwind v4 theme integration, multi-agency theme engine, Storybook visual regression
**Confidence:** HIGH (core CSS/Tailwind patterns verified via official docs; Storybook version verified via npm registry; AJV verified via official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**6 token layers (locked from mjagency/ specs)**
1. **Color** — palette, semantic colors (text, background, border, accent), state colors
2. **Typography** — font families, scales, weights, line heights, tracking
3. **Spacing** — 8px-grid scale, container widths, gaps
4. **Layout** — grid columns, breakpoints, max-widths
5. **Effects** — shadows, blurs, transitions, animations
6. **Components** — button variants, card variants, form-field variants (composed from layers 1-5)

**Locked from prior phases**
- `packages/ui` exists from Phase 1 with `theme.css` baseline — extend, don't replace
- 12 agency slugs from `@mjagency/config` AGENCIES const drive the 12 niche themes
- Tailwind 4 — theme injection is via CSS variables, not tailwind.config.js

**20 customization scopes (locked from milestone-M004 spec)**
brand, color, type, spacing, layout, components, header, footer, hero, blocks, templates, motion, icons, imagery, theme, a11y, perf, SEO-defaults, custom-CSS, code-injection

### Claude's Discretion
- Specific CSS variable naming convention (`--mj-color-*` vs `--color-*`)
- Storybook addon choice for visual regression (Chromatic vs Loki vs Playwright snapshots)
- A/B framework backbone (custom vs GrowthBook vs Vercel Edge Config)
- Marketplace stub format (just types + interfaces vs minimal API)

### Deferred Ideas (OUT OF SCOPE)
- Custom theme builder UI (deferred to M010 builder phase)
- Per-user theme overrides (defer to post-launch)
- Right-to-left layouts (defer to M011)
- Reduced-motion auto-detect at theme level (M011)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-040 | CSS variable token schema (6 layers) | §1 — complete 6-layer naming convention, Tailwind 4 @theme integration |
| REQ-041 | `theme.json` manifest + JSON Schema validator | §2 — AJV 8.x schema, no-hex-literals rule |
| REQ-042 | 20 customization scopes per agency | §4 — enumerated 20 scopes from milestone-M004 spec |
| REQ-043 | Theme resolution — base → agency → page | §3 — CSS cascade approach with data attributes |
| REQ-044 | 12 niche default themes pre-built | §5 — palette table for all 12 agency slugs |
| REQ-045 | Theme switch < 16ms (CSS variable update) | §3 — single DOM setAttribute = sub-1ms CSS var cascade |
| REQ-046 | Dark mode via token swap, no asset reload | §6 — `[data-theme="dark"]` + Tailwind @custom-variant |
| REQ-047 | SVG illustrations — token vars, no hex literals | §2 — ESLint custom rule + token transformer |
| REQ-048 | Storybook — 45 blocks × 12 niche themes, visual regression CI | §8 — Storybook 9.1.x + @chromatic-com/storybook + test-runner config |
</phase_requirements>

---

## Executive Summary

Phase 4 builds a CSS-variable-first design token system with exactly 6 layers, a JSON manifest + validator, 12 per-agency niche themes, dark mode via attribute toggle, and Storybook visual regression CI. The system extends — does not replace — the `packages/ui/styles/theme.css` skeleton from Phase 1.

The core architecture centers on three principles:

**1. CSS variables are the single source of truth.** Every color, spacing, typography, effect, and component value is expressed as a CSS custom property. Tailwind utilities reference those variables at build time via `@theme`. No hex literals in component code, SVGs, or theme manifests — enforced by ESLint rule and AJV schema validator.

**2. Theme resolution is pure CSS cascade.** The stack `base → agency → page → dark` is implemented as nested `[data-*]` attribute selectors on `<html>`. No JavaScript object merging at runtime, no style recalculation — `setAttribute` on the root element propagates instantly via CSS inheritance (< 1ms, well inside the 16ms budget).

**3. Storybook stories are the validation layer.** 45 blocks × 12 themes = 540 stories. Each story sets `data-theme` via a decorator. Visual regression via `@chromatic-com/storybook` (cloud) or `@storybook/test-runner` + Playwright snapshots (self-hosted). The 540-story count is manageable with `--maxWorkers=4` and shard splitting in CI.

**Primary recommendation:** Use `--mj-` prefix for all custom tokens to namespace away from Tailwind's own `--color-*` / `--spacing-*` defaults. Expose all tokens to Tailwind via `@theme inline` so utility classes like `bg-(--mj-color-brand-500)` resolve without builds.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CSS token schema (`:root` / `@theme`) | Frontend static (CSS file in `packages/ui`) | — | Pure CSS; consumed by all 12 apps via import |
| Theme resolution (cascade) | Browser (CSS specificity) | Frontend SSR (data-attr injection) | CSS cascade requires no runtime JS; SSR stamps initial `data-agency` on `<html>` |
| Theme persistence (DB) | API / Backend | Database | `agency_themes` table in per-agency Postgres; read by SSR on page load |
| Dark mode toggle | Browser (localStorage + setAttribute) | SSR (cookie fallback) | Must run before first paint; FOUC prevention requires inline script |
| Token validation (build time) | CI / Build tooling | — | AJV + ESLint run at build, not runtime |
| Storybook visual regression | CI pipeline | — | Run against built Storybook; not in-app |
| A/B theme variant | API / Backend (DB) | Browser (data-variant attr) | Traffic split decision server-side; CSS override client-side |
| Theme marketplace (stub) | API (types only at M004) | — | Full implementation in M010 |

---

## §1 — 6-Layer CSS Variable Token Schema + Tailwind 4 Integration

### 1.1 The 6 Layers

The 6 layers map directly from the milestone-M004 spec. Naming uses `--mj-` prefix to namespace away from Tailwind's built-in CSS variable names. [VERIFIED: official Tailwind v4 docs state `@theme` injects `--color-*` etc.; prefixing avoids collision]

```
Layer 1: primitive   → raw palette values  (--mj-primitive-*)
Layer 2: semantic    → purpose-mapped      (--mj-color-*, --mj-text-*, --mj-space-*)
Layer 3: typography  → type scale          (--mj-font-*, --mj-text-size-*, --mj-weight-*)
Layer 4: layout      → grid + breakpoints  (--mj-layout-*, --mj-breakpoint-*)
Layer 5: effects     → shadow, blur, anim  (--mj-shadow-*, --mj-blur-*, --mj-duration-*)
Layer 6: component   → composed token      (--mj-btn-*, --mj-card-*, --mj-form-*)

Plus two illustration/icon sub-layers (per M004 spec):
  illustration layer → --mj-ill-* (SVG palette tokens; NO hex literals)
  icon layer         → --mj-icon-* (icon fill tokens)
```

### 1.2 Full Token Naming Convention

```css
/* ================================================================
   LAYER 1 — PRIMITIVES (packages/ui/tokens/layer-1-primitives.css)
   Raw palette. Never referenced in components directly.
   ================================================================ */
:root {
  /* Color primitives — OKLCH for perceptual uniformity */
  --mj-primitive-blue-50:   oklch(0.97 0.013 250);
  --mj-primitive-blue-500:  oklch(0.55 0.19 250);
  --mj-primitive-blue-900:  oklch(0.25 0.08 250);

  --mj-primitive-neutral-0:   oklch(1 0 0);      /* white */
  --mj-primitive-neutral-50:  oklch(0.98 0 0);
  --mj-primitive-neutral-500: oklch(0.55 0 0);
  --mj-primitive-neutral-950: oklch(0.08 0 0);   /* near-black */

  /* Each agency's brand palette is defined in its theme.json
     and injected via data-agency attribute override, NOT here */
}

/* ================================================================
   LAYER 2 — SEMANTIC COLOR TOKENS
   (packages/ui/tokens/layer-2-semantic-color.css)
   ================================================================ */
:root {
  /* Background */
  --mj-color-bg-primary:   var(--mj-primitive-neutral-0);
  --mj-color-bg-secondary: var(--mj-primitive-neutral-50);
  --mj-color-bg-inverse:   var(--mj-primitive-neutral-950);

  /* Text */
  --mj-color-text-primary:   var(--mj-primitive-neutral-950);
  --mj-color-text-secondary: var(--mj-primitive-neutral-500);
  --mj-color-text-inverse:   var(--mj-primitive-neutral-0);
  --mj-color-text-link:      var(--mj-color-brand-500);

  /* Border */
  --mj-color-border-default: var(--mj-primitive-neutral-200);
  --mj-color-border-subtle:  var(--mj-primitive-neutral-100);
  --mj-color-border-focus:   var(--mj-color-brand-500);

  /* Brand (overridden per agency) */
  --mj-color-brand-50:   var(--mj-primitive-blue-50);
  --mj-color-brand-500:  var(--mj-primitive-blue-500);
  --mj-color-brand-900:  var(--mj-primitive-blue-900);

  /* Accent */
  --mj-color-accent-primary:   var(--mj-color-brand-500);
  --mj-color-accent-secondary: var(--mj-primitive-neutral-500);

  /* State */
  --mj-color-success: oklch(0.72 0.17 142);
  --mj-color-warning: oklch(0.83 0.17 78);
  --mj-color-error:   oklch(0.63 0.21 25);
  --mj-color-info:    oklch(0.60 0.17 250);
}

/* ================================================================
   LAYER 3 — TYPOGRAPHY
   (packages/ui/tokens/layer-3-typography.css)
   ================================================================ */
:root {
  /* Font families (overridden per agency via theme.json) */
  --mj-font-sans:  system-ui, -apple-system, sans-serif;
  --mj-font-serif: Georgia, 'Times New Roman', serif;
  --mj-font-mono:  'JetBrains Mono', 'Fira Code', monospace;
  --mj-font-brand: var(--mj-font-sans);  /* overridden per agency */

  /* Type scale (8pt grid, modular) */
  --mj-text-size-xs:   0.75rem;   /* 12px */
  --mj-text-size-sm:   0.875rem;  /* 14px */
  --mj-text-size-base: 1rem;      /* 16px */
  --mj-text-size-lg:   1.125rem;  /* 18px */
  --mj-text-size-xl:   1.25rem;   /* 20px */
  --mj-text-size-2xl:  1.5rem;    /* 24px */
  --mj-text-size-3xl:  1.875rem;  /* 30px */
  --mj-text-size-4xl:  2.25rem;   /* 36px */
  --mj-text-size-5xl:  3rem;      /* 48px */
  --mj-text-size-6xl:  3.75rem;   /* 60px */

  /* Font weights */
  --mj-weight-normal:    400;
  --mj-weight-medium:    500;
  --mj-weight-semibold:  600;
  --mj-weight-bold:      700;
  --mj-weight-extrabold: 800;

  /* Line heights */
  --mj-leading-tight:  1.25;
  --mj-leading-snug:   1.375;
  --mj-leading-normal: 1.5;
  --mj-leading-relaxed:1.625;

  /* Letter spacing */
  --mj-tracking-tight:  -0.025em;
  --mj-tracking-normal:  0em;
  --mj-tracking-wide:    0.025em;
  --mj-tracking-widest:  0.1em;
}

/* ================================================================
   LAYER 4 — SPACING + LAYOUT
   (packages/ui/tokens/layer-4-layout.css)
   ================================================================ */
:root {
  /* Spacing — 8px base grid */
  --mj-space-0:  0px;
  --mj-space-1:  4px;
  --mj-space-2:  8px;
  --mj-space-3:  12px;
  --mj-space-4:  16px;
  --mj-space-5:  20px;
  --mj-space-6:  24px;
  --mj-space-8:  32px;
  --mj-space-10: 40px;
  --mj-space-12: 48px;
  --mj-space-16: 64px;
  --mj-space-20: 80px;
  --mj-space-24: 96px;
  --mj-space-32: 128px;

  /* Container widths */
  --mj-container-sm:  640px;
  --mj-container-md:  768px;
  --mj-container-lg:  1024px;
  --mj-container-xl:  1280px;
  --mj-container-2xl: 1440px;
  --mj-container-3xl: 1600px;

  /* Grid */
  --mj-grid-cols-default: 12;
  --mj-layout-gutter: var(--mj-space-6);

  /* Border radius */
  --mj-radius-none: 0;
  --mj-radius-sm:   2px;
  --mj-radius-base: 4px;
  --mj-radius-md:   6px;
  --mj-radius-lg:   8px;
  --mj-radius-xl:   12px;
  --mj-radius-2xl:  16px;
  --mj-radius-full: 9999px;
}

/* ================================================================
   LAYER 5 — EFFECTS
   (packages/ui/tokens/layer-5-effects.css)
   ================================================================ */
:root {
  /* Shadows */
  --mj-shadow-xs:  0 1px 2px 0 oklch(0 0 0 / 0.05);
  --mj-shadow-sm:  0 1px 3px 0 oklch(0 0 0 / 0.1), 0 1px 2px -1px oklch(0 0 0 / 0.1);
  --mj-shadow-md:  0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1);
  --mj-shadow-lg:  0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -4px oklch(0 0 0 / 0.1);
  --mj-shadow-xl:  0 20px 25px -5px oklch(0 0 0 / 0.1), 0 8px 10px -6px oklch(0 0 0 / 0.1);

  /* Blur */
  --mj-blur-sm:   4px;
  --mj-blur-md:   8px;
  --mj-blur-lg:   16px;
  --mj-blur-xl:   24px;

  /* Transitions */
  --mj-duration-instant: 0ms;
  --mj-duration-fast:    100ms;
  --mj-duration-base:    200ms;
  --mj-duration-slow:    300ms;
  --mj-duration-slower:  500ms;

  --mj-ease-default:   cubic-bezier(0.4, 0, 0.2, 1);
  --mj-ease-in:        cubic-bezier(0.4, 0, 1, 1);
  --mj-ease-out:       cubic-bezier(0, 0, 0.2, 1);
  --mj-ease-spring:    cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* ================================================================
   LAYER 6 — COMPONENT TOKENS
   (packages/ui/tokens/layer-6-components.css)
   All composed from layers 1-5. Components ONLY reference these.
   ================================================================ */
:root {
  /* Button */
  --mj-btn-padding-x:       var(--mj-space-4);
  --mj-btn-padding-y:       var(--mj-space-2);
  --mj-btn-radius:          var(--mj-radius-md);
  --mj-btn-font-weight:     var(--mj-weight-semibold);
  --mj-btn-font-size:       var(--mj-text-size-sm);
  --mj-btn-bg-primary:      var(--mj-color-brand-500);
  --mj-btn-color-primary:   var(--mj-color-text-inverse);
  --mj-btn-border-primary:  transparent;
  --mj-btn-transition:      var(--mj-duration-fast) var(--mj-ease-default);

  /* Card */
  --mj-card-radius:         var(--mj-radius-xl);
  --mj-card-padding:        var(--mj-space-6);
  --mj-card-bg:             var(--mj-color-bg-primary);
  --mj-card-border:         var(--mj-color-border-default);
  --mj-card-shadow:         var(--mj-shadow-sm);

  /* Form field */
  --mj-form-radius:         var(--mj-radius-md);
  --mj-form-padding-x:      var(--mj-space-3);
  --mj-form-padding-y:      var(--mj-space-2);
  --mj-form-border:         var(--mj-color-border-default);
  --mj-form-bg:             var(--mj-color-bg-primary);
  --mj-form-font-size:      var(--mj-text-size-sm);
  --mj-form-focus-ring:     var(--mj-color-border-focus);

/* ================================================================
   ILLUSTRATION TOKENS (referenced by SVGs — NO hex literals)
   ================================================================ */
  --mj-ill-primary:   var(--mj-color-brand-500);
  --mj-ill-secondary: var(--mj-color-brand-900);
  --mj-ill-accent:    var(--mj-color-accent-primary);
  --mj-ill-neutral:   var(--mj-primitive-neutral-500);
  --mj-ill-bg:        var(--mj-color-bg-primary);
  --mj-ill-shadow:    var(--mj-shadow-sm);

/* ================================================================
   ICON TOKENS
   ================================================================ */
  --mj-icon-primary:   var(--mj-color-text-primary);
  --mj-icon-secondary: var(--mj-color-text-secondary);
  --mj-icon-accent:    var(--mj-color-accent-primary);
  --mj-icon-inverse:   var(--mj-color-text-inverse);
  --mj-icon-success:   var(--mj-color-success);
  --mj-icon-warning:   var(--mj-color-warning);
  --mj-icon-error:     var(--mj-color-error);
}
```

### 1.3 Tailwind v4 Integration

Tailwind v4 uses a CSS-first `@theme` directive. Variables declared inside `@theme` are automatically exposed as utility classes. [VERIFIED: tailwindcss.com/docs/theme]

**Pattern: Expose semantic tokens to Tailwind as utility classes**

```css
/* packages/ui/styles/theme.css  (extends existing skeleton)
   The @theme inline block bridges --mj-* vars → Tailwind utilities.
   @theme inline: Tailwind reads var() references at resolution time. */

@import "tailwindcss";

/* Import all 6 token layers */
@import "../tokens/layer-1-primitives.css";
@import "../tokens/layer-2-semantic-color.css";
@import "../tokens/layer-3-typography.css";
@import "../tokens/layer-4-layout.css";
@import "../tokens/layer-5-effects.css";
@import "../tokens/layer-6-components.css";

/* Bridge to Tailwind utilities via @theme inline */
@theme inline {
  /* Colors → bg-*, text-*, border-*, fill-*, stroke-* utilities */
  --color-brand-50:         var(--mj-color-brand-50);
  --color-brand-500:        var(--mj-color-brand-500);
  --color-brand-900:        var(--mj-color-brand-900);
  --color-bg-primary:       var(--mj-color-bg-primary);
  --color-bg-secondary:     var(--mj-color-bg-secondary);
  --color-text-primary:     var(--mj-color-text-primary);
  --color-text-secondary:   var(--mj-color-text-secondary);
  --color-border-default:   var(--mj-color-border-default);
  --color-accent:           var(--mj-color-accent-primary);
  --color-success:          var(--mj-color-success);
  --color-warning:          var(--mj-color-warning);
  --color-error:            var(--mj-color-error);

  /* Spacing → p-*, m-*, gap-*, w-* utilities */
  --spacing-1:  var(--mj-space-1);
  --spacing-2:  var(--mj-space-2);
  --spacing-4:  var(--mj-space-4);
  --spacing-6:  var(--mj-space-6);
  --spacing-8:  var(--mj-space-8);
  --spacing-12: var(--mj-space-12);
  --spacing-16: var(--mj-space-16);

  /* Typography → font-*, text-* utilities */
  --font-sans:  var(--mj-font-sans);
  --font-serif: var(--mj-font-serif);
  --font-mono:  var(--mj-font-mono);
  --font-brand: var(--mj-font-brand);

  /* Shadows → shadow-* utilities */
  --shadow-sm:  var(--mj-shadow-sm);
  --shadow-md:  var(--mj-shadow-md);
  --shadow-lg:  var(--mj-shadow-lg);

  /* Border radius → rounded-* utilities */
  --radius-sm:   var(--mj-radius-sm);
  --radius-base: var(--mj-radius-base);
  --radius-md:   var(--mj-radius-md);
  --radius-lg:   var(--mj-radius-lg);
  --radius-xl:   var(--mj-radius-xl);
  --radius-full: var(--mj-radius-full);
}

/* Dark mode variant: rebind @dark to data attribute */
/* Source: tailwindcss.com/docs/dark-mode */
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
```

**Usage in components:**
```tsx
// Components use Tailwind utilities — utilities resolve to CSS vars at runtime
// Theme swap = attribute change only, no re-render
<button className="bg-brand-500 text-text-inverse rounded-md px-4 py-2
                   dark:bg-brand-900 dark:text-text-primary
                   transition-colors duration-fast">
  CTA
</button>
```

**TypeScript token types (`packages/ui/tokens/types.ts`):**
```typescript
// Source: inferred from token schema above [ASSUMED: exact shape]
export type MjColorToken =
  | '--mj-color-bg-primary' | '--mj-color-bg-secondary' | '--mj-color-bg-inverse'
  | '--mj-color-text-primary' | '--mj-color-text-secondary' | '--mj-color-text-inverse'
  | '--mj-color-text-link'
  | '--mj-color-border-default' | '--mj-color-border-subtle' | '--mj-color-border-focus'
  | '--mj-color-brand-50' | '--mj-color-brand-500' | '--mj-color-brand-900'
  | '--mj-color-accent-primary' | '--mj-color-accent-secondary'
  | '--mj-color-success' | '--mj-color-warning' | '--mj-color-error' | '--mj-color-info';

export type MjThemeLayer = 'primitive' | 'semantic' | 'typography' | 'layout' | 'effects' | 'component';

// Used by theme.json manifest
export interface ThemeTokenValue {
  value: string;  // must be var(--mj-*) or a raw CSS value (no hex)
  layer: MjThemeLayer;
}
```

---

## §2 — theme.json Manifest + JSON Schema Validator

### 2.1 theme.json Structure

One `theme.json` per agency, stored at `packages/ui/themes/default/theme-{slug}.json`.

```json
{
  "$schema": "../schemas/theme.schema.json",
  "meta": {
    "slug": "ecommerce",
    "name": "MJ Ecommerce",
    "niche": "ecommerce",
    "version": "1.0.0",
    "description": "Bold, product-forward palette for ecommerce agency"
  },
  "scopes": {
    "brand": {
      "primary": "var(--mj-primitive-orange-500)",
      "secondary": "var(--mj-primitive-orange-900)",
      "tertiary": "var(--mj-primitive-neutral-50)"
    },
    "color": {
      "bg-primary":   "var(--mj-primitive-neutral-0)",
      "bg-secondary": "var(--mj-primitive-neutral-50)",
      "text-primary": "var(--mj-primitive-neutral-950)",
      "text-secondary":"var(--mj-primitive-neutral-600)",
      "accent-primary":"var(--mj-primitive-orange-500)"
    },
    "type": {
      "font-brand": "'Inter', system-ui, sans-serif",
      "font-body":  "'Inter', system-ui, sans-serif",
      "font-mono":  "'JetBrains Mono', monospace",
      "scale-base": "1rem",
      "weight-heading": "700"
    },
    "spacing": {
      "base-unit": "4px",
      "section-gap": "var(--mj-space-20)"
    },
    "layout": {
      "container-max": "1280px",
      "grid-cols": "12",
      "gutter": "var(--mj-space-6)"
    },
    "components": {
      "btn-radius": "var(--mj-radius-full)",
      "card-radius": "var(--mj-radius-xl)",
      "form-radius": "var(--mj-radius-md)"
    },
    "header": {
      "bg": "var(--mj-color-bg-primary)",
      "border": "var(--mj-color-border-subtle)",
      "height": "var(--mj-space-16)"
    },
    "footer": {
      "bg": "var(--mj-color-bg-inverse)",
      "text": "var(--mj-color-text-inverse)"
    },
    "hero": {
      "bg": "var(--mj-color-brand-500)",
      "text": "var(--mj-color-text-inverse)",
      "min-height": "80vh"
    },
    "blocks": {
      "section-bg-alt": "var(--mj-color-bg-secondary)",
      "divider-color": "var(--mj-color-border-subtle)"
    },
    "templates": {
      "blog-layout": "wide",
      "service-layout": "sidebar"
    },
    "motion": {
      "duration-base": "var(--mj-duration-base)",
      "easing-default": "var(--mj-ease-default)",
      "reduce-for-a11y": "false"
    },
    "icons": {
      "size-sm": "16px",
      "size-base": "20px",
      "size-lg": "24px",
      "color-default": "var(--mj-icon-primary)"
    },
    "imagery": {
      "radius": "var(--mj-radius-lg)",
      "aspect-hero": "16/9",
      "aspect-card": "3/2"
    },
    "theme": {
      "default-mode": "light",
      "supports-dark": "true"
    },
    "a11y": {
      "focus-ring-width": "2px",
      "focus-ring-offset": "2px",
      "focus-ring-color": "var(--mj-color-border-focus)",
      "min-contrast-aa": "4.5"
    },
    "perf": {
      "critical-font-preload": "2",
      "above-fold-css-inline": "true"
    },
    "seo-defaults": {
      "og-image-aspect": "1200x630",
      "schema-type": "LocalBusiness",
      "locale": "en_US"
    },
    "custom-css": "",
    "code-injection": {
      "head": "",
      "body-start": "",
      "body-end": ""
    }
  },
  "dark": {
    "color": {
      "bg-primary":    "var(--mj-primitive-neutral-950)",
      "bg-secondary":  "var(--mj-primitive-neutral-900)",
      "text-primary":  "var(--mj-primitive-neutral-0)",
      "text-secondary":"var(--mj-primitive-neutral-400)",
      "accent-primary":"var(--mj-primitive-orange-400)"
    }
  }
}
```

### 2.2 JSON Schema (theme.schema.json)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://mjagency.com/schemas/theme.schema.json",
  "title": "MJAgency Theme",
  "type": "object",
  "required": ["meta", "scopes"],
  "properties": {
    "meta": {
      "type": "object",
      "required": ["slug", "name", "niche", "version"],
      "properties": {
        "slug":    { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
        "name":    { "type": "string", "minLength": 1 },
        "niche":   {
          "type": "string",
          "enum": ["brand","ecommerce","growth","webdev","ai","branding",
                   "strategy","finance","engineering","product","video","graphic"]
        },
        "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" }
      },
      "additionalProperties": false
    },
    "scopes": {
      "type": "object",
      "required": [
        "brand","color","type","spacing","layout","components",
        "header","footer","hero","blocks","templates","motion",
        "icons","imagery","theme","a11y","perf","seo-defaults",
        "custom-css","code-injection"
      ],
      "properties": {
        "brand":          { "$ref": "#/$defs/scopeObject" },
        "color":          { "$ref": "#/$defs/colorScope" },
        "type":           { "$ref": "#/$defs/scopeObject" },
        "spacing":        { "$ref": "#/$defs/scopeObject" },
        "layout":         { "$ref": "#/$defs/scopeObject" },
        "components":     { "$ref": "#/$defs/scopeObject" },
        "header":         { "$ref": "#/$defs/scopeObject" },
        "footer":         { "$ref": "#/$defs/scopeObject" },
        "hero":           { "$ref": "#/$defs/scopeObject" },
        "blocks":         { "$ref": "#/$defs/scopeObject" },
        "templates":      { "$ref": "#/$defs/scopeObject" },
        "motion":         { "$ref": "#/$defs/scopeObject" },
        "icons":          { "$ref": "#/$defs/scopeObject" },
        "imagery":        { "$ref": "#/$defs/scopeObject" },
        "theme":          { "$ref": "#/$defs/scopeObject" },
        "a11y":           { "$ref": "#/$defs/scopeObject" },
        "perf":           { "$ref": "#/$defs/scopeObject" },
        "seo-defaults":   { "$ref": "#/$defs/scopeObject" },
        "custom-css":     { "type": "string" },
        "code-injection": {
          "type": "object",
          "properties": {
            "head":       { "type": "string" },
            "body-start": { "type": "string" },
            "body-end":   { "type": "string" }
          }
        }
      },
      "additionalProperties": false
    },
    "dark": {
      "type": "object",
      "description": "Dark mode token overrides — same scope structure, partial allowed"
    }
  },
  "$defs": {
    "noHexValue": {
      "type": "string",
      "not": {
        "pattern": "#[0-9a-fA-F]{3,8}\\b"
      },
      "description": "Value must NOT be a hex literal — use var(--mj-*) or CSS color functions"
    },
    "scopeObject": {
      "type": "object",
      "additionalProperties": { "$ref": "#/$defs/noHexValue" }
    },
    "colorScope": {
      "type": "object",
      "additionalProperties": { "$ref": "#/$defs/noHexValue" }
    }
  }
}
```

### 2.3 AJV 8 Validator Implementation

[VERIFIED: AJV 8.20.0 on npm registry; AJV docs at ajv.js.org]

```typescript
// packages/ui/src/theme/validate-theme.ts
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { ThemeJson } from './types.js';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Load schema at module init (compile once, reuse)
import themeSchema from '../../themes/schemas/theme.schema.json' assert { type: 'json' };
const validateTheme = ajv.compile<ThemeJson>(themeSchema);

export function assertValidTheme(data: unknown, filename: string): asserts data is ThemeJson {
  const valid = validateTheme(data);
  if (!valid) {
    const errors = validateTheme.errors ?? [];
    const messages = errors.map(e => `  ${e.instancePath || '(root)'}: ${e.message}`).join('\n');
    throw new Error(`Invalid theme "${filename}":\n${messages}`);
  }
}

// Standalone hex-literal check (belt + suspenders for SVG files)
const HEX_LITERAL_RE = /#[0-9a-fA-F]{3,8}\b/;
export function assertNoHexLiterals(content: string, filename: string): void {
  if (HEX_LITERAL_RE.test(content)) {
    throw new Error(
      `Hex literal detected in "${filename}". Use var(--mj-ill-*) instead.\n` +
      `Run: pnpm theme:transform-svg to auto-replace.`
    );
  }
}
```

**CI script (scripts/validate-themes.ts):**
```typescript
// Runs in CI: pnpm theme:validate
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { assertValidTheme, assertNoHexLiterals } from '../packages/ui/src/theme/validate-theme.js';

const THEMES_DIR = 'packages/ui/themes/default';
const SVG_DIR    = 'packages/ui/assets/illustrations';

// Validate all theme.json files
for (const file of readdirSync(THEMES_DIR).filter(f => f.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join(THEMES_DIR, file), 'utf-8'));
  assertValidTheme(data, file);
  console.log(`  theme OK: ${file}`);
}

// Check all SVG files for hex literals
for (const file of readdirSync(SVG_DIR).filter(f => f.endsWith('.svg'))) {
  const content = readFileSync(join(SVG_DIR, file), 'utf-8');
  assertNoHexLiterals(content, file);
  console.log(`  svg OK: ${file}`);
}

console.log('All themes valid. No hex literals found.');
```

---

## §3 — Theme Resolution Stack (base → agency → page)

### 3.1 Architecture

The stack is purely CSS — no JavaScript merging, no `getComputedStyle` at runtime. Resolution order follows CSS specificity rules: **later = wins**.

```
[1] :root                       base theme (packages/ui/tokens/)
[2] [data-agency="ecommerce"]   agency override (from theme.json)
[3] [data-page="home"]          page-level override (from page front-matter or CMS)
[4] [data-theme="dark"]         dark mode token swap
[5] [data-variant="b"]          A/B variant token override
```

**HTML structure (set by Next.js layout):**
```html
<html
  data-agency="ecommerce"
  data-theme="light"
  data-variant="a"
>
```

**CSS resolution layers:**
```css
/* Layer 2: Agency override — injected from theme.json at build time */
[data-agency="ecommerce"] {
  --mj-color-brand-50:   oklch(0.97 0.03 30);
  --mj-color-brand-500:  oklch(0.65 0.20 30);  /* orange */
  --mj-color-brand-900:  oklch(0.28 0.10 30);
  --mj-font-brand:       "'Inter', system-ui, sans-serif";
  --mj-btn-radius:       var(--mj-radius-full);
}

/* Layer 3: Page override — optional, from page meta */
[data-agency="ecommerce"][data-page="home"] {
  --mj-color-bg-primary: var(--mj-primitive-orange-50);
}

/* Layer 4: Dark mode — token swap only, no asset reload */
[data-theme="dark"] {
  --mj-color-bg-primary:    var(--mj-primitive-neutral-950);
  --mj-color-bg-secondary:  var(--mj-primitive-neutral-900);
  --mj-color-text-primary:  var(--mj-primitive-neutral-0);
  --mj-color-text-secondary:var(--mj-primitive-neutral-400);
  --mj-color-border-default:var(--mj-primitive-neutral-700);
}

/* Layer 5: A/B variant override */
[data-variant="b"] {
  --mj-btn-radius: var(--mj-radius-sm);
  --mj-color-accent-primary: var(--mj-primitive-purple-500);
}
```

### 3.2 Theme Compiler (theme.json → CSS)

```typescript
// packages/ui/src/theme/compile-theme.ts
// Run at build time: pnpm theme:compile
import type { ThemeJson } from './types.js';
import { assertValidTheme } from './validate-theme.js';

interface CompileOptions {
  agency: string;
  theme: ThemeJson;
}

export function compileThemeToCss({ agency, theme }: CompileOptions): string {
  assertValidTheme(theme, `theme-${agency}.json`);

  const lines: string[] = [];
  const { scopes, dark } = theme;

  // Agency scope block
  lines.push(`[data-agency="${agency}"] {`);
  for (const [scope, values] of Object.entries(scopes)) {
    if (scope === 'custom-css' || scope === 'code-injection') continue;
    if (typeof values === 'object' && values !== null) {
      for (const [key, value] of Object.entries(values as Record<string, string>)) {
        lines.push(`  --mj-${scope}-${key}: ${value};`);
      }
    }
  }
  lines.push('}');

  // Dark mode override block (only color scope tokens typically)
  if (dark) {
    lines.push(`[data-agency="${agency}"][data-theme="dark"] {`);
    for (const [scope, values] of Object.entries(dark)) {
      if (typeof values === 'object' && values !== null) {
        for (const [key, value] of Object.entries(values as Record<string, string>)) {
          lines.push(`  --mj-${scope}-${key}: ${value};`);
        }
      }
    }
    lines.push('}');
  }

  // Custom CSS (append verbatim — validated separately for CSP compliance)
  if (scopes['custom-css']) {
    lines.push(`/* custom-css for ${agency} */`);
    lines.push(scopes['custom-css']);
  }

  return lines.join('\n');
}
```

### 3.3 Performance: < 16ms Theme Switch

Single `setAttribute` on `<html>` triggers CSS re-cascade. No `style.setProperty` loop, no `getComputedStyle`. Measurement:

```typescript
// Playwright performance test (packages/ui/__tests__/theme-switch.spec.ts)
import { test, expect } from '@playwright/test';

test('theme switch is instant (<16ms)', async ({ page }) => {
  await page.goto('http://localhost:6006');  // Storybook
  const t0 = await page.evaluate(() => performance.now());
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  const t1 = await page.evaluate(() => performance.now());
  expect(t1 - t0).toBeLessThan(16);
});
```

---

## §4 — 20 Customization Scopes Per Agency

From `mjagency/specs/milestone-M004.md` Task 1.2 (canonical source):

| # | Scope | Token Bucket | Override Target |
|---|-------|-------------|-----------------|
| 1  | `brand`        | Primary/secondary/tertiary colors | Sets agency identity palette |
| 2  | `color`        | Semantic bg, text, border, accent | Controls all UI state colors |
| 3  | `type`         | Font families, scale, weights | Typography system-wide |
| 4  | `spacing`      | Base unit, section gap | Density control |
| 5  | `layout`       | Container max-width, grid, gutter | Page structure |
| 6  | `components`   | Button, card, form radius/padding | UI kit base styling |
| 7  | `header`       | Header bg, border, height | Navigation band |
| 8  | `footer`       | Footer bg, text | Footer band |
| 9  | `hero`         | Hero bg, text color, min-height | Above-fold section |
| 10 | `blocks`       | Section bg alternation, dividers | Content rhythm |
| 11 | `templates`    | Blog/service layout variant | Page template selection |
| 12 | `motion`       | Duration, easing, reduced-motion flag | Animation system |
| 13 | `icons`        | Icon sizes, default color | Icon system |
| 14 | `imagery`      | Image radius, aspect ratios | Media display |
| 15 | `theme`        | Default mode (light/dark), dark support flag | Mode defaults |
| 16 | `a11y`         | Focus ring, contrast floor | Accessibility guarantees |
| 17 | `perf`         | Font preload count, above-fold inline flag | Performance hints |
| 18 | `seo-defaults` | OG image aspect, schema type, locale | SEO metadata defaults |
| 19 | `custom-css`   | Arbitrary CSS string | Escape hatch for one-off overrides |
| 20 | `code-injection`| Head / body-start / body-end strings | Third-party snippets (tag managers, chat) |

**Design rationale:** Scopes 1-18 are token buckets; scope 19 is a controlled escape hatch; scope 20 enables client-level integrations without code changes. All 20 are validated by the JSON schema.

---

## §5 — 12 Niche Default Themes

One `theme-{slug}.json` per agency. Palettes use OKLCH for perceptual uniformity; all color values expressed as primitives or var() references (no hex literals in the compiled CSS output).

### 5.1 Palette Table

| Agency | Niche | Primary 500 | Primary 900 | Accent | Font Brand | Personality |
|--------|-------|-------------|-------------|--------|-----------|-------------|
| `brand` | Corporate main | `oklch(0.55 0.19 250)` (blue) | `oklch(0.25 0.08 250)` | `oklch(0.72 0.17 142)` (green) | Inter | Neutral, professional, warm |
| `ecommerce` | E-commerce | `oklch(0.65 0.20 30)` (orange) | `oklch(0.28 0.10 30)` | `oklch(0.55 0.19 250)` (blue) | Inter | Bold, saturated, product-forward |
| `growth` | SaaS/Growth | `oklch(0.60 0.20 280)` (indigo) | `oklch(0.28 0.10 280)` | `oklch(0.80 0.15 280)` (lavender) | Plus Jakarta Sans | Dashboard, data-dense, SaaS |
| `webdev` | Web Dev | `oklch(0.55 0.18 230)` (cool blue) | `oklch(0.26 0.09 230)` | `oklch(0.72 0.17 175)` (teal) | JetBrains Mono (headings) | Technical, grid-based, precise |
| `ai` | AI/ML | `oklch(0.60 0.22 295)` (violet) | `oklch(0.28 0.12 295)` | `oklch(0.93 0.04 95)` (warm cream) | Instrument Sans | Abstract, futuristic, warm contrast |
| `branding` | Branding/Creative | `oklch(0.15 0.00 0)` (near-black) | `oklch(0.08 0.00 0)` (black) | `oklch(0.72 0.14 55)` (warm amber) | Fraunces / editorial serif | Bold editorial, typographic |
| `strategy` | Strategy/Consulting | `oklch(0.30 0.12 250)` (navy) | `oklch(0.18 0.07 250)` | `oklch(0.72 0.12 80)` (gold) | Playfair Display | Corporate refined, trustworthy |
| `finance` | Finance/FinTech | `oklch(0.28 0.12 250)` (navy) | `oklch(0.18 0.06 250)` | `oklch(0.62 0.12 155)` (muted green) | Source Serif 4 | Trustworthy, conservative, secure |
| `engineering` | Engineering/Hardware | `oklch(0.28 0.02 0)` (charcoal) | `oklch(0.15 0.01 0)` | `oklch(0.72 0.18 70)` (amber) | IBM Plex Sans | Industrial, functional, amber accent |
| `product` | Product/UX | `oklch(0.95 0.03 90)` (cream) | `oklch(0.85 0.05 90)` | `oklch(0.68 0.20 20)` (coral) | DM Sans | Human-centered, soft, approachable |
| `video` | Video/Media | `oklch(0.15 0.02 20)` (warm dark) | `oklch(0.10 0.01 20)` | `oklch(0.80 0.15 50)` (warm gold) | Bebas Neue (headings) | Cinematic, contrasty, premium |
| `graphic` | Graphic Design | `oklch(0.12 0.00 0)` (near-black) | `oklch(0.06 0.00 0)` | `oklch(0.75 0.25 160)` (vivid green) | Space Grotesk | Bold typographic, high contrast |

### 5.2 Font Stack Approach

```typescript
// packages/ui/src/theme/font-stacks.ts
// Variable fonts preferred (one file covers weight range)
// Google Fonts loaded via Next.js font optimization (next/font/google)
// Source: [ASSUMED: Next.js next/font/google docs pattern]

export const NICHE_FONTS = {
  brand:       { heading: 'Inter',              body: 'Inter' },
  ecommerce:   { heading: 'Inter',              body: 'Inter' },
  growth:      { heading: 'Plus Jakarta Sans',  body: 'Plus Jakarta Sans' },
  webdev:      { heading: 'JetBrains Mono',     body: 'Inter' },
  ai:          { heading: 'Instrument Sans',    body: 'Instrument Sans' },
  branding:    { heading: 'Fraunces',           body: 'Instrument Sans' },
  strategy:    { heading: 'Playfair Display',   body: 'Source Sans 3' },
  finance:     { heading: 'Source Serif 4',     body: 'Source Sans 3' },
  engineering: { heading: 'IBM Plex Sans',      body: 'IBM Plex Sans' },
  product:     { heading: 'DM Sans',            body: 'DM Sans' },
  video:       { heading: 'Bebas Neue',         body: 'Inter' },
  graphic:     { heading: 'Space Grotesk',      body: 'Space Grotesk' },
} as const;
```

**Font loading rules** (no render-blocking):
- `font-display: optional` for above-fold headline fonts (prevents CLS)
- `font-display: swap` for body text (readable fallback immediately)
- Preload only the first 2 font files per page

---

## §6 — Dark Mode via Token Swap (FOUC Prevention)

### 6.1 CSS Architecture

[VERIFIED: tailwindcss.com/docs/dark-mode — `@custom-variant dark`]

```css
/* packages/ui/styles/theme.css — dark mode variant (already shown in §1.3) */
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
```

Dark mode overrides are pure token reassignment inside `[data-theme="dark"]`:

```css
/* packages/ui/tokens/dark-mode.css */
[data-theme="dark"] {
  /* Layer 2 color tokens — only these change for dark mode */
  --mj-color-bg-primary:    var(--mj-primitive-neutral-950);
  --mj-color-bg-secondary:  var(--mj-primitive-neutral-900);
  --mj-color-bg-inverse:    var(--mj-primitive-neutral-0);
  --mj-color-text-primary:  var(--mj-primitive-neutral-0);
  --mj-color-text-secondary:var(--mj-primitive-neutral-400);
  --mj-color-text-inverse:  var(--mj-primitive-neutral-950);
  --mj-color-border-default:var(--mj-primitive-neutral-700);
  --mj-color-border-subtle: var(--mj-primitive-neutral-800);

  /* Card / form dark surfaces */
  --mj-card-bg:   var(--mj-primitive-neutral-900);
  --mj-form-bg:   var(--mj-primitive-neutral-800);
  --mj-card-border:var(--mj-primitive-neutral-700);
}
```

No image assets change. No asset reload. No class toggling on every component. One attribute toggle propagates via CSS variable inheritance.

### 6.2 FOUC Prevention Strategy

FOUC (Flash of Unstyled Content / Flash of Wrong Theme) happens because SSR renders HTML without knowing the stored theme preference before hydration.

**Solution: Blocking inline script in `<head>` before `<body>`**

```tsx
// apps/web-{agency}/src/app/layout.tsx
// Source: Pattern from Next.js community discussions (github.com/vercel/next.js/discussions/53063)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        {/* CRITICAL: This script runs synchronously before any paint */}
        {/* It must be inline (no src=) so it blocks rendering until theme is set */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var stored = localStorage.getItem('mj-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
            `.trim()
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**Why `dangerouslySetInnerHTML` here is safe:** The script content is a static string, not user input. CSP nonce is injected at the middleware level (Phase 3 / Phase 11). `suppressHydrationWarning` on `<html>` prevents React hydration mismatch from the attribute the script sets.

**Cookie-based server-side alternative (for SSR-first dark mode):**
```typescript
// In middleware.ts (already established in Phase 3)
const themeCookie = req.cookies.get('mj-theme')?.value ?? 'light';
const response = NextResponse.next();
response.headers.set('x-theme', themeCookie);  // read in layout RSC
```

**Client toggle hook:**
```typescript
// packages/ui/src/hooks/use-theme.ts
'use client';
import { useCallback, useEffect, useState } from 'react';

export function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = localStorage.getItem('mj-theme') as 'light' | 'dark' | null;
    const current = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
    setThemeState(stored ?? current ?? 'light');
  }, []);

  const setTheme = useCallback((next: 'light' | 'dark') => {
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('mj-theme', next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  return { theme, setTheme, toggle } as const;
}
```

---

## §7 — A/B Framework (Variant Token Override)

### 7.1 Architecture

A/B variants are stored as theme.json sub-objects in the `agency_themes` DB table. CSS variant override uses `[data-variant="b"]` attribute on `<html>`.

**Token override pattern:**
```css
/* Variant B overrides only the tokens it changes — inherits all others from agency scope */
[data-agency="ecommerce"][data-variant="b"] {
  --mj-btn-radius:           var(--mj-radius-sm);      /* rectangular vs rounded */
  --mj-color-accent-primary: oklch(0.60 0.22 295);     /* purple accent vs orange */
  --mj-color-bg-primary:     oklch(0.97 0.01 95);      /* off-white vs pure white */
}
```

**DB schema (Drizzle, in Phase 4):**
```typescript
// packages/db/src/schema/theme-tables.ts
import { pgTable, uuid, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const agencyThemes = pgTable('agency_themes', {
  id:        uuid('id').defaultRandom().primaryKey(),
  agencyId:  uuid('agency_id').notNull(),  // RLS filters by this
  themeJson: jsonb('theme_json').notNull(),
  version:   integer('version').notNull().default(1),
  isActive:  boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const themeVersions = pgTable('theme_versions', {
  id:        uuid('id').defaultRandom().primaryKey(),
  agencyId:  uuid('agency_id').notNull(),
  version:   integer('version').notNull(),
  themeJson: jsonb('theme_json').notNull(),
  label:     text('label'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
// Max 20 rows per agency; oldest pruned on insert via DB trigger

export const themeAbVariants = pgTable('theme_ab_variants', {
  id:           uuid('id').defaultRandom().primaryKey(),
  agencyId:     uuid('agency_id').notNull(),
  variantAId:   uuid('variant_a_id').references(() => agencyThemes.id).notNull(),
  variantBId:   uuid('variant_b_id').references(() => agencyThemes.id).notNull(),
  trafficSplit: integer('traffic_split').notNull().default(50),  // percentage for B
  winnerId:     uuid('winner_id').references(() => agencyThemes.id),
  status:       text('status').notNull().default('active'),  // active | paused | completed
  createdAt:    timestamp('created_at').defaultNow().notNull(),
});
```

**Variant assignment (server-side, Phase 9+ analytics integration):**
```typescript
// packages/ui/src/theme/ab-assignment.ts
// At M004: assignment is random (Math.random < split/100)
// At M011+: assignment from GA4 experiment_id cookie

import type { AgencySlug } from '@mjagency/config';

export function assignVariant(
  agencyId: string,
  trafficSplit: number,  // 0-100, percentage for variant B
  seed: string = Math.random().toString()
): 'a' | 'b' {
  // Deterministic based on seed (user cookie) in Phase 9+
  // For M004: simple random
  return Math.random() * 100 < trafficSplit ? 'b' : 'a';
}

export function resolveVariantFromCookie(cookieValue: string | undefined): 'a' | 'b' {
  if (cookieValue === 'b') return 'b';
  return 'a';
}
```

**Phase 9+ analytics wire-up hook** (placeholder interface only at M004):
```typescript
// packages/ui/src/theme/ab-analytics-hook.ts
// M004: stub. M009: replace with real GA4 experiment integration.

export interface AbAnalyticsAdapter {
  /** Called when variant is assigned to a visitor */
  onAssign(agencyId: string, variant: 'a' | 'b'): void;
  /** Called on conversion event */
  onConvert(agencyId: string, variant: 'a' | 'b', eventName: string): void;
}

export const noopAbAdapter: AbAnalyticsAdapter = {
  onAssign: () => void 0,
  onConvert: () => void 0,
};
```

---

## §8 — Storybook Visual Regression CI

### 8.1 Version Selection

The project spec (milestone-M004) states "Storybook 8.x". The objective says "Storybook 9.x". npm registry shows:
- `storybook@latest` = **10.3.5** (June 2025+)
- `storybook@v9` = **9.1.20** (stable v9 channel)

[VERIFIED: npm view storybook dist-tags 2026-04-25]

**Recommendation:** Pin to `9.1.20` (the `v9` channel). Version 10 is less than 2 weeks old at research time; v9 is stable and battle-tested for the Turborepo/Next.js pattern. Align with Phase 1 plan 01-01 which referenced "Storybook 8.x" — using v9 is the appropriate upgrade.

```bash
# Installation in packages/ui
pnpm add -D storybook@9.1.20 @storybook/nextjs-vite@9.1.20 @storybook/test@9.1.20
```

> Note: `@storybook/nextjs-vite` is the recommended Next.js framework in Storybook 9 (replaces Webpack-based `@storybook/nextjs`). [CITED: storybook.js.org/blog/storybook-9]

### 8.2 Storybook Configuration for Turborepo

```typescript
// packages/ui/.storybook/main.ts
import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  framework: '@storybook/nextjs-vite',
  stories: [
    // All 45 blocks from packages/ui
    '../src/blocks/**/*.stories.@(ts|tsx)',
    '../src/components/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-themes',
    '@chromatic-com/storybook',  // visual regression via Chromatic
  ],
  docs: { autodocs: 'tag' },
};

export default config;
```

### 8.3 Theme Decorator: 540 Stories from 45 Blocks × 12 Themes

```typescript
// packages/ui/.storybook/preview.tsx
import type { Preview, Decorator } from '@storybook/react';
import { AGENCIES } from '@mjagency/config';
import '../styles/theme.css';

// Decorator: apply data-agency + data-theme to wrapper div
const withTheme: Decorator = (Story, context) => {
  const { agency = 'brand', darkMode = false } = context.globals as {
    agency?: string;
    darkMode?: boolean;
  };
  return (
    <div
      data-agency={agency}
      data-theme={darkMode ? 'dark' : 'light'}
      style={{ minHeight: '100vh', background: 'var(--mj-color-bg-primary)' }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    agency: {
      description: 'Agency theme',
      defaultValue: 'brand',
      toolbar: {
        title: 'Agency',
        icon: 'paintbrush',
        items: AGENCIES.map(slug => ({ value: slug, title: slug })),
        dynamicTitle: true,
      },
    },
    darkMode: {
      description: 'Dark mode',
      defaultValue: false,
      toolbar: {
        title: 'Dark Mode',
        icon: 'moon',
        items: [
          { value: false, title: 'Light' },
          { value: true,  title: 'Dark'  },
        ],
      },
    },
  },
  parameters: {
    layout: 'padded',
  },
};

export default preview;
```

**Auto-generating 540 stories without 540 story files:**
```typescript
// packages/ui/src/blocks/HeroBlock/HeroBlock.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { AGENCIES } from '@mjagency/config';
import { HeroBlock } from './HeroBlock.js';

const meta: Meta<typeof HeroBlock> = {
  title: 'Blocks/HeroBlock',
  component: HeroBlock,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof HeroBlock>;

// Default story — uses global agency/darkMode toggles
export const Default: Story = {
  args: { headline: 'Grow Your Revenue', cta: 'Book a Call' },
};

// Chromatic Modes: auto-capture all 12 agencies × 2 modes = 24 snapshots per block
// 45 blocks × 24 = 1080 snapshots total in Chromatic
export const AllThemes: Story = {
  ...Default,
  parameters: {
    chromatic: {
      modes: Object.fromEntries(
        AGENCIES.flatMap(agency => [
          [`${agency}-light`, { globals: { agency, darkMode: false } }],
          [`${agency}-dark`,  { globals: { agency, darkMode: true  } }],
        ])
      ),
    },
  },
};
```

### 8.4 Visual Regression Options

| Option | Tool | Cost | Snapshot Storage | CI Integration |
|--------|------|------|-----------------|----------------|
| **Recommended (SaaS)** | Chromatic | Paid (free tier: 5k snapshots/month) | Cloud | GitHub PR badge |
| **Self-hosted** | `@storybook/test-runner` + Playwright screenshots | Free | `packages/ui/__snapshots__/` | GitHub Actions |
| **Alternative** | Loki + Storybook | Free | Local repo | GitHub Actions |

**Recommendation for M004:** Use `@storybook/test-runner` + Playwright snapshots (self-hosted, free). The 540-story count fits within the free tier of Chromatic (5k snapshots) but adds an external service dependency at an early phase. Switch to Chromatic in Phase 8+ when the component count stabilizes.

### 8.5 Self-hosted CI Configuration (Playwright snapshots)

```typescript
// packages/ui/test-runner-jest.config.ts
// Generated via: pnpm test-storybook --eject
import { getJestConfig } from '@storybook/test-runner';

export default {
  ...getJestConfig(),
  testTimeout: 60_000,         // 60s per story (font loading can be slow)
  maxWorkers: 4,               // 4 parallel workers on GitHub-hosted runner (2 vCPU = 2, 4 is fine)
  // Per @storybook/test-runner docs: limit workers to avoid resource exhaustion
};
```

**CI workflow step (adds to existing GitHub Actions CI from Phase 1):**
```yaml
# .github/workflows/ci.yml — append to existing workflow
  visual-regression:
    name: Visual Regression (Storybook)
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - name: Build Storybook
        run: pnpm --filter=@mjagency/ui build-storybook
      - name: Install Playwright
        run: pnpm exec playwright install chromium --with-deps
      - name: Serve + Test
        run: |
          npx concurrently -k -s first -n "SB,TEST" \
            "npx http-server packages/ui/storybook-static --port 6006 --silent" \
            "npx wait-on tcp:127.0.0.1:6006 && pnpm --filter=@mjagency/ui test-storybook --maxWorkers=4 --testTimeout=60000"
```

**Pixel diff threshold (prevent flakiness from sub-pixel font rendering):**
```typescript
// packages/ui/.storybook/test-runner.ts
import { toMatchImageSnapshot } from 'jest-image-snapshot';
import type { TestRunnerConfig } from '@storybook/test-runner';

export default {
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },
  async postVisit(page, context) {
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchImageSnapshot({
      failureThreshold: 0.001,          // 0.1% pixel diff tolerance
      failureThresholdType: 'percent',
    });
  },
} satisfies TestRunnerConfig;
```

---

## §9 — Marketplace Stub

At M004, the marketplace is types-only. The full implementation ships in M010 (Tools + Builder phase).

### 9.1 M004 API Surface (types-only)

```typescript
// packages/ui/src/marketplace/types.ts
// M004: Types only. M010: implement ThemeMarketplaceService.

export interface MarketplaceTheme {
  id: string;
  slug: string;
  name: string;
  description: string;
  niche: string;
  preview_url: string;
  thumbnail_url: string;
  author: string;
  license: 'mit' | 'commercial';
  version: string;
  downloads: number;
  rating: number;  // 0-5
  theme_json: ThemeJson;
  created_at: string;
  updated_at: string;
}

export interface ThemeMarketplaceQuery {
  niche?: string;
  search?: string;
  sort?: 'popular' | 'recent' | 'rating';
  page?: number;
  per_page?: number;
}

export interface ThemeMarketplacePage {
  items: MarketplaceTheme[];
  total: number;
  page: number;
  per_page: number;
}

/** M004: stub only. Real implementation in M010 via tRPC. */
export interface ThemeMarketplaceService {
  list(query: ThemeMarketplaceQuery): Promise<ThemeMarketplacePage>;
  get(id: string): Promise<MarketplaceTheme>;
  install(agencyId: string, marketplaceThemeId: string): Promise<void>;
  publish(agencyId: string, themeId: string, meta: Partial<MarketplaceTheme>): Promise<MarketplaceTheme>;
}

/** M004: noop implementation for type-checking. */
export const marketplaceStub: ThemeMarketplaceService = {
  list:    async () => ({ items: [], total: 0, page: 1, per_page: 20 }),
  get:     async (id) => { throw new Error(`Marketplace not implemented (M010). Requested: ${id}`); },
  install: async () => { throw new Error('Marketplace not implemented (M010).'); },
  publish: async () => { throw new Error('Marketplace not implemented (M010).'); },
};
```

---

## §10 — Migration from Phase 1 `packages/ui`

### 10.1 Current State (Phase 1 Output)

```css
/* packages/ui/styles/theme.css — CURRENT (Phase 1 skeleton) */
@theme {
  --color-brand-50:  #f0f9ff;
  --color-brand-500: #0ea5e9;
  --color-brand-900: #0c4a6e;
}
```

```json
// packages/ui/package.json — CURRENT (no CSS/Tailwind deps)
{ "devDependencies": { "typescript": "5.6.3", "vitest": "2.1.8" } }
```

### 10.2 Migration Steps

**Step 1 — Replace hex literals in theme.css with OKLCH primitives**

The Phase 1 file has 3 hex literals that violate REQ-047. Phase 4 replaces them:
```
#f0f9ff → oklch(0.97 0.013 250)  [--mj-primitive-blue-50]
#0ea5e9 → oklch(0.55 0.19 250)   [--mj-primitive-blue-500]
#0c4a6e → oklch(0.25 0.08 250)   [--mj-primitive-blue-900]
```

**Step 2 — Move @theme block to `@theme inline` bridge pattern**

```css
/* BEFORE (Phase 1) */
@theme {
  --color-brand-500: #0ea5e9;
}

/* AFTER (Phase 4) */
/* All raw values now in layer-1-primitives.css */
/* Semantic tokens in layer-2-semantic-color.css */
/* Bridge via @theme inline in theme.css */
@theme inline {
  --color-brand-500: var(--mj-color-brand-500);
}
```

**Step 3 — Add token layer imports to theme.css**

```css
@import "tailwindcss";
@import "../tokens/layer-1-primitives.css";
/* ... all 6 layers */
@theme inline { /* bridge */ }
```

**Step 4 — Add dependencies to packages/ui/package.json**

```json
{
  "devDependencies": {
    "storybook": "9.1.20",
    "@storybook/nextjs-vite": "9.1.20",
    "@storybook/test": "9.1.20",
    "@storybook/test-runner": "0.24.3",
    "@storybook/addon-essentials": "9.1.20",
    "@storybook/addon-themes": "9.1.20",
    "ajv": "8.20.0",
    "ajv-formats": "3.0.1",
    "playwright": "1.x",
    "typescript": "5.6.3",
    "vitest": "2.1.8"
  }
}
```

**Step 5 — Add ESLint rule: no hex literals in components**

```typescript
// packages/eslint-config/rules/no-hex-literals.ts
// [ASSUMED: ESLint rule structure; exact API depends on eslint version in Phase 1]
export const noHexLiteralsInCss = {
  name: 'mjagency/no-hex-in-css-tokens',
  meta: {
    type: 'problem',
    docs: { description: 'Forbid hex literals in CSS-in-JS and styled components' },
    schema: [],
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(node.value)) {
          // Only flag in CSS-property-like contexts
          const parent = node.parent;
          if (parent.type === 'Property' || parent.type === 'AssignmentExpression') {
            context.report({
              node,
              message: `Hex literal "${node.value}" not allowed. Use var(--mj-*) CSS variable instead.`,
            });
          }
        }
      },
    };
  },
};
```

### 10.3 File Structure After Migration

```
packages/ui/
├── src/
│   ├── blocks/              # 45 blocks (Phase 5) — stories here
│   ├── components/          # Shared UI primitives
│   ├── hooks/
│   │   └── use-theme.ts
│   ├── marketplace/
│   │   └── types.ts         # M004 stub
│   └── theme/
│       ├── compile-theme.ts
│       ├── validate-theme.ts
│       ├── ab-analytics-hook.ts
│       └── types.ts
├── styles/
│   └── theme.css            # Entry point: imports layers + @theme inline bridge
├── tokens/
│   ├── layer-1-primitives.css
│   ├── layer-2-semantic-color.css
│   ├── layer-3-typography.css
│   ├── layer-4-layout.css
│   ├── layer-5-effects.css
│   ├── layer-6-components.css
│   └── dark-mode.css
├── themes/
│   ├── default/
│   │   ├── theme-brand.json
│   │   ├── theme-ecommerce.json
│   │   ├── theme-growth.json
│   │   ├── theme-webdev.json
│   │   ├── theme-ai.json
│   │   ├── theme-branding.json
│   │   ├── theme-strategy.json
│   │   ├── theme-finance.json
│   │   ├── theme-engineering.json
│   │   ├── theme-product.json
│   │   ├── theme-video.json
│   │   └── theme-graphic.json
│   └── schemas/
│       └── theme.schema.json
├── assets/
│   └── illustrations/       # SVGs — all must use var(--mj-ill-*), no hex
└── .storybook/
    ├── main.ts
    ├── preview.tsx
    └── test-runner.ts
```

---

## §11 — Version Matrix

All versions verified against npm registry on 2026-04-25.

| Package | Version | Notes |
|---------|---------|-------|
| `tailwindcss` | `4.2.4` | [VERIFIED: npm registry] CSS-first, `@theme` directive |
| `storybook` | `9.1.20` | [VERIFIED: npm registry `v9` tag] Stable v9 channel |
| `@storybook/nextjs-vite` | `9.1.20` | [VERIFIED: npm registry] Next.js + Vite framework |
| `@storybook/test` | `9.1.20` | Vitest integration for Storybook |
| `@storybook/test-runner` | `0.24.3` | [VERIFIED: npm registry] Jest + Playwright runner |
| `@storybook/addon-essentials` | `9.1.20` | Core addons bundle |
| `@storybook/addon-themes` | `9.1.20` | `withThemeByDataAttribute` decorator |
| `@chromatic-com/storybook` | `5.1.2` | [VERIFIED: npm registry] Chromatic integration (optional) |
| `ajv` | `8.20.0` | [VERIFIED: npm registry] JSON Schema validator |
| `ajv-formats` | `3.0.1` | [VERIFIED: npm registry] Format validators for AJV |
| `jest-image-snapshot` | `6.x` | Pixel diff for test-runner `postVisit` |
| `typescript` | `5.6.3` | Pinned from Phase 1 |
| `vitest` | `2.1.8` | Pinned from Phase 1 |
| `node` | `>=22.x` | Pinned from Phase 1 (CLAUDE.md §9) |

**Note on Storybook 10:** `storybook@latest` is `10.3.5` as of research date. The project should evaluate upgrading to v10 in Phase 8 when the component library stabilizes. v9 is stable and production-proven for the Turborepo/Next.js pattern.

---

## §12 — Common Pitfalls

### Pitfall 1: CSS Variable Inheritance Scope Leak
**What goes wrong:** Dark mode tokens applied to `[data-theme="dark"]` on `<html>` work globally, but components that use `isolation: isolate` or create new stacking contexts may not inherit the updated variables correctly in some browsers.
**Why it happens:** CSS custom properties inherit through the DOM tree by default, but `contain: strict` or shadow DOM can break the chain.
**How to avoid:** Never use `contain: strict` or Shadow DOM on theme-sensitive components. Test with `getComputedStyle(el).getPropertyValue('--mj-color-bg-primary')` in Playwright after attribute toggle.
**Warning signs:** Component looks correct in Storybook but wrong in production Next.js app.

### Pitfall 2: Tailwind @theme vs :root — Utility Class Gaps
**What goes wrong:** Tokens defined in `:root` do NOT generate Tailwind utility classes. Only tokens in `@theme` or `@theme inline` generate utilities.
**Why it happens:** This is intentional in Tailwind v4 design. `:root` is for runtime CSS vars that don't need utilities; `@theme` is for design system tokens that DO need utilities.
**How to avoid:** Use `@theme inline { --color-x: var(--mj-color-x); }` to bridge. All tokens that need `bg-*`, `text-*`, etc. utilities MUST be in `@theme` (or `@theme inline`).
**Warning signs:** `bg-brand-500` class has no effect; Tailwind compiler warnings about unresolved custom properties.

### Pitfall 3: FOUC on Hard Reload / SSR
**What goes wrong:** User refreshes page and sees light mode flash before dark mode is applied, even though they have dark mode set in localStorage.
**Why it happens:** React hydration runs after first paint. The inline `<script>` must be synchronous and blocking. Placing it in `<body>` or using `defer` breaks the fix.
**How to avoid:** Keep the blocking inline script in `<head>` BEFORE any stylesheet links. Keep it under ~500 bytes (no module imports, no async). `suppressHydrationWarning` on `<html>` is mandatory.
**Warning signs:** CLS score > 0 on Lighthouse due to layout shift when theme applies.

### Pitfall 4: AJV Schema Compile Cost in Hot Paths
**What goes wrong:** `ajv.compile(schema)` is called on every request, causing latency spikes.
**Why it happens:** AJV recommends compiling once and reusing. Compiling on every call is 100-1000x slower.
**How to avoid:** Module-level singleton: `const validate = ajv.compile(schema)` at module init. The compiled validator is a function and safe to call concurrently.
**Warning signs:** Slow theme-save API endpoints; heap profiler shows AJV compilation in hot path.

### Pitfall 5: Storybook Visual Regression Flakiness (Font Rendering)
**What goes wrong:** CI fails on pixel diffs caused by font anti-aliasing differences between local macOS and Linux CI runner.
**Why it happens:** Font rendering is OS/GPU dependent. Sub-pixel differences are inevitable.
**How to avoid:** Use `failureThreshold: 0.001` (0.1%) in jest-image-snapshot config. Never set threshold to 0. Regenerate baselines on CI runner (Linux), not on local macOS.
**Warning signs:** Visual regression tests pass locally but fail in CI on the first run after reset.

### Pitfall 6: 540-Story Timeout in CI
**What goes wrong:** GitHub Actions job times out at 6 hours because 540 stories run sequentially.
**Why it happens:** `@storybook/test-runner` defaults to single worker; 540 stories × ~1s each = 9 min, but font load + render can push this to 2-5s/story.
**How to avoid:** Set `--maxWorkers=4`. On GitHub-hosted runner (2 vCPU, 7GB RAM), 4 workers is safe. Alternatively, split by agency: run 45 stories × 12 theme variants = 12 parallel jobs using Turborepo task sharding.
**Warning signs:** CI job duration > 20 minutes for Storybook tests.

### Pitfall 7: Hex Literals in SVG Fills via Gradient Stops
**What goes wrong:** SVG gradient stops `<stop stop-color="#ff6600">` pass ESLint rules that only check TS/TSX files, but fail the AJV validator.
**Why it happens:** ESLint rules typically scan JS/TS files. SVGs are XML, not JS — they require a separate check.
**How to avoid:** Run `scripts/validate-themes.ts` which also scans `assets/illustrations/*.svg` for hex patterns. This runs in CI via `pnpm theme:validate` gate.
**Warning signs:** SVG looks correct in browser but fails the theme-switch test because gradient stop still has the hardcoded value.

### Pitfall 8: theme.json Custom CSS Scope XSS Vector
**What goes wrong:** The `custom-css` scope accepts arbitrary CSS string, which could contain `expression()` (IE-era) or `url(javascript:...)` injections if stored user input is ever rendered there.
**Why it happens:** CSS injection via `style` tags is a documented XSS vector.
**How to avoid:** At M004, `custom-css` is admin-only (no user input). In Phase 10+ when the builder exposes it: strip `expression(`, `javascript:`, `url(data:`, and all `@import` from the `custom-css` value before CSS compilation. Enforce CSP nonce on all injected inline styles (Phase 11).
**Warning signs:** Pentest finding in Phase 11 OWASP scan.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | OKLCH is supported in all target browsers (modern Chromium, Firefox, Safari) | §1.2, §5.1 | Fallback to hex/hsl needed; low risk for 2026 targets |
| A2 | `@storybook/nextjs-vite` exists at v9.1.20 as the recommended Next.js framework | §8.1 | May need `@storybook/nextjs` (Webpack) instead; both work |
| A3 | `@theme inline` allows var() references (Tailwind v4 resolves them at use-time) | §1.3 | If not, direct values required in @theme; token portability breaks |
| A4 | Font stacks (Inter, Fraunces, etc.) available on Google Fonts with variable font variant | §5.2 | Fallback to non-variable versions; slight performance impact |
| A5 | `jest-image-snapshot` is compatible with `@storybook/test-runner 0.24.3` | §8.5 | Different snapshot approach required (Playwright's own screenshot assertions) |
| A6 | TypeScript `import assert { type: 'json' }` works for JSON files in project TS config | §2.3 | May need `resolveJsonModule: true` or dynamic `readFileSync` instead |
| A7 | The ESLint rule structure for no-hex-literals follows ESLint flat config (Phase 1 used flat config) | §10.2 | May need legacy `.eslintrc` format if Phase 1 used different format |
| A8 | `data-agency` + `data-theme` dual-attribute CSS selector performance is acceptable at 540 selectors | §3.1 | Browser selector matching benchmarks needed; unlikely to be an issue |

---

## §A1 — Open Questions for Planner

1. **Storybook hosting location:** Should Storybook live in `packages/ui` (current recommendation) or as a separate `apps/storybook` app in the monorepo? The Turborepo guide supports both. `packages/ui` is simpler for M004; a dedicated app gives per-story deployment to Vercel/Chromatic.

2. **Chromatic vs self-hosted snapshots:** The research recommends `@storybook/test-runner` + Playwright (self-hosted, free) for M004. Chromatic (free tier: 5k snapshots/month) would cover 540 stories with 1080 Chromatic captures per build. Does the team have a Chromatic account? If yes, prefer Chromatic for the PR review UI.

3. **`@theme inline` confirmation:** The `@theme inline` pattern (bridging `--mj-*` variables to Tailwind utilities via var() references) needs a quick smoke test. The official Tailwind docs show it works, but the interaction with `--mj-` prefixed custom vars should be confirmed with a 5-minute proof-of-concept before the first plan commits to this as the standard.

4. **Font loading strategy:** The research recommends `next/font/google` for all agency font stacks. This requires the agency font to be declared in the per-agency Next.js layout, not in `packages/ui/theme.css`. Confirm this is the intended architecture (CSS token `--mj-font-brand` set by next/font injected CSS var, overriding the fallback value in :root).

5. **DB schema timing:** The `agency_themes`, `theme_versions`, and `theme_ab_variants` tables belong to Phase 4 (plan 04-03), but require a Drizzle migration. Phase 2 established the migration runner. Phase 4 needs to run a new migration (e.g., `004_create_theme_tables.sql`) — confirm this is the plan numbering convention and that Phase 4 is expected to add to the migration set.

6. **A/B traffic split server-side vs edge:** The research uses a server-side random assignment. Phase 3 established Cloudflare middleware. An edge-level A/B cookie assignment (using Cloudflare Workers or Next.js middleware) would avoid the server roundtrip. Deferred to M009 analytics but worth flagging now.

7. **SVG illustration source:** The 30 niche illustrations per agency (referenced in PROJECT.md) will be authored in Phase 12's content sprint. At M004, only the illustration token schema (`--mj-ill-*`) and the hex-literal validator need to exist. Confirm no SVG assets are expected in Phase 4 itself.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22 | Build tooling | ✓ | 22.x (pinned Phase 1) | — |
| pnpm | Package manager | ✓ | Phase 1 | — |
| Tailwind CSS 4 | Token system | ✓ | 4.2.4 | — |
| Chromatic account | Visual regression (SaaS) | Unknown | — | `@storybook/test-runner` + Playwright |
| Google Fonts API | Agency font stacks | ✓ (CDN) | — | System font fallbacks |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.8 + Playwright (via `@storybook/test-runner`) |
| Config file | `packages/ui/vitest.config.ts` (exists from Phase 1 scaffold) |
| Quick run | `pnpm --filter=@mjagency/ui test` |
| Storybook visual | `pnpm --filter=@mjagency/ui test-storybook` |
| Theme validator | `pnpm theme:validate` (scripts/validate-themes.ts) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-040 | All 6 token layers defined, TypeScript compiles | typecheck | `pnpm --filter=@mjagency/ui typecheck` | ❌ Wave 0 |
| REQ-041 | Theme validator rejects invalid theme + hex literals | unit | `vitest run packages/ui/src/theme/__tests__/validate-theme.test.ts` | ❌ Wave 0 |
| REQ-042 | All 20 scopes present in theme.json and schema | unit | `vitest run packages/ui/src/theme/__tests__/scopes.test.ts` | ❌ Wave 0 |
| REQ-043 | Theme resolution: agency override wins over base | unit | `vitest run packages/ui/src/theme/__tests__/resolution.test.ts` | ❌ Wave 0 |
| REQ-044 | 12 theme JSON files valid against schema | CI script | `node scripts/validate-themes.ts` | ❌ Wave 0 |
| REQ-045 | Theme switch `setAttribute` takes < 16ms | Playwright | `playwright test packages/ui/__tests__/theme-switch.spec.ts` | ❌ Wave 0 |
| REQ-046 | Dark mode: all 12 agencies have dark scope, no asset reload | unit | `vitest run packages/ui/src/theme/__tests__/dark-mode.test.ts` | ❌ Wave 0 |
| REQ-047 | Zero hex literals in SVG assets | CI script | `node scripts/validate-themes.ts` (includes SVG check) | ❌ Wave 0 |
| REQ-048 | Storybook builds clean, 45 stories visible | build | `pnpm --filter=@mjagency/ui build-storybook` | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `packages/ui/src/theme/__tests__/validate-theme.test.ts` — REQ-041, REQ-047
- [ ] `packages/ui/src/theme/__tests__/scopes.test.ts` — REQ-042
- [ ] `packages/ui/src/theme/__tests__/resolution.test.ts` — REQ-043
- [ ] `packages/ui/src/theme/__tests__/dark-mode.test.ts` — REQ-046
- [ ] `packages/ui/__tests__/theme-switch.spec.ts` — REQ-045 (Playwright)
- [ ] `scripts/validate-themes.ts` — REQ-044, REQ-047 (CI script)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Theme engine is not auth-gated at CSS level |
| V3 Session Management | No | — |
| V4 Access Control | Partial | Theme save API requires `admin` role (Phase 3 `requireSession()`) |
| V5 Input Validation | Yes | `custom-css` and `code-injection` scopes — strip injection vectors |
| V6 Cryptography | No | — |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSS injection via `custom-css` scope | Tampering | Strip `expression(`, `javascript:`, `@import` before compilation |
| XSS via `code-injection.head` | Tampering | Admin-only at v1; CSP nonce on all injected scripts (Phase 11) |
| Theme JSON SSRF via `url()` in values | Elevation | Disallow `url()` in all non-imagery token values; AJV `not: { pattern: "url\\(" }` |
| Privilege escalation via theme rollback | Spoofing | `theme.rollback` tRPC procedure must verify `agencyId` matches session (CLAUDE.md §3) |

---

## Sources

### Primary (HIGH confidence)
- `tailwindcss.com/docs/theme` — `@theme`, `@theme inline`, token namespaces [VERIFIED: fetched 2026-04-25]
- `tailwindcss.com/docs/dark-mode` — `@custom-variant dark` data attribute pattern [VERIFIED: fetched 2026-04-25]
- `tailwindcss.com/docs/adding-custom-styles` — CSS variable utility patterns [VERIFIED: fetched 2026-04-25]
- `ajv.js.org` — AJV 8.x API, pattern keyword, addFormat [VERIFIED: fetched 2026-04-25]
- `storybook.js.org/blog/storybook-9` — Storybook 9 release notes, `@storybook/nextjs-vite` [VERIFIED: fetched 2026-04-25]
- npm registry — storybook@9.1.20, @storybook/test-runner@0.24.3, ajv@8.20.0, tailwindcss@4.2.4, chromatic@16.6.0 [VERIFIED: npm view, 2026-04-25]
- `mjagency/specs/milestone-M004.md` — 20 scopes, 6 layers, 12 niche palette descriptions [VERIFIED: read from repo]
- `packages/ui/styles/theme.css` — Phase 1 baseline to extend [VERIFIED: read from repo]
- `packages/config/src/agency-constants.ts` — AGENCIES array, 12 slugs [VERIFIED: read from repo]

### Secondary (MEDIUM confidence)
- `storybook.js.org/docs/writing-tests/visual-testing` — Chromatic integration [VERIFIED: fetched 2026-04-25]
- `storybook.js.org/docs/writing-tests/integrations/test-runner` — timeout + maxWorkers config [VERIFIED: fetched 2026-04-25]
- `maviklabs.com/blog/design-tokens-tailwind-v4-2026` — @theme inline bridge pattern [CITED: fetched 2026-04-25]
- `github.com/vercel/next.js/discussions/53063` — FOUC prevention inline script pattern [CITED: community discussion]

### Tertiary (LOW confidence — flag for validation)
- Storybook `@storybook/addon-themes withThemeByDataAttribute` API — verified existence but exact import path from addon docs not fetched [LOW]
- `jest-image-snapshot` compatibility with `@storybook/test-runner 0.24.3` — assumed compatible [LOW, A5]
- OKLCH browser support for all target browsers — assumed (all modern browsers as of 2023+) [LOW, A1]

---

## Metadata

**Confidence breakdown:**
- Token schema naming: HIGH — derived from verified Tailwind v4 docs + milestone-M004 spec
- Tailwind @theme integration: HIGH — verified against official docs
- AJV no-hex-literals schema: HIGH — AJV `not.pattern` is standard JSON Schema 7
- Storybook v9 setup: HIGH — version verified via npm; blog confirmed June 2025 release
- 12 niche palettes: MEDIUM — OKLCH values are illustrative; exact brand polish is a design decision
- FOUC prevention: MEDIUM — inline script pattern is community-verified but Next.js App Router specifics [ASSUMED partial]
- A/B framework: MEDIUM — data-attribute CSS pattern is verified; DB schema is implementation design

**Research date:** 2026-04-25
**Valid until:** 2026-07-25 (90 days — Tailwind/Storybook are fast-moving; re-verify Storybook version before Phase 8)
