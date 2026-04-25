import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'MJAgency Platform — E-Commerce',
  description:
    'The MJAgency multi-brand platform: 12 agency verticals — ecommerce, growth, webdev, AI, branding, strategy, finance, engineering, product, video, and graphic — all in one place.',
}

export default function FrontendLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
