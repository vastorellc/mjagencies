export interface Award {
  name: string
  imageUrl: string
  imageAlt: string
  year?: string
}

export interface AwardsBarProps {
  awards: Award[]
  className?: string
}
