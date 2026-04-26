import type { Meta, StoryObj } from '@storybook/react'
import { TeamGrid } from './index.js'

const meta: Meta<typeof TeamGrid> = {
  title: 'Blocks/Trust/TeamGrid',
  component: TeamGrid,
}
export default meta

type Story = StoryObj<typeof TeamGrid>

export const Default: Story = {
  args: {
    members: [
      {
        name: 'Elena Vasquez',
        role: 'Managing Director',
        bio: '15 years building content programs for B2B technology companies. Former Head of SEO at two exits.',
        imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240',
        imageAlt: 'Elena Vasquez headshot',
        linkedIn: 'https://linkedin.com',
      },
      {
        name: 'Daniel Kim',
        role: 'Head of Paid Media',
        bio: 'Managed $50M+ in annual ad spend across SaaS, fintech, and logistics verticals.',
        imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240',
        imageAlt: 'Daniel Kim headshot',
        linkedIn: 'https://linkedin.com',
      },
      {
        name: 'Amara Osei',
        role: 'Technical SEO Lead',
        bio: 'Core Web Vitals specialist and structured data expert. Speaks at MozCon annually.',
        imageUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=240',
        imageAlt: 'Amara Osei headshot',
      },
      {
        name: 'Tom Eriksson',
        role: 'Content Strategy Director',
        bio: 'Former journalist turned content strategist. Builds editorial programs that earn links and convert readers.',
      },
    ],
  },
}
