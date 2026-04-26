/**
 * packages/ui/src/__tests__/use-page-theme.test.ts
 * Unit tests for usePageTheme hook (Plan 04-03, Task 3.2).
 * REQ-043: Layer 3 page-level override in pure CSS cascade.
 * 3 tests: setPageTheme sets data-page, null removes it, mounts from DOM truth.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageTheme } from '../hooks/use-page-theme.js';

beforeEach(() => {
  document.documentElement.removeAttribute('data-page');
});

describe('usePageTheme', () => {
  it('Test 6: setPageTheme(name) sets data-page on html', async () => {
    const { result } = renderHook(() => usePageTheme());
    await act(async () => {
      result.current.setPageTheme('home');
    });
    expect(document.documentElement.getAttribute('data-page')).toBe('home');
  });

  it('Test 7: setPageTheme(null) removes data-page attribute', async () => {
    document.documentElement.setAttribute('data-page', 'home');
    const { result } = renderHook(() => usePageTheme());
    await act(async () => {
      result.current.setPageTheme(null);
    });
    expect(document.documentElement.hasAttribute('data-page')).toBe(false);
  });

  it('Test 8: page state reflects DOM truth on mount', async () => {
    document.documentElement.setAttribute('data-page', 'checkout');
    const { result } = renderHook(() => usePageTheme());
    await act(async () => {});
    expect(result.current.page).toBe('checkout');
  });
});
