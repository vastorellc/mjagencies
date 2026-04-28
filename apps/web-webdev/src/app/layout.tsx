import type { ReactNode } from 'react'
import { getDataAttrs } from '@mjagency/ui'
import './globals.css'

const FOUC_SCRIPT = `(function(){try{var s=localStorage.getItem('mj-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',s||(d?'dark':'light'));}catch(e){}})();`

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  const attrs = getDataAttrs({ agency: 'webdev' })
  return (
    <html suppressHydrationWarning lang="en" {...attrs}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
