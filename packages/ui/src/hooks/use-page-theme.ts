// packages/ui/src/hooks/use-page-theme.ts
// Client hook: Layer 3 page-level override in the CSS cascade.
// REQ-043: setPageTheme toggles data-page on <html> for page-scope overrides.
'use client';
import { useCallback, useEffect, useState } from 'react';

export function usePageTheme() {
  const [page, setPageState] = useState<string | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-page');
    setPageState(current);
  }, []);

  const setPageTheme = useCallback((next: string | null) => {
    if (next === null) {
      document.documentElement.removeAttribute('data-page');
    } else {
      document.documentElement.setAttribute('data-page', next);  // INSTANT
    }
    setPageState(next);
  }, []);

  return { page, setPageTheme } as const;
}
