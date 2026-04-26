/**
 * packages/ui/src/__tests__/use-theme.test.ts
 * Unit tests for useTheme hook (Plan 04-03, Task 3.2).
 * REQ-045 (theme switch < 16ms via setAttribute), REQ-046 (dark mode via token swap).
 * 5 tests: localStorage read, DOM fallback, setTheme persistence, toggle, default.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../hooks/use-theme.js';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('useTheme', () => {
  it('Test 1: Initial render reads localStorage', async () => {
    localStorage.setItem('mj-theme', 'dark');
    const { result } = renderHook(() => useTheme());
    // Wait for useEffect to run
    await act(async () => {});
    expect(result.current.theme).toBe('dark');
  });

  it('Test 2: Initial render falls back to <html data-theme> attr if localStorage empty', async () => {
    localStorage.clear();
    document.documentElement.setAttribute('data-theme', 'dark');
    const { result } = renderHook(() => useTheme());
    await act(async () => {});
    expect(result.current.theme).toBe('dark');
  });

  it('Test 3: setTheme updates DOM AND localStorage', async () => {
    const { result } = renderHook(() => useTheme());
    await act(async () => {
      result.current.setTheme('dark');
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('mj-theme')).toBe('dark');
    expect(result.current.theme).toBe('dark');
  });

  it('Test 4: toggle alternates light ↔ dark', async () => {
    const { result } = renderHook(() => useTheme());
    await act(async () => {});
    // Initial state is 'light' (nothing set)
    await act(async () => {
      result.current.toggle();
    });
    expect(result.current.theme).toBe('dark');
    await act(async () => {
      result.current.toggle();
    });
    expect(result.current.theme).toBe('light');
  });

  it('Test 5: Default is light when nothing is set', async () => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    const { result } = renderHook(() => useTheme());
    await act(async () => {});
    expect(result.current.theme).toBe('light');
  });
});
