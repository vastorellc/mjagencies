export interface PricingPlan {
  name: string
  price: string
  period?: string
  features: string[]
  ctaText: string
  ctaHref: string
  highlighted?: boolean
}

export interface PricingTableProps {
  plans: PricingPlan[]
  className?: string
}
