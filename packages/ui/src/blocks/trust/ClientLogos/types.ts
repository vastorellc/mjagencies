export interface ClientLogo {
  imageUrl: string
  imageAlt: string
  href?: string
}

export interface ClientLogosProps {
  headline?: string
  logos: ClientLogo[]
  className?: string
}
