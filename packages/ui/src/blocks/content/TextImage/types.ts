import type { ReactNode } from 'react'

export interface TextImageProps {
  imageUrl: string
  imageAlt: string
  imageBlurHash?: string
  headline: string
  body: ReactNode
  imagePosition?: 'left' | 'right'
  className?: string
}
