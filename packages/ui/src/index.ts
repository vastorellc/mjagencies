// @mjagency/ui — shared design system package
// Phase 4 (Plan 04-01): 6-layer CSS token schema + Tailwind v4 @theme inline bridge.
// Phase 4 (Plan 04-02): AJV theme.json validator + SVG hex scanner + full ThemeJson type.
// Phase 4 (Plan 04-03): Theme resolution stack (resolveTheme + compileThemeToCss + getDataAttrs).
// Phase 4 (Plan 04-04): 12 niche default themes — NICHE_PALETTES + NICHE_FONTS single TS source.
// Plans 04-05 (Storybook) extends from this foundation. Keep exports granular for tree-shaking.

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
