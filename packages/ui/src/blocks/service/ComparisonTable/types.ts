export interface ComparisonRow {
  feature: string
  values: string[]
}

export interface ComparisonTableProps {
  headline: string
  headers: string[]
  rows: ComparisonRow[]
  className?: string
}
