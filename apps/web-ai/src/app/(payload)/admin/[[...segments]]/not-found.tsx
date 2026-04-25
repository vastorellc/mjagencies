import { NotFoundPage } from '@payloadcms/next/views'
import type { ReactNode } from 'react'

export default async function NotFound(): Promise<ReactNode> {
  return NotFoundPage({})
}
