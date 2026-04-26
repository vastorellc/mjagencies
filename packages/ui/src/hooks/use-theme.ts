// packages/ui/src/hooks/use-theme.ts
// Client hook: exposes { theme, setTheme, toggle } with localStorage persistence.
// REQ-045: setTheme uses setAttribute for INSTANT DOM update (< 16ms).
// REQ-046: dark mode toggle via token swap, no asset reload.
'use client';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mj-theme';

export function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Read DOM-truth (FOUC script set this) + localStorage as fallback
    const stored  = localStorage.getItem(STORAGE_KEY) as 'light' | 'dark' | null;
    const current = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null;
    setThemeState(stored ?? current ?? 'light');
  }, []);

  const setTheme = useCallback((next: 'light' | 'dark') => {
    document.documentElement.setAttribute('data-theme', next);  // INSTANT (REQ-045)
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  return { theme, setTheme, toggle } as const;
}
