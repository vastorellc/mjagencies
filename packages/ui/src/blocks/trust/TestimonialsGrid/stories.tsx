import type { Meta, StoryObj } from '@storybook/react'
import { TestimonialsGrid } from './index.js'

const meta: Meta<typeof TestimonialsGrid> = {
  title: 'Blocks/Trust/TestimonialsGrid',
  component: TestimonialsGrid,
}
export default meta

type Story = StoryObj<typeof TestimonialsGrid>

export const Default: Story = {
  args: {
    disclaimer: 'Individual results may vary. Testimonials are not necessarily representative of all users.',
    testimonials: [
      {
        quote: 'Working with this team transformed our SEO from an afterthought to our primary lead source. Organic pipeline grew over the course of the engagement.',
        author: 'Sarah Chen',
        role: 'VP Marketing',
        company: 'Acme SaaS',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96',
        avatarAlt: 'Sarah Chen headshot',
      },
      {
        quote: 'The content strategy they built for us established genuine topical authority. Our domain rating improved significantly and we started ranking for terms we thought were out of reach.',
        author: 'Marcus Williams',
        role: 'Head of Growth',
        company: 'Construct Labs',
      },
      {
        quote: 'They fixed technical debt we had been ignoring for years in the first 30 days. The speed improvements alone led to measurable improvements in conversion rate.',
        author: 'Priya Nair',
        role: 'Director of Digital',
        company: 'Meridian Health',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96',
        avatarAlt: 'Priya Nair headshot',
      },
    ],
  },
}
