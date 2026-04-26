export interface TeamMember {
  name: string
  role: string
  bio?: string
  imageUrl?: string
  imageAlt?: string
  linkedIn?: string
}

export interface TeamGridProps {
  members: TeamMember[]
  className?: string
}
