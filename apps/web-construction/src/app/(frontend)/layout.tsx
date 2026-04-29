import type { Metadata } from 'next'
import type React from 'react'

export const metadata: Metadata = {
  title: { default: 'MJ Construction Agency', template: `%s — MJ Construction Agency` },
  description: 'Construction marketing — bid pipelines, contractor SEO, residential and commercial growth.',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return <>{children}</>
}
