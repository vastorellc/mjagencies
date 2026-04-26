export interface FeatureListItem {
  title: string
  description: string
  included: boolean
}

export interface FeatureListProps {
  headline: string
  features: FeatureListItem[]
  className?: string
}
