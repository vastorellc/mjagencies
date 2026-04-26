import type { ReactNode } from 'react'

export interface TwoColumnProps {
  leftContent: ReactNode
  rightContent: ReactNode
  gap?: string
  className?: string
}
