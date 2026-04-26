/**
 * packages/ui/src/__tests__/compile-theme.test.ts
 * Unit tests for compileThemeToCss (Plan 04-03, Task 3.1).
 * REQ-043 — pure CSS cascade; Pitfall 8 — custom-css escape hatch.
 * 10 tests covering: output shape, token names, scope ordering, dark overlay,
 * custom-css escape hatch, assertValidTheme gate, determinism.
 */
import { describe, it, expect } from 'vitest';
import { compileThemeToCss } from '../theme/compile-theme.js';
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
      color:            { 'bg-primary': 'oklch(0.97 0.013 250)' },
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

describe('compileThemeToCss', () => {
  it('Test 1: Output starts with [data-agency="X"] {', () => {
    const theme = makeValidTheme();
    const css = compileThemeToCss({ agency: 'ecommerce', theme });
    const firstNonEmpty = css.split('\n').find(l => l.trim().length > 0);
    expect(firstNonEmpty).toBe('[data-agency="ecommerce"] {');
  });

  it('Test 2: Output closes scope block with }', () => {
    const theme = makeValidTheme();
    const css = compileThemeToCss({ agency: 'ecommerce', theme });
    // The first block close should be after the opening line
    const lines = css.split('\n');
    const openIdx = lines.findIndex(l => l.startsWith('[data-agency='));
    const closeIdx = lines.findIndex((l, i) => i > openIdx && l === '}');
    expect(closeIdx).toBeGreaterThan(openIdx);
  });

  it('Test 3: Token names use --mj-{scope}-{key} shape', () => {
    const theme = makeValidTheme();
    const css = compileThemeToCss({ agency: 'ecommerce', theme });
    // color scope with 'bg-primary' key → --mj-color-bg-primary
    expect(css).toContain('--mj-color-bg-primary: oklch(0.97 0.013 250);');
  });

  it('Test 4: All 18 non-skip scope keys are emitted (20 - custom-css - code-injection = 18)', () => {
    const theme = makeValidTheme();
    const css = compileThemeToCss({ agency: 'ecommerce', theme });
    // Count distinct scope prefixes (--mj-{scope}-)
    const scopePrefixes = new Set(
      [...css.matchAll(/--mj-([\w-]+)-/g)].map(m => m[1] ?? '')
    );
    // Expect at least 18 distinct scope prefixes
    expect(scopePrefixes.size).toBeGreaterThanOrEqual(18);
  });

  it('Test 5: custom-css and code-injection are NOT inside the [data-agency] block', () => {
    const theme = makeValidTheme();
    theme.scopes['custom-css'] = '.foo { color: oklch(0.5 0.1 200); }';
    const css = compileThemeToCss({ agency: 'ecommerce', theme });

    // Find first block close
    const lines = css.split('\n');
    const openIdx = lines.findIndex(l => l.startsWith('[data-agency="ecommerce"] {'));
    const closeIdx = lines.findIndex((l, i) => i > openIdx && l === '}');

    // .foo should appear AFTER the first closing }
    const fooIdx = lines.findIndex(l => l.includes('.foo'));
    expect(fooIdx).toBeGreaterThan(closeIdx);
  });

  it('Test 6: Empty custom-css does NOT emit a custom-css comment block', () => {
    const theme = makeValidTheme();
    theme.scopes['custom-css'] = '';
    const css = compileThemeToCss({ agency: 'ecommerce', theme });
    expect(css).not.toContain('/* custom-css for ecommerce');
  });

  it('Test 7: Dark overlay block is conditional', () => {
    const theme = makeValidTheme();
    // Without dark: no dark block
    const cssNoDark = compileThemeToCss({ agency: 'ecommerce', theme });
    expect(cssNoDark).not.toContain('[data-theme="dark"]');

    // With dark: dark block appears
    const themeWithDark: ThemeJson = {
      ...theme,
      dark: { color: { 'bg-primary': 'oklch(0.1 0.013 250)' } },
    };
    const cssDark = compileThemeToCss({ agency: 'ecommerce', theme: themeWithDark });
    expect(cssDark).toContain('[data-agency="ecommerce"][data-theme="dark"] {');
  });

  it('Test 8: assertValidTheme is invoked first — invalid theme throws validator error', () => {
    // Pass object missing `meta` — assertValidTheme should throw before any CSS generation
    const invalidTheme = { scopes: {} } as unknown as ThemeJson;
    expect(() =>
      compileThemeToCss({ agency: 'ecommerce', theme: invalidTheme })
    ).toThrow(/meta/i);
  });

  it('Test 9: Agency slug is interpolated literally', () => {
    const theme = makeValidTheme();
    const css = compileThemeToCss({ agency: 'ai', theme });
    expect(css).toContain('[data-agency="ai"]');
    expect(css).not.toContain('[data-agency="${agency}"]');
  });

  it('Test 10: Output is deterministic (byte-identical on repeated calls)', () => {
    const theme = makeValidTheme();
    const css1 = compileThemeToCss({ agency: 'ecommerce', theme });
    const css2 = compileThemeToCss({ agency: 'ecommerce', theme });
    expect(css1).toBe(css2);
  });
});
