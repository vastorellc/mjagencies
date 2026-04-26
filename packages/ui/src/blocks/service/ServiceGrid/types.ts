export interface ServiceGridItem {
  title: string
  description: string
  iconUrl?: string
  iconAlt?: string
  href?: string
}

export interface ServiceGridProps {
  items: ServiceGridItem[]
  columns?: 2 | 3
  className?: string
}
