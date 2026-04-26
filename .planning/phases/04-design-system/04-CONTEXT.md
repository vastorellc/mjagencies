# Phase 4: Design System + Theme Engine - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning
**Mode:** Auto-generated (workflow.skip_discuss=true)

<domain>
## Phase Boundary

6-layer CSS variable tokens, theme.json validator, 12 niche default themes, dark mode via token swap, A/B framework.

**Success criteria (from ROADMAP):**
1. Theme switch is instant (<16ms) via CSS variable update
2. All 12 niche default themes render correctly (one per agency)
3. Token validator rejects hex literals in SVG illustrations
4. Dark mode works on all 12 agencies via token swap (no asset reload)
5. Storybook visual regression CI passes for 45 blocks × 12 themes

**Requirements covered:** REQ-040, REQ-041, REQ-042, REQ-043, REQ-044, REQ-045, REQ-046, REQ-047, REQ-048

**Plan stubs from ROADMAP:**
- 04-01: CSS variable token schema — all 6 layers
- 04-02: `theme.json` manifest + JSON Schema validator (rejects hex literals)
- 04-03: Theme resolution stack — base → agency → page (20 customization scopes per agency)
- 04-04: 12 niche default themes pre-built (one per agency)
- 04-05: A/B test framework + marketplace stub + Storybook visual-regression CI

</domain>

<decisions>
## Implementation Decisions

### 6 token layers (locked from mjagency/ specs)
1. **Color** — palette, semantic colors (text, background, border, accent), state colors
2. **Typography** — font families, scales, weights, line heights, tracking
3. **Spacing** — 8px-grid scale, container widths, gaps
4. **Layout** — grid columns, breakpoints, max-widths
5. **Effects** — shadows, blurs, transitions, animations
6. **Components** — button variants, card variants, form-field variants (composed from layers 1-5)

### Locked from prior phases
- `packages/ui` exists from Phase 1 with `theme.css` baseline — extend, don't replace
- 12 agency slugs from `@mjagency/config` AGENCIES const drive the 12 niche themes
- Tailwind 4 (or whatever Phase 1 set up) — verify theme injection is via CSS variables, not Tailwind config

### Claude's Discretion
- Specific CSS variable naming convention (`--mj-color-*` vs `--color-*`)
- Storybook addon choice for visual regression (Chromatic vs Loki vs Playwright snapshots)
- A/B framework backbone (custom vs GrowthBook vs Vercel Edge Config)
- Marketplace stub format (just types + interfaces vs minimal API)

### Open Q at planning time
- 20 customization scopes per agency: which 20? Likely (a) global theme override, (b) per-page hero variant, (c) per-block variant, (d) dark/light, (e) seasonal, (f-t) the rest. Researcher to enumerate from mjagency/specs if present.

</decisions>

<canonical_refs>
## Canonical References

### Phase 1 outputs
- `packages/ui/styles/theme.css` — baseline CSS to extend
- `packages/ui/package.json` — dependency surface
- `packages/config/src/agency-constants.ts` — `AGENCIES` const drives the 12 themes

### Phase 3 outputs (auth context for theme picker)
- `packages/auth/src/middleware.ts` — agency-from-host header injection (theme picker reads `x-agency-id`)

### Project doctrine
- `mjagency/specs/design-system.md` (when present) — 6-layer token schema source-of-truth
- `mjagency/CLAUDE.md` — design rules

</canonical_refs>

<specifics>
## Specific Ideas

- Theme.json schema validates: all required tokens present, no hex literals (force CSS var refs), value types match (e.g., spacing is a number, not a string)
- Dark mode via `[data-theme="dark"]` attribute toggle on `<html>` — instant, no flash
- Storybook visual regression: 45 blocks × 12 themes = 540 stories. Use snapshot diffing with diff threshold to avoid flakiness on font rendering.
- A/B framework: variant-aware token override — `[data-variant="b"]` overrides specific tokens for the variant only

</specifics>

<deferred>
## Deferred Ideas

- Custom theme builder UI (deferred to M010 builder phase)
- Per-user theme overrides (defer to post-launch)
- Right-to-left layouts (defer to M011)
- Reduced-motion auto-detect at theme level (M011)

</deferred>

---

*Phase: 04-design-system*
*Context auto-generated: 2026-04-26 via workflow.skip_discuss=true*
