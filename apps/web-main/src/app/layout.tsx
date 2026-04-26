import type { ReactNode } from 'react'
import './globals.css'

/**
 * Root layout for apps/web-main.
 * Serves as the catch-all root for routes outside named route groups
 * (e.g., /sso, /auth/callback, /api/*).
 * Route groups (frontend) and (payload) define their own child layouts.
 */
export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
