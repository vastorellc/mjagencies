import type { Metadata } from 'next'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import type { ServerProps } from 'payload'

export async function generateMetadata({ params, searchParams }: ServerProps): Promise<Metadata> {
  const metadata = await generatePageMetadata({ params, searchParams })
  return metadata
}

export default async function Page({ params, searchParams }: ServerProps) {
  const pageData = await RootPage({ params, searchParams })
  return pageData
}
