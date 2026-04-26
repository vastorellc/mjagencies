// @mjagency/ui — shared design system package
// Phase 4 (Plan 04-01): 6-layer CSS token schema + Tailwind v4 @theme inline bridge.
// Plans 04-02 (validator), 04-03 (resolution stack), 04-04 (12 niche themes), 04-05 (Storybook)
// all extend from this foundation. Keep exports granular for clean tree-shaking.

export type { MjColorToken, MjThemeLayer, ThemeTokenValue, ThemeJson } from './theme/types.js';
