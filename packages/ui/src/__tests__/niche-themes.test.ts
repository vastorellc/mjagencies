// packages/ui/src/__tests__/niche-themes.test.ts
// Integration tests for the 12 niche default themes.
// TDD: written before generate-agency-css.ts and agencies.generated.css exist.
// T-04-010 mitigation: Test 5 asserts NICHE_PALETTES TS source stays in sync with JSON.
// REQ-044 (12 themes), REQ-042 (20 scopes), REQ-046 (dark overlay), REQ-047 (OKLCH-only).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENCIES } from '@mjagency/config';
import { assertValidTheme } from '../theme/validate-theme.js';
import { NICHE_PALETTES } from '../theme/niche-palettes.js';
import type { ThemeJson } from '../theme/types.js';

// __tests__ lives at packages/ui/src/__tests__/; themes live at packages/ui/themes/default/
const __dirname = dirname(fileURLToPath(import.meta.url));
const THEMES_DIR = join(__dirname, '../../themes/default');
const ALL_SCOPE_KEYS = [
  'brand', 'color', 'type', 'spacing', 'layout', 'components',
  'header', 'footer', 'hero', 'blocks', 'templates', 'motion',
  'icons', 'imagery', 'theme', 'a11y', 'perf', 'seo-defaults',
  'custom-css', 'code-injection',
] as const;

function readTheme(agency: string): unknown {
  const file = join(THEMES_DIR, `theme-${agency}.json`);
  return JSON.parse(readFileSync(file, 'utf-8'));
}

describe('Niche default themes (12 × OKLCH)', () => {
  it('Test 1: All 12 theme files exist on disk', () => {
    for (const agency of AGENCIES) {
      const file = join(THEMES_DIR, `theme-${agency}.json`);
      expect(existsSync(file), `theme-${agency}.json must exist on disk`).toBe(true);
    }
  });

  it('Test 2: Every theme parses as valid JSON and passes assertValidTheme', () => {
    for (const agency of AGENCIES) {
      const data = readTheme(agency);
      expect(() => assertValidTheme(data, `theme-${agency}.json`)).not.toThrow();
    }
  });

  it('Test 3: meta.slug matches filename (slug === agency)', () => {
    for (const agency of AGENCIES) {
      const theme = readTheme(agency) as ThemeJson;
      assertValidTheme(theme, `theme-${agency}.json`);
      expect(theme.meta.slug).toBe(agency);
    }
  });

  it('Test 4: meta.niche matches AGENCIES enum (niche === agency at M004)', () => {
    for (const agency of AGENCIES) {
      const theme = readTheme(agency) as ThemeJson;
      assertValidTheme(theme, `theme-${agency}.json`);
      expect(theme.meta.niche).toBe(agency);
    }
  });

  it('Test 5: scopes.color.brand-500 matches NICHE_PALETTES[agency].primary500 (T-04-010 drift guard)', () => {
    for (const agency of AGENCIES) {
      const theme = readTheme(agency) as ThemeJson;
      assertValidTheme(theme, `theme-${agency}.json`);
      const expected = NICHE_PALETTES[agency].primary500;
      const actual   = (theme.scopes.color as Record<string, string>)['brand-500'];
      expect(actual, `theme-${agency}.json color.brand-500 must match NICHE_PALETTES.primary500`).toBe(expected);
    }
  });

  it('Test 6: All 20 scopes are present in every theme', () => {
    for (const agency of AGENCIES) {
      const theme = readTheme(agency) as ThemeJson;
      assertValidTheme(theme, `theme-${agency}.json`);
      for (const key of ALL_SCOPE_KEYS) {
        expect(
          Object.prototype.hasOwnProperty.call(theme.scopes, key),
          `theme-${agency}.json must have scope "${key}"`,
        ).toBe(true);
      }
    }
  });

  it('Test 7: dark overlay has color block with at least 5 keys (REQ-046)', () => {
    for (const agency of AGENCIES) {
      const theme = readTheme(agency) as ThemeJson;
      assertValidTheme(theme, `theme-${agency}.json`);
      expect(theme.dark, `theme-${agency}.json must have a dark overlay`).toBeDefined();
      const darkOverlay = theme.dark as Record<string, Record<string, string>>;
      const darkColor   = darkOverlay['color'];
      expect(darkColor, `theme-${agency}.json dark.color must be defined`).toBeDefined();
      // Narrow after expect — darkColor is defined at this point
      const darkColorKeys = Object.keys(darkColor ?? {});
      expect(
        darkColorKeys.length,
        `theme-${agency}.json dark.color must have at least 5 keys`,
      ).toBeGreaterThanOrEqual(5);
    }
  });

  it('Test 8: No two themes share the same meta.slug (no duplicates)', () => {
    const slugs = AGENCIES.map(agency => {
      const theme = readTheme(agency) as ThemeJson;
      assertValidTheme(theme, `theme-${agency}.json`);
      return theme.meta.slug;
    });
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(12);
  });
});
