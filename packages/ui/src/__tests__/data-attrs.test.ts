/**
 * packages/ui/src/__tests__/data-attrs.test.ts
 * Unit tests for getDataAttrs (Plan 04-03, Task 3.1).
 * REQ-043 — Edge-safe SSR helper returning the 5-layer data-* prop bag for <html>.
 * 3 tests covering: default theme, all 4 attrs, omission of unset optionals.
 */
import { describe, it, expect } from 'vitest';
import { getDataAttrs } from '../theme/data-attrs.js';

describe('getDataAttrs', () => {
  it('Test 16: Default theme is light', () => {
    const attrs = getDataAttrs({ agency: 'x' });
    expect(attrs['data-agency']).toBe('x');
    expect(attrs['data-theme']).toBe('light');
  });

  it('Test 17: All 4 attrs present when full input provided', () => {
    const attrs = getDataAttrs({
      agency:  'ecommerce',
      page:    'home',
      theme:   'dark',
      variant: 'b',
    });
    expect(attrs['data-agency']).toBe('ecommerce');
    expect(attrs['data-theme']).toBe('dark');
    expect(attrs['data-page']).toBe('home');
    expect(attrs['data-variant']).toBe('b');
  });

  it('Test 18: Unset optional fields are omitted (no data-page or data-variant keys)', () => {
    const attrs = getDataAttrs({ agency: 'brand' });
    expect(Object.keys(attrs)).not.toContain('data-page');
    expect(Object.keys(attrs)).not.toContain('data-variant');
    // Exactly 2 keys: data-agency + data-theme
    expect(Object.keys(attrs).length).toBe(2);
  });
});
