// @mjagency/ui — shared design system package
// Phase 4 (Plan 04-01): 6-layer CSS token schema + Tailwind v4 @theme inline bridge.
// Phase 4 (Plan 04-02): AJV theme.json validator + SVG hex scanner + full ThemeJson type.
// Plans 04-03 (resolution stack), 04-04 (12 niche themes), 04-05 (Storybook)
// all extend from this foundation. Keep exports granular for clean tree-shaking.

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
