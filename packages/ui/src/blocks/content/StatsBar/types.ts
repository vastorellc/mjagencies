export interface StatItem {
  value: string
  label: string
  source?: string
}

export interface StatsBarProps {
  stats: StatItem[]
  className?: string
}
