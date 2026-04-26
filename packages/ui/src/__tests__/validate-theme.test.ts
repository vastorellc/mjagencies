/**
 * packages/ui/src/__tests__/validate-theme.test.ts
 * AJV validator unit tests for theme.json schema validation.
 * Tests cover: valid/invalid themes, scope enforcement, hex/url rejection.
 * REQ-041, REQ-042, REQ-047 — RESEARCH §2.2, §2.3
 */
import { describe, it, expect } from 'vitest';
import { assertValidTheme } from '../theme/validate-theme.js';
import type { ThemeJson } from '../theme/types.js';

/** Factory: builds a minimum valid theme with all 20 scopes. */
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
      'custom-css':     '/* no custom css */',
      'code-injection': {},
    },
  };
}

describe('assertValidTheme', () => {
  it('Test 1: valid theme passes', () => {
    expect(() => assertValidTheme(makeValidTheme(), 'test.json')).not.toThrow();
  });

  it('Test 2: missing meta fails', () => {
    const theme = makeValidTheme() as unknown as Record<string, unknown>;
    delete theme['meta'];
    expect(() => assertValidTheme(theme, 'test.json')).toThrow(/meta/i);
  });

  it('Test 3: missing scope fails', () => {
    const theme = makeValidTheme();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (theme.scopes as any)['icons'];
    expect(() => assertValidTheme(theme, 'test.json')).toThrow(/icons/i);
  });

  it('Test 4: invalid niche enum fails', () => {
    const theme = makeValidTheme();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (theme.meta as any)['niche'] = 'invalid';
    expect(() => assertValidTheme(theme, 'test.json')).toThrow(/enum/i);
  });

  it('Test 5: invalid version pattern fails', () => {
    const theme = makeValidTheme();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (theme.meta as any)['version'] = '1.0';
    expect(() => assertValidTheme(theme, 'test.json')).toThrow();
  });

  it('Test 6: invalid slug pattern fails', () => {
    const theme = makeValidTheme();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (theme.meta as any)['slug'] = 'My Slug';
    expect(() => assertValidTheme(theme, 'test.json')).toThrow();
  });

  it('Test 7: hex literal in color scope fails', () => {
    const theme = makeValidTheme();
    theme.scopes.color['bg-primary'] = '#ffffff';
    expect(() => assertValidTheme(theme, 'test.json')).toThrow();
  });

  it('Test 8: hex literal in brand scope fails', () => {
    const theme = makeValidTheme();
    theme.scopes.brand['primary'] = '#ff6600';
    expect(() => assertValidTheme(theme, 'test.json')).toThrow();
  });

  it('Test 9: url() in color scope fails (SSRF block)', () => {
    const theme = makeValidTheme();
    theme.scopes.color['bg-primary'] = 'url(data:image/svg+xml,...)';
    expect(() => assertValidTheme(theme, 'test.json')).toThrow();
  });

  it('Test 10: url() in imagery scope PASSES (legitimate use)', () => {
    const theme = makeValidTheme();
    theme.scopes.imagery['hero-bg'] = 'url(/cdn/hero.jpg)';
    expect(() => assertValidTheme(theme, 'test.json')).not.toThrow();
  });

  it('Test 11: OKLCH value passes', () => {
    const theme = makeValidTheme();
    theme.scopes.color['bg-primary'] = 'oklch(0.97 0.013 250)';
    expect(() => assertValidTheme(theme, 'test.json')).not.toThrow();
  });

  it('Test 12: var() reference passes', () => {
    const theme = makeValidTheme();
    theme.scopes.color['bg-primary'] = 'var(--mj-primitive-blue-50)';
    expect(() => assertValidTheme(theme, 'test.json')).not.toThrow();
  });

  it('Test 13: additional property at top level fails', () => {
    const theme = makeValidTheme() as unknown as Record<string, unknown>;
    theme['unknownKey'] = 'unexpected-value';
    expect(() => assertValidTheme(theme, 'test.json')).toThrow();
  });

  it('Test 14: type assertion narrows unknown to ThemeJson correctly', () => {
    const unknownData: unknown = makeValidTheme();
    assertValidTheme(unknownData, 'test.json');
    // If TS compilation succeeds (narrowing worked), accessing .meta.slug is valid
    expect(unknownData.meta.slug).toBe('test-theme');
  });
});
