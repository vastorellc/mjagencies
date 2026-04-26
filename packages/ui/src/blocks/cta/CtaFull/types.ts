export interface CtaLink {
  text: string
  href: string
}

export interface CtaFullProps {
  headline: string
  subheadline?: string
  primaryCta: CtaLink
  secondaryCta?: CtaLink
  className?: string
}
