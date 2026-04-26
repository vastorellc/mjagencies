import type { Meta, StoryObj } from '@storybook/react'
import { TestimonialsSlider } from './index.js'

const meta: Meta<typeof TestimonialsSlider> = {
  title: 'Blocks/Trust/TestimonialsSlider',
  component: TestimonialsSlider,
}
export default meta

type Story = StoryObj<typeof TestimonialsSlider>

export const Default: Story = {
  args: {
    disclaimer: 'Individual results may vary. Testimonials are not necessarily representative of all users.',
    testimonials: [
      {
        quote: 'Within six months, our organic revenue became the single largest channel in our business — surpassing paid for the first time in five years.',
        author: 'James Okafor',
        role: 'CEO',
        company: 'Fulcrum Analytics',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96',
        avatarAlt: 'James Okafor headshot',
      },
      {
        quote: 'The team understood our niche immediately and delivered keyword strategies that actually mapped to how our buyers search. Pipeline quality improved noticeably.',
        author: 'Linda Tran',
        role: 'CMO',
        company: 'Apex Logistics Tech',
      },
      {
        quote: 'We had tried two agencies before. This was the first time we saw a consistent, compounding return on content investment.',
        author: 'Raj Patel',
        role: 'Founder',
        company: 'BuildBridge',
        avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=96',
        avatarAlt: 'Raj Patel headshot',
      },
    ],
  },
}
