// packages/ui/src/theme/types.ts
// Full schema-derived TypeScript types for MJAgency theme.json.
// Replaces the Plan 04-01 stub — consumed by Plan 04-02 (AJV validator),
// Plan 04-03 (theme compiler), and Plan 04-04 (12 niche themes).
// REQ-040 (6-layer token schema), REQ-041 (ThemeJson interface), REQ-042 (20 scopes).

export type MjThemeLayer =
  | 'primitive'
  | 'semantic'
  | 'typography'
  | 'layout'
  | 'effects'
  | 'component';

export type MjColorToken =
  | '--mj-color-bg-primary'
  | '--mj-color-bg-secondary'
  | '--mj-color-bg-inverse'
  | '--mj-color-text-primary'
  | '--mj-color-text-secondary'
  | '--mj-color-text-inverse'
  | '--mj-color-text-link'
  | '--mj-color-border-default'
  | '--mj-color-border-subtle'
  | '--mj-color-border-focus'
  | '--mj-color-brand-50'
  | '--mj-color-brand-500'
  | '--mj-color-brand-900'
  | '--mj-color-accent-primary'
  | '--mj-color-accent-secondary'
  | '--mj-color-success'
  | '--mj-color-warning'
  | '--mj-color-error'
  | '--mj-color-info';

export interface ThemeTokenValue {
  /** Must be var(--mj-*) or a raw CSS value — no hex literals */
  value: string;
  layer: MjThemeLayer;
}

/** All 20 customization scopes (RESEARCH §4) */
export type ScopeKey =
  | 'brand' | 'color' | 'type' | 'spacing' | 'layout' | 'components'
  | 'header' | 'footer' | 'hero' | 'blocks' | 'templates' | 'motion'
  | 'icons' | 'imagery' | 'theme' | 'a11y' | 'perf' | 'seo-defaults'
  | 'custom-css' | 'code-injection';

export type AgencyNiche =
  | 'brand' | 'ecommerce' | 'growth' | 'webdev' | 'ai' | 'branding'
  | 'strategy' | 'finance' | 'engineering' | 'product' | 'video' | 'graphic';

export interface ThemeMeta {
  slug:         string;
  name:         string;
  niche:        AgencyNiche;
  version:      string;
  description?: string;
}

export interface CodeInjectionScope {
  head?:         string;
  'body-start'?: string;
  'body-end'?:   string;
}

/** Generic scope = key/value map of token names to CSS values */
export type ThemeScope = Record<string, string>;

export interface ThemeScopes {
  brand:            ThemeScope;
  color:            ThemeScope;
  type:             ThemeScope;
  spacing:          ThemeScope;
  layout:           ThemeScope;
  components:       ThemeScope;
  header:           ThemeScope;
  footer:           ThemeScope;
  hero:             ThemeScope;
  blocks:           ThemeScope;
  templates:        ThemeScope;
  motion:           ThemeScope;
  icons:            ThemeScope;
  imagery:          ThemeScope;
  theme:            ThemeScope;
  a11y:             ThemeScope;
  perf:             ThemeScope;
  'seo-defaults':   ThemeScope;
  'custom-css':     string;             // free-form CSS string (admin-only)
  'code-injection': CodeInjectionScope;
}

/** Dark mode is a partial overlay — only flips what it specifies (RESEARCH §6.1) */
export type ThemeDarkOverrides = Partial<Record<ScopeKey, ThemeScope>>;

export interface ThemeJson {
  $schema?: string;          // optional path to theme.schema.json
  meta:     ThemeMeta;
  scopes:   ThemeScopes;
  dark?:    ThemeDarkOverrides;
}
