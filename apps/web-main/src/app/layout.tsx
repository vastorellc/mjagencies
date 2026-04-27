import type { ReactNode } from 'react'
import { getDataAttrs } from '@mjagency/ui'
import './globals.css'

/**
 * Root layout for apps/web-main.
 * Serves as the catch-all root for routes outside named route groups
 * (e.g., /sso, /auth/callback, /api/*).
 * Route groups (frontend) and (payload) define their own child layouts.
 *
 * FOUC prevention: synchronous inline script in <head> reads localStorage
 * and sets data-theme BEFORE first paint (REQ-046, RESEARCH §6.2).
 * CSP nonce wiring defers to Phase 11.
 *
 * suppressHydrationWarning: mandatory because the FOUC script mutates
 * data-theme before React hydrates (RESEARCH §6.2, Pitfall 3).
 *
 * M004: web-main is the brand agency. Phase 8 per-agency apps spread
 * real getDataAttrs(...) with their own agency slug here.
 */

const FOUC_SCRIPT = `(function(){try{var s=localStorage.getItem('mj-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',s||(d?'dark':'light'));}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  const attrs = getDataAttrs({ agency: 'brand' });

  return (
    <html suppressHydrationWarning lang="en" {...attrs}>
      <head>
        {/* FOUC prevention — must be FIRST in <head>, BEFORE any stylesheet links.
            CSP nonce wiring lands in Phase 11 — at M004 the script is unconditional inline. */}
        <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
