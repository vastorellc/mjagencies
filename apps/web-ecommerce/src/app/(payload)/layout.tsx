import type { ReactNode } from 'react'
import './custom.scss'

export default function PayloadLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
