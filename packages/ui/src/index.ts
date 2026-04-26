// @mjagency/ui — shared design system package
// Phase 4 (Plan 04-01): 6-layer CSS token schema + Tailwind v4 @theme inline bridge.
// Phase 4 (Plan 04-02): AJV theme.json validator + SVG hex scanner + full ThemeJson type.
// Phase 4 (Plan 04-03): Theme resolution stack (resolveTheme + compileThemeToCss + getDataAttrs).
// Phase 4 (Plan 04-04): 12 niche default themes — NICHE_PALETTES + NICHE_FONTS single TS source.
// Phase 4 (Plan 04-05): A/B framework types + marketplace stub + Storybook v9.1.20 harness.
// Keep exports granular for tree-shaking.

export type {
  MjColorToken,
  MjThemeLayer,
  ThemeTokenValue,
  ScopeKey,
  AgencyNiche,
  ThemeMeta,
  CodeInjectionScope,
  ThemeScope,
  ThemeScopes,
  ThemeDarkOverrides,
  ThemeJson,
} from './theme/types.js';

export { assertValidTheme, assertNoHexLiterals } from './theme/validate-theme.js';

export { compileThemeToCss } from './theme/compile-theme.js';
export { resolveTheme, type ThemeResolution, type ThemeResolutionInput } from './theme/resolve-theme.js';
export { getDataAttrs, type DataAttrsInput } from './theme/data-attrs.js';

export { useTheme } from './hooks/use-theme.js';
export { usePageTheme } from './hooks/use-page-theme.js';

export { NICHE_PALETTES, type NichePalette } from './theme/niche-palettes.js';
export { NICHE_FONTS,    type NicheFontStack } from './theme/font-stacks.js';

// Plan 04-05: A/B framework (types-only at M004; Phase 9 swaps noopAbAdapter; Phase 11 swaps assignVariant)
export type { AbVariant, AbAssignment, AbExperimentConfig } from './theme/ab-types.js';
export { assignVariant, resolveVariantFromCookie } from './theme/ab-assignment.js';
export { type AbAnalyticsAdapter, noopAbAdapter } from './theme/ab-analytics-hook.js';

// Plan 04-05: Marketplace stub (types-only at M004; M010 implements the service)
export type { MarketplaceTheme, ThemeMarketplaceQuery, ThemeMarketplacePage, ThemeMarketplaceService } from './marketplace/types.js';
export { marketplaceStub } from './marketplace/stub.js';
