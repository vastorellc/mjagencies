export interface TestimonialItem {
  quote: string
  author: string
  role?: string
  company?: string
  avatarUrl?: string
  avatarAlt?: string
}

export interface TestimonialsGridProps {
  testimonials: TestimonialItem[]
  disclaimer: string
  className?: string
}
