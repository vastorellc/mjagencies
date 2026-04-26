import type { ReactNode } from 'react'

export interface ThreeColumnItem {
  content: ReactNode
}

export interface ThreeColumnProps {
  columns: ThreeColumnItem[]
  className?: string
}
