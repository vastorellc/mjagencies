/**
 * packages/ui/src/__tests__/resolve-theme.test.ts
 * Unit tests for resolveTheme (Plan 04-03, Task 3.1).
 * REQ-043 — server-side theme resolution; M004 filesystem-only.
 * 5 tests covering: valid resolution, default attrs, optional attrs, missing file, invalid fixture.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveTheme } from '../theme/resolve-theme.js';
import type { ThemeJson } from '../theme/types.js';

/** Factory: builds a minimum valid theme with all 20 scopes populated. */
function makeValidTheme(): ThemeJson {
  const scope = { token: 'var(--mj-color-bg-primary)' };
  return {
    meta: {
      slug:        'test-theme',
      name:        'Test Theme',
      niche:       'brand',
      version:     '1.0.0',
      description: 'A test theme',
    },
    scopes: {
      brand:            { ...scope },
      color:            { ...scope },
      type:             { ...scope },
      spacing:          { ...scope },
      layout:           { ...scope },
      components:       { ...scope },
      header:           { ...scope },
      footer:           { ...scope },
      hero:             { ...scope },
      blocks:           { ...scope },
      templates:        { ...scope },
      motion:           { ...scope },
      icons:            { ...scope },
      imagery:          { ...scope },
      theme:            { ...scope },
      a11y:             { ...scope },
      perf:             { ...scope },
      'seo-defaults':   { ...scope },
      'custom-css':     '',
      'code-injection': {},
    },
  };
}

let tempDir: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'mj-test-themes-'));
  // Write a valid fixture
  writeFileSync(
    join(tempDir, 'theme-test.json'),
    JSON.stringify(makeValidTheme(), null, 2),
    'utf-8',
  );
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('resolveTheme', () => {
  it('Test 11: resolveTheme returns valid ThemeResolution', () => {
    const result = resolveTheme({ agency: 'test', themesDir: tempDir });
    expect(result).toHaveProperty('theme');
    expect(result).toHaveProperty('dataAttrs');
    expect(result.theme.meta.slug).toBe('test-theme');
  });

  it('Test 12: dataAttrs always include data-agency and data-theme (defaults to light)', () => {
    const result = resolveTheme({ agency: 'test', themesDir: tempDir });
    expect(result.dataAttrs['data-agency']).toBe('test');
    expect(result.dataAttrs['data-theme']).toBe('light');
  });

  it('Test 13: dataAttrs include data-page and data-variant when provided', () => {
    const result = resolveTheme({
      agency:   'test',
      page:     'home',
      variant:  'b',
      theme:    'dark',
      themesDir: tempDir,
    });
    expect(result.dataAttrs['data-page']).toBe('home');
    expect(result.dataAttrs['data-variant']).toBe('b');
    expect(result.dataAttrs['data-theme']).toBe('dark');
  });

  it('Test 14: resolveTheme throws helpful error if agency theme.json is missing', () => {
    expect(() =>
      resolveTheme({ agency: 'nonexistent-agency', themesDir: tempDir })
    ).toThrow(/nonexistent-agency/);
  });

  it('Test 15: resolveTheme runs assertValidTheme on the loaded file', () => {
    // Write an invalid fixture (missing meta)
    writeFileSync(
      join(tempDir, 'theme-invalid.json'),
      JSON.stringify({ scopes: {} }),
      'utf-8',
    );
    expect(() =>
      resolveTheme({ agency: 'invalid', themesDir: tempDir })
    ).toThrow(/meta/i);
  });
});
