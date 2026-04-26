// packages/ui/src/theme/resolve-theme.ts
// M004: filesystem read. M005+: DB-backed via agency_themes table.
// REQ-043 — base → agency → page; dark + variant attached as orthogonal layers.
import 'server-only';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { assertValidTheme } from './validate-theme.js';
import type { ThemeJson } from './types.js';

export interface ThemeResolutionInput {
  agency:   string;
  page?:    string;
  theme?:   'light' | 'dark';
  variant?: 'a' | 'b';
  themesDir?: string;  // override for tests; defaults to packages/ui/themes/default
}

export interface ThemeResolution {
  theme:     ThemeJson;
  dataAttrs: Record<string, string>;
}

const DEFAULT_THEMES_DIR = 'packages/ui/themes/default';

/**
 * Resolve the active theme + Layer-1..5 data-attrs for SSR injection.
 * REQ-043 — base → agency → page; dark + variant attached as orthogonal layers.
 * M004: filesystem read. M005: DB read with filesystem fallback.
 * Throws a HELPFUL error (mentioning file path + Plan 04-04) if theme.json is missing.
 */
export function resolveTheme(input: ThemeResolutionInput): ThemeResolution {
  const themesDir = input.themesDir ?? DEFAULT_THEMES_DIR;
  const file = join(themesDir, `theme-${input.agency}.json`);
  if (!existsSync(file)) {
    throw new Error(`No theme.json for agency "${input.agency}" at ${file}. ` +
                    `Plan 04-04 ships 12 default themes; verify the slug matches AGENCIES const.`);
  }

  const data = JSON.parse(readFileSync(file, 'utf-8'));
  assertValidTheme(data, `theme-${input.agency}.json`);

  const dataAttrs: Record<string, string> = {
    'data-agency':  input.agency,
    'data-theme':   input.theme   ?? 'light',
  };
  if (input.page)    dataAttrs['data-page']    = input.page;
  if (input.variant) dataAttrs['data-variant'] = input.variant;

  return { theme: data, dataAttrs };
}
