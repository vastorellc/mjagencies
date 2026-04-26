export interface TestimonialItem {
  quote: string
  author: string
  role?: string
  company?: string
  avatarUrl?: string
  avatarAlt?: string
}

export interface TestimonialsSliderProps {
  testimonials: TestimonialItem[]
  disclaimer: string
  className?: string
}
