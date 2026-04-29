import type { Metadata } from 'next'
import type React from 'react'

export const metadata: Metadata = {
  title: { default: 'MJ Spa Agency', template: `%s — MJ Spa Agency` },
  description: 'Spa and wellness marketing — membership growth, treatment packages, and retention for day spas, med spas, and salons.',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return <>{children}</>
}
