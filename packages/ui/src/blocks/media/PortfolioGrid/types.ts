export interface PortfolioItem {
  title: string
  imageUrl: string
  imageAlt: string
  category?: string
  href?: string
}

export interface PortfolioGridProps {
  items: PortfolioItem[]
  columns?: 2 | 3
  className?: string
}
