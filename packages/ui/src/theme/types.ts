// packages/ui/src/theme/types.ts
// TypeScript types for the 6-layer CSS token schema.
// Used by Plan 04-02 (AJV validator) and Plan 04-04 (12 niche themes).
// REQ-040 — 6-layer token schema.

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

/** Stub — Plan 04-02 fills the full ThemeJson interface from theme.schema.json */
export interface ThemeJson {
  meta: {
    slug: string;
    name: string;
    niche: string;
    version: string;
    description?: string;
  };
  scopes: Record<string, unknown>;
  dark?: Record<string, unknown>;
}
